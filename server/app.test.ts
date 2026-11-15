import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { labelRealSms } from '../shared/sms.ts';
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

test('revisiting saved context updates the existing graph and unsent drafts safely', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const created=store.createReviewed({topic:'Meeting',people:['Alex'],tasks:[{description:'Check in',assignee:'Alex'}],uncertainties:[],draft:{recipient:'Alex',taskIndex:0,body:'Hello'}});
  const graph=store.graph();const person=graph.nodes.find(n=>n.kind==='person')!;const message=graph.nodes.find(n=>n.kind==='message')!;
  const update=(id:unknown,expectedLabel:string,label:string)=>app.inject({method:'PATCH',url:`/api/nodes/${id}`,payload:{expectedLabel,label}});
  assert.equal((await update(person.id,'Alex','Sam')).statusCode,200);assert.equal(store.graph().drafts[0].person,'Sam');
  assert.equal((await update(message.id,'Hello','How are you?')).statusCode,200);assert.equal(store.graph().drafts[0].body,'How are you?');
  assert.equal((await update(message.id,'Hello','Stale edit')).statusCode,400);assert.equal(store.graph().drafts[0].body,'How are you?');
  store.transition(created.draftId!,'waiting_for_reply');
  assert.equal((await update(message.id,'How are you?','Changed history')).statusCode,400);
  assert.equal((await update(person.id,'Sam','Other name')).statusCode,400);
  store.reply(created.draftId!,'Fine','simulated');const reply=store.graph().nodes.find(n=>n.kind==='reply')!;
  assert.equal((await update(reply.id,'Fine','Changed reply')).statusCode,400);assert.equal(store.graph().nodes.find(n=>n.id===reply.id)?.label,'Fine');
 }finally{await app.close();store.close();}
});

