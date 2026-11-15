export type Embedder=(texts:string[])=>Promise<number[][]>;

/** Optional, ephemeral embeddings: no text or vectors are written to storage. */
export function cloudflareEmbedder(accountId=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_AI_TOKEN,request:typeof fetch=fetch):Embedder|null {
 if(!accountId || !token)return null;
 if(!/^[a-f0-9]{32}$/i.test(accountId))return null;
 return async texts=>{
  if(!texts.length || texts.length>64)throw Error('Invalid embedding batch.');
  const response=await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({text:texts}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Embedding service unavailable.');
  const payload=await response.json() as {success?:unknown;result?:{data?:unknown}};
  const vectors=payload.result?.data;
  if(payload.success!==true || !Array.isArray(vectors) || vectors.length!==texts.length || !vectors.every(v=>Array.isArray(v) && v.length>0 && v.length<=4096 && v.every(n=>typeof n==='number' && Number.isFinite(n))) || !vectors.every(v=>v.length===vectors[0].length))throw Error('Invalid embedding response.');
  return vectors as number[][];
 };
}
