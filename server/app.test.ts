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
 const suggested = { topic:'Group project', people:['Alex','Sam'], tasks:[{description:'Frontend',assignee:'Alex'},{description:'Dataset',assignee:'Sam'},{description:'Backend',assignee:''}], uncertainties:[{question:'Is the deadline Saturday?',people:['Alex']},{question:'Who will review it?',people:[]}], draft:{recipient:'Alex',taskIndex:0,body:'Can you confirm Saturday?'} };
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
  const alex=graph.nodes.find(n=>n.kind==='person' && n.label==='Alex'); const question=graph.nodes.find(n=>n.label==='Is the deadline Saturday?'); const topic=graph.nodes.find(n=>n.kind==='topic'); const unknown=graph.nodes.find(n=>n.label==='Who will review it?');
  assert.ok(graph.edges.some(e=>e.source===alex?.id && e.target===question?.id));
  assert.ok(!graph.edges.some(e=>e.source===topic?.id && e.target===question?.id));
  assert.ok(graph.edges.some(e=>e.source===topic?.id && e.target===unknown?.id));
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

test('manual draft creates a connected graph without a message-to-person cycle', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const response=await app.inject({method:'POST',url:'/api/drafts',payload:{topic:'Project',person:'Alex',task:'Confirm date',body:'When?'}}); assert.equal(response.statusCode,200);
  const graph=store.graph();const person=graph.nodes.find(n=>n.kind==='person');const task=graph.nodes.find(n=>n.kind==='task');const message=graph.nodes.find(n=>n.kind==='message');
  assert.equal(graph.drafts.length,1); assert.ok(graph.edges.some(e=>e.source===person?.id && e.target===task?.id));
  assert.ok(graph.edges.some(e=>e.source===task?.id && e.target===message?.id)); assert.ok(!graph.edges.some(e=>e.source===message?.id && e.target===person?.id));
 } finally {await app.close();store.close();}
});

test('saving another conversation preserves prior graph and draft records', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 const input=(topic:string,person:string)=>({topic,people:[person],tasks:[{description:'Check',assignee:person}],uncertainties:[],draft:{recipient:person,taskIndex:0,body:'Hello?'}});
 try {
  const first=await app.inject({method:'POST',url:'/api/reviewed-context',payload:input('First','Alex')});
  const second=await app.inject({method:'POST',url:'/api/reviewed-context',payload:input('Second','Sam')});
  assert.equal(first.statusCode,200);assert.equal(second.statusCode,200);
  const graph=store.graph();assert.ok(graph.nodes.some(n=>n.id===first.json().topicId));assert.ok(graph.nodes.some(n=>n.id===second.json().topicId));
  assert.equal(graph.drafts.length,2);assert.ok(graph.drafts.every(d=>d.state==='pending_approval'));
 } finally {await app.close();store.close();}
});

test('delete removes only the selected conversation and its local drafts',async()=>{
 const store=new Store(':memory:');const app=createApp(store);
 const input=(topic:string,person:string)=>({topic,people:[person],tasks:[{description:'Check',assignee:person}],uncertainties:[],draft:{recipient:person,taskIndex:0,body:'Hello?'}});
 try {
  const one=(await app.inject({method:'POST',url:'/api/reviewed-context',payload:input('One','A')})).json();
  const two=(await app.inject({method:'POST',url:'/api/reviewed-context',payload:input('Two','B')})).json();
  const deleted=await app.inject({method:'DELETE',url:`/api/conversations/${one.topicId}`});assert.equal(deleted.statusCode,200);
  const graph=store.graph();assert.ok(!graph.nodes.some(n=>n.id===one.topicId));assert.ok(graph.nodes.some(n=>n.id===two.topicId));assert.equal(graph.drafts.length,1);assert.equal(graph.drafts[0].id,two.draftId);
  assert.equal((await app.inject({method:'DELETE',url:`/api/conversations/${one.topicId}`})).statusCode,400);
 }finally{await app.close();store.close();}
});

test('deleting a conversation with Photon activity is blocked and keeps its history',async()=>{
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const created=(await app.inject({method:'POST',url:'/api/reviewed-context',payload:{topic:'Real',people:['A'],tasks:[{description:'Check',assignee:'A'}],uncertainties:[],draft:{recipient:'A',taskIndex:0,body:'Hello?'}}})).json();
  store.preparePhone(created.draftId,'+14155550123','Hello?');
  const before=store.graph();const response=await app.inject({method:'DELETE',url:`/api/conversations/${created.topicId}`});assert.equal(response.statusCode,400);assert.match(response.json().error,/Photon activity/);assert.deepEqual(store.graph(),before);
 }finally{await app.close();store.close();}
});

test('delete refuses graphs that join multiple topics and leaves both intact',async()=>{
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const one=store.createReviewed({topic:'One',people:[],tasks:[],uncertainties:[],draft:null});
  const two=store.createReviewed({topic:'Two',people:[],tasks:[],uncertainties:[],draft:null});
  store.edge(one.topicId,two.topicId,'connected');const before=store.graph();
  const response=await app.inject({method:'DELETE',url:`/api/conversations/${two.topicId}`});
  assert.equal(response.statusCode,400);assert.match(response.json().error,/multiple connected topics/);assert.deepEqual(store.graph(),before);
 }finally{await app.close();store.close();}
});
