import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Store } from './store.ts';

test('approval, duplicate prevention, cancellation, and simulated reply update the graph', () => {
 const s = new Store(':memory:');
 try {
  const id = s.create('Project', 'Alex', 'Confirm deadline', 'Can you confirm?');
  assert.throws(() => s.reply(id, 'Saturday', 'simulated'), /not waiting/);
  s.transition(id, 'waiting_for_reply');
  assert.throws(() => s.transition(id, 'waiting_for_reply'), /not awaiting/);
  s.reply(id, 'Saturday', 'simulated');
  assert.throws(() => s.reply(id, 'Again', 'simulated'), /not waiting/);
  const graph = s.graph();
  assert.equal(graph.drafts[0].state, 'reply_received');
  assert.equal(graph.nodes.find(n=>n.kind==='reply')?.source, 'simulated');
  assert.equal(graph.nodes.find(n=>n.kind==='task')?.status, 'reply_received');
  const cancelled = s.create('Project', 'Sam', 'Dataset', 'When?');
  s.transition(cancelled, 'cancelled');
  assert.throws(() => s.transition(cancelled, 'waiting_for_reply'), /not awaiting/);
 } finally { s.close(); }
});
