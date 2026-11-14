import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkPhoton } from './photon.ts';
const config={apiKey:'pho_sk_test',projectId:'pho_prj_00000000000000000000000001'};
test('Photon check uses a read-only beta endpoint and does not expose response content', async () => {
 let called=false;
 const fake: typeof fetch=async (url, options) => { called=true; assert.equal(String(url),'https://api.photon.codes/v1/projects/pho_prj_00000000000000000000000001/spaces?pageSize=1'); assert.equal(options?.method,'GET'); assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer pho_sk_test'); assert.equal(options?.redirect,'error'); return new Response(JSON.stringify({items:[{sensitive:'not returned'}]}),{status:200}); };
 assert.deepEqual(await checkPhoton(config,fake),{ok:true}); assert.equal(called,true);
});
test('Photon check handles missing credentials, denial, invalid payload and network errors', async () => {
 assert.deepEqual(await checkPhoton({}, async()=>{throw Error('must not call');}),{ok:false,reason:'missing_config'});
 assert.deepEqual(await checkPhoton({...config,projectId:'../unsafe'}, async()=>{throw Error('must not call');}),{ok:false,reason:'invalid_config'});
 for (const status of [401,403,500]) { const result=await checkPhoton(config,async()=>new Response('',{status})); assert.equal(result.ok,false); if (!result.ok) assert.equal(result.reason,status===401?'unauthorized':status===403?'forbidden':'http_error'); }
 assert.deepEqual(await checkPhoton(config,async()=>new Response('{}')),{ok:false,reason:'invalid_response'});
 assert.deepEqual(await checkPhoton(config,async()=>{throw Error('secret');}),{ok:false,reason:'network_error'});
});
