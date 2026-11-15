import { traceAnalysis } from './telemetry.ts';
import { filterInsights, initialInsights } from './insight-filter.ts';
import Fastify from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Store } from './store.ts';
import { createAgent } from './agent.ts';
import { extractConversation, type Extractor } from './extract.ts';
import { validateExtraction } from '../shared/extraction.ts';
import { parsePhotonMessage, verifyPhotonWebhook } from './photon-webhook.ts';
import { PhotonSender, type PhotonTarget } from './photon.ts';
import { analysisErrorFingerprint, describeAnalysisError, safeValidationDetails } from './analysis-error.ts';
import { generateManualMessage, type ManualMessageGenerator } from './manual-message.ts';
import { analyzeReply, replyAnalysisSchema, type ReplyAnalyzer } from './reply-analysis.ts';
import { elevenLabsAgentStatus } from './elevenlabs.ts';
import type { ReplyProgress } from '../shared/reply-progress.ts';
export function createApp(store: Store, extractor: Extractor = extractConversation, webhookConfig = { secret: process.env.PHOTON_WEBHOOK_SECRET, projectId: process.env.PHOTON_PROJECT_ID }, photon = new PhotonSender({apiKey:process.env.PHOTON_API_KEY,projectId:process.env.PHOTON_PROJECT_ID,smsNumber:process.env.PHOTON_SMS_NUMBER}), manualMessage:ManualMessageGenerator = generateManualMessage, replyAnalyzer:ReplyAnalyzer = analyzeReply) {
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
app.get('/api/voice/elevenlabs/status', async (_req,reply) => {
  const agentId=process.env.ELEVENLABS_AGENT_ID;
  if(!process.env.ELEVENLABS_API_KEY || !agentId)return {configured:false};
  try{return {configured:true,agent:await elevenLabsAgentStatus(agentId)};}catch{return reply.code(502).send({error:'Could not retrieve the ElevenLabs agent. Check the agent ID and account access.'});}
});
app.get('/api/contacts', async () => ({contacts:store.contacts()}));
app.post('/api/contacts', async req=>{const b=req.body as {name?:unknown;handle?:unknown}|null;return store.createContact(b?.name,b?.handle);});
app.patch('/api/contacts/:id', async req=>{const b=req.body as {name?:unknown}|null;store.renameContact((req.params as {id:string}).id,b?.name);return {ok:true};});
app.delete('/api/contacts/:id', async req=>{store.deleteContact((req.params as {id:string}).id);return {ok:true};});
app.put('/api/people/:id/contact', async req=>{const b=req.body as {contactId?:unknown}|null;store.bindContact((req.params as {id:string}).id,b?.contactId);return {ok:true};});
app.get('/api/imessage-conversations', async () => ({conversations:store.imessageSessions()}));
app.patch('/api/nodes/:id', async req => {const b=req.body as {expectedLabel?:unknown;label?:unknown}|null;store.reviseNode((req.params as {id:string}).id,b?.expectedLabel,b?.label);return {ok:true};});
app.delete('/api/conversations/:id', async req => {store.deleteConversation((req.params as {id:string}).id);return {ok:true};});
app.get('/api/photon-inbox/:id/candidates', async req => ({candidates:store.photonCandidates((req.params as {id:string}).id)}));
app.post('/api/photon-inbox/:id/link', async (req,reply) => {
  const draftId=(req.body as {draftId?:unknown}|null)?.draftId;
  if(typeof draftId!=='string') return reply.code(400).send({error:'Choose a delegation.'});
  store.linkPhotonReply((req.params as {id:string}).id,draftId);
  return {ok:true};
});
app.post('/api/photon-inbox/:id/review', async (req,reply) => {
  const confirm=(req.body as {confirm?:unknown}|null)?.confirm;
  if(typeof confirm!=='boolean') return reply.code(400).send({error:'Choose whether this message is a reply.'});
  store.reviewPossibleReply((req.params as {id:string}).id,confirm);
  return {ok:true};
});
app.post('/api/extract', async (req, reply) => {
  const input = (req.body as { text?: unknown } | null)?.text;
  if (typeof input !== 'string' || !input.trim() || input.length > 8000) return reply.code(400).send({ error: 'Enter text (maximum 8000 characters).' });
  try { return initialInsights(validateExtraction(await traceAnalysis('conversation_analysis',()=>extractor(input.trim())))); }
  catch (error) { const diagnosis=describeAnalysisError(error); const fingerprint=analysisErrorFingerprint(error); console.error(`Analysis failed: ${diagnosis.kind} (${fingerprint})${diagnosis.kind==='invalid_output' ? ` [${safeValidationDetails(error)}]` : ''}`); return reply.code(502).send({ error: diagnosis.kind==='unknown' ? `${diagnosis.message} Diagnostic: ${fingerprint}.` : diagnosis.message, category:diagnosis.kind }); }
});
app.post('/api/reviewed-context', async (req) => store.createReviewed(req.body));
// Only expose this specific route to the voice provider. It cannot read existing
// conversations or approve/send messages; the bearer token authenticates the
// provider tool, not the person on the phone.
app.post('/api/voice/capture', async (req,reply) => {
  const secret=process.env.VOICE_TOOL_SECRET;
  if(!secret || secret.length<32) return reply.code(503).send({error:'Voice tool is not configured.'});
  const auth=req.headers.authorization;
  const token=typeof auth==='string' && auth.startsWith('Bearer ')?auth.slice(7):'';
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  if(!token || !timingSafeEqual(digest(token),digest(secret))) return reply.code(401).send({error:'Unauthorized.'});
  const b=req.body as {conversationId?:unknown;text?:unknown}|null;
  if(typeof b?.conversationId!=='string'||!/^conv_[A-Za-z0-9_-]{1,150}$/.test(b.conversationId)||typeof b.text!=='string'||!b.text.trim()||b.text.length>8000) return reply.code(400).send({error:'Provide a valid conversation ID and transcript (maximum 8000 characters).'});
  const existing=store.voiceCapture(b.conversationId);
  if(existing) return existing.summary?existing:reply.code(409).send({error:'This call was previously deleted.'});
  try {
    const voiceText=b.text.trim();const analysis=initialInsights(validateExtraction(await traceAnalysis('voice_analysis',()=>extractor(voiceText))));
    const saved=store.createReviewed(analysis,b.conversationId);
    if(!saved.voiceSummary) return reply.code(409).send({error:'This call was previously deleted.'});
    return {summary:saved.voiceSummary,duplicate:saved.duplicate};
  } catch(error){const diagnosis=describeAnalysisError(error);console.error(`Voice capture failed: ${diagnosis.kind} (${analysisErrorFingerprint(error)})${diagnosis.kind==='invalid_output' ? ` [${safeValidationDetails(error)}]` : ''}`);return reply.code(502).send({error:'Could not analyze and save this call. Please try again.'});}
});
const replyAnalysisJobs=new Map<string,Promise<ReplyProgress>>();
app.post('/api/replies/:id/analyze', async (req,reply) => {
  const id=(req.params as {id:string}).id;const context=store.replyAnalysisContext(id);
  const existing=store.replyProgress(id);if(existing)return existing;
  try {
    let job=replyAnalysisJobs.get(id);
    if(!job){job=(async()=>{const analysis=replyAnalysisSchema.parse(await traceAnalysis('reply_analysis',()=>replyAnalyzer(context)));const relationship=filterInsights(analysis.relationship,store.replyExistingInsights(id),2);return store.startReplyProgress(id,relationship,analysis.suggestedReply,context.person);})();replyAnalysisJobs.set(id,job);void job.then(()=>replyAnalysisJobs.delete(id),()=>replyAnalysisJobs.delete(id));}
    return await job;
  }
  catch(error){const diagnosis=describeAnalysisError(error);const fingerprint=analysisErrorFingerprint(error);console.error(`Reply analysis failed: ${diagnosis.kind} (${fingerprint})${diagnosis.kind==='invalid_output' ? ` [${safeValidationDetails(error)}]` : ''}`);return reply.code(502).send({error:diagnosis.kind==='invalid_output' ? 'The model returned an invalid reply analysis. Please try again; nothing was saved.' : diagnosis.message,category:diagnosis.kind});}
});
app.get('/api/replies/:id/progress',async req=>{const id=(req.params as {id:string}).id;store.replyAnalysisContext(id);return {progress:store.replyProgress(id),processing:replyAnalysisJobs.has(id)};});
app.put('/api/replies/:id/progress',async req=>{const id=(req.params as {id:string}).id;store.replyAnalysisContext(id);store.updateReplyProgress(id,req.body);return {ok:true};});
app.delete('/api/replies/:id/progress',async req=>{const id=(req.params as {id:string}).id;store.replyAnalysisContext(id);store.discardReplyProgress(id);return {ok:true};});
app.post('/api/replies/:id/insights', async (req) => {store.addReplyInsights((req.params as {id:string}).id,req.body);return {ok:true};});
app.post('/api/replies/:id/draft', async req => {const b=req.body as {body?:unknown;action?:unknown}|null;return store.createReplyDraft((req.params as {id:string}).id,b?.body,b?.action);});
app.post('/api/ask', async (req) => {
  const question = (req.body as {question?:unknown})?.question;
  if (typeof question !== 'string' || !question.trim() || question.length > 2000) throw new Error('Enter a question (maximum 2000 characters).');
  if (!process.env.NEUROPROXY_MODEL) throw new Error('Set NEUROPROXY_MODEL and the provider credentials to use context recovery.');
  const result = await createAgent(store).generate(question, { maxSteps: 5 });
  return { answer: result.text };
});
app.post('/api/drafts', async (req) => { const b = req.body as Record<string,string>; return { id: store.create(b.topic, b.person, b.task, b.body) }; });
app.post('/api/conversations/:id/delegation-suggestion', async (req,reply) => {
  const id=(req.params as {id:string}).id;const b=req.body as {personId?:unknown;newPerson?:unknown;actionId?:unknown;customAction?:unknown}|null;
  const context=store.delegationContext(id,b?.personId,b?.newPerson,b?.actionId,b?.customAction);
  const data=context.nodes.filter(n=>['topic','person','task','question','reported_fact','feeling','need','interpretation','core_question','suggested_action','message','reply'].includes(String(n.kind))).slice(-30).map(n=>({kind:String(n.kind),text:String(n.label).slice(0,500)}));
  try {return await manualMessage({person:context.person,action:context.action,conversation:data});}
  catch(error){const diagnosis=describeAnalysisError(error);const fingerprint=analysisErrorFingerprint(error);console.error(`Message generation failed: ${diagnosis.kind} (${fingerprint})`);return reply.code(502).send({error:diagnosis.message,category:diagnosis.kind});}
});
app.post('/api/conversations/:id/drafts', async req => {const b=req.body as {personId?:unknown;newPerson?:unknown;actionId?:unknown;customAction?:unknown;body?:unknown}|null;return store.createConversationDraft((req.params as {id:string}).id,b??{});});
app.post('/api/drafts/:id/approve-photon-phone', async (req, reply) => {
  const b=req.body as {recipientPhone?:unknown;approvedBody?:unknown;consent?:unknown;label?:unknown}|null;
  if(!b || b.consent!==true || typeof b.recipientPhone!=='string' || typeof b.approvedBody!=='string' || (b.label!==undefined && typeof b.label!=='string')) return reply.code(400).send({error:'Confirm recipient consent and approve the exact draft.'});
  const id=(req.params as {id:string}).id;
  const reserved=store.preparePhone(id,b.recipientPhone.trim(),b.approvedBody,b.label as string|undefined);
  let target: PhotonTarget;
  try { target=await photon.resolvePhone(b.recipientPhone.trim(),reserved.key); }
  catch { store.failPreparation(id); return reply.code(502).send({error:'Could not prepare the Photon SMS conversation. No SMS was sent; check number activation, API credentials, and E.164 numbers.'}); }
  store.bindPreparedPhone(id,target,reserved.key);
  const messageId=await photon.send(target,reserved.body,reserved.key);
  store.finishPhoton(id,messageId);
  return {status:messageId ? 'waiting_for_reply' : 'send_unknown'};
});
app.post('/api/drafts/:id/approve-photon-imessage', async (req,reply) => {
 const b=req.body as {nodeId?:unknown;approvedHandle?:unknown;approvedBody?:unknown;consent?:unknown;label?:unknown}|null;
 if(!b || b.consent!==true || typeof b.nodeId!=='string' || typeof b.approvedHandle!=='string' || typeof b.approvedBody!=='string' || (b.label!==undefined && typeof b.label!=='string')) return reply.code(400).send({error:'Review the recipient and exact message and confirm consent.'});
 const target=store.imessageTarget(b.nodeId);
 if(!target || target.humanHandle!==b.approvedHandle) return reply.code(400).send({error:'The selected iMessage conversation no longer matches the approved recipient.'});
 const id=(req.params as {id:string}).id;
 const reserved=store.reservePhoton(id,target.spaceId,target.senderId,target.recipientId,b.approvedBody,target.humanHandle,b.label as string|undefined);
 const messageId=await photon.send({...target,recipientPhone:target.humanHandle},reserved.body,reserved.key,target.parentMessageId);
 store.finishPhoton(id,messageId);
 return {status:messageId?'waiting_for_reply':'send_unknown'};
});
app.post('/api/drafts/:id/approve-photon', async (req, reply) => {
  const b = req.body as (PhotonTarget & {approvedBody?:unknown;consent?:unknown}) | null;
  if (!b || b.consent !== true || typeof b.approvedBody !== 'string' || typeof b.spaceId !== 'string' || typeof b.senderId !== 'string' || typeof b.recipientId !== 'string' || typeof b.recipientPhone !== 'string') return reply.code(400).send({error:'Confirm recipient consent and approve the exact draft.'});
  try { await photon.verifyTarget(b); } catch { return reply.code(400).send({error:'Could not verify the Photon SMS conversation and recipient.'}); }
  const id=(req.params as {id:string}).id;
  const reserved=store.reservePhoton(id,b.spaceId,b.senderId,b.recipientId,b.approvedBody,b.recipientPhone);
  const messageId=await photon.send(b,reserved.body,reserved.key);
  store.finishPhoton(id,messageId);
  return {status:messageId ? 'waiting_for_reply' : 'send_unknown'};
});
app.post('/api/drafts/:id/approve-simulation', async (req) => { store.transition((req.params as {id:string}).id, 'waiting_for_reply'); return { ok: true }; });
app.post('/api/drafts/:id/cancel', async (req) => { store.transition((req.params as {id:string}).id, 'cancelled'); return { ok: true }; });
app.post('/api/drafts/:id/simulate-reply', async (req) => { store.reply((req.params as {id:string}).id, (req.body as {body:string}).body, 'simulated'); return { ok: true }; });
return app;
}
