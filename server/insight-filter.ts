import type { Extraction } from '../shared/extraction.ts';

type Relationship=NonNullable<Extraction['relationship']>;
type Insight={kind:string;text:string};
const kinds={facts:'reported_fact',feelings:'feeling',needs:'need',interpretations:'interpretation',coreQuestion:'core_question',nextAction:'suggested_action'} as const;
// Conservative lexical cosine: protect changes in negation or numbers from being discarded.
function features(value:string) {
 const normalized=value.normalize('NFKC').toLocaleLowerCase();
 const words=normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
 const tokens=words.flatMap(word=>/\p{Script=Han}/u.test(word) ? [...word].slice(0,-1).map((_,i)=>[...word].slice(i,i+2).join('')).concat(word.length===1?[word]:[]) : [word]);
 const counts=new Map<string,number>();for(const token of tokens)counts.set(token,(counts.get(token)??0)+1);
 return counts;
}
function similar(a:string,b:string) {
 const x=features(a),y=features(b);if(!x.size||!y.size)return false;
 const critical=(s:string)=>(s.toLocaleLowerCase().match(/\b(?:not|no|never|cannot|can't|won't|didn't|doesn't|isn't|don't|without|\d+)\b|不|没|无|未|别|没有/gu)??[]).sort().join('|');
 if(critical(a)!==critical(b))return false;
 let dot=0,xx=0,yy=0;for(const [k,v] of x){dot+=v*(y.get(k)??0);xx+=v*v;}for(const v of y.values())yy+=v*v;
 return dot/Math.sqrt(xx*yy)>=0.88;
}
export function filterInsights(relationship:Relationship, existing:Insight[], limit:number):Relationship {
 const result={...relationship};
 for(const key of ['facts','feelings','needs','interpretations'] as const){
  const seen=existing.filter(x=>x.kind===kinds[key]).map(x=>x.text);const selected:string[]=[];
  for(const text of relationship[key]){if(!seen.some(v=>similar(v,text))&&!selected.some(v=>similar(v,text))){selected.push(text);if(selected.length>=limit)break;}}
  result[key]=selected;
 }
 for(const key of ['coreQuestion','nextAction'] as const)if(existing.some(x=>x.kind===kinds[key]&&similar(x.text,relationship[key])))result[key]='';
 return result;
}
export function initialInsights(data:Extraction):Extraction {return data.relationship?{...data,relationship:filterInsights(data.relationship,[],3)}:data;}
