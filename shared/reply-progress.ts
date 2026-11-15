import { z } from 'zod';

const entry=z.string().max(500);
export const replyProgressSchema=z.object({
 stage:z.enum(['review','suggested']),
 relationship:z.object({facts:z.array(entry).max(10),feelings:z.array(entry).max(10),needs:z.array(entry).max(10),interpretations:z.array(entry).max(10),coreQuestion:entry,nextAction:entry}),
 suggestedReply:z.string().max(2000),action:entry,
});
export type ReplyProgress=z.infer<typeof replyProgressSchema>;
