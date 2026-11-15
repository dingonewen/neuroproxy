import { useLayoutEffect, useRef } from 'react';

export function ExpandingInsightInput({value,onChange,maxLength=500}:{value:string;onChange:(value:string)=>void;maxLength?:number}) {
 const ref=useRef<HTMLTextAreaElement>(null);
 const expand=()=>{const field=ref.current;if(!field)return;field.style.height='auto';field.style.height=`${field.scrollHeight+field.offsetHeight-field.clientHeight}px`;};
 useLayoutEffect(()=>{expand();window.addEventListener('resize',expand);return()=>window.removeEventListener('resize',expand);},[value]);
 return <textarea ref={ref} className="insight-expanding-input" rows={1} maxLength={maxLength} value={value} onFocus={expand} onChange={e=>onChange(e.target.value)}/>;
}

export function InsightReviewField({id,label,value,onChange,onRemove}:{id?:string;label:string;value:string;onChange:(value:string)=>void;onRemove:()=>void}) {
 return <div className="nested-card insight-review-field" id={id}><label><span className="saved-node-label">{label}</span><ExpandingInsightInput value={value} onChange={onChange}/></label><button className="text-button" type="button" onClick={onRemove}>Remove</button></div>;
}
