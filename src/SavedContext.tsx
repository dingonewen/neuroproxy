import { useEffect, useState } from 'react';
import { InfoTip } from './InfoTip';
import { ContactPicker } from './ContactPicker';

type ContextNode={id:string;kind:string;label:string;status:string;source:string;contact_id?:string|null;contact_name?:string|null;contact_handle?:string|null};
const groups=[
 {label:'People',kinds:['person']}, {label:'Tasks',kinds:['task']},
 {label:'Unresolved Questions',kinds:['question']},
 {label:'Relationship Context',kinds:['reported_fact','feeling','need','interpretation','core_question','suggested_action']},
];
const names:Record<string,string>={person:'Person',task:'Task',question:'Question',reported_fact:'Reported Fact',feeling:'Expressed Feeling',need:'Expressed Need',interpretation:'Possible Interpretation',core_question:'Core Question',suggested_action:'Suggested Next Action',message:'Message',reply:'Reply'};
const editable=new Set(['topic','person','task','question','reported_fact','feeling','need','interpretation','core_question','suggested_action']);
function SavedNode({node,title,onRefresh,selected,onSelect}:{node:ContextNode;title:string;onRefresh:()=>Promise<void>;selected:boolean;onSelect:()=>void}) {
 const [editing,setEditing]=useState(false);const [text,setText]=useState(node.label);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const canEdit=editable.has(node.kind)||(node.kind==='message'&&node.status==='pending_approval');
 async function save(){setBusy(true);setError('');let saved=false;try{const res=await fetch(`/api/nodes/${encodeURIComponent(node.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedLabel:node.label,label:text})});const data=await res.json();if(!res.ok)throw Error(data.error);saved=true;setEditing(false);await onRefresh();}catch(e){setError(saved?'Saved, but the graph could not refresh. Reload the page.':(e as Error).message);}finally{setBusy(false);}}
 return <div id={`context-${node.id}`} className={`nested-card saved-node${selected?' saved-node-selected':''}`} tabIndex={0} onClick={onSelect} onKeyDown={e=>{if(e.target===e.currentTarget && (e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect();}}}><div className="saved-node-label">{title}</div>{editing && selected ? <><label>Revised Content<textarea value={text} disabled={busy} maxLength={node.kind==='message'?2000:500} onChange={e=>setText(e.target.value)}/></label><button type="button" disabled={busy||!text.trim()} onClick={()=>void save()}>Save Changes</button> <button className="secondary-button" type="button" disabled={busy} onClick={()=>{setEditing(false);setError('');}}>Cancel</button></> : <><div>{node.label}</div>{node.status && <small className="saved-node-status">{node.status.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())}</small>}{selected && canEdit && <button className="text-button" type="button" onClick={()=>{setText(node.label);setError('');setEditing(true);}}>Revisit</button>}{selected && !canEdit && (node.kind==='message'||node.kind==='reply') && <small>This message is read-only in its current state.</small>}</>}{selected && node.kind==='person' && !editing && <ContactPicker personId={node.id} person={node.label} contactId={node.contact_id??null} contactName={node.contact_name??null} contactHandle={node.contact_handle??null} onSaved={onRefresh}/>} {error && <p role="alert">{error}</p>}</div>;
}
export function SavedContext({nodes,onRefresh,navigation}:{nodes:ContextNode[];onRefresh:()=>Promise<void>;navigation:{id:string;nonce:number}|null}) {
 const [selectedId,setSelectedId]=useState<string|null>(null);
 useEffect(()=>{if(navigation)setSelectedId(navigation.id);},[navigation]);
 if(!nodes.length)return null;
 const topic=nodes.find(n=>n.kind==='topic');
 const known=new Set(['topic','message','reply',...groups.flatMap(g=>g.kinds)]);
 const sections=[...groups,{label:'Other Context',kinds:[...new Set(nodes.filter(n=>!known.has(n.kind)).map(n=>n.kind))]}];
 return <div className="saved-context"><div className="review-heading"><h3>Saved Context</h3><InfoTip>Use Revisit to correct saved context.</InfoTip><p className="saved-context-subtitle">Conversation Details</p></div>
  <div className="topic-card">{topic?<SavedNode key={topic.id} node={topic} title="Topic" onRefresh={onRefresh} selected={selectedId===topic.id} onSelect={()=>setSelectedId(topic.id)}/>:<strong>Unlinked Messages</strong>}
   {sections.map(group=>{const members=nodes.filter(n=>group.kinds.includes(n.kind));if(!members.length)return null;
    const relationship=group.label==='Relationship Context';
    const renderNode=(node:ContextNode,i:number)=><SavedNode key={node.id} node={node} title={`${names[node.kind] ?? node.kind.replaceAll('_',' ')} ${i+1}`} onRefresh={onRefresh} selected={selectedId===node.id} onSelect={()=>setSelectedId(node.id)}/>;
    return <div className={`category-card${relationship?' saved-relationship-card':''}`} id={relationship?'context-relationship-section':undefined} key={group.label}><div className="category-heading"><h4>{group.label}</h4><span>{members.length}</span></div>{relationship ? <div className="saved-relationship-grid">{group.kinds.map(kind=>{const items=members.filter(node=>node.kind===kind);return items.length ? <div className="saved-relationship-group" key={kind}><h5>{names[kind]}</h5>{items.map(renderNode)}</div> : null;})}</div> : members.map(renderNode)}</div>;})}
  </div>
 </div>;
}
