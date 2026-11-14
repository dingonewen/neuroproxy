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

test('extraction requires review and saves multiple tasks, uncertainties and an unapproved draft', async () => {
 const store = new Store(':memory:');
 const suggested = { topic:'Group project', people:['Alex','Sam'], tasks:[{description:'Frontend',assignee:'Alex'},{description:'Dataset',assignee:'Sam'},{description:'Backend',assignee:''}], uncertainties:['Is the deadline Saturday?'], draft:{recipient:'Alex',taskIndex:0,body:'Can you confirm Saturday?'} };
 const app = createApp(store, async () => suggested);
 try {
  let response = await app.inject({method:'POST',url:'/api/extract',payload:{text:'Synthetic conversation'}});
  assert.equal(response.statusCode,200); assert.deepEqual(response.json(),suggested);
  assert.equal(store.graph().nodes.length,0, 'analysis must not persist or send');
  response = await app.inject({method:'POST',url:'/api/reviewed-context',payload:{...suggested,draft:{...suggested.draft,taskIndex:99}}});
  assert.equal(response.statusCode,400); assert.equal(store.graph().nodes.length,0);
  response = await app.inject({method:'POST',url:'/api/reviewed-context',payload:suggested});
  assert.equal(response.statusCode,200); const graph=store.graph();
  assert.equal(graph.nodes.filter(n=>n.kind==='task').length,3);
  assert.equal(graph.nodes.filter(n=>n.kind==='person').length,2);
  assert.equal(graph.nodes.find(n=>n.kind==='question')?.status,'unresolved');
  assert.equal(graph.drafts[0].state,'pending_approval');
  assert.equal(graph.nodes.find(n=>n.kind==='message')?.source,'simulated');
  assert.equal(graph.nodes.find(n=>n.label==='Backend')?.status,'proposed');
 } finally { await app.close(); store.close(); }
});

test('invalid model output does not write to the graph', async () => {
 const store=new Store(':memory:');
 const app=createApp(store, async () => ({topic:'Project',people:[],tasks:[],uncertainties:[],draft:{recipient:'Invented',taskIndex:5,body:'Hello'}}));
 try {
  const response=await app.inject({method:'POST',url:'/api/extract',payload:{text:'hello'}});
  assert.equal(response.statusCode,502); assert.equal(store.graph().nodes.length,0);
 } finally { await app.close(); store.close(); }
});
