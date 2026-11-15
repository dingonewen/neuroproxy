import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installInteractivePreview } from './interactive-preview.ts';

test('preview returns an empty graph and blocks all other requests locally', async () => {
 const oldWindow=globalThis.window;
 const fakeWindow={location:{href:'https://preview.example/',origin:'https://preview.example'}} as Window;
 Object.defineProperty(globalThis,'window',{value:fakeWindow,configurable:true});
 try {
  installInteractivePreview();
  const empty=await fakeWindow.fetch('/api/graph');
  assert.deepEqual(await empty.json(),{nodes:[],edges:[],drafts:[]});
  for(const [url,method] of [['/api/extract','POST'],['/api/graph','DELETE'],['https://elsewhere.example/','GET']]) {
   const blocked=await fakeWindow.fetch(url,{method});
   assert.equal(blocked.status,403);
   assert.match((await blocked.json()).error,/preview only/i);
  }
 } finally {
  if(oldWindow===undefined) Reflect.deleteProperty(globalThis,'window');
  else Object.defineProperty(globalThis,'window',{value:oldWindow,configurable:true});
 }
});
