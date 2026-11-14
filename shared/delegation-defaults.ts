type Item={id:string;kind:string;label:string};

/** Use reviewed graph content, and do not guess between multiple people. */
export function delegationDefaults(nodes:Item[]) {
 const people=nodes.filter(n=>n.kind==='person');
 const suggested=nodes.find(n=>n.kind==='suggested_action' && n.label.trim());
 const tasks=nodes.filter(n=>n.kind==='task' && n.label.trim());
 return {personId:people.length===1?people[0].id:'',actionId:suggested?.id ?? (tasks.length===1?tasks[0].id:'')};
}
