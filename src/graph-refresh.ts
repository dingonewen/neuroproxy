export type GraphSnapshot = {nodes:unknown[];edges:unknown[];drafts:unknown[]};

// Ignore older overlapping responses so background polling cannot undo a newer update.
export function createGraphRefresh<T extends GraphSnapshot>(request: typeof fetch, onGraph:(graph:T)=>void, onStatus:(message:string)=>void) {
 let newest=0;
 return async () => {
  const sequence=++newest;
  try {
   const response=await request('/api/graph',{cache:'no-store'});
   if (!response.ok) throw Error('Graph could not be loaded.');
   const value:unknown=await response.json();
   if (!value || typeof value!=='object' || !Array.isArray((value as GraphSnapshot).nodes) || !Array.isArray((value as GraphSnapshot).edges) || !Array.isArray((value as GraphSnapshot).drafts)) throw Error('Graph response was invalid.');
   if(sequence===newest) {onGraph(value as T);onStatus('');}
  } catch(error) {
   if(sequence===newest) {onStatus('Graph could not refresh. Check the backend connection.');throw error;}
  }
 };
}
