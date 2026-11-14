import type { Extraction } from '../shared/extraction';

type Node = {id:string;kind:string;label:string;status:string;source:string};
type Edge = {id:string;source:string;target:string;label:string};
/** Build a temporary graph; it creates no database records or external actions. */
export function previewGraph(data:Extraction):{nodes:Node[];edges:Edge[];drafts:[]} {
 const nodes:Node[]=[];const edges:Edge[]=[];const people=new Map<string,string>();
 const add=(id:string,kind:string,label:string,status='')=>nodes.push({id,kind,label:label.trim()||'(empty)',status,source:'preview'});
 const edge=(source:string,target:string,label:string)=>edges.push({id:`preview-edge-${edges.length}`,source,target,label});
 add('preview-topic','topic',data.topic);
 data.people.forEach((person,i)=>{const id=`preview-person-${i}`;add(id,'person',person);if(!people.has(person))people.set(person,id);edge('preview-topic',id,'involves');});
 data.tasks.forEach((task,i)=>{const id=`preview-task-${i}`;add(id,'task',task.description,'proposed');edge('preview-topic',id,'contains');const person=people.get(task.assignee);if(person)edge(person,id,'assigned to');});
 data.uncertainties.forEach((question,i)=>{const id=`preview-question-${i}`;add(id,'question',question.question,'unresolved');const related=question.people.map(p=>people.get(p)).filter((p):p is string=>Boolean(p));if(related.length)related.forEach(person=>edge(person,id,'question about'));else edge('preview-topic',id,'unresolved');});
 if(data.relationship){const r=data.relationship;const addInsight=(id:string,kind:string,label:string,link:string)=>{if(!label.trim())return;add(id,kind,label,'suggested');edge('preview-topic',id,link);};r.facts.forEach((v,i)=>addInsight(`preview-fact-${i}`,'reported_fact',v,'reported'));r.feelings.forEach((v,i)=>addInsight(`preview-feeling-${i}`,'feeling',v,'expressed feeling'));r.needs.forEach((v,i)=>addInsight(`preview-need-${i}`,'need',v,'expressed need'));r.interpretations.forEach((v,i)=>addInsight(`preview-interpretation-${i}`,'interpretation',v,'possible interpretation'));addInsight('preview-core','core_question',r.coreQuestion,'core question');addInsight('preview-action','suggested_action',r.nextAction,'suggested action');}
 if(data.draft){add('preview-message','message',data.draft.body,'draft');const index=data.draft.taskIndex;if(index!==null&&index>=0&&index<data.tasks.length)edge(`preview-task-${index}`,'preview-message','draft');const recipient=people.get(data.draft.recipient);if(recipient)edge(recipient,'preview-message','recipient');}
 return {nodes,edges,drafts:[]};
}
