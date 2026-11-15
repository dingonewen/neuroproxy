import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.ts';
import { Store } from './store.ts';

test('reply analysis persists, survives restart, and becomes a draft without repeating the model call',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuroproxy-reply-'));const path=join(dir,'state.db');let store=new Store(path);let calls=0;
 const relationship={facts:['Alex replied'],feelings:[],needs:[],interpretations:[],coreQuestion:'When?',nextAction:'Ask directly'};
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 let app=createApp(store,undefined,undefined,undefined,undefined,async()=>{calls++;await gate;return {relationship,suggestedReply:'When can we talk?'};});
 try {
  const id=store.create('Project','Alex','Ask','Hi');store.transition(id,'waiting_for_reply');store.reply(id,'Busy','simulated');
  const reply=store.graph().nodes.find(n=>n.kind==='reply')!;const base=`/api/replies/${reply.id}`;
  const first=app.inject({method:'POST',url:`${base}/analyze`});const second=app.inject({method:'POST',url:`${base}/analyze`});
  await new Promise(resolve=>setImmediate(resolve));release();
  const [a,b]=await Promise.all([first,second]);assert.equal(a.statusCode,200);assert.deepEqual(a.json(),b.json());assert.equal(calls,1);
  const edited={...a.json(),suggestedReply:'Could we talk tomorrow?',relationship:{...relationship,facts:['Alex is busy']}};
  assert.equal((await app.inject({method:'PUT',url:`${base}/progress`,payload:edited})).statusCode,200);
  await app.close();store.close();store=new Store(path);app=createApp(store,undefined,undefined,undefined,undefined,async()=>{calls++;throw Error('unexpected model call');});
  const restored=(await app.inject({method:'GET',url:`${base}/progress`})).json().progress;
  assert.equal(restored.suggestedReply,'Could we talk tomorrow?');assert.equal(restored.relationship.facts[0],'Alex is busy');
  assert.equal((await app.inject({method:'POST',url:`${base}/analyze`})).statusCode,200);assert.equal(calls,1);
  assert.equal((await app.inject({method:'POST',url:`${base}/insights`,payload:restored.relationship})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:`${base}/insights`,payload:restored.relationship})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url:`${base}/progress`,payload:edited})).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:`${base}/progress`})).json().progress.stage,'suggested');
  assert.equal((await app.inject({method:'POST',url:`${base}/draft`,payload:{body:restored.suggestedReply,action:restored.action}})).statusCode,200);
  assert.equal((await app.inject({method:'GET',url:`${base}/progress`})).json().progress,null);
  assert.equal((await app.inject({method:'PUT',url:`${base}/progress`,payload:{...edited,stage:'suggested'}})).statusCode,400);
 } finally {release();await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
