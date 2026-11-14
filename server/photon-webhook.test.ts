import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { verifyPhotonWebhook } from './photon-webhook.ts';
import { createApp } from './app.ts';
import { Store } from './store.ts';
const project='pho_prj_00000000000000000000000001';
const secret='whsec_AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const message={id:'message-1',projectId:project,platform:'sms',status:'received',space:{id:'space-1'},sentBy:{id:'person-1',kind:'human'},receivedBy:{id:'agent-1',kind:'agent'},content:{type:'text',text:'Saturday works.'}};
const event={id:'event-1',type:'message.received',data:{projectId:project,object:message}};
function sign(body:string, id='delivery-1', timestamp=String(Math.floor(Date.now()/1000))) {
 const digest=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.`).update(body).digest('base64');
 return {'content-type':'application/json','webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':`v1,${digest}`};
}
test('Photon published signature interoperability vector verifies exact bytes and timestamp', () => {
 const raw=Buffer.from('{"synthetic":true,"text":"Hello 🌍"}');
 const headers={'webhook-id':'synthetic-vector','webhook-timestamp':'1767225600','webhook-signature':'v1,0urZDpPAiQuH0H0rEB2NpIzgZKIhN6z++ZQqVUiN8e8='};
 const key='whsec_BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
 assert.equal(verifyPhotonWebhook(raw,headers,key,1767225600*1000),true);
 assert.equal(verifyPhotonWebhook(Buffer.from(raw.toString()+' '),headers,key,1767225600*1000),false);
 assert.equal(verifyPhotonWebhook(raw,headers,key,(1767225600+301)*1000),false);
});
test('signed Photon messages are kept unlinked and deduplicated without changing simulated drafts', async () => {
 const store=new Store(':memory:'); const app=createApp(store,undefined,{secret,projectId:project});
 try {
  const draft=store.create('Project','Alex','Deadline','When?'); store.transition(draft,'waiting_for_reply');
  const body=JSON.stringify(event); let res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(body),payload:body}); assert.equal(res.statusCode,204);
  res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(body,'delivery-2'),payload:body}); assert.equal(res.statusCode,204);
  let graph=store.graph(); assert.equal(graph.nodes.filter(n=>n.source==='photon').length,1); assert.equal(graph.nodes.find(n=>n.source==='photon')?.status,'unlinked'); assert.equal(graph.drafts[0].state,'waiting_for_reply');
  const bad=JSON.stringify({...event,id:'event-2'}); res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(body),payload:bad}); assert.equal(res.statusCode,401);
  const wrong=JSON.stringify({...event,id:'event-3',data:{...event.data,projectId:'other'}}); res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(wrong),payload:wrong}); assert.equal(res.statusCode,400);
  const sameMessage=JSON.stringify({...event,id:'event-4'}); res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(sameMessage),payload:sameMessage}); assert.equal(res.statusCode,204);
  graph=store.graph(); assert.equal(graph.nodes.filter(n=>n.source==='photon').length,1);
 } finally {await app.close(); store.close();}
});
test('webhook remains disabled without signing configuration', async () => {
 const store=new Store(':memory:');const app=createApp(store,undefined,{secret:undefined,projectId:undefined});
 try { const body=JSON.stringify(event); const res=await app.inject({method:'POST',url:'/api/webhooks/photon',headers:sign(body),payload:body}); assert.equal(res.statusCode,503); assert.equal(store.graph().nodes.length,0); } finally {await app.close();store.close();}
});
