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

export class ExtractionValidationError extends Error {
  constructor(message:string) { super(message); this.name='ExtractionValidationError'; }
}

/** Repair only unambiguous model-generated references; never guess an assignee. */
export function normalizeModelExtraction(value:unknown):Extraction {
  const result=extractionSchema.parse(value);
  const resolve=(name:string)=>result.people.find(person=>person.toLocaleLowerCase()===name.toLocaleLowerCase()) ?? '';
  result.tasks=result.tasks.map(task=>({...task,assignee:resolve(task.assignee)}));
  return validateExtraction(result);
}

export function validateExtraction(value: unknown): Extraction {
  const result = extractionSchema.parse(value);
  if (result.draft) {
    if (!result.draft.recipient || !result.draft.body || result.draft.taskIndex === null || result.draft.taskIndex < 0 || result.draft.taskIndex >= result.tasks.length) throw new ExtractionValidationError('A draft needs a recipient, message, and associated task.');
    if (!result.people.includes(result.draft.recipient)) throw new ExtractionValidationError('The draft recipient must be listed under people.');
  }
  if (result.tasks.some(task => task.assignee && !result.people.includes(task.assignee))) throw new ExtractionValidationError('Each task assignee must be listed under people.');
  if (result.uncertainties.some(item => item.people.some(person => !result.people.includes(person)) || new Set(item.people).size !== item.people.length)) throw new ExtractionValidationError('Question participants must be distinct and listed under people.');
  if (new Set(result.people.map(x => x.toLocaleLowerCase())).size !== result.people.length) throw new ExtractionValidationError('People must have distinct names.');
  return result;
}
