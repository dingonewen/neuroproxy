import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import type { Extraction } from '../shared/extraction';
import { InfoTip } from './InfoTip';

type Note = {status:'processing'|'ready'|'failed'|'interrupted'; transcript:string|null; analysis:Extraction|null};
const storageKey='neuroproxy-voice-note-id';

export function VoiceNote({disabled,onReview}:{disabled:boolean;onReview:(transcript:string,analysis:Extraction)=>void}) {
 const [id,setId]=useState(()=>localStorage.getItem(storageKey));
 const [note,setNote]=useState<Note|null>(null);
 const [recording,setRecording]=useState(false);
 const [blob,setBlob]=useState<Blob|null>(null);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const timeout=useRef<number|undefined>();
 const [audioUrl,setAudioUrl]=useState('');
 useEffect(()=>{if(!blob){setAudioUrl('');return;}const url=URL.createObjectURL(blob);setAudioUrl(url);return()=>URL.revokeObjectURL(url);},[blob]);
 useEffect(()=>()=>{window.clearTimeout(timeout.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());},[]);
 useEffect(()=>{
  if(!id){setNote(null);return;}
  let active=true;
  const refresh=async()=>{try{const res=await fetch(`/api/voice-notes/${encodeURIComponent(id)}`);if(res.status===404){localStorage.removeItem(storageKey);if(active){setId(null);setError('Voice note was not found.');}return;}if(!res.ok)throw Error();const value=await res.json() as Note;if(active)setNote(value);}catch{if(active)setError('Unable to check voice note. Reconnect and try again.');}};
  void refresh();const timer=window.setInterval(refresh,3000);return()=>{active=false;window.clearInterval(timer);};
 },[id]);
 async function start(){
  setError('');setBlob(null);
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('Voice notes are not supported in this browser. Use Safari over HTTPS.');return;}
  try {
   const input=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=input;
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
   const media=new MediaRecorder(input,mime?{mimeType:mime}:undefined);recorder.current=media;const chunks:BlobPart[]=[];
   media.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   media.onstop=()=>{window.clearTimeout(timeout.current);input.getTracks().forEach(track=>track.stop());stream.current=null;setRecording(false);if(chunks.length)setBlob(new Blob(chunks,{type:media.mimeType || 'audio/webm'}));};
   media.start();setRecording(true);timeout.current=window.setTimeout(()=>{if(media.state==='recording')media.stop();},60000);
  }catch{stream.current?.getTracks().forEach(track=>track.stop());setError('Could not access the microphone. Check your browser permissions.');}
 }
 async function send(){if(!blob)return;setSending(true);setError('');try{const res=await fetch('/api/voice-notes',{method:'POST',headers:{'content-type':blob.type || 'audio/webm'},body:blob});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not send voice note.');localStorage.setItem(storageKey,data.id);setId(data.id);setBlob(null);}catch(e){setError((e as Error).message);}finally{setSending(false);}}
 async function remove(){if(id){try{const res=await fetch(`/api/voice-notes/${encodeURIComponent(id)}`,{method:'DELETE'});if(!res.ok)throw Error();}catch{setError('Could not delete the voice note.');return;}}localStorage.removeItem(storageKey);setId(null);setBlob(null);setError('');}
 function listen(){if(!note?.analysis||!('speechSynthesis' in window))return;const a=note.analysis;const message=[a.topic,a.relationship?.coreQuestion,a.relationship?.nextAction].filter(Boolean).join('. ');window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));}
 return <details className="voice-note" open={recording||!!id||!!blob||undefined}>
  <summary className="voice-note-heading">Voice Note</summary>
  <div className="voice-note-info">Record up to one minute. <InfoTip>Sending shares audio with ElevenLabs for transcription and the transcript with your configured AI provider. The transcript and analysis are stored until you delete this note; the audio is not saved.</InfoTip></div>
  {!id && !blob && <button type="button" className="secondary-button" disabled={disabled} onClick={recording?()=>recorder.current?.stop():start}>{recording?<><Square className="button-icon"/> Stop Recording</>:<><Mic className="button-icon"/> Record Voice Note</>}</button>}
  {blob&&!id&&<div className="voice-note-actions"><audio controls src={audioUrl}/><button type="button" className="secondary-button" disabled={sending||disabled} onClick={remove}>Discard</button><button type="button" disabled={sending||disabled} onClick={send}>{sending?'Sending…':'Send Voice Note'}</button></div>}
  {id && <div className="voice-note-actions"><span role="status">{!note||note.status==='processing'?'Processing your voice note…':note.status==='ready'?'Your analysis is ready.':'Processing stopped. Delete this note and try again.'}</span>{note?.status==='ready'&&note.analysis&&note.transcript&&<><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onReview(note.transcript!,note.analysis!)}>Review Analysis</button>{'speechSynthesis' in window&&<button type="button" className="secondary-button" onClick={listen}><Volume2 className="button-icon"/> Listen to Summary</button>}</>}<button type="button" className="text-button" onClick={remove}>Delete Note</button></div>}
  {error&&<p role="alert" className="voice-note-error">{error}</p>}
 </details>;
}
