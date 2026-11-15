import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withModelTimeout,ModelTimeoutError} from './model-timeout.ts';
import {describeAnalysisError} from './analysis-error.ts';

test('model deadline aborts a stalled request and returns a safe timeout diagnosis',async()=>{
 let signal:AbortSignal|undefined;
 await assert.rejects(withModelTimeout(received=>{signal=received;return new Promise<never>(()=>{});},10),ModelTimeoutError);
 assert.equal(signal?.aborted,true);
 assert.equal(describeAnalysisError(new ModelTimeoutError()).kind,'timeout');
});

test('model deadline preserves successful results and provider errors',async()=>{
 assert.equal(await withModelTimeout(async()=>42,100),42);
 const error=Object.assign(new Error('not disclosed'),{status:429});
 await assert.rejects(withModelTimeout(async()=>{throw error;},100),value=>value===error);
});
