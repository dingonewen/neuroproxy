/** Classify errors without exposing provider messages, credentials or conversation text. */
export function describeAnalysisError(error: unknown): {kind:string; message:string} {
 const seen=new Set<unknown>();
 const queue:unknown[]=[error];
 let status:number|undefined; let schemaError=false; let networkError=false; let missingModel=false; let missingKey=false;
 while(queue.length && seen.size<30) {
  const current=queue.shift();if(!current || typeof current!=='object' || seen.has(current))continue;seen.add(current);
  const e=current as Record<string,unknown>;
  const candidate=e.statusCode ?? e.status;
  if(typeof candidate==='number' && candidate>=400 && candidate<=599) status ??= candidate;
  if(e.name==='ZodError' || e.name==='ExtractionValidationError' || e.name==='AI_TypeValidationError' || e.name==='TypeValidationError' || e.name==='AI_NoObjectGeneratedError' || e.name==='AI_NoOutputGeneratedError') schemaError=true;
  if(e.name==='AI_LoadAPIKeyError') missingKey=true;
  if(e.code==='NEUROPROXY_MODEL_MISSING') missingModel=true;
  if(typeof e.code==='string' && ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(e.code)) networkError=true;
  queue.push(e.cause,e.error,e.originalError,e.lastError);
  if(Array.isArray(e.errors))queue.push(...e.errors);
 }
 if(missingModel)return {kind:'missing_model',message:'Set NEUROPROXY_MODEL in .env and restart the backend.'};
 if(missingKey)return {kind:'missing_key',message:'The model provider API key is missing. Check .env and restart the backend.'};
 if(status===429)return {kind:'rate_limit',message:'The model provider returned HTTP 429 (rate limit or quota). Check its rate limits and account quota, then retry.'};
 if(status===401 || status===403)return {kind:'authentication',message:'The model provider rejected authentication or access (HTTP '+status+'). Check the API key and model access.'};
 if(status===404)return {kind:'model_not_found',message:'The model provider returned HTTP 404. Check the model name and account access.'};
 if(status===400 || status===422)return {kind:'invalid_request',message:'The model provider rejected the request (HTTP '+status+'). Check the model and structured-output compatibility.'};
 if(status && status>=500)return {kind:'provider_error',message:'The model provider returned HTTP '+status+'. Retry later.'};
 if(schemaError)return {kind:'invalid_output',message:'The model response contained invalid or inconsistent analysis (such as a person or task reference). Try again; no graph was saved.'};
 if(networkError)return {kind:'network',message:'Could not connect to the model provider. Check the backend network connection and retry.'};
 return {kind:'unknown',message:'Analysis failed for an unknown reason. Check the backend diagnostic category and model configuration.'};
}

/** Only fixed, non-content metadata may be exposed for unrecognized exceptions. */
export function analysisErrorFingerprint(error:unknown):string {
 const names=new Set(['Error','TypeError','RangeError','MastraError','AI_APICallError','AI_RetryError','AI_NoObjectGeneratedError','AI_NoOutputGeneratedError','AI_TypeValidationError','ZodError','ExtractionValidationError']);
 const parts:string[]=[];const seen=new Set<unknown>();let current=error;
 while(current && typeof current==='object' && !seen.has(current) && parts.length<4) {
  seen.add(current);const e=current as Record<string,unknown>;
  parts.push(typeof e.name==='string' && names.has(e.name) ? e.name : 'OtherError');
  current=e.cause ?? e.originalError ?? e.error;
 }
 return parts.join(' > ') || 'non-object error';
}
