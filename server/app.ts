import Fastify from 'fastify';
import { Store } from './store.ts';
import { createAgent } from './agent.ts';
import { extractConversation, type Extractor } from './extract.ts';
import { validateExtraction } from '../shared/extraction.ts';
import { parsePhotonMessage, verifyPhotonWebhook } from './photon-webhook.ts';
import { PhotonSender, type PhotonTarget } from './photon.ts';
export function createApp(store: Store, extractor: Extractor = extractConversation, webhookConfig = { secret: process.env.PHOTON_WEBHOOK_SECRET, projectId: process.env.PHOTON_PROJECT_ID }, photon = new PhotonSender({apiKey:process.env.PHOTON_API_KEY,projectId:process.env.PHOTON_PROJECT_ID})) {
const app = Fastify({ logger: false });
app.setErrorHandler((error, _req, reply) => { reply.code(400).send({ error: error instanceof Error ? error.message : 'Request failed' }); });
app.register(async (webhook) => {
  webhook.removeContentTypeParser('application/json');
  webhook.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 65536 }, (_req, body, done) => done(null, body));
  webhook.post('/api/webhooks/photon', async (req, reply) => {
    if (!webhookConfig.secret || !webhookConfig.projectId) return reply.code(503).send({ error: 'Photon webhook is not configured.' });
    if (!Buffer.isBuffer(req.body) || !verifyPhotonWebhook(req.body, req.headers, webhookConfig.secret)) return reply.code(401).send({ error: 'Invalid webhook signature.' });
    let delivery: unknown;
    try { delivery = JSON.parse(req.body.toString('utf8')); } catch { return reply.code(400).send({ error: 'Invalid webhook JSON.' }); }
    if (!delivery || typeof delivery !== 'object' || typeof (delivery as {type?:unknown}).type !== 'string') return reply.code(400).send({ error: 'Invalid webhook event.' });
    if ((delivery as {type:string}).type !== 'message.received') return reply.code(204).send();
    const content = (delivery as {data?:{object?:{content?:{type?:unknown}}}}).data?.object?.content;
    if (content && typeof content.type === 'string' && content.type !== 'text') return reply.code(204).send();
    const message = parsePhotonMessage(delivery, webhookConfig.projectId);
    if (!message) return reply.code(400).send({ error: 'Invalid message event.' });
    try { store.receivePhoton(message); }
    catch { return reply.code(503).send({ error: 'Unable to store webhook event.' }); }
    return reply.code(204).send();
  });
});
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
app.post('/api/drafts/:id/approve-photon', async (req, reply) => {
  const b = req.body as (PhotonTarget & {approvedBody?:unknown;consent?:unknown}) | null;
  if (!b || b.consent !== true || typeof b.approvedBody !== 'string' || typeof b.spaceId !== 'string' || typeof b.senderId !== 'string' || typeof b.recipientId !== 'string' || typeof b.recipientPhone !== 'string') return reply.code(400).send({error:'Confirm recipient consent and approve the exact draft.'});
  try { await photon.verifyTarget(b); } catch { return reply.code(400).send({error:'Could not verify the Photon SMS conversation and recipient.'}); }
  const id=(req.params as {id:string}).id;
  const reserved=store.reservePhoton(id,b.spaceId,b.senderId,b.recipientId,b.approvedBody);
  const messageId=await photon.send(b,reserved.body,reserved.key);
  store.finishPhoton(id,messageId);
  return {status:messageId ? 'waiting_for_reply' : 'send_unknown'};
});
app.post('/api/drafts/:id/approve-simulation', async (req) => { store.transition((req.params as {id:string}).id, 'waiting_for_reply'); return { ok: true }; });
app.post('/api/drafts/:id/cancel', async (req) => { store.transition((req.params as {id:string}).id, 'cancelled'); return { ok: true }; });
app.post('/api/drafts/:id/simulate-reply', async (req) => { store.reply((req.params as {id:string}).id, (req.body as {body:string}).body, 'simulated'); return { ok: true }; });
return app;
}
