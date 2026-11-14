import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from './app.ts';
import { Store } from './store.ts';
test('simulated delegation API persists a reply and rejects duplicate approval', async () => {
 const store = new Store(':memory:'); const app = createApp(store);
 try {
  let res = await app.inject({method:'POST',url:'/api/drafts',payload:{topic:'Project',person:'Alex',task:'Deadline',body:'When?'}}); assert.equal(res.statusCode,200); const {id}=res.json();
  res=await app.inject({method:'POST',url:`/api/drafts/${id}/approve-simulation`}); assert.equal(res.statusCode,200);
  res=await app.inject({method:'POST',url:`/api/drafts/${id}/approve-simulation`}); assert.equal(res.statusCode,400);
  res=await app.inject({method:'POST',url:`/api/drafts/${id}/simulate-reply`,payload:{body:'Saturday'}}); assert.equal(res.statusCode,200);
  res=await app.inject({method:'GET',url:'/api/graph'}); assert.equal(res.json().drafts[0].state,'reply_received'); assert.equal(res.json().nodes.find((n:{kind:string})=>n.kind==='reply').source,'simulated');
 } finally { await app.close(); store.close(); }
});
