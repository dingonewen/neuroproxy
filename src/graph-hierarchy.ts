type GraphNode = {id:string;kind:string;label:string;status:string;source:string};
type GraphEdge = {id:string;source:string;target:string;label:string};
const stages = [
 {key:'context',label:'Relationship context', kinds:[] as string[]},
 {key:'reported',label:'Reported context', kinds:['reported_fact','feeling','need']},
 {key:'interpret',label:'Possible interpretations', kinds:['interpretation']},
 {key:'question',label:'Core question', kinds:['core_question']},
 {key:'action',label:'Suggested next action', kinds:['suggested_action']},
];
/** Add visual-only groups; sequential headers indicate review order, not causation. */
export function graphHierarchy<T extends {nodes:GraphNode[];edges:GraphEdge[]}>(graph:T): {nodes:GraphNode[];edges:GraphEdge[]} {
 const nodes=[...graph.nodes];const edges=[...graph.edges];const byId=new Map(nodes.map(n=>[n.id,n]));
 const candidates=graph.edges.filter(e=>stages.some(s=>s.kinds.includes(byId.get(e.target)?.kind ?? '')));
 const parents=[...new Set(candidates.map(e=>e.source))];
 for(const parent of parents){
  const related=candidates.filter(e=>e.source===parent);let previous=parent;
  for(const stage of stages){
   const matches=related.filter(e=>stage.kinds.includes(byId.get(e.target)?.kind ?? ''));
   if(stage.key!=='context' && !matches.length)continue;
   const groupId=`visual-group:${parent}:${stage.key}`;
   nodes.push({id:groupId,kind:'group',label:stage.label,status:'',source:'layout'});
   edges.push({id:`visual-order:${parent}:${stage.key}`,source:previous,target:groupId,label:stage.key==='context'?'context':'review order'});
   for(const edge of matches){const index=edges.indexOf(edge);if(index>=0)edges.splice(index,1);edges.push({...edge,source:groupId});}
   previous=groupId;
  }
 }
 return {nodes,edges};
}
