/** Recognize opt-out commands without treating ordinary uses of "stop" as a request to end contact. */
export function isAutoReplyOptOut(text:string):boolean {
 const value=text.normalize('NFKC').trim();
 return /^(?:please\s+)?(?:stop|unsubscribe(?:\s+me)?|opt\s*out)(?:\s+please)?[.!?\s]*$/i.test(value)
  || /\b(?:stop\s+(?:contacting|messaging|texting)|do not\s+(?:contact|message|text)|don['’]t\s+(?:contact|message|text))\s+me\b|\bleave me alone\b|不要再联系|别再联系|停止联系/i.test(value);
}

/** Compare with the previous outbound message; do not treat an AutoReply label as message content. */
export function repeatsPreviousMessage(candidate:string,previous:string):boolean {
 const normalize=(text:string)=>text.replace(/^\s*\[NeuroProxy AutoReply\]\s*/i,'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
 const a=normalize(candidate),b=normalize(previous);
 if(!a || !b)return false;
 if(a===b)return true;
 // Only catch close copies of longer messages; short acknowledgements can legitimately recur.
 const left=a.split(' '),right=b.split(' ');
 if(left.length<5 || right.length<5 || Math.min(a.length,b.length)/Math.max(a.length,b.length)<0.85)return false;
 const counts=new Map<string,number>();for(const word of left)counts.set(word,(counts.get(word)??0)+1);
 let common=0;for(const word of right){const count=counts.get(word)??0;if(count){common++;counts.set(word,count-1);}}
 return 2*common/(left.length+right.length)>=0.9;
}
