import { bindTestContact } from './test-contact.ts';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.ts';
import { labelRealSms } from '../shared/sms.ts';

test('delete removes the selected Photon conversation and prevents webhook replay after restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'neuroproxy-delete-'));const path=join(dir,'test.db');let store=new Store(path);
 const space='pho_spc_00000000000000000000000001',agent='pho_usr_00000000000000000000000001',human='pho_usr_00000000000000000000000002',sent='pho_msg_00000000000000000000000001';
 const reply={eventId:'event-1',messageId:'reply-1',spaceId:space,senderId:human,recipientId:agent,parentMessageId:sent,body:'Synthetic reply',imessage:{humanHandle:'+14155550123',agentHandle:'+14155550124'}};
 try {
  const created=store.createReviewed({topic:'Delete me',people:['A'],tasks:[{description:'Ask',assignee:'A'}],uncertainties:[],draft:{recipient:'A',taskIndex:0,body:'Hello'}});
  const other=store.createReviewed({topic:'Keep me',people:[],tasks:[],uncertainties:[],draft:null});
  bindTestContact(store,created.draftId!);store.reservePhoton(created.draftId!,space,agent,human,labelRealSms('Hello'),'+14155550123');store.finishPhoton(created.draftId!,sent);assert.equal(store.receivePhoton(reply),true);
  store.deleteConversation(created.topicId);let graph=store.graph();assert.ok(!graph.nodes.some(n=>n.id===created.topicId || n.label==='Synthetic reply'));assert.ok(graph.nodes.some(n=>n.id===other.topicId));assert.equal(graph.drafts.length,0);assert.equal(store.imessageSessions().length,0);
  store.close();store=new Store(path);assert.equal(store.receivePhoton(reply),false);assert.equal(store.receivePhoton({...reply,eventId:'redelivery-with-another-id'}),false);
  graph=store.graph();assert.ok(!graph.nodes.some(n=>n.label==='Synthetic reply'));assert.ok(graph.nodes.some(n=>n.id===other.topicId));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('unlinked inbound messages can be deleted without being recreated by redelivery',()=>{
 const store=new Store(':memory:');const message={eventId:'unlinked-event',messageId:'unlinked-message',spaceId:'space',senderId:'human',recipientId:'agent',parentMessageId:null,body:'Synthetic ping',imessage:{humanHandle:'test',agentHandle:'agent'}};
 try{assert.equal(store.receivePhoton(message),true);assert.equal(store.imessageSessions().length,1);store.deleteConversation('unlinked');assert.equal(store.graph().nodes.length,0);assert.equal(store.imessageSessions().length,0);assert.equal(store.receivePhoton(message),false);}finally{store.close();}
});
