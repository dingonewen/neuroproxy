export type GroupNode = {id:string;kind:string;label:string};
export type GroupEdge = {source:string;target:string};
export type GraphGroup = {id:string;label:string;nodeIds:Set<string>};

/** Partition the persisted graph into connected components without changing stored data. */
export function groupGraph(nodes:GroupNode[],edges:GroupEdge[]):GraphGroup[] {
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const neighbours=new Map(nodes.map(node=>[node.id,new Set<string>()]));
 for(const edge of edges) if(byId.has(edge.source)&&byId.has(edge.target)) {neighbours.get(edge.source)!.add(edge.target);neighbours.get(edge.target)!.add(edge.source);}
 const seen=new Set<string>();const groups:GraphGroup[]=[];const orphans=new Set<string>();
 // Newest topic is first; old records have no separate conversation table.
 for(const root of [...nodes].reverse()) {
  if(root.kind!=='topic'||seen.has(root.id)) continue;
  const ids=new Set<string>();const queue=[root.id];seen.add(root.id);
  for(let i=0;i<queue.length;i++) {const id=queue[i];ids.add(id);for(const next of neighbours.get(id)??[]) if(!seen.has(next)){seen.add(next);queue.push(next);}}
  groups.push({id:root.id,label:root.label,nodeIds:ids});
 }
 for(const node of nodes) if(!seen.has(node.id)) orphans.add(node.id);
 if(orphans.size) groups.push({id:'unlinked',label:'Unlinked messages',nodeIds:orphans});
 return groups;
}
