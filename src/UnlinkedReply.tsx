import { useEffect, useState } from 'react';
import { optionLabel } from './option-label';


type Candidate = {id:string;person:string;body:string};
export function UnlinkedReply({nodeId,onSaved}:{nodeId:string;onSaved:()=>Promise<void>}) {
 const [items,setItems]=useState<Candidate[]>([]); const [draftId,setDraftId]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setItems([]);setDraftId('');setError('');fetch(`/api/photon-inbox/${nodeId}/candidates`).then(async r=>{if(!r.ok) throw Error('Could not load matching delegations.');return r.json();}).then(data=>{if(active)setItems(data.candidates);}).catch(e=>{if(active)setError(e.message);});return ()=>{active=false;};},[nodeId]);
 async function link(){setBusy(true);setError('');try{const r=await fetch(`/api/photon-inbox/${nodeId}/link`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({draftId})});const data=await r.json();if(!r.ok)throw Error(data.error);await onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div><p>This message is not linked to a task.</p>{items.length>0 ? <><label>Matching waiting delegation<select title={items.find(item=>item.id===draftId) ? `${items.find(item=>item.id===draftId)!.person}: ${items.find(item=>item.id===draftId)!.body}` : undefined} value={draftId} onChange={e=>setDraftId(e.target.value)}><option value="">Select a delegation</option>{items.map(item=><option key={item.id} value={item.id} title={`${item.person}: ${item.body}`}>{optionLabel(`${item.person}: ${item.body}`)}</option>)}</select></label><button type="button" disabled={!draftId||busy} onClick={link}>Confirm this is a reply</button></> : <p>No waiting delegation matches this Photon conversation.</p>}{error && <p role="alert">{error}</p>}</div>;
}
