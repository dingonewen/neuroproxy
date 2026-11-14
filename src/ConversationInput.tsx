import { useState } from 'react';
import type { Extraction } from '../shared/extraction';

export function ConversationInput({ onSaved }: { onSaved: () => Promise<void> }) {
 const [text, setText] = useState('');
 const [result, setResult] = useState<Extraction | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [saved, setSaved] = useState(false);
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
   const res = await fetch('/api/reviewed-context', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(result) });
   const data = await res.json(); if (!res.ok) throw new Error(data.error);
   setResult(null); setSaved(true);
   try { await onSaved(); } catch { setError('Saved, but the graph could not refresh. Reload the page.'); }
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 return <section>
  <h2>Understand a conversation</h2>
  <p>Describe the situation. Review the suggestions before saving them to the graph.</p>
  <label>Conversation<textarea maxLength={8000} disabled={busy} value={text} onChange={e=>{setText(e.target.value); setResult(null); setSaved(false);}} /></label>
  <button type="button" disabled={busy || !text.trim()} onClick={analyze}>{busy ? 'Working…' : 'Analyze conversation'}</button>
  {error && <p role="alert">{error}</p>}{saved && <p role="status">Saved to the graph. Any message draft still requires approval.</p>}
  {result && <fieldset disabled={busy} className="review"><h3>Review before saving</h3><p>These are suggestions. Correct or remove anything inaccurate.</p>
   <label>Topic / project (overall subject)<input value={result.topic} onChange={e=>setResult({...result,topic:e.target.value})}/></label>
   <h4>People</h4>{result.people.map((person,i)=><div className="review-row" key={i}><label>Person {i+1}<input value={person} onChange={e=>setResult({...result,people:result.people.map((p,j)=>j===i?e.target.value:p),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:e.target.value}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.map(p=>p===person?e.target.value:p)})),draft:result.draft?.recipient===person?{...result.draft,recipient:e.target.value}:result.draft})}/></label><button type="button" onClick={()=>setResult({...result,people:result.people.filter((_,j)=>j!==i),tasks:result.tasks.map(t=>t.assignee===person?{...t,assignee:''}:t),uncertainties:result.uncertainties.map(q=>({...q,people:q.people.filter(p=>p!==person)})),draft:result.draft?.recipient===person?{...result.draft,recipient:''}:result.draft})}>Remove</button></div>)}
   <button type="button" onClick={()=>setResult({...result,people:[...result.people,'']})}>Add person</button>
   <h4>Tasks — specific actions</h4>{result.tasks.map((task,i)=><div className="review-item" key={i}><label>Task {i+1}<input value={task.description} onChange={e=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,description:e.target.value}:t)})}/></label><label>Assignee (optional)<select value={task.assignee} onChange={e=>setResult({...result,tasks:result.tasks.map((t,j)=>j===i?{...t,assignee:e.target.value}:t)})}><option value="">Unknown</option>{result.people.map((p,j)=><option key={j} value={p}>{p}</option>)}</select></label><button type="button" onClick={()=>setResult({...result,tasks:result.tasks.filter((_,j)=>j!==i),draft:result.draft ? {...result.draft,taskIndex:null} : null})}>Remove task</button></div>)}
   <button type="button" onClick={()=>setResult({...result,tasks:[...result.tasks,{description:'',assignee:''}]})}>Add task</button>
   <h4>Unresolved questions</h4><p>Choose only people related to each question. Leave unchecked if unknown.</p>{result.uncertainties.map((item,i)=><div className="review-item" key={i}><label>Question {i+1}<input value={item.question} onChange={e=>setResult({...result,uncertainties:result.uncertainties.map((v,j)=>j===i?{...v,question:e.target.value}:v)})}/></label><span>Related people</span>{result.people.filter(Boolean).map((person,j)=><label className="inline-choice" key={j}><input type="checkbox" checked={item.people.includes(person)} onChange={e=>setResult({...result,uncertainties:result.uncertainties.map((q,k)=>k===i?{...q,people:e.target.checked?[...q.people,person]:q.people.filter(p=>p!==person)}:q)})}/>{person}</label>)}<button type="button" onClick={()=>setResult({...result,uncertainties:result.uncertainties.filter((_,j)=>j!==i)})}>Remove question</button></div>)}
   <button type="button" onClick={()=>setResult({...result,uncertainties:[...result.uncertainties,{question:'',people:[]}]})}>Add question</button>
   {result.draft && <div className="review-item"><h4>Suggested message draft</h4><p>Saving creates a draft only. Approve separately to simulate sending.</p><label>Recipient<select value={result.draft.recipient} onChange={e=>setResult({...result,draft:{...result.draft!,recipient:e.target.value}})}><option value="">Choose a person</option>{result.people.map((p,i)=><option key={i} value={p}>{p}</option>)}</select></label><label>Associated task<select value={result.draft.taskIndex ?? ''} onChange={e=>setResult({...result,draft:{...result.draft!,taskIndex:e.target.value === '' ? null : Number(e.target.value)}})}><option value="">Choose a task</option>{result.tasks.map((t,i)=><option key={i} value={i}>{t.description}</option>)}</select></label><label>Message<textarea value={result.draft.body} onChange={e=>setResult({...result,draft:{...result.draft!,body:e.target.value}})}/></label><button type="button" onClick={()=>setResult({...result,draft:null})}>Remove draft</button></div>}
   <p><button type="button" disabled={busy} onClick={save}>Save reviewed context</button> <button type="button" disabled={busy} onClick={()=>setResult(null)}>Discard</button></p>
  </fieldset>}
 </section>;
}
