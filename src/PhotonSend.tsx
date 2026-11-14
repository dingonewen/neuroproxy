import { useState } from 'react';
type Target = {spaceId:string;senderId:string;recipientId:string;recipientPhone:string};
export function PhotonSend({draftId,person,body,onSaved}:{draftId:string;person:string;body:string;onSaved:()=>Promise<void>}) {
 const [show,setShow]=useState(false); const [target,setTarget]=useState<Target>({spaceId:'',senderId:'',recipientId:'',recipientPhone:''}); const [consent,setConsent]=useState(false); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
 const update=(name:keyof Target,value:string)=>setTarget({...target,[name]:value});
 async function send() {
  setBusy(true);setNotice('');
  try {
   const res=await fetch(`/api/drafts/${draftId}/approve-photon`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...target,approvedBody:body,consent})}); const result=await res.json();
   if (!res.ok) throw Error(result.error || 'Request failed.');
   setNotice(result.status==='send_unknown' ? 'Send result unknown. Check Photon before doing anything else; this draft cannot be sent again.' : 'Photon accepted the request; delivery is not confirmed.');
   await onSaved();
  } catch(e) {setNotice((e as Error).message);} finally {setBusy(false);}
 }
 return <div><button type="button" onClick={()=>setShow(!show)}>Review real SMS</button>{show && <div className="review-item"><strong>Real SMS to {person}</strong><p>Confirm the actual number, exact message, and recipient consent before sending.</p><p>{body}</p><label>Recipient phone (E.164)<input value={target.recipientPhone} onChange={e=>update('recipientPhone',e.target.value)} placeholder="+14155550123"/></label><label>Photon space ID<input value={target.spaceId} onChange={e=>update('spaceId',e.target.value)} placeholder="pho_spc_…"/></label><label>Photon sender user ID<input value={target.senderId} onChange={e=>update('senderId',e.target.value)} placeholder="pho_usr_…"/></label><label>Photon recipient user ID<input value={target.recipientId} onChange={e=>update('recipientId',e.target.value)} placeholder="pho_usr_…"/></label><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> The recipient has consented to this message.</label><button type="button" disabled={!consent||busy} onClick={send}>Approve and send real SMS</button>{notice && <p role="status">{notice}</p>}</div>}</div>;
}
