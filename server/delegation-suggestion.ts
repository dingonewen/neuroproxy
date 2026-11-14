import { z } from 'zod';
import type { Extraction } from '../shared/extraction.ts';

export const suggestionSchema=z.object({suggestion:z.object({recipient:z.string().trim().min(1).max(500),action:z.string().trim().min(1).max(500),body:z.string().trim().min(1).max(2000)}).nullable()});
type Suggestion=z.infer<typeof suggestionSchema>['suggestion'];

/** Add a proposed draft only when the model identifies a known recipient and a concrete action. */
export async function ensureDelegationSuggestion(context:Extraction, propose:()=>Promise<Suggestion>):Promise<Extraction> {
 if(context.draft || !context.people.length) return context;
 const candidate=await propose();
 const parsed=suggestionSchema.safeParse({suggestion:candidate});
 if(!parsed.success || !parsed.data.suggestion) return context;
 const {recipient,action,body}=parsed.data.suggestion;
 if(!context.people.includes(recipient))return context;
 let index=context.tasks.findIndex(t=>t.description.toLocaleLowerCase()===action.toLocaleLowerCase());
 if(index<0 && context.tasks.length>=20)return context;
 const tasks=[...context.tasks];
 if(index<0){index=tasks.length;tasks.push({description:action,assignee:''});}
 return {...context,tasks,draft:{recipient,taskIndex:index,body}};
}
