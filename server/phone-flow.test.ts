import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { Store } from './store.ts';
import { createApp } from './app.ts';
import { PhotonSender } from './photon.ts';
import { labelRealSms } from '../shared/sms.ts';
const project='pho_prj_00000000000000000000000001';
const sender='pho_usr_00000000000000000000000001';
const recipient='pho_usr_00000000000000000000000002';
const space='pho_spc_00000000000000000000000001';
const message='pho_msg_00000000000000000000000001';
// Synthetic signing key, used only by mock tests.
const testSecret='whsec_'+Buffer.alloc(32,7).toString('base64');
const extracted={topic:'Project',people:['Alex'],tasks:[{description:'Confirm deadline',assignee:'Alex'}],uncertainties:[{question:'When?',people:['Alex']}],draft:{recipient:'Alex',taskIndex:0,body:'When?'}};
const phone='+14155550123'; const ownPhone='+14155550124';
function setup(options:{failSetup?:boolean;failSend?:boolean}={}) {
 const calls:{path:string; key:string; body:Record<string,unknown>}[]=[]; let sentCount=0;
 const mock:typeof fetch=async (url,request) => {
  const path=String(url).split(`/projects/${project}`)[1];
  const body=JSON.parse(String(request?.body)); const key=(request?.headers as Record<string,string>)['idempotency-key']; calls.push({path,key,body});
  if(options.failSetup && path==='/users') throw Error('offline');
  if(path==='/users') {const isOwn=body.handle===ownPhone; return Response.json({id:isOwn?sender:recipient,kind:isOwn?'agent':'human',platform:'sms',handle:body.handle,projectId:project});}
  if(path==='/spaces') return Response.json({id:space,projectId:project,platform:'sms',kind:'direct',participantIds:[sender,recipient]});
  if(path==='/messages') {if(options.failSend) throw Error('timeout'); sentCount++; return Response.json({id:sentCount===1?message:'pho_msg_00000000000000000000000002',projectId:project,space:{id:space},status:'dispatched'},{status:202});}
  throw Error('unexpected');
 };
 const store=new Store(':memory:');const photon=new PhotonSender({apiKey:'pho_sk_test',projectId:project,smsNumber:ownPhone},mock);
 return {store,app:createApp(store,async()=>extracted,{secret:testSecret,projectId:project},photon),calls};
}
const payload={recipientPhone:phone,approvedBody:labelRealSms('When?'),consent:true};
test('phone-based approval prepares users and space, sends once, and reviews inferred replies',async()=>{
 const {store,app,calls}=setup(); const id=store.create('Project','Alex','Deadline','When?');bindTestContact(store,id); const url=`/api/drafts/${id}/approve-photon-phone`;
 try {
  assert.equal((await app.inject({method:'POST',url,payload:{...payload,consent:false}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url,payload:{...payload,approvedBody:'Wrong'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url,payload:{...payload,approvedBody:'When?'}})).statusCode,400); assert.equal(calls.length,0);
  const sent=await app.inject({method:'POST',url,payload});assert.equal(sent.statusCode,200);assert.equal(sent.json().status,'waiting_for_reply');
  assert.deepEqual(calls.map(c=>c.path),['/users','/users','/spaces','/messages']); assert.equal((calls.find(c=>c.path==='/messages')?.body.content as {text:string}).text,labelRealSms('When?')); assert.equal(store.graph().drafts[0].body,labelRealSms('When?')); assert.equal(new Set(calls.map(c=>c.key)).size,4);
  assert.equal((await app.inject({method:'POST',url,payload})).statusCode,400);assert.equal(calls.filter(c=>c.path==='/messages').length,1);
  store.receivePhoton({eventId:'event',messageId:'reply',spaceId:space,senderId:recipient,recipientId:sender,parentMessageId:null,createdAt:new Date(Date.now()+1000).toISOString(),body:'Saturday'});
  let graph=store.graph();const reply=graph.nodes.find(n=>n.label==='Saturday');assert.equal(reply?.status,'possible_reply');assert.equal(graph.drafts[0].state,'possible_reply');
  const reviewed=await app.inject({method:'POST',url:`/api/photon-inbox/${reply?.id}/review`,payload:{confirm:true}});assert.equal(reviewed.statusCode,200);
  graph=store.graph();assert.equal(graph.drafts[0].state,'reply_received');assert.equal(graph.nodes.find(n=>n.id===reply?.id)?.status,'received');
 } finally {await app.close();store.close();}
});
test('setup failure never sends, can retry only after approval; unknown outcome cannot retry',async()=>{
 for(const mode of ['setup','send'] as const){const {store,app,calls}=setup(mode==='setup'?{failSetup:true}:{failSend:true});const id=store.create('Project','Alex','Deadline','When?');bindTestContact(store,id);const url=`/api/drafts/${id}/approve-photon-phone`;
  try {const res=await app.inject({method:'POST',url,payload}); assert.equal(res.statusCode,mode==='setup'?502:200); assert.equal(store.graph().drafts[0].state,mode==='setup'?'preparation_failed':'send_unknown'); assert.equal(calls.filter(c=>c.path==='/messages').length,mode==='setup'?0:1);
   if(mode==='send') assert.equal((await app.inject({method:'POST',url,payload})).statusCode,400);
   else assert.equal((await app.inject({method:'POST',url:`/api/drafts/${id}/cancel`})).statusCode,200);
  }finally {await app.close();store.close();}
 }
});

test('simultaneous approvals cannot send twice',async()=>{
 const {store,app,calls}=setup();const id=store.create('Project','Alex','Deadline','When?');bindTestContact(store,id); const url=`/api/drafts/${id}/approve-photon-phone`;
 try {const results=await Promise.all([app.inject({method:'POST',url,payload}),app.inject({method:'POST',url,payload})]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,400]);assert.equal(calls.filter(c=>c.path==='/messages').length,1);} finally {await app.close();store.close();}
});

