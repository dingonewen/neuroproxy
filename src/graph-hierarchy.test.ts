import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { graphHierarchy } from './graph-hierarchy.ts';

test('relationship groups organize original nodes without changing stored graph', () => {
 const node=(id:string,kind:string)=>({id,kind,label:id,status:'',source:'analysis'});
 const graph={nodes:[node('topic','topic'),node('person','person'),node('fact','reported_fact'),node('interpretation','interpretation'),node('action','suggested_action')],edges:[{id:'a',source:'topic',target:'person',label:'involves'},{id:'b',source:'topic',target:'fact',label:'reported'},{id:'c',source:'topic',target:'interpretation',label:'possible interpretation'},{id:'d',source:'topic',target:'action',label:'suggested action'}]};
 const before=structuredClone(graph);const result=graphHierarchy(graph);
 assert.deepEqual(graph,before);
 assert.ok(result.edges.some(e=>e.source==='topic'&&e.target==='person'&&e.label==='involves'));
 assert.ok(result.edges.some(e=>e.source==='visual-group:topic:reported'&&e.target==='fact'&&e.label==='reported'));
 assert.ok(result.edges.some(e=>e.source==='visual-group:topic:reported'&&e.target==='visual-group:topic:interpret'&&e.label==='review order'));
 assert.ok(result.edges.some(e=>e.source==='visual-group:topic:action'&&e.target==='action'&&e.label==='suggested action'));
 assert.equal(result.nodes.filter(n=>n.kind==='group').length,4);
});
