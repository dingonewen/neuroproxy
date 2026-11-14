import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {previewGraph} from './preview-graph.ts';
test('analysis preview connects questions to people and drafts to their task without saving',()=>{
 const graph=previewGraph({topic:'Project',people:['Alex'],tasks:[{description:'Check',assignee:'Alex'}],uncertainties:[{question:'When?',people:['Alex']}],draft:{recipient:'Alex',taskIndex:0,body:'When?'}});
 assert.ok(graph.edges.some(e=>e.source==='preview-person-0'&&e.target==='preview-question-0'));
 assert.ok(graph.edges.some(e=>e.source==='preview-task-0'&&e.target==='preview-message'));
 assert.ok(graph.nodes.every(n=>n.source==='preview'));assert.deepEqual(graph.drafts,[]);
});
