import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { createApp } from './app.ts';
import { Store } from './store.ts';
import { PhotonSender } from './photon.ts';
import { bindTestContact } from './test-contact.ts';

const project='pho_prj_00000000000000000000000001',space='pho_spc_00000000000000000000000001',agent='pho_usr_00000000000000000000000001',human='pho_usr_00000000000000000000000002';
const initial='pho_msg_00000000000000000000000001',firstSent='pho_msg_00000000000000000000000002',autoSent='pho_msg_00000000000000000000000003';
const secret='whsec_'+Buffer.alloc(32,7).toString('base64');
const relationship={facts:[],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:'Reply'};
function setup(store:Store) {
 store.receivePhoton({eventId:'initial',messageId:initial,spaceId:space,senderId:human,recipientId:agent,parentMessageId:null,body:'Hi',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}});
 const draft=store.create('Topic','Alex','Ask','Hello');bindTestContact(store,draft);
 store.reservePhoton(draft,space,agent,human,'Hello','+14155550123','',false);store.finishPhoton(draft,firstSent);
 const graph=store.graph();return {topicId:String(graph.nodes.find(n=>n.kind==='topic')!.id),personId:String(graph.drafts.find(d=>d.id===draft)!.person_id)};
}
function signedEvent(eventId:string,messageId:string,body:string,parentMessageId:string|null=null) {
 const timestamp=String(Math.floor(Date.now()/1000)),delivery=`delivery-${eventId}`;
 const event={id:eventId,type:'message.received',data:{projectId:project,object:{id:messageId,projectId:project,platform:'imessage',status:'received',createdAt:new Date(Date.now()+1000).toISOString(),parentMessageId,space:{id:space,platform:'imessage',kind:'direct'},sentBy:{id:human,kind:'human',platform:'imessage',handle:'+14155550123'},receivedBy:{id:agent,kind:'agent',platform:'imessage',handle:'+14155550124'},content:{type:'text',text:body}}}};
 const payload=JSON.stringify(event),sig=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${delivery}.${timestamp}.`).update(payload).digest('base64');
 return {method:'POST' as const,url:'/api/webhooks/photon',headers:{'content-type':'application/json','webhook-id':delivery,'webhook-timestamp':timestamp,'webhook-signature':`v1,${sig}`},payload};
}
async function waitFor(testCondition:()=>boolean){for(let i=0;i<100;i++){if(testCondition())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('AutoReply did not finish');}

test('authorized AutoReply sends once for a uniquely matched reply and stops on opt-out',async()=>{
 let sends=0,modelCalls=0;let preferences='';
 const request:typeof fetch=async(_url,init)=>{sends++;const body=JSON.parse(String(init?.body));assert.equal(body.content.text,'[NeuroProxy AutoReply]\nThanks for telling me.');return Response.json({id:autoSent,projectId:project,space:{id:space},status:'dispatched'},{status:202});};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async input=>{modelCalls++;preferences=input.stylePreferences??'';return {relationship,suggestedReply:'Thanks for telling me.'};});
 try {
  const {topicId,personId}=setup(store);const url=`/api/conversations/${topicId}/auto-reply`;
  assert.equal((await app.inject({method:'PUT',url,payload:{enabled:true,personId,preferences:'Be brief',consent:false}})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url,payload:{enabled:true,personId,preferences:'Be brief',consent:true}})).statusCode,200);
  const event=signedEvent('reply1','pho_msg_00000000000000000000000004','I can stop by Friday.');
  assert.equal((await app.inject(event)).statusCode,204);await waitFor(()=>store.autoReplySettings(topicId).lastStatus==='submitted');
  assert.equal(sends,1);assert.equal(modelCalls,1);assert.equal(preferences,'Be brief');assert.equal(store.autoReplySettings(topicId).enabled,true);
  const graph=store.graph();const auto=graph.drafts.find(d=>d.auto_generated===1);assert.equal(auto?.body,'[NeuroProxy AutoReply]\nThanks for telling me.');assert.equal(auto?.auto_reply_status,'submitted');assert.ok(auto?.photon_prepared_at);assert.equal(typeof auto?.auto_reply_received_at_ms,'number');
  assert.equal((await app.inject(event)).statusCode,204);assert.equal(sends,1);
  assert.equal((await app.inject(signedEvent('stop','pho_msg_00000000000000000000000005','Stop contacting me',autoSent))).statusCode,204);
  assert.equal(store.autoReplySettings(topicId).enabled,false);assert.equal(sends,1);assert.equal(modelCalls,1);
 }finally{await app.close();store.close();}
});

test('revoking and re-enabling authorization cancels an in-flight generated reply',async()=>{
 let release!:()=>void,started=false,sends=0;const gate=new Promise<void>(resolve=>{release=resolve;});
 const request:typeof fetch=async()=>{sends++;throw Error('must not send');};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async()=>{started=true;await gate;return {relationship,suggestedReply:'Hello again'};});
 try {
  const {topicId,personId}=setup(store);const url=`/api/conversations/${topicId}/auto-reply`;
  const enable=()=>app.inject({method:'PUT',url,payload:{enabled:true,personId,preferences:'',consent:true}});
  assert.equal((await enable()).statusCode,200);
  await app.inject(signedEvent('reply2','pho_msg_00000000000000000000000006','Hello',firstSent));await waitFor(()=>started);
  assert.equal((await app.inject({method:'PUT',url,payload:{enabled:false}})).statusCode,200);assert.equal((await enable()).statusCode,200);
  release();await waitFor(()=>store.autoReplySettings(topicId).lastStatus==='cancelled');assert.equal(sends,0);
 }finally{release();await app.close();store.close();}
});

test('enabling AutoReply never sends a reply to an earlier message or its redelivery',async()=>{
 let modelCalls=0,sends=0;const request:typeof fetch=async()=>{sends++;throw Error('must not send');};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async()=>{modelCalls++;return {relationship,suggestedReply:'Hello'};});
 try {
  const {topicId,personId}=setup(store);const event=signedEvent('before','pho_msg_00000000000000000000000007','Hello',firstSent);
  assert.equal((await app.inject(event)).statusCode,204);
  assert.equal((await app.inject({method:'PUT',url:`/api/conversations/${topicId}/auto-reply`,payload:{enabled:true,personId,preferences:'',consent:true}})).statusCode,200);
  assert.equal((await app.inject(event)).statusCode,204);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(modelCalls,0);assert.equal(sends,0);
 }finally{await app.close();store.close();}
});


test('an auto-reply that cannot fit its disclosure is held for review',async()=>{
 let sends=0;const request:typeof fetch=async()=>{sends++;throw Error('must not send');};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async()=>({relationship,suggestedReply:'x'.repeat(2000)}));
 try {
  const {topicId,personId}=setup(store);const url=`/api/conversations/${topicId}/auto-reply`;
  assert.equal((await app.inject({method:'PUT',url,payload:{enabled:true,personId,preferences:'',consent:true}})).statusCode,200);
  assert.equal((await app.inject(signedEvent('long','pho_msg_00000000000000000000000008','Hello',firstSent))).statusCode,204);
  await waitFor(()=>store.autoReplySettings(topicId).lastStatus==='needs_review');assert.equal(sends,0);
 }finally{await app.close();store.close();}
});

test('auto-reply retries a repeated previous message and sends only the revised response',async()=>{
 let calls=0,sends=0;const request:typeof fetch=async(_url,init)=>{sends++;assert.equal(JSON.parse(String(init?.body)).content.text,'[NeuroProxy AutoReply]\nI can meet on Saturday.');return Response.json({id:autoSent,projectId:project,space:{id:space},status:'dispatched'},{status:202});};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async input=>{calls++;assert.equal(input.outgoingMessage,'Hello');assert.equal(input.reply,'Can you meet Saturday?');assert.equal(input.avoidRepeatingPrevious,calls===2 ? true : undefined);return {relationship,suggestedReply:calls===1?'Hello!':'I can meet on Saturday.'};});
 try{const {topicId,personId}=setup(store);await app.inject({method:'PUT',url:`/api/conversations/${topicId}/auto-reply`,payload:{enabled:true,personId,preferences:'',consent:true}});await app.inject(signedEvent('repeat','pho_msg_00000000000000000000000009','Can you meet Saturday?',firstSent));await waitFor(()=>store.autoReplySettings(topicId).lastStatus==='submitted');assert.equal(calls,2);assert.equal(sends,1);}finally{await app.close();store.close();}
});

test('auto-reply sends nothing when both generated responses repeat the previous message',async()=>{
 let calls=0,sends=0;const request:typeof fetch=async()=>{sends++;throw Error('must not send');};
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret,projectId:project},new PhotonSender({apiKey:'test',projectId:project},request),undefined,async()=>{calls++;return {relationship,suggestedReply:'Hello!'};});
 try{const {topicId,personId}=setup(store);await app.inject({method:'PUT',url:`/api/conversations/${topicId}/auto-reply`,payload:{enabled:true,personId,preferences:'',consent:true}});await app.inject(signedEvent('repeat-twice','pho_msg_0000000000000000000000000a','Can you meet Saturday?',firstSent));await waitFor(()=>store.autoReplySettings(topicId).lastStatus==='needs_review');assert.equal(calls,2);assert.equal(sends,0);}finally{await app.close();store.close();}
});
