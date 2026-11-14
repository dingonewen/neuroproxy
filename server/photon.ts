/** Read-only Photon 2.0 Beta connectivity check.
 * https://photon.codes/docs/beta/api-reference/spaces/list-spaces
 */
export type PhotonCheck = { ok: true } | { ok: false; reason: 'missing_config' | 'invalid_config' | 'unauthorized' | 'forbidden' | 'http_error' | 'network_error' | 'invalid_response'; status?: number };

type PhotonConfig = { apiKey?: string; projectId?: string };
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