test('reviewed relationship insights stay distinct from reported facts and attach to confirmed replies', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 const relationship={facts:['Alex said they are busy'],feelings:['User feels uncertain'],needs:['Clarity'],interpretations:['They may be busy, or may be declining'],coreQuestion:'Do they want to meet?',nextAction:'Ask once directly.'};
 try {
  const saved=await app.inject({method:'POST',url:'/api/reviewed-context',payload:{topic:'Meeting',people:['Alex'],tasks:[],uncertainties:[],draft:null,relationship}});
  assert.equal(saved.statusCode,200);let graph=store.graph();
  const interpretation=graph.nodes.find(n=>n.kind==='interpretation');assert.equal(interpretation?.label,relationship.interpretations[0]);assert.equal(interpretation?.source,'analysis');
  assert.equal(graph.nodes.find(n=>n.kind==='reported_fact')?.label,relationship.facts[0]);assert.equal(graph.nodes.find(n=>n.kind==='suggested_action')?.status,'reviewed');
  const id=store.create('Meeting','Alex','Ask','Are you free?');store.transition(id,'waiting_for_reply');store.reply(id,'Busy this week','simulated');
  graph=store.graph();const reply=graph.nodes.find(n=>n.kind==='reply');
  assert.equal((await app.inject({method:'POST',url:'/api/replies/not-a-reply/insights',payload:relationship})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/replies/${reply?.id}/insights`,payload:relationship})).statusCode,200);
  graph=store.graph();assert.ok(graph.edges.some(e=>e.source===reply?.id&&e.label==='possible interpretation'));assert.equal(graph.drafts.find(d=>d.id===id)?.state,'reply_received');
 } finally {await app.close();store.close();}
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

test('deleting a conversation is blocked while a Photon send is in progress',async()=>{
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const created=(await app.inject({method:'POST',url:'/api/reviewed-context',payload:{topic:'Real',people:['A'],tasks:[{description:'Check',assignee:'A'}],uncertainties:[],draft:{recipient:'A',taskIndex:0,body:'Hello?'}}})).json();
  bindTestContact(store,created.draftId);store.preparePhone(created.draftId,'+14155550123',labelRealSms('Hello?'));
  const before=store.graph();const response=await app.inject({method:'DELETE',url:`/api/conversations/${created.topicId}`});assert.equal(response.statusCode,400);assert.match(response.json().error,/being sent/);assert.deepEqual(store.graph(),before);
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

test('confirmed replies can produce one follow-up draft on the same person and conversation', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const id=store.create('Connection','Alex','Ask','How are you?');
  store.transition(id,'waiting_for_reply');store.reply(id,'Doing well','simulated');
  let graph=store.graph();const reply=graph.nodes.find(n=>n.kind==='reply')!;
  const request=()=>app.inject({method:'POST',url:`/api/replies/${reply.id}/draft`,payload:{action:'Continue the conversation',body:'Glad to hear it!'}});
  const created=await request();assert.equal(created.statusCode,200);
  assert.equal((await request()).statusCode,400);
  graph=store.graph();const draft=graph.drafts.find(d=>d.id===created.json().id)!;const original=graph.drafts.find(d=>d.id===id)!;
  assert.equal(draft.person_id,original.person_id);assert.equal(draft.state,'pending_approval');
  assert.ok(graph.edges.some(e=>e.source===reply.id && e.target===draft.task_id && e.label==='follow-up'));
  store.transition(String(draft.id),'waiting_for_reply');store.reply(String(draft.id),'Thanks!','simulated');
  const next=store.graph().nodes.find(n=>n.label==='Thanks!')!;
  assert.equal((await app.inject({method:'POST',url:`/api/replies/${next.id}/draft`,payload:{action:'Respond',body:'You are welcome.'}})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/replies/missing/draft',payload:{action:'Respond',body:'Hello'}})).statusCode,400);
 }finally{await app.close();store.close();}
});

test('ending a conversation preserves history and blocks follow-ups and pending sends', async () => {
 const store=new Store(':memory:');const app=createApp(store);
 try {
  const id=store.create('Connection','Alex','Ask','Hello');
  store.transition(id,'waiting_for_reply');store.reply(id,'Hi','simulated');
  const graph=store.graph();const reply=graph.nodes.find(n=>n.kind==='reply')!;const topic=graph.nodes.find(n=>n.kind==='topic')!;
  const followup=await app.inject({method:'POST',url:`/api/replies/${reply.id}/draft`,payload:{action:'Reply',body:'Thanks'}});
  assert.equal(followup.statusCode,200);
  assert.equal((await app.inject({method:'POST',url:`/api/conversations/${topic.id}/end`})).statusCode,200);
  const after=store.graph();assert.equal(after.nodes.length,graph.nodes.length+2);assert.equal(after.nodes.find(n=>n.id===topic.id)?.conversation_ended,1);
  assert.equal((await app.inject({method:'POST',url:`/api/replies/${reply.id}/analyze`})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/replies/${reply.id}/draft`,payload:{action:'Reply',body:'Thanks'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/drafts/${followup.json().id}/approve-simulation`})).statusCode,400);
  assert.equal(store.graph().drafts.find(d=>d.id===followup.json().id)?.state,'pending_approval');
  assert.equal((await app.inject({method:'DELETE',url:`/api/conversations/${topic.id}`})).statusCode,200);
 }finally{await app.close();store.close();}
});

test('manual delegation stays in the chosen conversation and reuses the selected person', async () => {
 const store=new Store(':memory:');let modelInput='';
 const app=createApp(store,undefined,undefined,undefined,async input=>{modelInput=JSON.stringify(input);return {body:'Can we talk honestly?',reason:null};});
 try {
  const first=store.createReviewed({topic:'Friendship',people:['Alex'],tasks:[{description:'Ask directly',assignee:'Alex'}],uncertainties:[],draft:null});
  const second=store.createReviewed({topic:'Other',people:['Sam'],tasks:[],uncertainties:[],draft:null});
  const graph=store.graph();const alex=graph.nodes.find(n=>n.kind==='person'&&n.label==='Alex')!;const sam=graph.nodes.find(n=>n.kind==='person'&&n.label==='Sam')!;const task=graph.nodes.find(n=>n.kind==='task'&&n.label==='Ask directly')!;
  const selection={personId:alex.id,actionId:task.id};
  let res=await app.inject({method:'POST',url:`/api/conversations/${first.topicId}/delegation-suggestion`,payload:selection});
  assert.equal(res.statusCode,200);assert.equal(res.json().body,'Can we talk honestly?');assert.match(modelInput,/Friendship/);assert.doesNotMatch(modelInput,/Other/);assert.equal(store.graph().drafts.length,0);
  res=await app.inject({method:'POST',url:`/api/conversations/${first.topicId}/drafts`,payload:{...selection,body:'Can we talk honestly?'}});assert.equal(res.statusCode,200);
  const draft=store.graph().drafts.find(d=>d.id===res.json().id)!;assert.equal(draft.person_id,alex.id);assert.equal(draft.state,'pending_approval');assert.ok(store.graph().edges.some(e=>e.source===task.id&&e.target===draft.task_id));
  assert.equal((await app.inject({method:'POST',url:`/api/conversations/${first.topicId}/drafts`,payload:{personId:sam.id,actionId:task.id,body:'Wrong person'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/conversations/${second.topicId}/drafts`,payload:{personId:alex.id,actionId:task.id,body:'Wrong conversation'}})).statusCode,400);
  const added=await app.inject({method:'POST',url:`/api/conversations/${first.topicId}/drafts`,payload:{newPerson:'Taylor',customAction:'Check in',body:'How are you?'}});assert.equal(added.statusCode,200);
  const taylor=store.graph().nodes.find(n=>n.kind==='person'&&n.label==='Taylor')!;assert.ok(store.graph().edges.some(e=>e.source===first.topicId&&e.target===taylor.id));
 }finally{await app.close();store.close();}
});

test('reply analysis uses the confirmed conversation and leaves graph unchanged until review', async () => {
 const store=new Store(':memory:');let invoked=0;let seenPerson='';
 const relationship={facts:['Alex replied'],feelings:[],needs:[],interpretations:['They may be busy'],coreQuestion:'When?',nextAction:'Ask directly'};
 const app=createApp(store,undefined,undefined,undefined,undefined,async input=>{invoked++;seenPerson=input.person;assert.equal(input.reply,'Busy');assert.ok(input.conversation.some(n=>n.text==='Project'));assert.ok(!input.conversation.some(n=>n.text==='Unrelated'));return {relationship,suggestedReply:'When works for you?'};});
 try {
  const id=store.create('Project','Alex','Ask','Are you free?');store.create('Unrelated','Sam','Check','Hello');store.transition(id,'waiting_for_reply');store.reply(id,'Busy','simulated');
  const before=store.graph();const reply=before.nodes.find(n=>n.kind==='reply'&&n.label==='Busy')!;
  const res=await app.inject({method:'POST',url:`/api/replies/${reply.id}/analyze`});assert.equal(res.statusCode,200);assert.equal(res.json().suggestedReply,'When works for you?');assert.equal(seenPerson,'Alex');assert.equal(invoked,1);assert.deepEqual(store.graph(),before);
  assert.equal((await app.inject({method:'POST',url:'/api/replies/not-real/analyze'})).statusCode,400);assert.equal(invoked,1);
 } finally {await app.close();store.close();}
});
