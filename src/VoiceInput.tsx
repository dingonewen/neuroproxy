import { Mic, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { InfoTip } from './InfoTip';

type SpeechResult={isFinal:boolean;[index:number]:{transcript:string}};
type SpeechEvent={resultIndex:number;results:ArrayLike<SpeechResult>};
type SpeechError={error:string};
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:SpeechEvent)=>void)|null;onerror:((e:SpeechError)=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function VoiceInput({onTranscript,onListeningChange,disabled=false}:{onTranscript:(text:string)=>void;onListeningChange:(listening:boolean)=>void;disabled?:boolean}) {
 const [listening,setListening]=useState(false);const [stopping,setStopping]=useState(false);const [interim,setInterim]=useState('');const [notice,setNotice]=useState('');const [language,setLanguage]=useState(navigator.language?.startsWith('zh')?'zh-CN':'en-US');
 const recognition=useRef<Recognition|null>(null);const callbacks=useRef({onTranscript,onListeningChange});callbacks.current={onTranscript,onListeningChange};
 const languageId=useId();
 const Speech=(window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
 useEffect(()=>()=>{const current=recognition.current;if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();recognition.current=null;}},[]);
 function start(){
  if(!Speech||recognition.current)return;
  const current=new Speech();recognition.current=current;current.lang=language;current.continuous=true;current.interimResults=true;
  current.onresult=e=>{let pending='';for(let i=e.resultIndex;i<e.results.length;i++){const item=e.results[i];const text=item[0]?.transcript ?? '';if(item.isFinal && text.trim()) callbacks.current.onTranscript(text.trim());else if(!item.isFinal)pending+=text;}setInterim(pending);};
  current.onerror=e=>{const messages:Record<string,string>={'not-allowed':'Microphone access was denied. Check browser permissions.','service-not-allowed':'Speech recognition is unavailable or blocked by the browser.','audio-capture':'No microphone was found.','network':'Speech recognition could not connect. Check your network.','no-speech':'No speech detected. Try again.'};setNotice(messages[e.error] ?? 'Voice recognition stopped. Try again or type your message.');};
  current.onend=()=>{if(recognition.current!==current)return;recognition.current=null;setListening(false);setStopping(false);setInterim('');callbacks.current.onListeningChange(false);};
  try{setNotice('');current.start();setListening(true);callbacks.current.onListeningChange(true);}catch{recognition.current=null;setNotice('Could not start the microphone. Try again or type your message.');}
 }
 function stop(){if(!recognition.current||stopping)return;setStopping(true);try{recognition.current.stop();}catch{recognition.current.abort();}}
 if(!Speech)return <p className="helper-text">Voice input is unavailable in this browser. You can type instead.</p>;
 return <div className="voice-input"><div className="voice-controls"><div className="voice-language"><label htmlFor={languageId}>Language</label><InfoTip>Your browser may send audio to its speech recognition provider.</InfoTip><select id={languageId} value={language} disabled={listening||disabled} onChange={e=>setLanguage(e.target.value)}><option value="en-US">English</option><option value="zh-CN">中文</option></select></div><button className={listening?'voice-button recording':'voice-button'} type="button" disabled={disabled||stopping} onClick={listening?stop:start}>{listening ? <Square className="button-icon" aria-hidden="true"/> : <Mic className="button-icon" aria-hidden="true"/>}{stopping?'Stopping…':listening?'Stop Listening':'Start Voice'}</button></div>{listening && <p className="helper-text">Listening… Speak naturally, then stop and review the text.</p>}{interim && <p className="voice-interim" aria-live="polite">{interim}</p>}{notice && <p role="status">{notice}</p>}</div>;
}
