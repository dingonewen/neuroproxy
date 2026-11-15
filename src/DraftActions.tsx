import { useState } from 'react';
import { PhotonImessage } from './PhotonImessage';
import { ContactPicker } from './ContactPicker';

export function DraftActions({id,messageId,person,personId,contactId,contactName,contactHandle,body,state,onSaved,onPost}:{id:string;messageId:string;person:string;personId:string;contactId:string|null;contactName:string|null;contactHandle:string|null;body:string;state:string;onSaved:()=>Promise<void>;onPost:(path:string)=>Promise<void>}) {
 const [editing,setEditing]=useState(false);const [editedBody,setEditedBody]=useState(body);const [editError,setEditError]=useState('');const [savingEdit,setSavingEdit]=useState(false);
 async function saveEdit(){setSavingEdit(true);setEditError('');try{const response=await fetch(`/api/nodes/${encodeURIComponent(messageId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedLabel:body,label:editedBody})});const data=await response.json();if(!response.ok)throw Error(data.error);setEditing(false);await onSaved();}catch(e){setEditError((e as Error).message);}finally{setSavingEdit(false);}}
 const [contactPending,setContactPending]=useState(false);
 return <div className="draft-actions">{state==='pending_approval' && (editing ? <div><label>Edit Draft<textarea value={editedBody} maxLength={2000} disabled={savingEdit} onChange={e=>setEditedBody(e.target.value)}/></label><div className="contact-actions"><button className="secondary-button" type="button" disabled={savingEdit} onClick={()=>setEditing(false)}>Cancel</button><button className="secondary-button" type="button" disabled={savingEdit||!editedBody.trim()} onClick={()=>void saveEdit()}>Save Changes</button></div></div> : <button className="text-button" type="button" onClick={()=>{setEditedBody(body);setEditing(true);}}>Revisit Draft</button>)}{editError && <p className="helper-text" role="alert">{editError}</p>}<ContactPicker personId={personId} person={person} contactId={contactId} contactName={contactName} contactHandle={contactHandle} onSaved={onSaved} onSelectionPendingChange={setContactPending}/>
 {state==='pending_approval' && !contactPending && contactId && contactHandle && <PhotonImessage key={contactId} contactHandle={contactHandle} draftId={id} person={person} body={body} introduce={false} onSaved={onSaved}/>}
 {state==='preparation_failed' && <p className="helper-text">This SMS draft cannot be retried here while SMS is unavailable.</p>}
 <div className="draft-secondary"><button type="button" className="text-button cancel-draft" onClick={()=>void onPost(`/api/drafts/${id}/cancel`)}>Cancel Draft</button></div>
 </div>;
}
