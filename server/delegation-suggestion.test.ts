import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ensureDelegationSuggestion } from './delegation-suggestion.ts';
import { validateExtraction } from '../shared/extraction.ts';
import { Store } from './store.ts';

const context=validateExtraction({topic:'Friendship',people:['Alex'],tasks:[],uncertainties:[],relationship:{facts:[],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:''},draft:null});
test('a suggested message becomes a reviewable draft and never sends on save',async()=>{
 const result=await ensureDelegationSuggestion(context,async()=>({recipient:'Alex',action:'Check in',body:'Hi Alex, how are you?'}));
 assert.equal(result.draft?.taskIndex,0);assert.equal(result.tasks[0].description,'Check in');validateExtraction(result);
 const store=new Store(':memory:');try{const saved=store.createReviewed(result);assert.ok(saved.draftId);const graph=store.graph();assert.equal(graph.drafts[0].state,'pending_approval');assert.equal(graph.drafts[0].body,'Hi Alex, how are you?');assert.equal(graph.nodes.find(n=>n.kind==='message')?.source,'simulated');}finally{store.close();}
});
test('no known person, unknown recipient, or no suggestion never creates an outreach draft',async()=>{
 let called=false;const empty={...context,people:[]};assert.equal(await ensureDelegationSuggestion(empty,async()=>{called=true;return null;}),empty);assert.equal(called,false);
 assert.equal(await ensureDelegationSuggestion(context,async()=>({recipient:'Unknown',action:'Ask',body:'Hello'})),context);
 assert.equal(await ensureDelegationSuggestion(context,async()=>null),context);
});
test('preserves an existing draft and reuses an existing matching action',async()=>{
 const withTask={...context,tasks:[{description:'Check in',assignee:'Alex'}]};const result=await ensureDelegationSuggestion(withTask,async()=>({recipient:'Alex',action:'Check in',body:'Hi'}));assert.equal(result.tasks.length,1);assert.equal(result.draft?.taskIndex,0);
 let called=false;assert.equal(await ensureDelegationSuggestion(result,async()=>{called=true;return null;}),result);assert.equal(called,false);
});
