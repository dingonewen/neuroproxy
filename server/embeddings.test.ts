import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {cloudflareEmbedder} from './embeddings.ts';
import {semanticFilterInsights,filterInsights} from './insight-filter.ts';

const relationship={facts:['Bob feels unhappy','Alice feels unhappy','Bob is not happy'],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:''};
const existing=[{kind:'reported_fact',text:'Bob is sad'}];

test('semantic deduplication preserves different people and negation',async()=>{
 const result=await semanticFilterInsights(relationship,existing,3,async texts=>texts.map(()=>[1,0]));
 assert.deepEqual(result.facts,['Alice feels unhappy','Bob is not happy']);
});

test('semantic deduplication falls back to lexical matching on provider failure',async()=>{
 assert.deepEqual(await semanticFilterInsights(relationship,existing,3,async()=>{throw Error('offline');}),filterInsights(relationship,existing,3));
});

test('Cloudflare embedding request validates response and sends only requested text',async()=>{
 let requestBody:unknown;
 const request:typeof fetch=async (url,init)=>{assert.match(String(url),/\/ai\/run\/@cf\/baai\/bge-m3$/);requestBody=JSON.parse(String(init?.body));return Response.json({success:true,result:{data:[[0.1,0.2],[0.3,0.4]]}});};
 const embed=cloudflareEmbedder('a'.repeat(32),'test-token',request)!;
 assert.deepEqual(await embed(['one','two']),[[0.1,0.2],[0.3,0.4]]);assert.deepEqual(requestBody,{text:['one','two']});
 const malformed=cloudflareEmbedder('a'.repeat(32),'test-token',async()=>Response.json({success:true,result:{data:[[0.1]]}}))!;
 await assert.rejects(()=>malformed(['one','two']));
 assert.equal(cloudflareEmbedder('', ''),null);
});


test('semantic deduplication preserves lowercase participants and avoids sending Chinese insights',async()=>{
 let sent:string[]=[];
 const result=await semanticFilterInsights({facts:['alice is upset','小明感到难过'],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:''},[{kind:'reported_fact',text:'bob feels sad'},{kind:'reported_fact',text:'小明不开心'}],3,async texts=>{sent=texts;return texts.map(()=>[1,0]);});
 assert.deepEqual(result.facts,['alice is upset','小明感到难过']);
 assert.ok(sent.every(text=>!/[\p{Script=Han}]/u.test(text)));
});
