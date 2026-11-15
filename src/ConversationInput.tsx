import { StatusNotice } from './StatusNotice';
import { MessageCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Extraction } from '../shared/extraction';
import { InfoTip } from './InfoTip';
import { ExpandingInsightInput, InsightReviewField } from './InsightReviewField';
import { EmptyCurve } from './EmptyCurve';
import { SavedContext } from './SavedContext';
import { optionLabel } from './option-label';
import { VoiceInput } from './VoiceInput';
import { readApiJson } from './api-response';

export function ConversationInput({ onSaved, onPreview, savedNodes, showingPreview, navigation, onRefresh }: { onSaved: (topicId:string, context:Extraction, draftId:string|null) => Promise<void>; onPreview:(result:Extraction|null)=>void; savedNodes:{id:string;kind:string;label:string;status:string;source:string;contact_id?:string|null;contact_name?:string|null;contact_handle?:string|null}[]; showingPreview:boolean; navigation:{id:string;nonce:number}|null; onRefresh:()=>Promise<void> }) {
 const [text, setText] = useState('');
 const [languageSlot,setLanguageSlot]=useState<HTMLDivElement|null>(null);
 const [listening,setListening]=useState(false);
 const [result, setResult] = useState<Extraction | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [saved, setSaved] = useState(false);
 useEffect(()=>{onPreview(result);},[result,onPreview]);
 useEffect(()=>{if(!navigation)return;const target=document.getElementById(`context-${navigation.id}`);if(!target)return;target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.remove('node-highlight');void target.offsetWidth;target.classList.add('node-highlight');const timer=window.setTimeout(()=>target.classList.remove('node-highlight'),2400);return ()=>window.clearTimeout(timer);},[navigation]);
 async function analyze() {
  setBusy(true); setError(''); setSaved(false); setResult(null);
  try {
   const res = await fetch('/api/extract', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({text}) });
   const data = await readApiJson(res); if (!res.ok) throw new Error(data.error); setResult(data);
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 async function save() {
  if (!result) return;
  setBusy(true); setError('');
  try {
   const relationship=result.relationship ? {...result.relationship, facts:result.relationship.facts.filter(v=>v.trim()),feelings:result.relationship.feelings.filter(v=>v.trim()),needs:result.relationship.needs.filter(v=>v.trim()),interpretations:result.relationship.interpretations.filter(v=>v.trim())} : result.relationship;
   const reviewed={...result,relationship};
   const res = await fetch('/api/reviewed-context', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(reviewed) });
   const data = await readApiJson(res); if (!res.ok) throw new Error(data.error);
   setResult(null); setSaved(true);
   try { await onSaved(data.topicId, reviewed, data.draftId ?? null); } catch { setError('Saved, but the graph could not refresh. Reload the page.'); }
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 return <section className="conversation-panel" id="understand">
  <div className="panel-heading"><span className="eyebrow">01 / Understand</span><h2><MessageCircle className="heading-icon" aria-hidden="true"/>Hear the Meaning</h2></div>
  <div className="input-label"><label htmlFor="conversation-text">Conversation</label><InfoTip>Analyze, review the suggestions, then save them to the graph.</InfoTip><div className="language-slot" ref={setLanguageSlot}/></div><textarea id="conversation-text" className="conversation-textarea" maxLength={8000} disabled={busy||listening} value={text} onChange={e=>{setText(e.target.value); setResult(null); setSaved(false);}} />
  <div className="conversation-input-actions"><VoiceInput languageSlot={languageSlot} disabled={busy} onListeningChange={setListening} onTranscript={part=>{setText(previous=>(previous ? `${previous.trimEnd()} ${part}` : part).slice(0,8000));setResult(null);setSaved(false);}}/>
  <div className="analyze-actions"><button className="analyze-button" type="button" disabled={busy || listening || !text.trim()} onClick={analyze}>{busy ? 'Working…' : <><Sparkles className="button-icon" aria-hidden="true"/>Analyze</>}</button></div></div>
  {error && <p role="alert">{error}</p>}{saved && <StatusNotice message="Saved to the graph. Any message draft still requires approval."/>}
  {result && showingPreview && <fieldset disabled={busy} className="review"><div className="review-heading"><h3>Review Before Saving</h3><p>Correct or remove anything inaccurate.</p></div>
   <div className="topic-card saved-topic-card review-topic-card" id="context-preview-topic"><label className="topic-title">Topic<input value={result.topic} onChange={e=>setResult({...result,topic:e.target.value})}/></label>
    <div className="saved-overview-grid"><div><div className="category-card"><div className="category-heading"><h4>People</h4><span>{result.people.length}</span></div>
     {result.people.map((person,i)=><div className="nested-card" id={`context-preview-person-${i}`} key={i}><label>Person {i+1}<input value={person} onChange={e=>setResult({...result,people:result.people.map((p,j)=>j===i?e.target.value:p),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:e.target.value}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.map(p=>p===person?e.target.value:p)})),draft:result.draft?.recipient===person?{...result.draft,recipient:e.target.value}:result.draft})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,people:result.people.filter((_,j)=>j!==i),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:''}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.filter(p=>p!==person)})),draft:result.draft?.recipient===person?{...result.draft,recipient:''}:result.draft})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,people:[...result.people,'']})}>+ Add person</button></div>
    <div className="category-card"><div className="category-heading"><h4>Tasks</h4><span>{result.tasks.length}</span></div>
     {result.tasks.map((task,i)=><div className="nested-card" id={`context-preview-task-${i}`} key={i}><label>Task {i+1}<ExpandingInsightInput value={task.description} onChange={text=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,description:text}:t)})}/></label><label>Assignee (optional)<select title={task.assignee} value={task.assignee} onChange={e=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,assignee:e.target.value}:t)})}><option value="">Unknown</option>{result.people.filter(Boolean).map((p,j)=><option key={j} value={p} title={p}>{optionLabel(p)}</option>)}</select></label><button className="text-button" type="button" onClick={()=>setResult({...result,tasks:result.tasks.filter((_,j)=>j!==i),draft:result.draft ? {...result.draft,taskIndex:null} : null})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,tasks:[...result.tasks,{description:'',assignee:''}]})}>+ Add task</button></div>
    </div><div><div className="category-card"><div className="category-heading"><h4>Unresolved Questions <InfoTip>Choose only related people; leave blank if unknown.</InfoTip></h4><span>{result.uncertainties.length}</span></div>
     {result.uncertainties.map((item,i)=><div className="nested-card" id={`context-preview-question-${i}`} key={i}><label>Question {i+1}<ExpandingInsightInput value={item.question} onChange={text=>setResult({...result,uncertainties:result.uncertainties.map((v,j)=>j===i?{...v,question:text}:v)})}/></label><span className="field-caption">Related people</span>{result.people.filter(Boolean).map((person,j)=><label className="inline-choice" key={j}><input type="checkbox" checked={item.people.includes(person)} onChange={e=>setResult({...result,uncertainties:result.uncertainties.map((q,k)=>k===i?{...q,people:e.target.checked?[...q.people,person]:q.people.filter(p=>p!==person)}:q)})}/>{person}</label>)}<button className="text-button" type="button" onClick={()=>setResult({...result,uncertainties:result.uncertainties.filter((_,j)=>j!==i)})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,uncertainties:[...result.uncertainties,{question:'',people:[]}]})}>+ Add question</button></div>
    </div></div><div className="category-card saved-relationship-card" id="context-relationship-section"><div className="category-heading"><h4>Relationship Context <InfoTip>Reported facts come from the conversation. Possible interpretations are not confirmed facts. Review before saving.</InfoTip></h4></div>
     {result.relationship ? <><div className="saved-relationship-grid">
      {(['facts','feelings','needs','interpretations'] as const).map(key=><div className="relationship-group saved-relationship-group" key={key}><h5>{({facts:'Reported Facts',feelings:'Expressed Feelings',needs:'Expressed Needs',interpretations:'Possible Interpretations'})[key]}</h5>{result.relationship![key].map((value,i)=><InsightReviewField key={i} id={`context-preview-${({facts:'fact',feelings:'feeling',needs:'need',interpretations:'interpretation'})[key]}-${i}`} label={`${({facts:'Fact',feelings:'Feeling',needs:'Need',interpretations:'Interpretation'})[key]} ${i+1}`} value={value} onChange={text=>setResult({...result,relationship:{...result.relationship!,[key]:result.relationship![key].map((v,j)=>j===i?text:v)}})} onRemove={()=>setResult({...result,relationship:{...result.relationship!,[key]:result.relationship![key].filter((_,j)=>j!==i)}})}/>)}<button className="add-button" type="button" onClick={()=>setResult({...result,relationship:{...result.relationship!,[key]:[...result.relationship![key],'']}})}>+ Add {({facts:'fact',feelings:'feeling',needs:'need',interpretations:'interpretation'})[key]}</button></div>)}
      <div className="nested-card" id="context-preview-core"><label>Core Question<ExpandingInsightInput value={result.relationship.coreQuestion} onChange={text=>setResult({...result,relationship:{...result.relationship!,coreQuestion:text}})}/></label></div>
      <div className="nested-card" id="context-preview-action"><label>Suggested Next Action<ExpandingInsightInput value={result.relationship.nextAction} onChange={text=>setResult({...result,relationship:{...result.relationship!,nextAction:text}})}/></label></div>
      </div><button className="text-button" type="button" onClick={()=>setResult({...result,relationship:null})}>Remove relationship context</button>
     </> : <button className="add-button" type="button" onClick={()=>setResult({...result,relationship:{facts:[],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:''}})}>+ Add relationship context</button>}
    </div>
    <div className="category-card"><h4>Suggested Message Draft <InfoTip>Saving creates a draft only. Sending requires separate approval.</InfoTip></h4>{result.draft ? <div className="nested-card" id="context-preview-message"><label>Recipient<select title={result.draft.recipient} value={result.draft.recipient} onChange={e=>setResult({...result,draft:{...result.draft!,recipient:e.target.value}})}><option value="">Choose a person</option>{result.people.filter(Boolean).map((p,i)=><option key={i} value={p} title={p}>{optionLabel(p)}</option>)}</select></label><label>Associated task<select title={result.draft.taskIndex != null ? result.tasks[result.draft.taskIndex]?.description : undefined} value={result.draft.taskIndex ?? ''} onChange={e=>setResult({...result,draft:{...result.draft!,taskIndex:e.target.value === '' ? null : Number(e.target.value)}})}><option value="">Choose a task</option>{result.tasks.map((t,i)=><option key={i} value={i} title={t.description}>{optionLabel(t.description)}</option>)}</select></label><label>Message<textarea maxLength={2000} value={result.draft.body} onChange={e=>setResult({...result,draft:{...result.draft!,body:e.target.value}})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,draft:null})}>Remove draft</button></div> : <><p>No draft was suggested. Add a person and task above if needed, then write a draft here.</p><button className="add-button" type="button" onClick={()=>setResult({...result,draft:{recipient:'',taskIndex:null,body:''}})}>+ Add Message Draft</button></>}</div>
   </div>
   <div className="review-actions"><button className="review-save-button" type="button" disabled={busy} onClick={save}>Save reviewed context</button> <button className="review-discard-button" type="button" disabled={busy} onClick={()=>setResult(null)}>Discard</button></div>
  </fieldset>}
  {!showingPreview && <SavedContext nodes={savedNodes} onRefresh={onRefresh} navigation={navigation}/>}
  {!showingPreview && !result && !text.trim() && savedNodes.length===0 && <div className="empty-illustration empty-understand"><EmptyCurve curve="lemniscate" color="hsl(var(--accent))"/></div>}
 </section>;
}
