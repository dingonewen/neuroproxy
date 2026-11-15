/** Show routing failures without displaying HTML, login pages, or raw server responses. */
export async function readApiJson(response:Response) {
 if(response.status===524)throw Error('Cloudflare timed out waiting for the backend. Restart the backend to load the timeout fix, then try again.');
 const text=await response.text();
 if(response.headers.get('content-type')?.includes('text/html') || /^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) {
  throw Error('The API returned a web page instead of JSON. Reload to renew sign-in, then check the backend and /api routing. The public preview does not support AI requests.');
 }
 try{return JSON.parse(text);}
 catch{throw Error(`The API returned an invalid response (HTTP ${response.status}). Check the backend connection.`);}
}
