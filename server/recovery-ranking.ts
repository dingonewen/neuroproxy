import { groupGraph } from '../shared/graph-groups.ts';
import type { Store } from './store.ts';

type Graph = ReturnType<Store['graph']>;

// Split Han text into character bigrams; use word tokens for other scripts.
function tokens(text:string):string[] {
 const words=text.normalize('NFKC').toLocaleLowerCase().match(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu) ?? [];
 return words.flatMap(word=>/^\p{Script=Han}+$/u.test(word) && word.length>1 ? [...word].slice(0,-1).map((_,i)=>[...word].slice(i,i+2).join('')) : [word]);
}

export function bm25Scores(query:string,documents:string[]):number[] {
 const terms=[...new Set(tokens(query))];const docs=documents.map(tokens);
 const average=docs.reduce((sum,doc)=>sum+doc.length,0)/Math.max(docs.length,1) || 1;
 const frequencies=terms.map(term=>docs.filter(doc=>doc.includes(term)).length);
 return docs.map(doc=>terms.reduce((score,term,i)=>{
  const tf=doc.filter(token=>token===term).length;if(!tf)return score;
  const idf=Math.log(1+(docs.length-frequencies[i]+0.5)/(frequencies[i]+0.5));
  return score+idf*(tf*2.2)/(tf+1.2*(0.25+0.75*doc.length/average));
 },0));
}

// Rank whole conversations without discarding any results or breaking message/reply links.
export function rankRecoveryGraph(graph:Graph,query:string):Graph {
 const groups=groupGraph(graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label)})),graph.edges.map(e=>({source:String(e.source),target:String(e.target)})));
 const docs=groups.map(group=>graph.nodes.filter(n=>group.nodeIds.has(String(n.id))).map(n=>String(n.label)).join(' '));
 const scores=bm25Scores(query,docs);
 const order=groups.map((group,index)=>({group,index,score:scores[index]})).sort((a,b)=>b.score-a.score || a.index-b.index);
 const rank=new Map<string,number>();order.forEach(({group},i)=>group.nodeIds.forEach(id=>rank.set(id,i)));
 const nodeRank=(id:unknown)=>rank.get(String(id)) ?? order.length;
 const stable=<T>(items:T[],score:(item:T)=>number)=>items.map((value,index)=>({value,index})).sort((a,b)=>score(a.value)-score(b.value)||a.index-b.index).map(x=>x.value);
 return {...graph,nodes:stable(graph.nodes,n=>nodeRank(n.id)),edges:stable(graph.edges,e=>nodeRank(e.source)),drafts:stable(graph.drafts,d=>nodeRank(d.message_id))};
}
