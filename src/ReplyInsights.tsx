import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Extraction } from '../shared/extraction';
import { InfoTip } from './InfoTip';

type Relationship = NonNullable<Extraction['relationship']>;
const names = {facts:{title:'Reported Facts',item:'Fact'},feelings:{title:'Expressed Feelings',item:'Feeling'},needs:{title:'Expressed Needs',item:'Need'},interpretations:{title:'Possible Interpretations',item:'Interpretation'}} as const;

export function ReplyInsights({replyId,person,onSaved,analyzed}:{replyId:string;person:string;onSaved:()=>Promise<void>;analyzed:boolean}) {
 const [result,setResult]=useState<Relationship|null>(null);const [analysisSaved,setAnalysisSaved]=useState(false);const [suggestedReply,setSuggestedReply]=useState('');const [action,setAction]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 async function analyze() {
  setBusy(true);setNotice('');setResult(null);setAnalysisSaved(false);
  try {
   const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/analyze`,{method:'POST'});
   if(res.status===404)throw Error('The reply analysis endpoint is unavailable. Restart the backend and try again.');
   const data=await res.json();
   if(!res.ok)throw Error(data.error);setResult(data.relationship);setSuggestedReply(data.suggestedReply ?? '');setAction(data.relationship.nextAction || 'Reply to '+person);
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function createDraft() {
  if(!suggestedReply.trim() || !action.trim())return;setBusy(true);setNotice('');
  try {const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/draft`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:suggestedReply,action})});const data=await res.json();if(!res.ok)throw Error(data.error);setSuggestedReply('');setAnalysisSaved(false);setResult(null);await onSaved();setNotice('Follow-up draft created in Messages & Drafts. Review and approve before sending.');}
  catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function save() {
  if(!result)return;setBusy(true);setNotice('');
  try {
   const clean={...result,facts:result.facts.filter(x=>x.trim()),feelings:result.feelings.filter(x=>x.trim()),needs:result.needs.filter(x=>x.trim()),interpretations:result.interpretations.filter(x=>x.trim())};
   const res=await fetch(`/api/replies/${encodeURIComponent(replyId)}/insights`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(clean)});const data=await res.json();if(!res.ok)throw Error(data.error);setAnalysisSaved(true);await onSaved();setNotice('Reviewed analysis saved to this reply in the graph.');
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 return <div>{!analyzed && !result && <><p className="helper-text">Analyze this reply and suggest a next message. Conversation context and messages are sent to your configured AI provider.</p><div className="reply-analysis-actions"><button type="button" disabled={busy} onClick={analyze}>{busy?'Working…':<><Sparkles className="button-icon" aria-hidden="true"/>Analyze this reply</>}</button></div></>}
  {result && !analysisSaved && <div className="reply-review">
   <div className="review-heading"><h3>Review Reply Analysis</h3></div>
   <div className="topic-card">
    <div className="category-card relationship-card"><div className="category-heading"><h4>Relationship Context <InfoTip>Reported facts and expressed feelings are distinct from possible interpretations. Review before saving.</InfoTip></h4></div>
     {(Object.keys(names) as (keyof typeof names)[]).map(key=><div className="relationship-group" key={key}><h5>{names[key].title}</h5>
      {result[key].map((value,i)=><div className="nested-card" key={i}><label>{names[key].item} {i+1}<input maxLength={500} value={value} onChange={e=>setResult({...result,[key]:result[key].map((v,j)=>j===i?e.target.value:v)})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,[key]:result[key].filter((_,j)=>j!==i)})}>Remove</button></div>)}
      <button className="add-button" type="button" disabled={busy||result[key].length>=10} onClick={()=>setResult({...result,[key]:[...result[key],'']})}>+ Add {names[key].item.toLowerCase()}</button>
     </div>)}
     <div className="nested-card"><label>Core Question<input maxLength={500} value={result.coreQuestion} onChange={e=>setResult({...result,coreQuestion:e.target.value})}/></label></div>
     <div className="nested-card"><label>Suggested Next Action<input maxLength={500} value={result.nextAction} onChange={e=>setResult({...result,nextAction:e.target.value})}/></label></div>
    </div>

   </div>
   <div className="review-actions reply-review-actions"><button type="button" disabled={busy} onClick={save}>Save Reviewed Analysis</button><button className="secondary-button" type="button" disabled={busy} onClick={()=>setResult(null)}>Discard</button></div>
  </div>}
  {result && analysisSaved && <div className="reply-review"><div className="topic-card">
    <div className="category-card"><div className="category-heading"><h4>Suggested Reply <InfoTip>Review and edit this draft. Sending requires separate approval.</InfoTip></h4></div><div className="nested-card"><label>Action<input maxLength={500} value={action} onChange={e=>setAction(e.target.value)}/></label><label>Message<textarea maxLength={2000} value={suggestedReply} onChange={e=>setSuggestedReply(e.target.value)}/></label></div>{!suggestedReply && <p className="helper-text">No reply was suggested. You can write one if appropriate.</p>}<div className="manual-actions"><button className="secondary-button" type="button" disabled={busy || !suggestedReply.trim() || !action.trim()} onClick={createDraft}>Create Follow-up Draft</button></div></div>
  </div></div>}
  {notice && <p className="helper-text" role="status">{notice}</p>}
 </div>;
}
