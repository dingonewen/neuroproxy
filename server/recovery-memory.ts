import { groupGraph } from '../shared/graph-groups.ts';
import { bm25Scores } from './recovery-ranking.ts';
import type { Store } from './store.ts';

type Graph=ReturnType<Store['graph']>;
export type RecoverySource={id:string;conversationId:string;conversationLabel:string;kind:string;text:string;status:string;origin:string;autoReplyStatus?:string;incomingAtMs?:number;preparedAt?:string};
export type RecoveryContext={sources:RecoverySource[];edges:{source:string;target:string;label:string}[];partial:boolean;match:'keyword'|'recent'|'auto-reply'};

/** Bounded, read-only retrieval over the existing Graph; no contact addresses are included. */
export function recallMemory(graph:Graph,question:string,limit=16):RecoveryContext {
 const max=Math.max(1,Math.min(Math.floor(limit)||16,24));
 const nodes=graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label),status:String(n.status),source:String(n.source)}));
 const edges=graph.edges.map(e=>({source:String(e.source),target:String(e.target),label:String(e.label)}));
 const groups=groupGraph(nodes,edges);const groupByNode=new Map<string,{id:string;label:string}>();
 for(const group of groups)for(const id of group.nodeIds)groupByNode.set(id,{id:group.id,label:group.label});
 const nodeById=new Map(nodes.map(n=>[n.id,n]));
 const draftsByMessage=new Map(graph.drafts.map(d=>[String(d.message_id),d]));
 const scores=bm25Scores(question,nodes.map(n=>n.label));
 const groupScores=bm25Scores(question,groups.map(group=>nodes.filter(n=>group.nodeIds.has(n.id)).map(n=>n.label).join(' ')));
 const scoreByGroup=new Map(groups.map((group,i)=>[group.id,groupScores[i]]));
 const wantsAuto=/auto[\s-]*repl|automatic|automatically|自动回复|自动回|自动发送/i.test(question);
 const candidates=nodes.map((node,index)=>{const draft=draftsByMessage.get(node.id);const auto=!!draft?.auto_generated;return {node,index,score:scores[index]+(scoreByGroup.get(groupByNode.get(node.id)?.id ?? '') ?? 0)*0.15+(wantsAuto&&auto?4:0)};});
 const matched=candidates.some(c=>c.score>0);
 candidates.sort((a,b)=>b.score-a.score || b.index-a.index);
 const chosen=new Set<string>();
 for(const c of candidates){if(chosen.size>=Math.max(1,Math.floor(max/2)))break;if(matched && c.score<=0)break;chosen.add(c.node.id);}
 // Keep message/reply context linked without expanding every node attached to a topic.
 const related=new Set(['reply','possible reply','follow-up','draft','recipient','from']);
 for(const edge of edges){if(chosen.size>=max)break;if(!related.has(edge.label))continue;if(chosen.has(edge.source)&&nodeById.has(edge.target))chosen.add(edge.target);if(chosen.size<max&&chosen.has(edge.target)&&nodeById.has(edge.source))chosen.add(edge.source);}
 const selected=nodes.filter(n=>chosen.has(n.id)).map(n=>{
  const group=groupByNode.get(n.id) ?? {id:'unlinked',label:'Unlinked messages'};const draft=draftsByMessage.get(n.id);
  const source:RecoverySource={id:n.id,conversationId:group.id,conversationLabel:group.label,kind:n.kind,text:n.label.slice(0,1000),status:n.status,origin:n.source};
  if(draft?.auto_generated){source.origin='auto_reply';if(draft.auto_reply_status)source.autoReplyStatus=String(draft.auto_reply_status);if(typeof draft.auto_reply_received_at_ms==='number')source.incomingAtMs=draft.auto_reply_received_at_ms;if(draft.photon_prepared_at)source.preparedAt=String(draft.photon_prepared_at);}
  return source;
 });
 return {sources:selected,edges:edges.filter(e=>chosen.has(e.source)&&chosen.has(e.target)),partial:selected.length<nodes.length,match:wantsAuto&&candidates.some(c=>!!draftsByMessage.get(c.node.id)?.auto_generated)?'auto-reply':matched?'keyword':'recent'};
}

/** Accept source markers only for nodes actually returned by this request's tool. */
export function validateRecoveryCitations(answer:string,recalled:Map<string,RecoverySource>):{answer:string;sources:RecoverySource[]} {
 const ids:string[]=[];const cleaned=answer.replace(/\[\[source:([\w-]+)\]\]/gi,(_marker:string,id:string)=>{if(recalled.has(id)&&!ids.includes(id))ids.push(id);return '';}).trim();
 return {answer:cleaned,sources:ids.map(id=>recalled.get(id)!)};
}
