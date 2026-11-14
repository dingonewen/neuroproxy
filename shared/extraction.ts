import { z } from 'zod';

const text = z.string().trim().max(500);
export const relationshipSchema = z.object({
  facts: z.array(text.min(1)).max(10),
  feelings: z.array(text.min(1)).max(10),
  needs: z.array(text.min(1)).max(10),
  interpretations: z.array(text.min(1)).max(10),
  coreQuestion: text,
  nextAction: text,
});
export const extractionSchema = z.object({
  topic: text.min(1),
  people: z.array(text.min(1)).max(20),
  tasks: z.array(z.object({ description: text.min(1), assignee: text })).max(20),
  uncertainties: z.array(z.object({ question: text.min(1), people: z.array(text.min(1)).max(20) })).max(20),
  draft: z.object({ recipient: text, taskIndex: z.number().int().nullable(), body: z.string().trim().max(2000) }).nullable(),
  relationship: relationshipSchema.nullable().optional(),
});
export type Extraction = z.infer<typeof extractionSchema>;

export function validateExtraction(value: unknown): Extraction {
  const result = extractionSchema.parse(value);
  if (result.draft) {
    if (!result.draft.recipient || !result.draft.body || result.draft.taskIndex === null || result.draft.taskIndex < 0 || result.draft.taskIndex >= result.tasks.length) throw new Error('A draft needs a recipient, message, and associated task.');
    if (!result.people.includes(result.draft.recipient)) throw new Error('The draft recipient must be listed under people.');
  }
  if (result.tasks.some(task => task.assignee && !result.people.includes(task.assignee))) throw new Error('Each task assignee must be listed under people.');
  if (result.uncertainties.some(item => item.people.some(person => !result.people.includes(person)) || new Set(item.people).size !== item.people.length)) throw new Error('Question participants must be distinct and listed under people.');
  if (new Set(result.people.map(x => x.toLocaleLowerCase())).size !== result.people.length) throw new Error('People must have distinct names.');
  return result;
}
