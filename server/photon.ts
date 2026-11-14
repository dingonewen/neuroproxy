/** Read-only Photon 2.0 Beta connectivity check.
 * https://photon.codes/docs/beta/api-reference/spaces/list-spaces
 */
export type PhotonCheck = { ok: true } | { ok: false; reason: 'missing_config' | 'invalid_config' | 'unauthorized' | 'forbidden' | 'http_error' | 'network_error' | 'invalid_response'; status?: number };

type PhotonConfig = { apiKey?: string; projectId?: string; smsNumber?: string };
export async function checkPhoton(config: PhotonConfig, request: typeof fetch = fetch): Promise<PhotonCheck> {
 const key = config.apiKey?.trim(); const project = config.projectId?.trim();
 if (!key || !project) return { ok:false, reason:'missing_config' };
 if (!/^pho_prj_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(project) || /[\r\n]/.test(key)) return { ok:false, reason:'invalid_config' };
 try {
  const response = await request(`https://api.photon.codes/v1/projects/${project}/spaces?pageSize=1`, {
   method:'GET', headers:{ Authorization:`Bearer ${key}`, Accept:'application/json' }, redirect:'error', signal:AbortSignal.timeout(10000),
  });
  if (response.status === 401) return {ok:false,reason:'unauthorized',status:401};
  if (response.status === 403) return {ok:false,reason:'forbidden',status:403};
  if (!response.ok) return {ok:false,reason:'http_error',status:response.status};
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !Array.isArray((body as {items?:unknown}).items)) return {ok:false,reason:'invalid_response'};
  return {ok:true};
 } catch { return {ok:false,reason:'network_error'}; }
}

export type PhotonTarget = { spaceId:string; senderId:string; recipientId:string; recipientPhone:string };
const entityId = (value:string, prefix:'spc'|'usr') => new RegExp(`^pho_${prefix}_[0-7][0-9a-hjkmnp-tv-z]{25}$`).test(value);
export class PhotonSender {
 constructor(privateConfig: PhotonConfig, request: typeof fetch = fetch) { this.config=privateConfig; this.request=request; }
 private config: PhotonConfig;
 private request: typeof fetch;
 private base() {
  const project=this.config.projectId?.trim(); const key=this.config.apiKey?.trim();
  if (!key || !project || !/^pho_prj_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(project) || /[\r\n]/.test(key)) throw Error('Photon credentials or project ID are not configured.');
  return {url:`https://api.photon.codes/v1/projects/${project}`,key,project};
 }
 async resolvePhone(recipientPhone:string, idempotencyKey:string):Promise<PhotonTarget> {
  const senderPhone=this.config.smsNumber?.trim();
  if (!senderPhone || !/^\+[1-9]\d{7,14}$/.test(senderPhone) || !/^\+[1-9]\d{7,14}$/.test(recipientPhone) || senderPhone===recipientPhone) throw Error('Configure a valid Photon SMS number and a different recipient number in E.164 format.');
  const {url,key,project}=this.base();
  const post=async(path:string,body:object,suffix:string) => {
   const res=await this.request(url+path,{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json','idempotency-key':`${idempotencyKey}-${suffix}`},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!res.ok) throw Error('Photon could not prepare the SMS conversation.');
   return await res.json() as Record<string,unknown>;
  };
  const own=await post('/users',{platform:'sms',handle:senderPhone},'sender');
  if(own.projectId!==project || own.platform!=='sms' || own.kind!=='agent' || own.handle!==senderPhone || typeof own.id!=='string' || !entityId(own.id,'usr')) throw Error('Photon SMS number is not available as an agent.');
  const other=await post('/users',{platform:'sms',handle:recipientPhone},'recipient');
  if(other.projectId!==project || other.platform!=='sms' || other.kind!=='human' || other.handle!==recipientPhone || typeof other.id!=='string' || !entityId(other.id,'usr') || other.id===own.id) throw Error('Photon recipient could not be verified.');
  const space=await post('/spaces',{platform:'sms',participantIds:[own.id,other.id]},'space');
  if(space.projectId!==project || space.platform!=='sms' || space.kind!=='direct' || typeof space.id!=='string' || !entityId(space.id,'spc') || !Array.isArray(space.participantIds) || space.participantIds.length!==2 || !space.participantIds.includes(own.id) || !space.participantIds.includes(other.id)) throw Error('Photon conversation could not be verified.');
  return {spaceId:space.id,senderId:own.id,recipientId:other.id,recipientPhone};
 }
 async verifyTarget(target:PhotonTarget) {
  if (!entityId(target.spaceId,'spc') || !entityId(target.senderId,'usr') || !entityId(target.recipientId,'usr') || target.senderId===target.recipientId || !/^\+[1-9]\d{7,14}$/.test(target.recipientPhone)) throw Error('Enter valid Photon IDs and an E.164 recipient phone number.');
  const {url,key,project}=this.base();
  const get=async(path:string) => { const r=await this.request(url+path,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)}); if(!r.ok) throw Error('Could not verify Photon conversation and recipient.'); return await r.json() as Record<string,unknown>; };
  const [space,sender,recipient]=await Promise.all([get(`/spaces/${target.spaceId}`),get(`/users/${target.senderId}`),get(`/users/${target.recipientId}`)]);
  const participants=space.participantIds;
  if(space.projectId!==project || space.id!==target.spaceId || space.platform!=='sms' || space.kind!=='direct' || !Array.isArray(participants) || participants.length!==2 || !participants.includes(target.senderId) || !participants.includes(target.recipientId) || sender.projectId!==project || sender.id!==target.senderId || sender.platform!=='sms' || sender.kind!=='agent' || recipient.projectId!==project || recipient.id!==target.recipientId || recipient.platform!=='sms' || recipient.kind!=='human' || recipient.handle!==target.recipientPhone) throw Error('Photon conversation or recipient did not match the approved phone number.');
 }
 async send(target:PhotonTarget, body:string, key:string):Promise<string|null> {
  const {url,key:apiKey,project}=this.base();
  try {
   const r=await this.request(`${url}/messages`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':key},body:JSON.stringify({spaceId:target.spaceId,senderId:target.senderId,content:{type:'text',format:'plain',text:body}}),redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!r.ok) return null;
   const data=await r.json() as {id?:unknown;projectId?:unknown;space?:{id?:unknown};status?:unknown};
   if (typeof data.id!=='string' || !/^pho_msg_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(data.id) || data.projectId!==project || data.space?.id!==target.spaceId || !['dispatched','accepted','delivered'].includes(String(data.status))) return null;
   return data.id;
  } catch {return null;}
 }
}
