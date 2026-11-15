import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {Store} from './store.ts';
import {recallMemory,validateRecoveryCitations} from './recovery-memory.ts';

test('recall returns bounded graph evidence from the relevant conversation',()=>{
 const store=new Store(':memory:');try {
  store.create('Plans with David','David','Discuss Saturday','Can we meet Saturday?');
  for(let i=0;i<10;i++)store.create(`Project ${i}`,`Person ${i}`,'Prepare a report',`Report ${i}`);
  const result=recallMemory(store.graph(),'What did David say about Saturday?',8);
  assert.ok(result.sources.length<=8);assert.equal(result.partial,true);
  assert.ok(result.sources.some(source=>source.text==='Can we meet Saturday?'));
  assert.ok(result.sources.some(source=>source.conversationLabel==='Plans with David'));
  assert.ok(result.sources.every(source=>!('contact_handle' in source)));
  assert.ok(result.edges.every(edge=>result.sources.some(source=>source.id===edge.source)&&result.sources.some(source=>source.id===edge.target)));
 }finally{store.close();}
});

test('auto-reply recall includes recorded origin, status and time, without treating submission as delivery',()=>{
 const store=new Store(':memory:');try {
  const id=store.create('Catch up','Alex','Ask','An automatic reply');const graph=store.graph();
  const draft=graph.drafts.find(d=>d.id===id)!;draft.auto_generated=1;draft.auto_reply_status='submitted';draft.auto_reply_received_at_ms=1000;draft.photon_prepared_at='2026-01-01T12:00:00Z';
  const result=recallMemory(graph,'What did AutoReply send?',8);const source=result.sources.find(s=>s.id===draft.message_id);
  assert.equal(source?.origin,'auto_reply');assert.equal(source?.autoReplyStatus,'submitted');assert.equal(source?.incomingAtMs,1000);assert.equal(source?.preparedAt,'2026-01-01T12:00:00Z');
 }finally{store.close();}
});

test('only cited IDs returned by the current recall become source links',()=>{
 const store=new Store(':memory:');try {
  store.create('Catch up','Alex','Ask','Hello');const context=recallMemory(store.graph(),'Alex',8);
  const source=context.sources[0];const known=new Map(context.sources.map(item=>[item.id,item]));
  const result=validateRecoveryCitations(`Hello [[source:${source.id}]] [[source:invented-id]] [[source:${source.id}]]`,known);
  assert.equal(result.answer,'Hello');assert.deepEqual(result.sources,[source]);
  assert.deepEqual(validateRecoveryCitations('No sources',known).sources,[]);
 }finally{store.close();}
});

test('no lexical match returns recent evidence marked as a fallback',()=>{
 const store=new Store(':memory:');try{store.create('Topic','Alex','Check','Hello');const result=recallMemory(store.graph(),'unmatchedword',4);assert.equal(result.match,'recent');assert.ok(result.sources.length>0);}finally{store.close();}
});

test('recovery API returns only validated citations and rejects stale evidence',async()=>{
 const {createApp}=await import('./app.ts');const store=new Store(':memory:');
 const draft=store.create('Weekend with Alex','Alex','Ask about Saturday','Can we meet Saturday?');
 let removeDuringResponse=false;const app=createApp(store,undefined,undefined,undefined,undefined,undefined,async(question,recalled)=>{
  const context=recallMemory(store.graph(),question);for(const source of context.sources)recalled.set(source.id,source);
  const message=context.sources.find(source=>source.text==='Can we meet Saturday?')!;
  if(removeDuringResponse)store.reviseNode(message.id,'Can we meet Saturday?','Changed after recall');
  return {text:`You asked to meet. [[source:${message.id}]] [[source:invented]]`};
 });
 try{
  let response=await app.inject({method:'POST',url:'/api/ask',payload:{question:'What about Saturday?'}});
  assert.equal(response.statusCode,200);assert.equal(response.json().sources.length,1);assert.equal(response.json().sources[0].text,'Can we meet Saturday?');assert.doesNotMatch(response.json().answer,/source:/);
  removeDuringResponse=true;response=await app.inject({method:'POST',url:'/api/ask',payload:{question:'What about Saturday?'}});
  assert.equal(response.statusCode,200);assert.match(response.json().answer,/changed/);assert.deepEqual(response.json().sources,[]);assert.ok(draft);
 }finally{await app.close();store.close();}
});
