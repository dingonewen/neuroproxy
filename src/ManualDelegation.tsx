import { useEffect, useId, useRef, useState } from 'react';
import { delegationDefaults } from '../shared/delegation-defaults';
import { optionLabel } from './option-label';
import { InfoTip } from './InfoTip';
import { readApiJson } from './api-response';

type Item={id:string;kind:string;label:string};
export function ManualDelegation({topicId,nodes,onSaved}:{topicId:string;nodes:Item[];onSaved:()=>Promise<void>}) {
 const draftInputId=useId();
 const people=nodes.filter(n=>n.kind==='person');
 const actions=nodes.filter(n=>n.kind==='task'||n.kind==='suggested_action');
 const defaults=delegationDefaults(nodes);
 const [personId,setPersonId]=useState(defaults.personId);const [newPerson,setNewPerson]=useState('');
 const [actionId,setActionId]=useState(defaults.actionId);const [customAction,setCustomAction]=useState('');
 const touched=useRef({person:false,action:false});
 useEffect(()=>{if(!touched.current.person&&defaults.personId)setPersonId(defaults.personId);if(!touched.current.action&&defaults.actionId)setActionId(defaults.actionId);},[defaults.personId,defaults.actionId]);
 const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const selection={personId:personId==='new'?'':personId,newPerson:personId==='new'?newPerson:'',actionId:actionId==='custom'?'':actionId,customAction:actionId==='custom'?customAction:''};
 const validPerson=!!selection.personId || !!selection.newPerson.trim();const validAction=!!selection.actionId || !!selection.customAction.trim();
 const changed=(fn:()=>void)=>{fn();setBody('');setNotice('');};
 async function generate(){setBusy(true);setNotice('');setBody('');try{const r=await fetch(`/api/conversations/${encodeURIComponent(topicId)}/delegation-suggestion`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)});const data=await readApiJson(r);if(!r.ok)throw Error(data.error);if(!data.body){setNotice(data.reason ? `No draft suggested: ${data.reason}` : 'The model did not suggest a draft. You can edit the message yourself if appropriate.');return;}setBody(data.body);}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function save(){setBusy(true);setNotice('');try{const r=await fetch(`/api/conversations/${encodeURIComponent(topicId)}/drafts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...selection,body})});const data=await readApiJson(r);if(!r.ok)throw Error(data.error);setBody('');setNotice('Draft added to this conversation. Review it in Messages before sending.');await onSaved();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <div className="manual-delegation">
  <label>Person<select disabled={busy} value={personId} title={people.find(p=>p.id===personId)?.label} onChange={e=>changed(()=>{touched.current.person=true;setPersonId(e.target.value);})}><option value="">Choose a person</option>{people.map(p=><option key={p.id} value={p.id} title={p.label}>{optionLabel(p.label)}</option>)}<option value="new">Add a person</option></select></label>
  {personId==='new' && <label>New Person<input disabled={busy} maxLength={100} value={newPerson} onChange={e=>changed(()=>setNewPerson(e.target.value))}/></label>}
  <label>Action<select disabled={busy} value={actionId} title={actions.find(a=>a.id===actionId)?.label} onChange={e=>changed(()=>{touched.current.action=true;setActionId(e.target.value);})}><option value="">Choose an action</option>{actions.map(a=><option key={a.id} value={a.id} title={a.label}>{optionLabel(a.label)}</option>)}<option value="custom">Add an action</option></select></label>
  {actionId==='custom' && <label>New Action<input disabled={busy} maxLength={500} value={customAction} onChange={e=>changed(()=>setCustomAction(e.target.value))}/></label>}
  <div className="manual-actions"><button className="secondary-button" type="button" disabled={busy||!validPerson||!validAction} onClick={()=>void generate()}>{busy?'Working…':'Generate'}</button></div>
  <div className="draft-input-label"><label htmlFor={draftInputId}>Message Draft</label><InfoTip>Clicking Create saves a draft for approval. It does not send a message.</InfoTip></div><textarea disabled={busy} id={draftInputId} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/>
  <div className="manual-actions"><button className="secondary-button" type="button" disabled={busy||!validPerson||!validAction||!body.trim()} onClick={()=>void save()}>Create</button></div>
  {notice && (notice.startsWith('No draft suggested: ') ? <p role="status" className="draft-suggestion-notice"><strong>No draft suggested:</strong> {notice.slice('No draft suggested: '.length)}</p> : <p className="helper-text" role="status">{notice}</p>)}
 </div>;
}
