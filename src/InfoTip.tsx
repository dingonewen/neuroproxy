import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircleQuestion } from 'lucide-react';

export function InfoTip({children}:{children:string}) {
 const id=useId();
 const trigger=useRef<HTMLButtonElement>(null);
 const popover=useRef<HTMLSpanElement>(null);
 const [open,setOpen]=useState(false);
 const [position,setPosition]=useState({left:8,top:8});

 useLayoutEffect(()=>{
  if(!open)return;
  const update=()=>{
   const anchor=trigger.current?.getBoundingClientRect();
   const tip=popover.current?.getBoundingClientRect();
   if(!anchor||!tip)return;
   const left=Math.max(8,Math.min(anchor.left,window.innerWidth-tip.width-8));
   const below=anchor.bottom+8;
   const top=below+tip.height<=window.innerHeight-8?below:Math.max(8,anchor.top-tip.height-8);
   setPosition({left,top});
  };
  const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.blur();}};
  update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);window.addEventListener('keydown',keydown);
  return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);window.removeEventListener('keydown',keydown);};
 },[open]);

 return <span className="info-tip" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}><button ref={trigger} type="button" className="info-trigger" aria-label="More information" aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={()=>setOpen(true)}><MessageCircleQuestion aria-hidden="true"/></button>{open && createPortal(<span ref={popover} className="info-popover info-popover-portal" id={id} role="tooltip" style={position}>{children}</span>,document.body)}</span>;
}
