import { checkPhoton } from '../server/photon.ts';
const result = await checkPhoton({ apiKey: process.env.PHOTON_API_KEY, projectId: process.env.PHOTON_PROJECT_ID });
if (result.ok) {
 console.log('Photon 2.0 Beta: project API connection succeeded. This does not verify SMS activation or delivery.');
} else {
 const messages: Record<typeof result.reason,string> = {
  missing_config:'Set PHOTON_API_KEY and PHOTON_PROJECT_ID in .env.',
  invalid_config:'Check the project ID format and API key.',
  unauthorized:'Photon rejected the credential (401).',
  forbidden:'The credential lacks access to this project or endpoint (403).',
  http_error:'Photon returned an error response.',
  network_error:'Could not reach Photon, or the request timed out.',
  invalid_response:'Photon returned an unexpected response.',
 };
 console.error(`Photon 2.0 Beta check failed: ${messages[result.reason]}${result.status && result.reason === 'http_error' ? ` (HTTP ${result.status})` : ''}`);
 process.exitCode = 1;
}
