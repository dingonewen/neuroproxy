import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';
import { Store } from './store.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('voice notes process asynchronously, require review, and can be deleted',async()=>{
 const store=new Store(':memory:');
 let finish!:(s:string)=>void;
 const transcript=new Promise<string>(resolve=>{finish=resolve;});
 const extraction={topic:'Project',people:['Alex'],tasks:[{description:'Ask about deadline',assignee:'Alex'}],uncertainties:[],relationship:null,draft:null};
 const app=createApp(store,async()=>extraction,undefined,undefined,undefined,undefined,async()=>transcript);
 try {
  const res=await app.inject({method:'POST',url:'/api/voice-notes',headers:{'content-type':'audio/mp4'},payload:Buffer.from('fake audio')});
  assert.equal(res.statusCode,202);const {id}=res.json();
  assert.equal((await app.inject({method:'GET',url:`/api/voice-notes/${id}`})).json().status,'processing');
  assert.equal((await app.inject({method:'POST',url:'/api/voice-notes',headers:{'content-type':'audio/webm'},payload:Buffer.from('second')})).statusCode,429);
  finish('Ask Alex about the deadline.');
  for(let i=0;i<30&&store.voiceNote(id)?.status==='processing';i++) await new Promise(resolve=>setImmediate(resolve));
  const ready=(await app.inject({method:'GET',url:`/api/voice-notes/${id}`})).json();
  assert.equal(ready.status,'ready');assert.equal(ready.transcript,'Ask Alex about the deadline.');assert.equal(ready.analysis.topic,'Project');
  assert.equal(store.graph().nodes.length,0);
  await app.inject({method:'DELETE',url:`/api/voice-notes/${id}`});
  assert.equal((await app.inject({method:'GET',url:`/api/voice-notes/${id}`})).statusCode,404);
 } finally {finish('');await app.close();store.close();}
});

test('a restarted server marks an unfinished voice note as interrupted',()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuroproxy-note-'));const path=join(dir,'test.db');
 try {const first=new Store(path);const id=first.createVoiceNote();first.close();const second=new Store(path);try{assert.equal(second.voiceNote(id)?.status,'interrupted');}finally{second.close();}}
 finally {rmSync(dir,{recursive:true,force:true});}
});
