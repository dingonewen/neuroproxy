import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// Photon 2.0 Beta signs the delivery ID, timestamp and exact body bytes with Standard Webhooks.
// https://github.com/photon-hq/dify/tree/main/trigger
export function verifyPhotonWebhook(raw: Buffer, headers: Record<string, string | string[] | undefined>, secret: string, now = Date.now()): boolean {
 const id = headers['webhook-id']; const timestamp = headers['webhook-timestamp']; const signature = headers['webhook-signature'];
 if (typeof id !== 'string' || !id || typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp) || typeof signature !== 'string' || !signature || !secret.startsWith('whsec_')) return false;
 const encoded = secret.slice(6);
 if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
 const key = Buffer.from(encoded, 'base64');
 if (!key.length || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return false;
 const seconds = Number(timestamp);
 if (!Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
 const expected = createHmac('sha256',key).update(`${id}.${timestamp}.`).update(raw).digest();
 return signature.split(/\s+/).some(part => {
  if (!part.startsWith('v1,')) return false;
  const encodedSignature = part.slice(3);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSignature)) return false;
  const actual = Buffer.from(encodedSignature, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
 });
}
const id = z.string().min(1).max(255);
const deliverySchema = z.object({
 id, type:z.literal('message.received'),
 data:z.object({ projectId:id, object:z.object({
  id, projectId:id, platform:z.string(), status:z.literal('received'),
  space:z.object({id}), sentBy:z.object({id, kind:z.string()}), receivedBy:z.object({id, kind:z.string()}),
  parentMessageId:id.nullable().optional(), content:z.object({type:z.literal('text'), text:z.string().trim().min(1).max(2000)}),
 }) }),
});
export function parsePhotonMessage(value: unknown, projectId: string) {
 const parsed=deliverySchema.safeParse(value);
 if (!parsed.success) return null;
 const {data}=parsed.data; const message=data.object;
 if (data.projectId !== projectId || message.projectId !== projectId || message.sentBy.kind !== 'human' || message.receivedBy.kind !== 'agent') return null;
 return {eventId:parsed.data.id, messageId:message.id, spaceId:message.space.id, senderId:message.sentBy.id, recipientId:message.receivedBy.id, parentMessageId:message.parentMessageId ?? null, body:message.content.text};
}
export type PhotonMessage = NonNullable<ReturnType<typeof parsePhotonMessage>>;
