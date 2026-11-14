import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Store } from './store.ts';
import { createApp } from './app.ts';

test('voice capture authenticates, saves proposed context once, and never sends a message',async()=>{
 const previous=process.env.VOICE_TOOL_SECRET;process.env.VOICE_TOOL_SECRET='synthetic-voice-secret-at-least-32-characters';
 const store=new Store(':memory:');let calls=0;
 const app=createApp(store,async()=>{calls++;return {topic:'Team project',people:['Alex'],tasks:[{description:'Ask about deadline',assignee:'Alex'}],uncertainties:[],relationship:{facts:['Alex is working on the project'],feelings:[],needs:[],interpretations:[],coreQuestion:'When is it due?',nextAction:'Ask Alex'},draft:{recipient:'Alex',taskIndex:0,body:'When is the deadline?'}};});
 const send=(token:string,body:Record<string,string>)=>app.inject({method:'POST',url:'/api/voice/capture',headers:{authorization:`Bearer ${token}`},payload:body});
 try{
  assert.equal((await send('wrong',{conversationId:'conv_test',text:'Hello'})).statusCode,401);assert.equal(calls,0);
  assert.equal((await send(process.env.VOICE_TOOL_SECRET!,{conversationId:'bad',text:'Hello'})).statusCode,400);
  const first=await send(process.env.VOICE_TOOL_SECRET!,{conversationId:'conv_test',text:'Ask Alex about the deadline.'});assert.equal(first.statusCode,200);assert.equal(first.json().summary.suggestedMessage,'When is the deadline?');
  let graph=store.graph();const topic=graph.nodes.find(n=>n.kind==='topic')!;assert.equal(topic.source,'voice');assert.equal(topic.status,'proposed');assert.equal(graph.nodes.find(n=>n.kind==='reported_fact')?.status,'proposed');assert.equal(graph.drafts[0].state,'pending_approval');
  const again=await send(process.env.VOICE_TOOL_SECRET!,{conversationId:'conv_test',text:'Ask Alex about the deadline.'});assert.equal(again.json().duplicate,true);assert.equal(calls,1);assert.equal(store.graph().nodes.filter(n=>n.kind==='topic').length,1);
  store.deleteConversation(String(topic.id));assert.equal((await send(process.env.VOICE_TOOL_SECRET!,{conversationId:'conv_test',text:'Ask Alex about the deadline.'})).statusCode,409);assert.equal(calls,1);graph=store.graph();assert.equal(graph.nodes.length,0);
 }finally{await app.close();store.close();if(previous===undefined)delete process.env.VOICE_TOOL_SECRET;else process.env.VOICE_TOOL_SECRET=previous;}
});
