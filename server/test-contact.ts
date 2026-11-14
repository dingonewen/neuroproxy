import type { Store } from './store.ts';
export function bindTestContact(store:Store,draftId:string,handle='+14155550123') {
 const draft=store.graph().drafts.find(d=>d.id===draftId);if(!draft)throw Error('Missing test draft');
 const contact=store.createContact('Synthetic Contact',handle);store.bindContact(String(draft.person_id),contact.id);
}
