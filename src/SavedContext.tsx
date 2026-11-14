import { InfoTip } from './InfoTip';

type ContextNode={id:string;kind:string;label:string;status:string;source:string};
const groups=[
 {label:'People',kinds:['person']},
 {label:'Tasks',kinds:['task']},
 {label:'Unresolved Questions',kinds:['question']},
 {label:'Relationship Context',kinds:['reported_fact','feeling','need','interpretation','core_question','suggested_action']},
 {label:'Messages and Replies',kinds:['message','reply']},
];
const names:Record<string,string>={person:'Person',task:'Task',question:'Question',reported_fact:'Reported Fact',feeling:'Expressed Feeling',need:'Expressed Need',interpretation:'Possible Interpretation',core_question:'Core Question',suggested_action:'Suggested Next Action',message:'Message',reply:'Reply'};
export function SavedContext({nodes}:{nodes:ContextNode[]}) {
 if(!nodes.length)return null;
 const topic=nodes.find(n=>n.kind==='topic');
 const known=new Set(['topic',...groups.flatMap(g=>g.kinds)]);
 const sections=[...groups,{label:'Other Context',kinds:[...new Set(nodes.filter(n=>!known.has(n.kind)).map(n=>n.kind))]}];
 return <div className="saved-context"><div className="review-heading"><h3>Saved Context</h3><InfoTip>This is the saved graph. Start a new analysis to make a new set of suggestions.</InfoTip><p className="saved-context-subtitle">Conversation Details</p></div>
  <div className="topic-card" id={topic?`context-${topic.id}`:undefined}><div className="saved-topic-label">Topic</div><strong>{topic?.label ?? 'Unlinked Messages'}</strong>
   {sections.map(group=>{const members=nodes.filter(n=>group.kinds.includes(n.kind));if(!members.length)return null;return <div className="category-card" id={group.label==='Relationship Context'?'context-relationship-section':undefined} key={group.label}><div className="category-heading"><h4>{group.label}</h4><span>{members.length}</span></div>{members.map((node,i)=><div id={`context-${node.id}`} className="nested-card saved-node" key={node.id}><div className="saved-node-label">{names[node.kind] ?? node.kind.replaceAll('_',' ')} {i+1}</div><div>{node.label}</div>{node.status && <small>{node.status.replaceAll('_',' ')}</small>}</div>)}</div>;})}
  </div>
 </div>;
}
