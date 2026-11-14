import { useState } from 'react';
import { DEFAULT_CUSTOM_LABEL, NEUROPROXY_LABEL, validMessageLabel } from '../shared/sms';
import { PhotonSend } from './PhotonSend';
import { PhotonImessage } from './PhotonImessage';
import { ContactPicker } from './ContactPicker';

export function DraftActions({id,person,personId,contactId,contactName,contactHandle,body,state,messageLabel,onSaved,onPost}:{id:string;person:string;personId:string;contactId:string|null;contactName:string|null;contactHandle:string|null;body:string;state:string;messageLabel:string|null;onSaved:()=>Promise<void>;onPost:(path:string)=>Promise<void>}) {
 const [channel,setChannel]=useState<'imessage'|'sms'|null>(null);
 const [label,setLabel]=useState(state==='preparation_failed'?(messageLabel??NEUROPROXY_LABEL):DEFAULT_CUSTOM_LABEL);
 return <div className="draft-actions"><ContactPicker personId={personId} person={person} contactId={contactId} contactName={contactName} contactHandle={contactHandle} onSaved={onSaved}/><p className="channel-prompt">Choose a way to send. You’ll review the message first.</p><div className="channel-buttons">{state==='pending_approval' && <button className={channel==='imessage'?'channel-button active':'channel-button'} type="button" disabled={!contactId} aria-pressed={channel==='imessage'} onClick={()=>setChannel(channel==='imessage'?null:'imessage')}>iMessage</button>}<button className={channel==='sms'?'channel-button active':'channel-button'} type="button" disabled={!contactId} aria-pressed={channel==='sms'} onClick={()=>setChannel(channel==='sms'?null:'sms')}>SMS</button></div>
 {channel && <div className="label-editor"><label>Message signature<input value={label} maxLength={120} disabled={state==='preparation_failed'} onChange={e=>setLabel(e.target.value)}/></label><small>{state==='preparation_failed'?'The previously approved signature is kept for this retry.':'Customize the signature. Include “NeuroProxy” so the recipient can identify the assistant.'}</small>{!validMessageLabel(label) && <p role="alert">Include “NeuroProxy” in the signature.</p>}</div>}
 {channel==='imessage' && contactId && contactHandle && <PhotonImessage key={contactId} contactHandle={contactHandle} draftId={id} person={person} body={body} label={label} onSaved={onSaved}/>}{channel==='sms' && contactId && contactHandle && <PhotonSend key={contactId} contactHandle={contactHandle} draftId={id} person={person} body={body} label={label} onSaved={onSaved}/>}
 <div className="draft-secondary"><button type="button" className="text-button" onClick={()=>void onPost(`/api/drafts/${id}/cancel`)}>Cancel Draft</button>{state==='pending_approval' && <details><summary>Testing options</summary><p>Simulate sending and replies without contacting anyone.</p><button type="button" className="secondary-button" onClick={()=>void onPost(`/api/drafts/${id}/approve-simulation`)}>Simulate Send</button></details>}</div>
 </div>;
}
