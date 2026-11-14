import { useEffect, useState } from 'react';
import type { Extraction } from '../shared/extraction';

export function ConversationInput({ onSaved, onPreview }: { onSaved: (topicId:string, context:Extraction, draftId:string|null) => Promise<void>; onPreview:(result:Extraction|null)=>void }) {
 const [text, setText] = useState('');
 const [result, setResult] = useState<Extraction | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [saved, setSaved] = useState(false);
 useEffect(()=>{onPreview(result);},[result,onPreview]);
 async function analyze() {
  setBusy(true); setError(''); setSaved(false); setResult(null);
  try {
   const res = await fetch('/api/extract', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({text}) });
   const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 async function save() {
  if (!result) return;
  setBusy(true); setError('');
  try {
   const relationship=result.relationship ? {...result.relationship, facts:result.relationship.facts.filter(v=>v.trim()),feelings:result.relationship.feelings.filter(v=>v.trim()),needs:result.relationship.needs.filter(v=>v.trim()),interpretations:result.relationship.interpretations.filter(v=>v.trim())} : result.relationship;
   const reviewed={...result,relationship};
   const res = await fetch('/api/reviewed-context', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(reviewed) });
   const data = await res.json(); if (!res.ok) throw new Error(data.error);
   setResult(null); setSaved(true);
   try { await onSaved(data.topicId, reviewed, data.draftId ?? null); } catch { setError('Saved, but the graph could not refresh. Reload the page.'); }
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 return <section className="conversation-panel">
  <div className="panel-heading"><span className="eyebrow">01 / Understand</span><h2>Understand a conversation</h2><p>Analyze, review the suggestions, then save them to the graph.</p></div>
  <label>Conversation<textarea maxLength={8000} disabled={busy} value={text} onChange={e=>{setText(e.target.value); setResult(null); setSaved(false);}} /></label>
  <button type="button" disabled={busy || !text.trim()} onClick={analyze}>{busy ? 'Working…' : 'Analyze conversation'}</button>
  {error && <p role="alert">{error}</p>}{saved && <p role="status">Saved to the graph. Any message draft still requires approval.</p>}
  {result && <fieldset disabled={busy} className="review"><div className="review-heading"><span className="eyebrow">02 / Review</span><h3>Review before saving</h3><p>Correct or remove anything inaccurate.</p></div>
   <div className="topic-card"><label className="topic-title">Topic<input value={result.topic} onChange={e=>setResult({...result,topic:e.target.value})}/></label>
    <div className="category-card"><div className="category-heading"><h4>People</h4><span>{result.people.length}</span></div>
     {result.people.map((person,i)=><div className="nested-card" key={i}><label>Person {i+1}<input value={person} onChange={e=>setResult({...result,people:result.people.map((p,j)=>j===i?e.target.value:p),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:e.target.value}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.map(p=>p===person?e.target.value:p)})),draft:result.draft?.recipient===person?{...result.draft,recipient:e.target.value}:result.draft})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,people:result.people.filter((_,j)=>j!==i),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:''}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.filter(p=>p!==person)})),draft:result.draft?.recipient===person?{...result.draft,recipient:''}:result.draft})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,people:[...result.people,'']})}>+ Add person</button></div>
    <div className="category-card"><div className="category-heading"><h4>Tasks</h4><span>{result.tasks.length}</span></div>
     {result.tasks.map((task,i)=><div className="nested-card" key={i}><label>Task {i+1}<input value={task.description} onChange={e=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,description:e.target.value}:t)})}/></label><label>Assignee (optional)<select value={task.assignee} onChange={e=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,assignee:e.target.value}:t)})}><option value="">Unknown</option>{result.people.filter(Boolean).map((p,j)=><option key={j} value={p}>{p}</option>)}</select></label><button className="text-button" type="button" onClick={()=>setResult({...result,tasks:result.tasks.filter((_,j)=>j!==i),draft:result.draft ? {...result.draft,taskIndex:null} : null})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,tasks:[...result.tasks,{description:'',assignee:''}]})}>+ Add task</button></div>
    <div className="category-card"><div className="category-heading"><h4>Unresolved questions</h4><span>{result.uncertainties.length}</span></div><p>Choose only related people; leave blank if unknown.</p>
     {result.uncertainties.map((item,i)=><div className="nested-card" key={i}><label>Question {i+1}<input value={item.question} onChange={e=>setResult({...result,uncertainties:result.uncertainties.map((v,j)=>j===i?{...v,question:e.target.value}:v)})}/></label><span className="field-caption">Related people</span>{result.people.filter(Boolean).map((person,j)=><label className="inline-choice" key={j}><input type="checkbox" checked={item.people.includes(person)} onChange={e=>setResult({...result,uncertainties:result.uncertainties.map((q,k)=>k===i?{...q,people:e.target.checked?[...q.people,person]:q.people.filter(p=>p!==person)}:q)})}/>{person}</label>)}<button className="text-button" type="button" onClick={()=>setResult({...result,uncertainties:result.uncertainties.filter((_,j)=>j!==i)})}>Remove</button></div>)}
     <button className="add-button" type="button" onClick={()=>setResult({...result,uncertainties:[...result.uncertainties,{question:'',people:[]}]})}>+ Add question</button></div>
    <div className="category-card relationship-card"><div className="category-heading"><h4>Relationship context</h4></div><p>Reported facts and possible interpretations are different. Review before saving.</p>
     {result.relationship ? <>
      {(['facts','feelings','needs','interpretations'] as const).map(key=><div className="relationship-group" key={key}><h5>{({facts:'Reported facts',feelings:'Expressed feelings',needs:'Expressed needs',interpretations:'Possible interpretations'})[key]}</h5>{result.relationship![key].map((value,i)=><div className="nested-card" key={i}><label>{({facts:'Fact',feelings:'Feeling',needs:'Need',interpretations:'Interpretation'})[key]} {i+1}<input value={value} onChange={e=>setResult({...result,relationship:{...result.relationship!,[key]:result.relationship![key].map((v,j)=>j===i?e.target.value:v)}})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,relationship:{...result.relationship!,[key]:result.relationship![key].filter((_,j)=>j!==i)}})}>Remove</button></div>)}<button className="add-button" type="button" onClick={()=>setResult({...result,relationship:{...result.relationship!,[key]:[...result.relationship![key],'']}})}>+ Add {({facts:'fact',feelings:'feeling',needs:'need',interpretations:'interpretation'})[key]}</button></div>)}
      <div className="nested-card"><label>Core question<input value={result.relationship.coreQuestion} onChange={e=>setResult({...result,relationship:{...result.relationship!,coreQuestion:e.target.value}})}/></label></div>
      <div className="nested-card"><label>Suggested next action<input value={result.relationship.nextAction} onChange={e=>setResult({...result,relationship:{...result.relationship!,nextAction:e.target.value}})}/></label></div>
      <button className="text-button" type="button" onClick={()=>setResult({...result,relationship:null})}>Remove relationship context</button>
     </> : <button className="add-button" type="button" onClick={()=>setResult({...result,relationship:{facts:[],feelings:[],needs:[],interpretations:[],coreQuestion:'',nextAction:''}})}>+ Add relationship context</button>}
    </div>
    {result.draft && <div className="category-card"><h4>Suggested message draft</h4><p>Saving creates a draft only. Sending requires separate approval.</p><div className="nested-card"><label>Recipient<select value={result.draft.recipient} onChange={e=>setResult({...result,draft:{...result.draft!,recipient:e.target.value}})}><option value="">Choose a person</option>{result.people.filter(Boolean).map((p,i)=><option key={i} value={p}>{p}</option>)}</select></label><label>Associated task<select value={result.draft.taskIndex ?? ''} onChange={e=>setResult({...result,draft:{...result.draft!,taskIndex:e.target.value === '' ? null : Number(e.target.value)}})}><option value="">Choose a task</option>{result.tasks.map((t,i)=><option key={i} value={i}>{t.description}</option>)}</select></label><label>Message<textarea value={result.draft.body} onChange={e=>setResult({...result,draft:{...result.draft!,body:e.target.value}})}/></label><button className="text-button" type="button" onClick={()=>setResult({...result,draft:null})}>Remove draft</button></div></div>}
   </div>
   <div className="review-actions"><button type="button" disabled={busy} onClick={save}>Save reviewed context</button> <button className="secondary-button" type="button" disabled={busy} onClick={()=>setResult(null)}>Discard</button></div>
  </fieldset>}
 </section>;
}
