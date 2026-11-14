import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Store } from './store.ts';
import { createApp } from './app.ts';
import { PhotonSender } from './photon.ts';
import { labelRealSms } from '../shared/sms.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('same-name contacts require explicit binding and recipient must match before any send',async()=>{
 let calls=0;const fake:typeof fetch=async()=>{calls++;throw Error('must not call');};
 const store=new Store(':memory:');const app=createApp(store,undefined,undefined,new PhotonSender({apiKey:'pho_sk_test',projectId:'pho_prj_00000000000000000000000001',smsNumber:'+14155550199'},fake));
 try {
  const one=store.createContact('Alice','+14155550123');const two=store.createContact('Alice','+14155550124');assert.notEqual(one.id,two.id);
  const id=store.create('Project','Alice','Ask','Hi');let draft=store.graph().drafts[0];const url=`/api/drafts/${id}/approve-photon-phone`;
  const request=(recipientPhone:string)=>app.inject({method:'POST',url,payload:{recipientPhone,approvedBody:labelRealSms('Hi'),consent:true}});
  assert.equal((await request('+14155550123')).statusCode,400);assert.equal(calls,0);
  assert.equal((await app.inject({method:'PUT',url:`/api/people/${draft.person_id}/contact`,payload:{contactId:two.id}})).statusCode,200);
  draft=store.graph().drafts[0];assert.equal(draft.contact_id,two.id);assert.equal(draft.contact_handle,'+14155550124');
  assert.equal((await request('+14155550123')).statusCode,400);assert.equal(calls,0);assert.equal(store.graph().drafts[0].state,'pending_approval');
  assert.equal((await app.inject({method:'DELETE',url:`/api/contacts/${two.id}`})).statusCode,200);assert.equal(store.graph().drafts[0].contact_id,null);
 }finally{await app.close();store.close();}
});

test('simulated delegation remains available without a contact and contact fields are validated',()=>{
 const store=new Store(':memory:');try{
  assert.throws(()=>store.createContact('Alice','415-555-0123'),/E.164/);assert.throws(()=>store.createContact('','+14155550123'),/name/);
  assert.ok(store.createContact('Alice','alice@example.com').id);
  const id=store.create('Topic','Alice','Ask','Hi');store.transition(id,'waiting_for_reply');assert.equal(store.graph().drafts[0].state,'waiting_for_reply');
 }finally{store.close();}
});

test('contact binding persists after restart and deleting a graph keeps the reusable contact',()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuroproxy-contact-'));const path=join(dir,'test.db');let store=new Store(path);
 try{
  const contact=store.createContact('Alice','+14155550123');const created=store.createReviewed({topic:'Test',people:['Alice'],tasks:[],uncertainties:[],draft:null});
  const person=store.graph().nodes.find(n=>n.kind==='person')!;store.bindContact(String(person.id),contact.id);store.close();store=new Store(path);
  assert.equal(store.graph().nodes.find(n=>n.id===person.id)?.contact_id,contact.id);store.deleteConversation(created.topicId);
  assert.equal(store.graph().nodes.length,0);assert.equal(store.contacts().length,1);store.deleteContact(contact.id);assert.equal(store.contacts().length,0);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
