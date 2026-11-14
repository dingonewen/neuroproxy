import type { Extraction } from './extraction';

export function delegationPrefill(context: Extraction) {
  const selectedTask = context.draft?.taskIndex != null
    ? context.tasks[context.draft.taskIndex]
    : context.tasks.length === 1 ? context.tasks[0] : undefined;
  return {
    topic: context.topic,
    person: context.draft?.recipient ?? (context.people.length === 1 ? context.people[0] : ''),
    task: selectedTask?.description ?? '',
    body: context.draft?.body ?? '',
  };
}
