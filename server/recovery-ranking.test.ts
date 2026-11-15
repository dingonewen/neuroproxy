import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {bm25Scores,rankRecoveryGraph} from './recovery-ranking.ts';
import {Store} from './store.ts';

test('BM25 ranks relevant English and Chinese text without inventing matches',()=>{
 const docs=['David wants to meet Saturday','Alice needs a dataset','大卫想要周六见面'];
 assert.ok(bm25Scores('David Saturday',docs)[0]>bm25Scores('David Saturday',docs)[1]);
 assert.ok(bm25Scores('周六见面',docs)[2]>0);
 assert.deepEqual(bm25Scores('unmatched',docs),[0,0,0]);
});

test('recovery ranks complete conversations and keeps drafts and edges',()=>{
 const store=new Store(':memory:');try {
  store.create('Tea with David','David','Ask about Saturday','Can we meet Saturday?');
  store.create('Work with Alice','Alice','Check dataset','Is the dataset ready?');
  const graph=store.graph();const ranked=rankRecoveryGraph(graph,'David Saturday');
  assert.equal(ranked.nodes[0].label,'Tea with David');
  assert.equal(ranked.nodes.length,graph.nodes.length);assert.equal(ranked.edges.length,graph.edges.length);assert.equal(ranked.drafts.length,graph.drafts.length);
  assert.deepEqual(rankRecoveryGraph(graph,'unmatched').nodes,graph.nodes.slice().sort((a,b)=>{const t=(n:typeof a)=>n.label==='Work with Alice'||n.label==='Alice'||n.label==='Check dataset'||n.label==='Is the dataset ready?'?0:1;return t(a)-t(b);}));
 } finally {store.close();}
});
