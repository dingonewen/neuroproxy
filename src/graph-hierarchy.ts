type GraphNode = {id:string;kind:string;label:string;status:string;source:string};
type GraphEdge = {id:string;source:string;target:string;label:string};
const evidence=[
 {key:'facts',label:'Reported Facts',kinds:['reported_fact']},
 {key:'feelings',label:'Expressed Feelings',kinds:['feeling']},
 {key:'needs',label:'Expressed Needs',kinds:['need']},
];
const later=[
 {key:'interpret',label:'Possible Interpretations',kinds:['interpretation']},
 {key:'question',label:'Core Question',kinds:['core_question']},
 {key:'action',label:'Suggested Next Action',kinds:['suggested_action']},
];
/** Visual-only review paths; relationships do not imply that a specific fact caused a specific feeling. */
export function graphHierarchy<T extends {nodes:GraphNode[];edges:GraphEdge[]}>(graph:T): {nodes:GraphNode[];edges:GraphEdge[]} {
 const nodes=[...graph.nodes],edges=[...graph.edges],byId=new Map(nodes.map(n=>[n.id,n]));
 const stages=[...evidence,...later];
 const candidates=graph.edges.filter(e=>stages.some(s=>s.kinds.includes(byId.get(e.target)?.kind ?? '')));
 for(const parent of new Set(candidates.map(e=>e.source))){
  const related=candidates.filter(e=>e.source===parent);
  const group=(key:string,label:string,parents:string[],matches:GraphEdge[])=>{
   const id=`visual-group:${parent}:${key}`;nodes.push({id,kind:'group',label,status:'',source:'layout'});
   for(const from of parents)edges.push({id:`visual-order:${parent}:${key}:${from}`,source:from,target:id,label:'review order'});
   for(const edge of matches){const index=edges.indexOf(edge);if(index>=0)edges.splice(index,1);edges.push({...edge,source:id});}
   return id;
  };
  const context=group('context','Relationship Context',[parent],[]);
  let previous=evidence.flatMap(stage=>{const matches=related.filter(e=>stage.kinds.includes(byId.get(e.target)?.kind ?? ''));return matches.length?[group(stage.key,stage.label,[context],matches)]:[];});
  if(!previous.length)previous=[context];
  for(const stage of later){const matches=related.filter(e=>stage.kinds.includes(byId.get(e.target)?.kind ?? ''));if(matches.length)previous=[group(stage.key,stage.label,previous,matches)];}
 }
 return {nodes,edges};
}
