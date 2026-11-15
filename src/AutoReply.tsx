import { useEffect, useId, useRef, useState } from 'react';
import { InfoTip } from './InfoTip';
import { MessageCircleReply } from 'lucide-react';

type Person={id:string;kind:string;label:string;contact_id?:string|null;contact_name?:string|null;contact_handle?:string|null};
type Settings={enabled:boolean;personId:string;preferences:string;lastStatus:string|null};
const empty:Settings={enabled:false,personId:'',preferences:'',lastStatus:null};

export function AutoReplyHeader({enabled=false,disabled=true,onToggle}:{enabled?:boolean;disabled?:boolean;onToggle?:()=>void}) {
 return <div className="auto-reply-header"><h2 className="delegations-heading"><MessageCircleReply className="heading-icon" aria-hidden="true"/>AutoReply <InfoTip>AutoReply can send iMessage replies without reviewing each message. Each automatic reply is labeled [NeuroProxy AutoReply]. Replies and saved context are sent to your AI provider; ambiguous replies still need review.</InfoTip></h2><div className="auto-reply-switch-row"><button className="voice-switch" role="switch" type="button" aria-checked={enabled} aria-label="AutoReply" disabled={disabled} onClick={onToggle}><span className="voice-switch-thumb" aria-hidden="true"/></button><span>{enabled?'On':'Off'}</span><InfoTip>First send an approved iMessage to this contact. Turn AutoReply off before changing its settings. An already sending message may not be stopped.</InfoTip></div></div>;
}

export function AutoReply({topicId,people}:{topicId:string;people:Person[]}) {
 const contactId=useId();
 const [settings,setSettings]=useState<Settings>(empty);
 const [personId,setPersonId]=useState('');const [preferences,setPreferences]=useState('');
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const revision=useRef(0);
 const candidates=people.filter(p=>p.kind==='person' && p.contact_id && p.contact_handle);
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch(`/api/conversations/${encodeURIComponent(topicId)}/auto-reply`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Could not load AutoReply settings.');return await r.json() as Settings;}).then(data=>{if(active){setSettings(data);setPersonId(data.personId || '');setPreferences(data.preferences || '');}}).catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[topicId]);
 useEffect(()=>{let active=true;const timer=window.setInterval(()=>{const requested=revision.current;void fetch(`/api/conversations/${encodeURIComponent(topicId)}/auto-reply`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then((data:Settings|null)=>{if(active && data && revision.current===requested){setSettings(data);if(data.enabled){setPersonId(data.personId);setPreferences(data.preferences);}}}).catch(()=>{});},5000);return()=>{active=false;window.clearInterval(timer);};},[topicId]);
 async function toggle(){
  const enabled=!settings.enabled;
  if(enabled && (!personId || !window.confirm('Allow NeuroProxy to automatically send iMessage replies to this contact in this conversation without reviewing each message? Every automatic reply is labeled [NeuroProxy AutoReply]. You can turn AutoReply off at any time.')))return;
  revision.current++;setBusy(true);setError('');
  try {const r=await fetch(`/api/conversations/${encodeURIComponent(topicId)}/auto-reply`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled,personId,preferences,consent:enabled})});const data=await r.json();if(!r.ok)throw Error(data.error || 'Could not update AutoReply.');setSettings(data);}
  catch(e){setError((e as Error).message);}finally{revision.current++;setBusy(false);}
 }
 return <><AutoReplyHeader enabled={settings.enabled} disabled={loading || busy || (!settings.enabled && !personId)} onToggle={()=>void toggle()}/><div className="auto-reply-section"><div className="input-label"><label htmlFor={contactId}>Contact</label><InfoTip>AutoReply applies only to this contact within this conversation.</InfoTip></div><select id={contactId} value={personId} disabled={loading || busy || settings.enabled} onChange={e=>setPersonId(e.target.value)}><option value="">Choose a contact</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.contact_name || p.label} · {p.contact_handle}</option>)}</select><label>Communication Style (optional)<textarea value={preferences} maxLength={1000} disabled={loading || busy || settings.enabled} onChange={e=>setPreferences(e.target.value)}/></label>{settings.lastStatus && <p className="helper-text" role="status">{settings.lastStatus==='needs_review' ? 'AutoReply needs your review; no automatic message was sent.' : <>Last AutoReply: {settings.lastStatus.replaceAll('_',' ')}{settings.lastStatus==='submitted' ? ' (delivery not confirmed)' : ''}</>}</p>}{error && <p className="helper-text" role="alert">{error}</p>}</div></>;
}
