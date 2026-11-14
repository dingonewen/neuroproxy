import { useState } from 'react';

type Item={id:string;kind:string;label:string};
export function ManualDelegation({topicId,nodes,onSaved}:{topicId:string;nodes:Item[];onSaved:()=>Promise<void>}) {
 const people=nodes.filter(n=>n.kind==='person');
 const actions=nodes.filter(n=>n.kind==='task'||n.kind==='suggested_action');
 const [personId,setPersonId]=useState(people.length===1?people[0].id:'');const [newPerson,setNewPerson]=useState('');
 const [actionId,setActionId]=useState(actions.length===1?actions[0].id:'');const [customAction,setCustomAction]=useState('');
 const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const selection={personId:personId==='new'?'':personId,newPerson:personId==='new'?newPerson:'',actionId:actionId==='custom'?'':actionId,customAction:actionId==='custom'?customAction:''};
 const validPerson=!!selection.personId || !!selection.newPerson.trim();const validAction=!!selection.actionId || !!selection.customAction.trim();
 const changed=(fn:()=>void)=>{fn();setBody('');setNotice('');};
 async function generate(){setBusy(true);setNotice('');setBody('');try{const r=await fetch(`/api/conversations/${encodeURIComponent(topicId)}/delegation-suggestion`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)});const data=await r.json();if(!r.ok)throw Error(data.error);if(!data.body){setNotice(data.reason ? `No draft suggested: ${data.reason}` : 'The model did not suggest a draft. You can edit the message yourself if appropriate.');return;}setBody(data.body);}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function save(){setBusy(true);setNotice('');try{const r=await fetch(`/api/conversations/${encodeURIComponent(topicId)}/drafts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...selection,body})});const data=await r.json();if(!r.ok)throw Error(data.error);setBody('');setNotice('Draft added to this conversation. Review it in All Delegations before sending.');await onSaved();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <details><summary>Optional Manual Delegation</summary><p className="helper-text">Choose a person and an action from this conversation. The conversation context is sent to your AI provider to generate a draft.</p>
  <label>Person<select value={personId} onChange={e=>changed(()=>setPersonId(e.target.value))}><option value="">Choose a person</option>{people.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}<option value="new">Add a person</option></select></label>
  {personId==='new' && <label>New Person<input maxLength={100} value={newPerson} onChange={e=>changed(()=>setNewPerson(e.target.value))}/></label>}
  <label>Action<select value={actionId} onChange={e=>changed(()=>setActionId(e.target.value))}><option value="">Choose an action</option>{actions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}<option value="custom">Add an action</option></select></label>
  {actionId==='custom' && <label>New Action<input maxLength={500} value={customAction} onChange={e=>changed(()=>setCustomAction(e.target.value))}/></label>}
  <div className="manual-actions"><button className="secondary-button" type="button" disabled={busy||!validPerson||!validAction} onClick={()=>void generate()}>{busy?'Working…':'Generate'}</button></div>
  <label>Message Draft<textarea maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></label>
  <div className="manual-actions"><button className="secondary-button" type="button" disabled={busy||!validPerson||!validAction||!body.trim()} onClick={()=>void save()}>Create</button></div>
  {notice && (notice.startsWith('No draft suggested: ') ? <p role="status" className="draft-suggestion-notice"><strong>No draft suggested:</strong> {notice.slice('No draft suggested: '.length)}</p> : <p role="status">{notice}</p>)}
 </details>;
}
