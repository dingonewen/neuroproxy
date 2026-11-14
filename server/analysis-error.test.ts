import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analysisErrorFingerprint, describeAnalysisError, safeValidationDetails } from './analysis-error.ts';
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

 test('validation diagnostics disclose only allowed fields and codes',()=>{
  const details=safeValidationDetails({cause:{issues:[{path:['tasks',0,'assignee'],code:'invalid_type',message:'private content'},{path:['secret-person'],code:'secret-value'}]}});
  assert.equal(details,'tasks.[].assignee:invalid_type, ?:validation_error');
  assert.doesNotMatch(details,/private|secret/);
  assert.equal(safeValidationDetails({name:'ExtractionValidationError',message:'The draft recipient must be listed under people.'}),'draft_recipient');
 });

test('model assignee repair preserves tasks without guessing a person',async()=>{
 const {normalizeModelExtraction}=await import('../shared/extraction.ts');
 const model={topic:'Test',people:['Bob'],tasks:[{description:'Check in',assignee:'bob'},{description:'Reflect',assignee:'User'}],uncertainties:[],draft:null};
 assert.deepEqual(normalizeModelExtraction(model).tasks,[{description:'Check in',assignee:'Bob'},{description:'Reflect',assignee:''}]);
 assert.throws(()=>validateExtraction(model),/assignee/);
});
