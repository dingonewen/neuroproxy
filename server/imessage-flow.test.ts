import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { createApp } from './app.ts';
import { Store } from './store.ts';
import { PhotonSender } from './photon.ts';
import { labelRealSms } from '../shared/sms.ts';
import { parsePhotonMessage } from './photon-webhook.ts';

const project='pho_prj_00000000000000000000000001',space='pho_spc_00000000000000000000000001',agent='pho_usr_00000000000000000000000001',human='pho_usr_00000000000000000000000002',incoming='pho_msg_00000000000000000000000001',outgoing='pho_msg_00000000000000000000000002';
const secret='whsec_'+Buffer.alloc(32,7).toString('base64');
test('group or incomplete iMessage snapshots do not become sendable conversations',()=>{
 const event={id:'e',type:'message.received',data:{projectId:project,object:{id:incoming,projectId:project,platform:'imessage',status:'received',space:{id:space,platform:'imessage',kind:'group'},sentBy:{id:human,kind:'human',platform:'imessage',handle:'+14155550123'},receivedBy:{id:agent,kind:'agent',platform:'imessage',handle:'+14155550124'},content:{type:'text',text:'ping'}}}};
 assert.equal(parsePhotonMessage(event,project)?.imessage,undefined);
 event.data.object.space.kind='direct';event.data.object.sentBy.handle='';assert.equal(parsePhotonMessage(event,project)?.imessage,undefined);
});
test('signed inbound iMessage enables only an explicitly approved reply and tracks a response',async()=>{
 let sends=0;let payload:Record<string,unknown>|undefined;
 const mock:typeof fetch=async (_url,request)=>{sends++;payload=JSON.parse(String(request?.body));return Response.json({id:outgoing,projectId:project,space:{id:space},status:'dispatched'},{status:202});};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'pho_sk_test',projectId:project},mock));
 try {
  const event={id:'evt-test',type:'message.received',data:{projectId:project,object:{id:incoming,projectId:project,platform:'imessage',status:'received',space:{id:space,platform:'imessage',kind:'direct'},sentBy:{id:human,kind:'human',platform:'imessage',handle:'+14155550123'},receivedBy:{id:agent,kind:'agent',platform:'imessage',handle:'+14155550124'},content:{type:'text',text:'ping'}}}};
  const body=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000)),delivery='test-delivery';const signature=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${delivery}.${timestamp}.`).update(body).digest('base64');
  assert.equal((await app.inject({method:'POST',url:'/api/webhooks/photon',headers:{'content-type':'application/json','webhook-id':delivery,'webhook-timestamp':timestamp,'webhook-signature':`v1,${signature}`},payload:body})).statusCode,204);
  const sessions=(await app.inject({method:'GET',url:'/api/imessage-conversations'})).json().conversations;assert.equal(sessions.length,1);
  const draft=store.create('Test','Me','Check','Hello');bindTestContact(store,draft);const url=`/api/drafts/${draft}/approve-photon-imessage`;const label='From NeuroProxy';const approved={nodeId:sessions[0].nodeId,approvedHandle:'+14155550123',approvedBody:labelRealSms('Hello',label),consent:true,label};
  assert.equal((await app.inject({method:'POST',url,payload:{...approved,consent:false}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url,payload:{...approved,approvedHandle:'+14155559999'}})).statusCode,400);
  const alternate=store.createContact('Me','+14155550125');const personId=String(store.graph().drafts.find(d=>d.id===draft)?.person_id);store.bindContact(personId,alternate.id);
  assert.equal((await app.inject({method:'POST',url,payload:approved})).statusCode,400);assert.equal(sends,0);bindTestContact(store,draft);
  assert.equal((await app.inject({method:'POST',url,payload:{...approved,label:'From an assistant'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url,payload:{...approved,approvedBody:'Hello'}})).statusCode,400);assert.equal(sends,0);
  const sent=await app.inject({method:'POST',url,payload:approved});assert.equal(sent.statusCode,200);assert.equal(sent.json().status,'waiting_for_reply');assert.equal(sends,1);
  assert.equal(payload?.parentMessageId,incoming);assert.equal((payload?.content as {text:string}).text,labelRealSms('Hello',label));assert.equal(store.graph().drafts.find(d=>d.id===draft)?.message_label,label);
  assert.equal((await app.inject({method:'POST',url,payload:approved})).statusCode,400);assert.equal(sends,1);
  store.receivePhoton({eventId:'reply',messageId:'reply',spaceId:space,senderId:human,recipientId:agent,parentMessageId:null,createdAt:new Date(Date.now()+1000).toISOString(),body:'Hi back'});
  assert.equal(store.graph().drafts.find(d=>d.id===draft)?.state,'possible_reply');const reply=store.graph().nodes.find(n=>n.label==='Hi back')!;store.reviewPossibleReply(String(reply.id),true);
  assert.equal(store.graph().drafts.find(d=>d.id===draft)?.state,'reply_received');
 }finally{await app.close();store.close();}
});
