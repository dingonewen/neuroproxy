import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiJson} from './api-response.ts';

test('HTML fallback and sign-in pages produce a clear routing error without page contents',async()=>{
 for(const response of [new Response('<!DOCTYPE html><html>private login data</html>'),new Response('login',{headers:{'content-type':'text/html'}})]) {
  await assert.rejects(readApiJson(response),error=>error instanceof Error && /routing/.test(error.message) && !error.message.includes('private login data'));
 }
});

test('API responses preserve JSON error details and report empty proxy failures safely',async()=>{
 assert.deepEqual(await readApiJson(Response.json({error:'Model request timed out.'},{status:502})),{error:'Model request timed out.'});
 await assert.rejects(readApiJson(new Response('',{status:502})),/HTTP 502/);
});

test('Cloudflare timeout pages show a timeout diagnosis instead of a JSON parsing error',async()=>{
 await assert.rejects(readApiJson(new Response('<!DOCTYPE html>timeout',{status:524,headers:{'content-type':'text/html'}})),/Cloudflare timed out/);
});