test('a custom signature stays unchanged when preparation fails and is retried',()=>{
 const store=new Store(':memory:');try {const id=store.create('Project','Alex','Check','Hello');bindTestContact(store,id);const label='via NeuroProxy';const body=labelRealSms('Hello',label);
  store.preparePhone(id,phone,body,label);store.failPreparation(id);
  assert.equal(store.graph().drafts[0].message_label,label);
  assert.throws(()=>store.preparePhone(id,phone,labelRealSms(body,'Another NeuroProxy label'),'Another NeuroProxy label'),/previously approved label/);
  const retry=store.preparePhone(id,phone,body,label);assert.equal(retry.body,body);
 }finally{store.close();}
});

test('ambiguous inbound messages remain unlinked and can only be attached to a matching delegation',async()=>{
 const {store,app}=setup(); const one=store.create('Project','Alex','First','When?');const two=store.create('Project','Alex','Second','When?');bindTestContact(store,one);bindTestContact(store,two);
 try {
  for(const id of [one,two]) assert.equal((await app.inject({method:'POST',url:`/api/drafts/${id}/approve-photon-phone`,payload})).statusCode,200);
  store.receivePhoton({eventId:'ambiguous',messageId:'r1',spaceId:space,senderId:recipient,recipientId:sender,parentMessageId:null,createdAt:new Date(Date.now()+1000).toISOString(),body:'Saturday'});
  let graph=store.graph();const node=graph.nodes.find(n=>n.label==='Saturday'); assert.equal(node?.status,'unlinked');assert.equal(store.photonCandidates(String(node?.id)).length,2);
  assert.equal((await app.inject({method:'POST',url:`/api/photon-inbox/${node?.id}/link`,payload:{draftId:'wrong'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/photon-inbox/${node?.id}/link`,payload:{draftId:one}})).statusCode,200);
  graph=store.graph();assert.equal(graph.drafts.find(d=>d.id===one)?.state,'reply_received');assert.equal(graph.drafts.find(d=>d.id===two)?.state,'waiting_for_reply');
  store.receivePhoton({eventId:'old',messageId:'r2',spaceId:space,senderId:recipient,recipientId:sender,parentMessageId:null,createdAt:'2020-01-01T00:00:00.000Z',body:'Old message'});
  assert.equal(store.graph().nodes.find(n=>n.label==='Old message')?.status,'unlinked');
 } finally {await app.close();store.close();}
});

test('conversation to approved SMS to signed webhook and confirmed graph update',async()=>{
 const {store,app}=setup();
 try {
  const analysis=await app.inject({method:'POST',url:'/api/extract',payload:{text:'Please ask Alex when.'}});assert.equal(analysis.statusCode,200);assert.equal(store.graph().nodes.length,0);
  const saved=await app.inject({method:'POST',url:'/api/reviewed-context',payload:analysis.json()});assert.equal(saved.statusCode,200);const id=saved.json().draftId;bindTestContact(store,id);
  const sent=await app.inject({method:'POST',url:`/api/drafts/${id}/approve-photon-phone`,payload});assert.equal(sent.statusCode,200);
  const incoming={id:'evt-synthetic',type:'message.received',data:{projectId:project,object:{id:'reply-synthetic',projectId:project,platform:'sms',status:'received',space:{id:space},sentBy:{id:recipient,kind:'human'},receivedBy:{id:sender,kind:'agent'},createdAt:new Date(Date.now()+1000).toISOString(),content:{type:'text',text:'Saturday'}}}};
  const body=JSON.stringify(incoming);const delivery='delivery-synthetic';const timestamp=String(Math.floor(Date.now()/1000));const signature=createHmac('sha256',Buffer.from(testSecret.slice(6),'base64')).update(`${delivery}.${timestamp}.`).update(body).digest('base64');
  const headers={'content-type':'application/json','webhook-id':delivery,'webhook-timestamp':timestamp,'webhook-signature':`v1,${signature}`};
  assert.equal((await app.inject({method:'POST',url:'/api/webhooks/photon',headers,payload:body})).statusCode,204);
  assert.equal((await app.inject({method:'POST',url:'/api/webhooks/photon',headers,payload:body})).statusCode,204);
  let graph=store.graph();const reply=graph.nodes.find(n=>n.label==='Saturday');assert.equal(graph.nodes.filter(n=>n.label==='Saturday').length,1);assert.equal(reply?.status,'possible_reply');
  assert.equal((await app.inject({method:'POST',url:`/api/photon-inbox/${reply?.id}/review`,payload:{confirm:false}})).statusCode,200);
  graph=store.graph();assert.equal(graph.drafts.find(d=>d.id===id)?.state,'waiting_for_reply');assert.equal(graph.nodes.find(n=>n.id===reply?.id)?.status,'unlinked');
  assert.equal((await app.inject({method:'POST',url:`/api/photon-inbox/${reply?.id}/link`,payload:{draftId:id}})).statusCode,200);
  assert.equal(store.graph().drafts.find(d=>d.id===id)?.state,'reply_received');
 } finally {await app.close();store.close();}
});

test('an empty signature is supported and remains empty on retry',()=>{
 const store=new Store(':memory:');try {
  const id=store.create('Project','Alex','Check','Hello');bindTestContact(store,id);
  assert.equal(labelRealSms('Hello',''),'Hello');assert.equal(labelRealSms('Hello','— A friend'),'Hello\n\n— A friend');
  store.preparePhone(id,phone,'Hello','');store.failPreparation(id);
  assert.equal(store.graph().drafts[0].message_label,'');
  assert.throws(()=>store.preparePhone(id,phone,labelRealSms('Hello','Changed'),'Changed'),/previously approved label/);
  assert.equal(store.preparePhone(id,phone,'Hello','').body,'Hello');
 }finally{store.close();}
});
