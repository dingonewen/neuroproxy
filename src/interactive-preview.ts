// This module is activated only in the isolated static preview build.
export function installInteractivePreview() {
 window.fetch=async (input, init) => {
  const url=new URL(input instanceof Request ? input.url : String(input),window.location.href);
  const method=(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if(url.origin===window.location.origin && url.pathname==='/api/graph' && method==='GET') {
   return Response.json({nodes:[],edges:[],drafts:[]});
  }
  return Response.json({error:'Interactive preview only — AI, voice, saving, and messaging are disabled.'},{status:403});
 };
}
