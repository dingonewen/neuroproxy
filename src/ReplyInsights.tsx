import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Extraction } from '../shared/extraction';
import { InfoTip } from './InfoTip';
import { ExpandingInsightInput, InsightReviewField } from './InsightReviewField';
import type { ReplyProgress } from '../shared/reply-progress';

type Relationship = NonNullable<Extraction['relationship']>;
const names = {facts:{title:'Reported Facts',item:'Fact'},feelings:{title:'Expressed Feelings',item:'Feeling'},needs:{title:'Expressed Needs',item:'Need'},interpretations:{title:'Possible Interpretations',item:'Interpretation'}} as const;
const pendingWrites=new Map<string,Promise<void>>();
function persistProgress(replyId:string,progress:ReplyProgress) {
 const previous=pendingWrites.get(replyId) ?? Promise.resolve();
 const next=previous.catch(()=>{}).then(async()=>{const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/progress`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(progress),keepalive:true});if(!res.ok)throw Error('Could not save reply progress.');});
 pendingWrites.set(replyId,next);void next.then(()=>{if(pendingWrites.get(replyId)===next)pendingWrites.delete(replyId);},()=>{if(pendingWrites.get(replyId)===next)pendingWrites.delete(replyId);});return next;
}

export function ReplyInsights({replyId,person,onSaved,analyzed,hasFollowUp}:{replyId:string;person:string;onSaved:()=>Promise<void>;analyzed:boolean;hasFollowUp:boolean}) {
 const [result,setResult]=useState<Relationship|null>(null);const [analysisSaved,setAnalysisSaved]=useState(false);const [suggestedReply,setSuggestedReply]=useState('');const [action,setAction]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');const [loadAttempt,setLoadAttempt]=useState(0);
 const latest=useRef<ReplyProgress|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const applyProgress=(progress:ReplyProgress)=>{setResult(progress.relationship);setAnalysisSaved(progress.stage==='suggested');setSuggestedReply(progress.suggestedReply);setAction(progress.action);};
 useEffect(()=>{const flush=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;if(latest.current)void persistProgress(replyId,latest.current).catch(()=>{});}};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[replyId]);
 useEffect(()=>{let active=true;setLoading(true);setLoadError('');(async()=>{try{await pendingWrites.get(replyId);while(active){const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/progress`,{cache:'no-store'});if(!res.ok)throw Error('Could not restore reply progress.');const data=await res.json() as {progress:ReplyProgress|null;processing:boolean};if(data.progress){if(active)applyProgress(data.progress);break;}if(!data.processing)break;await new Promise(resolve=>setTimeout(resolve,1200));}}catch{if(active)setLoadError('Could not restore reply progress. Check the backend and try again.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[replyId,loadAttempt]);
 useEffect(()=>{if(loading||loadError||!result){latest.current=null;return;}const progress:ReplyProgress={stage:analysisSaved?'suggested':'review',relationship:result,suggestedReply,action};latest.current=progress;timer.current=setTimeout(()=>{timer.current=null;void persistProgress(replyId,progress).catch(()=>setNotice('Could not save reply progress. Check the backend connection.'));},400);return()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};},[replyId,result,analysisSaved,suggestedReply,action,loading,loadError]);
 async function flushProgress(progress:ReplyProgress){if(timer.current){clearTimeout(timer.current);timer.current=null;}await persistProgress(replyId,progress);}
 async function analyze() {
  setBusy(true);setNotice('');setResult(null);setAnalysisSaved(false);
  try {
   const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/analyze`,{method:'POST'});
   if(res.status===404)throw Error('The reply analysis endpoint is unavailable. Restart the backend and try again.');
   const data=await res.json();
   if(!res.ok)throw Error(data.error);applyProgress(data);
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function createDraft() {
  if(!suggestedReply.trim() || !action.trim())return;setBusy(true);setNotice('');
  try {if(result)await flushProgress({stage:'suggested',relationship:result,suggestedReply,action});const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/draft`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:suggestedReply,action})});const data=await res.json();if(!res.ok)throw Error(data.error);latest.current=null;setSuggestedReply('');setAnalysisSaved(false);setResult(null);await onSaved();setNotice('Follow-up draft created in Messages. Review and approve before sending.');}
  catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function save() {
  if(!result)return;setBusy(true);setNotice('');
  try {
   const clean={...result,facts:result.facts.filter(x=>x.trim()),feelings:result.feelings.filter(x=>x.trim()),needs:result.needs.filter(x=>x.trim()),interpretations:result.interpretations.filter(x=>x.trim())};
   await flushProgress({stage:'review',relationship:result,suggestedReply,action});const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/insights`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(clean)});const data=await res.json();if(!res.ok)throw Error(data.error);setResult(clean);setAnalysisSaved(true);await onSaved();setNotice('Reviewed analysis saved to this reply in the graph.');
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function discard(){setBusy(true);setNotice('');try{if(timer.current){clearTimeout(timer.current);timer.current=null;}await pendingWrites.get(replyId);const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/progress`,{method:'DELETE'});if(!res.ok)throw Error('Could not discard reply analysis.');latest.current=null;setResult(null);setSuggestedReply('');setAction('');}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <div>{loading && <p className="helper-text" role="status">Restoring reply progress…</p>}{loadError && <><p className="helper-text" role="alert">{loadError}</p><button type="button" className="secondary-button" onClick={()=>setLoadAttempt(n=>n+1)}>Retry</button></>}{!loading&&!loadError&&!result&&!hasFollowUp && <><p className="helper-text">{analyzed?'The earlier analysis was saved, but its suggested reply was not kept. Analyze again if you need a new suggestion.':'Analyze this reply and suggest a next message. Conversation context goes to your AI provider; if configured, insight text also goes to Cloudflare for semantic deduplication.'}</p><div className="reply-analysis-actions"><button type="button" disabled={busy} onClick={analyze}>{busy?'Working…':<><Sparkles className="button-icon" aria-hidden="true"/>{analyzed?'Analyze again':'Analyze this reply'}</>}</button></div></>}
  {result && !hasFollowUp && !analysisSaved && <div className="reply-review">
    <h2 className="delegations-heading reply-section-heading"><InfoTip>Reported facts and expressed feelings are distinct from possible interpretations. Review before saving.</InfoTip> Reply Analysis</h2>
     {(Object.keys(names) as (keyof typeof names)[]).map(key=><div className="relationship-group" key={key}><h5>{names[key].title}</h5>
      {result[key].map((value,i)=><InsightReviewField key={i} label={`${names[key].item} ${i+1}`} value={value} onChange={text=>setResult({...result,[key]:result[key].map((v,j)=>j===i?text:v)})} onRemove={()=>setResult({...result,[key]:result[key].filter((_,j)=>j!==i)})}/>)}
      <button className="add-button" type="button" disabled={busy||result[key].length>=10} onClick={()=>setResult({...result,[key]:[...result[key],'']})}>+ Add {names[key].item.toLowerCase()}</button>
     </div>)}
     <div className="nested-card"><label>Core Question<ExpandingInsightInput value={result.coreQuestion} onChange={text=>setResult({...result,coreQuestion:text})}/></label></div>
     <div className="nested-card"><label>Suggested Next Action<ExpandingInsightInput value={result.nextAction} onChange={text=>setResult({...result,nextAction:text})}/></label></div>
   <div className="review-actions reply-review-actions"><button type="button" disabled={busy} onClick={save}>Save Reviewed Analysis</button><button className="secondary-button" type="button" disabled={busy} onClick={()=>void discard()}>Discard</button></div>
  </div>}
  {result && !hasFollowUp && analysisSaved && <div className="reply-review">
    <h2 className="delegations-heading reply-section-heading"><InfoTip>Review and edit this draft. Sending requires separate approval.</InfoTip> Suggested Reply</h2>
    <div className="reply-draft-fields"><label>Action<ExpandingInsightInput value={action} onChange={setAction}/></label><label>Message<textarea className="reply-message-input" maxLength={2000} value={suggestedReply} onChange={e=>setSuggestedReply(e.target.value)}/></label></div>{!suggestedReply && <p className="helper-text">No reply was suggested. You can write one if appropriate.</p>}<div className="manual-actions"><button className="secondary-button" type="button" disabled={busy || !suggestedReply.trim() || !action.trim()} onClick={createDraft}>Draft</button></div>
  </div>}
  {notice && <p className="helper-text" role="status">{notice}</p>}
 </div>;
}
