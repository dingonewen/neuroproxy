import Fastify from 'fastify';
import { Store } from './store.ts';
import { createAgent } from './agent.ts';
import { extractConversation, type Extractor } from './extract.ts';
import { validateExtraction } from '../shared/extraction.ts';
export function createApp(store: Store, extractor: Extractor = extractConversation) {
const app = Fastify({ logger: false });
app.setErrorHandler((error, _req, reply) => { reply.code(400).send({ error: error instanceof Error ? error.message : 'Request failed' }); });
app.get('/api/graph', async () => store.graph());
app.post('/api/extract', async (req, reply) => {
  const input = (req.body as { text?: unknown } | null)?.text;
  if (typeof input !== 'string' || !input.trim() || input.length > 8000) return reply.code(400).send({ error: 'Enter text (maximum 8000 characters).' });
  try { return validateExtraction(await extractor(input.trim())); }
  catch { return reply.code(502).send({ error: 'Analysis failed. Check NEUROPROXY_MODEL and provider credentials, then try again.' }); }
});
app.post('/api/reviewed-context', async (req) => store.createReviewed(req.body));
app.post('/api/ask', async (req) => {
  const question = (req.body as {question?:unknown})?.question;
  if (typeof question !== 'string' || !question.trim() || question.length > 2000) throw new Error('Enter a question (maximum 2000 characters).');
  if (!process.env.NEUROPROXY_MODEL) throw new Error('Set NEUROPROXY_MODEL and the provider credentials to use context recovery.');
  const result = await createAgent(store).generate(question, { maxSteps: 5 });
  return { answer: result.text };
});
app.post('/api/drafts', async (req) => { const b = req.body as Record<string,string>; return { id: store.create(b.topic, b.person, b.task, b.body) }; });
app.post('/api/drafts/:id/approve-simulation', async (req) => { store.transition((req.params as {id:string}).id, 'waiting_for_reply'); return { ok: true }; });
app.post('/api/drafts/:id/cancel', async (req) => { store.transition((req.params as {id:string}).id, 'cancelled'); return { ok: true }; });
app.post('/api/drafts/:id/simulate-reply', async (req) => { store.reply((req.params as {id:string}).id, (req.body as {body:string}).body, 'simulated'); return { ok: true }; });
return app;
}
