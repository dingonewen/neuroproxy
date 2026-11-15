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

// Semantic removal is intentionally strict: preserve protected details and names.
function protectedDetails(text:string) {
 const negation=text.toLocaleLowerCase().match(/\b(?:not|no|never|cannot|can't|won't|didn't|doesn't|isn't|don't|without|i|me|my|you|your|he|him|she|her|they|them|we|us|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+)\b/gu) ?? [];
 const names=text.match(/\b[A-Z][a-z]{2,}\b/g)?.filter(x=>!['The','This','That','They','Their','There','When','What','How','Why','And','But','She','Her','You','Your','His','Him'].includes(x)) ?? [];
 return [...negation,...names.map(n=>n.toLowerCase())].sort().join('|');
}
function vectorCosine(a:number[],b:number[]) {
 let dot=0,x=0,y=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];x+=a[i]*a[i];y+=b[i]*b[i];}return x && y ? dot/Math.sqrt(x*y) : 0;
}

/** Optional high-threshold semantic deduplication, constrained to same category. */
export async function semanticFilterInsights(relationship:Relationship,existing:Insight[],limit:number,embed:import('./embeddings.ts').Embedder|null):Promise<Relationship> {
 const lexical=filterInsights(relationship,existing,limit);
 if(!embed)return lexical;
 const keys=['facts','feelings','needs','interpretations'] as const;
 const entries:{kind:string;text:string;candidate:boolean}[]=[];
 for(const key of keys){for(const x of existing.filter(x=>x.kind===kinds[key] && !/\p{Script=Han}/u.test(x.text)).slice(-12))entries.push({...x,candidate:false});for(const text of lexical[key])if(text.trim() && !/\p{Script=Han}/u.test(text))entries.push({kind:kinds[key],text,candidate:true});}
 if(entries.length<2 || entries.length>64)return lexical;
 try {
  const vectors=await embed(entries.map(e=>e.text));
  if(vectors.length!==entries.length || !vectors.length || vectors.some(v=>v.length!==vectors[0].length || !v.length || v.some(n=>!Number.isFinite(n))))return lexical;
  const suppressed=new Set<string>();
  for(let i=0;i<entries.length;i++){
   const candidate=entries[i];if(!candidate.candidate || /\p{Script=Han}/u.test(candidate.text))continue;
   for(let j=0;j<i;j++){
    const prev=entries[j];if(prev.kind!==candidate.kind || suppressed.has(`${prev.kind}\0${prev.text}`) || /\p{Script=Han}/u.test(prev.text))continue;
    if(candidate.text.trim().split(/\s+/u)[0].toLocaleLowerCase()===prev.text.trim().split(/\s+/u)[0].toLocaleLowerCase() && protectedDetails(candidate.text)===protectedDetails(prev.text) && vectorCosine(vectors[i],vectors[j])>=0.97){suppressed.add(`${candidate.kind}\0${candidate.text}`);break;}
   }
  }
  const result={...lexical};for(const key of keys)result[key]=lexical[key].filter(text=>!suppressed.has(`${kinds[key]}\0${text}`));return result;
 }catch{return lexical;}
}
