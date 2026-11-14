import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { delegationPrefill } from '../shared/delegation-prefill.ts';
import { labelRealSms, NEUROPROXY_LABEL } from '../shared/sms.ts';
import type { Extraction } from '../shared/extraction.ts';
import { delegationDefaults } from '../shared/delegation-defaults.ts';

const context: Extraction = {topic:'Project', people:['Alex','Sam'], tasks:[{description:'Check deadline',assignee:'Alex'},{description:'Get data',assignee:'Sam'}], uncertainties:[], draft:null};
test('delegation uses the saved suggested action and does not guess an ambiguous person',()=>{
 const nodes=[{id:'p',kind:'person',label:'Alex'},{id:'t',kind:'task',label:'Other task'},{id:'a',kind:'suggested_action',label:'Ask Alex'}];
 assert.deepEqual(delegationDefaults(nodes),{personId:'p',actionId:'a'});
 assert.deepEqual(delegationDefaults([...nodes,{id:'q',kind:'person',label:'Sam'}]),{personId:'',actionId:'a'});
 assert.deepEqual(delegationDefaults(nodes.slice(0,2)),{personId:'p',actionId:'t'});
});

test('prefill leaves ambiguous recipient and action for the user to choose', () => {
  assert.deepEqual(delegationPrefill(context), {topic:'Project',person:'',task:'',body:''});
  assert.deepEqual(delegationPrefill({...context,people:['Alex'],tasks:[context.tasks[0]]}), {topic:'Project',person:'Alex',task:'Check deadline',body:''});
});

test('prefill uses the reviewed draft and its associated action', () => {
  assert.deepEqual(delegationPrefill({...context,draft:{recipient:'Sam',taskIndex:1,body:'When?'}}), {topic:'Project',person:'Sam',task:'Get data',body:'When?'});
});

test('SMS label is stable when a failed preparation is reviewed again', () => {
  assert.equal(labelRealSms('When?'), `When?\n\n${NEUROPROXY_LABEL}`);
  assert.equal(labelRealSms(labelRealSms('When?')), labelRealSms('When?'));
});
