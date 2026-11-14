import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analysisErrorFingerprint, describeAnalysisError } from './analysis-error.ts';
import { validateExtraction } from '../shared/extraction.ts';
import { Store } from './store.ts';
import { createApp } from './app.ts';

test('categorizes wrapped provider errors without exposing details', () => {
 assert.equal(describeAnalysisError({cause:{statusCode:429,message:'private'}}).kind,'rate_limit');
 assert.equal(describeAnalysisError({cause:{statusCode:401}}).kind,'authentication');
 assert.equal(describeAnalysisError({cause:{status:404}}).kind,'model_not_found');
 assert.equal(describeAnalysisError({name:'ZodError'}).kind,'invalid_output');
 assert.equal(describeAnalysisError({name:'AI_LoadAPIKeyError'}).kind,'missing_key');
 assert.equal(describeAnalysisError({cause:{code:'ENOTFOUND'}}).kind,'network');
 assert.equal(describeAnalysisError({code:'NEUROPROXY_MODEL_MISSING'}).kind,'missing_model');
 const cyclic:{cause?:unknown}={};cyclic.cause=cyclic;assert.equal(describeAnalysisError(cyclic).kind,'unknown');
});

test('invalid model cross-references are classified without leaking analysis text', () => {
 try {validateExtraction({topic:'private',people:['A'],tasks:[],uncertainties:[],draft:{recipient:'A',taskIndex:0,body:'private'}});assert.fail('expected validation to fail');}
 catch(error) {const diagnosis=describeAnalysisError(error);assert.equal(diagnosis.kind,'invalid_output');assert.doesNotMatch(diagnosis.message,/private/);}
 assert.equal(analysisErrorFingerprint({name:'secret value',cause:{name:'Error',message:'secret'}}),'OtherError > Error');
});

test('extraction API reports category without returning sensitive provider errors', async () => {
 const store=new Store(':memory:');const app=createApp(store,async()=>{throw Object.assign(new Error('sensitive secret and conversation'),{statusCode:429});});
 try {const res=await app.inject({method:'POST',url:'/api/extract',payload:{text:'test'}});assert.equal(res.statusCode,502);assert.equal(res.json().category,'rate_limit');assert.doesNotMatch(res.body,/sensitive secret|conversation/);} finally {await app.close();store.close();}
});
