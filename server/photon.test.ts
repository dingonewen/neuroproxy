import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { labelRealSms } from '../shared/sms.ts';
import { strict as assert } from 'node:assert';
import { checkPhoton } from './photon.ts';
const config={apiKey:'pho_sk_test',projectId:'pho_prj_00000000000000000000000001'};
test('Photon check uses a read-only beta endpoint and does not expose response content', async () => {
 let called=false;
 const fake: typeof fetch=async (url, options) => { called=true; assert.equal(String(url),'https://api.photon.codes/v1/projects/pho_prj_00000000000000000000000001/spaces?pageSize=1'); assert.equal(options?.method,'GET'); assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer pho_sk_test'); assert.equal(options?.redirect,'error'); return new Response(JSON.stringify({items:[{sensitive:'not returned'}]}),{status:200}); };
 assert.deepEqual(await checkPhoton(config,fake),{ok:true}); assert.equal(called,true);
});
test('Photon check handles missing credentials, denial, invalid payload and network errors', async () => {
 assert.deepEqual(await checkPhoton({}, async()=>{throw Error('must not call');}),{ok:false,reason:'missing_config'});
 assert.deepEqual(await checkPhoton({...config,projectId:'../unsafe'}, async()=>{throw Error('must not call');}),{ok:false,reason:'invalid_config'});
 for (const status of [401,403,500]) { const result=await checkPhoton(config,async()=>new Response('',{status})); assert.equal(result.ok,false); if (!result.ok) assert.equal(result.reason,status===401?'unauthorized':status===403?'forbidden':'http_error'); }
 assert.deepEqual(await checkPhoton(config,async()=>new Response('{}')),{ok:false,reason:'invalid_response'});
 assert.deepEqual(await checkPhoton(config,async()=>{throw Error('secret');}),{ok:false,reason:'network_error'});
});

import { PhotonSender } from './photon.ts';
import { Store } from './store.ts';
import { createApp } from './app.ts';
const project='pho_prj_00000000000000000000000001';
const space='pho_spc_00000000000000000000000001';
const sender='pho_usr_00000000000000000000000001';
const recipient='pho_usr_00000000000000000000000002';
const message='pho_msg_00000000000000000000000001';
const target={spaceId:space,senderId:sender,recipientId:recipient,recipientPhone:'+14155550123'};
function fakeSender(sendResult:'success'|'unknown'='success') {
 let sends=0;
 const mock:typeof fetch=async (input,options) => {
  const url=String(input);
  if (options?.method==='POST') { sends++; assert.ok((options.headers as Record<string,string>)['idempotency-key']); assert.deepEqual(JSON.parse(String(options.body)).content,{type:'text',format:'plain',text:labelRealSms('When?')}); if(sendResult==='unknown') throw Error('timeout'); return Response.json({id:message,projectId:project,space:{id:space},status:'dispatched'},{status:202}); }
  if(url.endsWith(`/spaces/${space}`)) return Response.json({id:space,projectId:project,platform:'sms',kind:'direct',participantIds:[sender,recipient]});
  if(url.endsWith(`/users/${sender}`)) return Response.json({id:sender,projectId:project,platform:'sms',kind:'agent'});
  if(url.endsWith(`/users/${recipient}`)) return Response.json({id:recipient,projectId:project,platform:'sms',kind:'human',handle:'+14155550123'});
  throw Error('unexpected request');
 };
 return {client:new PhotonSender({apiKey:'pho_sk_test',projectId:project},mock),sends:()=>sends};
}
test('real send requires explicit consent, exact draft and a verified recipient; duplicate approval is rejected',async()=>{
 const store=new Store(':memory:');const fake=fakeSender();const app=createApp(store,undefined,undefined,fake.client);const id=store.create('Project','Alex','Deadline','When?');bindTestContact(store,id);
 try {
  const call=(payload:object)=>app.inject({method:'POST',url:`/api/drafts/${id}/approve-photon`,payload});
  assert.equal((await call({...target,approvedBody:labelRealSms('When?'),consent:false})).statusCode,400);
  assert.equal((await call({...target,recipientPhone:'+14155550124',approvedBody:labelRealSms('When?'),consent:true})).statusCode,400);
  assert.equal((await call({...target,approvedBody:'Different',consent:true})).statusCode,400);
  assert.equal(fake.sends(),0);
  const sent=await call({...target,approvedBody:labelRealSms('When?'),consent:true});assert.equal(sent.statusCode,200);assert.equal(sent.json().status,'waiting_for_reply');
  assert.equal((await call({...target,approvedBody:labelRealSms('When?'),consent:true})).statusCode,400);assert.equal(fake.sends(),1);
  assert.equal((await app.inject({method:'POST',url:`/api/drafts/${id}/simulate-reply`,payload:{body:'Fake'}})).statusCode,400);
  store.receivePhoton({eventId:'event-unlinked',messageId:'reply-unlinked',spaceId:space,senderId:recipient,recipientId:sender,parentMessageId:null,body:'Hello'});
  assert.equal(store.graph().drafts[0].state,'waiting_for_reply');
  const linked=store.receivePhoton({eventId:'event',messageId:'reply',spaceId:space,senderId:recipient,recipientId:sender,parentMessageId:message,body:'Saturday'});
  assert.equal(linked,true);const graph=store.graph();assert.equal(graph.drafts[0].state,'reply_received');assert.equal(graph.nodes.find(n=>n.label==='Saturday')?.status,'received');
 } finally {await app.close();store.close();}
});
test('unknown send outcome is not automatically retried',async()=>{
 const store=new Store(':memory:');const fake=fakeSender('unknown');const app=createApp(store,undefined,undefined,fake.client);const id=store.create('Project','Alex','Deadline','When?');bindTestContact(store,id);
 try {const payload={...target,approvedBody:labelRealSms('When?'),consent:true};const call=()=>app.inject({method:'POST',url:`/api/drafts/${id}/approve-photon`,payload});const result=await call();assert.equal(result.json().status,'send_unknown');assert.equal((await call()).statusCode,400);assert.equal(fake.sends(),1);} finally {await app.close();store.close();}
});
