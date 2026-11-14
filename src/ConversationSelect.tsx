import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';

type Option={id:string;label:string};
export function ConversationSelect({options,value,onChange}:{options:Option[];value:string;onChange:(value:string)=>void}) {
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const container=useRef<HTMLDivElement>(null);
 const listId=useId();
 const selected=options.find(option=>option.id===value);
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>{if(open)document.getElementById(`${listId}-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,listId]);
 function show(){if(!options.length)return;setActive(Math.max(0,options.findIndex(option=>option.id===value)));setOpen(true);}
 function choose(index:number){const option=options[index];if(option){onChange(option.id);setOpen(false);}}
 function key(event:KeyboardEvent<HTMLButtonElement>){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open)show();else setActive(index=>Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1))));}
  else if(open&&(event.key==='Home'||event.key==='End')){event.preventDefault();setActive(event.key==='Home'?0:options.length-1);}
  else if(open&&(event.key==='Enter'||event.key===' ')){event.preventDefault();choose(active);}
  else if(event.key==='Escape'){setOpen(false);}
  else if(event.key==='Tab'){setOpen(false);}
 }
 return <div className="graph-select-wrap" ref={container}>
  <button id="graph-conversation" type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open?`${listId}-${active}`:undefined} disabled={!options.length} title={selected?.label} onClick={()=>open?setOpen(false):show()} onKeyDown={key}>
   <span className="graph-select-value">{selected?.label ?? 'No saved conversations'}</span><ChevronDown aria-hidden="true"/>
  </button>
  {open&&<div id={listId} role="listbox" className="graph-select-menu">{options.map((option,index)=><div id={`${listId}-${index}`} role="option" aria-selected={option.id===value} className={`graph-select-option${index===active?' active':''}`} key={option.id} title={option.label} onMouseMove={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}><span>{option.label}</span></div>)}</div>}
 </div>;
}
