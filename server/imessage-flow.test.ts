import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { createApp } from './app.ts';
import { Store } from './store.ts';
import { PhotonSender } from './photon.ts';
import { formatImessage, labelRealSms } from '../shared/sms.ts';
import { parsePhotonMessage } from './photon-webhook.ts';

const project='pho_prj_00000000000000000000000001',space='pho_spc_00000000000000000000000001',agent='pho_usr_00000000000000000000000001',human='pho_usr_00000000000000000000000002',incoming='pho_msg_00000000000000000000000001',outgoing='pho_msg_00000000000000000000000002';
const secret='whsec_'+Buffer.alloc(32,7).toString('base64');
test('missing Photon credentials do not reserve or lock an approved iMessage draft',async()=>{
 let requests=0;
 const store=new Store(':memory:');
 const app=createApp(store,undefined,undefined,new PhotonSender({projectId:project},async()=>{requests++;throw Error('must not request');}));
 try {
  store.receivePhoton({eventId:'initial',messageId:incoming,spaceId:space,senderId:human,recipientId:agent,parentMessageId:null,body:'Start',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}});
  const draft=store.create('Project','Alex','Ask','Hello');bindTestContact(store,draft);
  const response=await app.inject({method:'POST',url:`/api/drafts/${draft}/approve-photon-imessage`,payload:{nodeId:store.imessageSessions()[0].nodeId,approvedHandle:'+14155550123',approvedBody:'Hello',consent:true,label:'',introduce:false}});
  assert.equal(response.statusCode,400);assert.match(response.json().error,/credentials/);assert.equal(requests,0);
  assert.equal(store.graph().drafts.find(d=>d.id===draft)?.state,'pending_approval');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM photon_dispatches').get()?.count,0);
 } finally {await app.close();store.close();}
});
test('iMessage introduction matches the approved message and cannot be changed silently',()=>{
 const store=new Store(':memory:');
 try {
  const first=store.create('Topic','Alex','Ask','Hello');bindTestContact(store,first);
  const full=formatImessage('Hello',true);
  assert.throws(()=>store.reservePhoton(first,space,agent,human,'Hello','+14155550123','',true),/approved text/);
  assert.throws(()=>store.reservePhoton(first,space,agent,human,full,'+14155550123','signature',true),/introduction/);
  assert.equal(store.reservePhoton(first,space,agent,human,full,'+14155550123','',true).body,full);
  const second=store.create('Other','Alex','Ask','Hello');bindTestContact(store,second);
  assert.equal(store.reservePhoton(second,space,agent,human,'Hello','+14155550123','',false).body,'Hello');
 }finally{store.close();}
});
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

test('iMessage follow-up reuses the latest session and requires approval for each turn',async()=>{
 let sends=0;const bodies:Record<string,unknown>[]=[];
 const sentIds=['pho_msg_00000000000000000000000002','pho_msg_00000000000000000000000003'];
 const mock:typeof fetch=async (_url,request)=>{bodies.push(JSON.parse(String(request?.body)));return Response.json({id:sentIds[sends++],projectId:project,space:{id:space},status:'accepted'},{status:202});};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'pho_sk_test',projectId:project},mock));
 try{
  store.receivePhoton({eventId:'initial',messageId:incoming,spaceId:space,senderId:human,recipientId:agent,parentMessageId:null,body:'Start',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}});
  const draft=store.create('Project','Alex','Check in','How are you?');bindTestContact(store,draft);
  const firstSession=store.imessageSessions()[0];const send=(draftId:string,nodeId:unknown,body:string,consent:boolean)=>app.inject({method:'POST',url:`/api/drafts/${draftId}/approve-photon-imessage`,payload:{nodeId,approvedHandle:'+14155550123',approvedBody:labelRealSms(body,''),consent,label:''}});
  assert.equal((await send(draft,firstSession.nodeId,'How are you?',false)).statusCode,400);assert.equal(sends,0);
  assert.equal((await send(draft,firstSession.nodeId,'How are you?',true)).statusCode,200);assert.equal(sends,1);
  const replyId='pho_msg_00000000000000000000000004';
  store.receivePhoton({eventId:'next',messageId:replyId,spaceId:space,senderId:human,recipientId:agent,parentMessageId:sentIds[0],body:'Doing well',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}});
  const reply=store.graph().nodes.find(n=>n.kind==='reply'&&n.label==='Doing well')!;const sessions=store.imessageSessions();assert.equal(sessions.length,1);assert.equal(sessions[0].nodeId,reply.id);
  const created=await app.inject({method:'POST',url:`/api/replies/${reply.id}/draft`,payload:{body:'Glad to hear it.',action:'Respond'}});assert.equal(created.statusCode,200);const follow=created.json().id;
  assert.equal(store.graph().drafts.find(d=>d.id===follow)?.state,'pending_approval');assert.equal(sends,1);
  assert.equal((await send(follow,reply.id,'Glad to hear it.',false)).statusCode,400);assert.equal(sends,1);
  assert.equal((await send(follow,reply.id,'Glad to hear it.',true)).statusCode,200);assert.equal(sends,2);assert.equal(bodies[1].parentMessageId,replyId);
  assert.equal((await send(follow,reply.id,'Glad to hear it.',true)).statusCode,400);assert.equal(sends,2);
 }finally{await app.close();store.close();}
});

test('session list keeps the newest message per conversation before applying its limit',()=>{
 const store=new Store(':memory:');try{
  store.receivePhoton({eventId:'other',messageId:'other',spaceId:'other-space',senderId:human,recipientId:agent,parentMessageId:null,body:'Other',imessage:{humanHandle:'+14155550999',agentHandle:'+14155550124'}});
  for(let i=0;i<55;i++)store.receivePhoton({eventId:`event-${i}`,messageId:`message-${i}`,spaceId:space,senderId:human,recipientId:agent,parentMessageId:null,body:'Ping',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}});
  const sessions=store.imessageSessions();assert.equal(sessions.length,2);assert.ok(sessions.some(s=>s.humanHandle==='+14155550999'));
 }finally{store.close();}
});
