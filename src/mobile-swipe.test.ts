import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { swipeStage } from './mobile-swipe.ts';

test('mobile swipe changes stages only for intentional horizontal gestures',()=>{
 assert.equal(swipeStage('understand',-100,10,500),'visualize');
 assert.equal(swipeStage('visualize',100,10,500),'understand');
 assert.equal(swipeStage('visualize',-25,5,100),'visualize');
 assert.equal(swipeStage('visualize',-90,100,200),'visualize');
 assert.equal(swipeStage('visualize',-45,2,80),'delegate');
 assert.equal(swipeStage('understand',100,0,100),'understand');
 assert.equal(swipeStage('reconnect',-100,0,100),'reconnect');
});
