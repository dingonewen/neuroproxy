import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {filterInsights} from './insight-filter.ts';

test('limits new insights, removes close duplicates and preserves meaningful negation',()=>{
 const base={facts:['Alex said the project is ready','Alex said the project is ready.','Alex said the project is not ready','Another fact','Last fact'],feelings:[],needs:[],interpretations:[],coreQuestion:'What next?',nextAction:'Ask Alex'};
 const initial=filterInsights(base,[],3);assert.deepEqual(initial.facts,['Alex said the project is ready','Alex said the project is not ready','Another fact']);
 const continued=filterInsights(base,[{kind:'reported_fact',text:'Alex said the project is ready'},{kind:'suggested_action',text:'Ask Alex'}],2);
 assert.deepEqual(continued.facts,['Alex said the project is not ready','Another fact']);assert.equal(continued.nextAction,'');
});
