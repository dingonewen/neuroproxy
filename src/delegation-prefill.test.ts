import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { delegationPrefill } from '../shared/delegation-prefill.ts';
import { labelRealSms, NEUROPROXY_LABEL } from '../shared/sms.ts';
import type { Extraction } from '../shared/extraction.ts';

const context: Extraction = {topic:'Project', people:['Alex','Sam'], tasks:[{description:'Check deadline',assignee:'Alex'},{description:'Get data',assignee:'Sam'}], uncertainties:[], draft:null};

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
