import { useState } from 'react';

export function PhotonSend({draftId,person,body,onSaved}:{draftId:string;person:string;body:string;onSaved:()=>Promise<void>}) {
 const [show,setShow]=useState(false); const [phone,setPhone]=useState(''); const [consent,setConsent]=useState(false); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
 async function send() {
  setBusy(true);setNotice('');
  try {
   const res=await fetch(`/api/drafts/${draftId}/approve-photon-phone`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipientPhone:phone.trim(),approvedBody:body,consent})});
   const result=await res.json();
   if (!res.ok) { await onSaved(); throw Error(result.error || 'Request failed.'); }
   setNotice(result.status==='send_unknown' ? 'Send result unknown. Check Photon before doing anything else; do not send again.' : 'Photon accepted the request; delivery is not confirmed.');
   await onSaved();
  } catch(e) {setNotice((e as Error).message || 'Could not confirm the result. Check the draft status and Photon before trying again.');} finally {setBusy(false);}
 }
 return <div><button type="button" onClick={()=>setShow(!show)}>Review real SMS</button>{show && <div className="review-item"><strong>Real SMS to {person}</strong><p>Confirm the number, exact message and recipient consent before sending.</p><p>{body}</p><label>Recipient phone (E.164)<input value={phone} disabled={busy} onChange={e=>setPhone(e.target.value)} /></label><label className="inline-choice"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} /> The recipient has consented to this message.</label><button type="button" disabled={!consent||!phone.trim()||busy} onClick={send}>{busy?'Sending…':'Approve and send real SMS'}</button>{notice && <p role="status">{notice}</p>}</div>}</div>;
}
