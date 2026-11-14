import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { validateExtraction, relationshipSchema, type Extraction } from '../shared/extraction.ts';
import type { PhotonMessage } from './photon-webhook.ts';
import { groupGraph } from '../shared/graph-groups.ts';
import { labelRealSms } from '../shared/sms.ts';

const eventHash=(value:string)=>createHash('sha256').update(value).digest('hex');

export class Store {
  db: DatabaseSync;
  constructor(path = 'neuroproxy.db') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'user'); CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES nodes(id), target TEXT NOT NULL REFERENCES nodes(id), label TEXT NOT NULL); CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, person TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL, person_id TEXT NOT NULL REFERENCES nodes(id), task_id TEXT NOT NULL REFERENCES nodes(id), message_id TEXT NOT NULL REFERENCES nodes(id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_inbox (event_id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, space_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, node_id TEXT NOT NULL REFERENCES nodes(id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS deleted_photon_events (event_hash TEXT PRIMARY KEY, message_hash TEXT NOT NULL UNIQUE);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS imessage_sessions (node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE, human_handle TEXT NOT NULL, agent_handle TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_dispatches (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), space_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, photon_message_id TEXT UNIQUE);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_preparations (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), recipient_phone TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, approved_at TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_message_labels (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), label TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT NOT NULL); CREATE TABLE IF NOT EXISTS person_contacts (person_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE, contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE);`);
  }
  contacts() {return this.db.prepare('SELECT id,name,handle FROM contacts ORDER BY name COLLATE NOCASE,id').all();}
  createContact(name:unknown,handle:unknown) {
    if(typeof name!=='string'||!name.trim()||name.trim().length>100||typeof handle!=='string') throw Error('Enter a contact name and phone number or email.');
    const value=handle.trim();if(!/^\+[1-9]\d{7,14}$/.test(value)&&! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw Error('Use an E.164 phone number or an iMessage email address.');
    if(value.length>254)throw Error('Contact address is too long.');
    const id=randomUUID();this.db.prepare('INSERT INTO contacts VALUES (?,?,?)').run(id,name.trim(),value);return {id};
  }
  deleteContact(id:string) {
    this.db.exec('BEGIN IMMEDIATE');try {
      if(this.db.prepare("SELECT 1 FROM person_contacts p JOIN drafts d ON d.person_id=p.person_id WHERE p.contact_id=? AND d.state IN ('preparing','submitting') LIMIT 1").get(id))throw Error('A message to this contact is being sent. Try again after it finishes.');
      if(!this.db.prepare('DELETE FROM contacts WHERE id=?').run(id).changes)throw Error('Contact not found.');
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  bindContact(personId:string,contactId:unknown) {
    if(typeof contactId!=='string')throw Error('Choose a contact.');
    this.db.exec('BEGIN IMMEDIATE');try {
      if(!this.db.prepare("SELECT 1 FROM nodes WHERE id=? AND kind='person'").get(personId)||!this.db.prepare('SELECT 1 FROM contacts WHERE id=?').get(contactId))throw Error('Person or contact not found.');
      const current=this.db.prepare('SELECT contact_id FROM person_contacts WHERE person_id=?').get(personId) as {contact_id:string}|undefined;
      if(current?.contact_id!==contactId && this.db.prepare("SELECT 1 FROM drafts WHERE person_id=? AND state NOT IN ('pending_approval','cancelled') LIMIT 1").get(personId))throw Error('This person has message history and cannot be rebound.');
      this.db.prepare('INSERT INTO person_contacts VALUES (?,?) ON CONFLICT(person_id) DO UPDATE SET contact_id=excluded.contact_id').run(personId,contactId);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  requireContact(personId:string,handle:string|undefined) {
    const contact=this.db.prepare('SELECT c.handle FROM contacts c JOIN person_contacts p ON p.contact_id=c.id WHERE p.person_id=?').get(personId) as {handle:string}|undefined;
    if(!contact) throw Error('Choose and confirm a contact before sending.');
    if(!handle || contact.handle.toLocaleLowerCase()!==handle.trim().toLocaleLowerCase()) throw Error('The recipient does not match the selected contact.');
  }
  preparePhone(id: string, phone: string, approvedBody: string, label?:string) {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter the recipient number in E.164 format.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft=this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as {state:string;body:string;task_id:string;message_id:string;person_id:string}|undefined;
      if (!draft || !['pending_approval','preparation_failed'].includes(draft.state)) throw new Error('Draft is not awaiting approval.');
      this.requireContact(draft.person_id,phone);
      const stored=this.db.prepare('SELECT label FROM photon_message_labels WHERE draft_id=?').get(id) as {label:string}|undefined;
      if (draft.state==='preparation_failed' && stored && stored.label!==label) throw new Error('A retry must use the previously approved label.');
      if (labelRealSms(draft.body,label)!==approvedBody) throw new Error('The approved text does not match this draft and its NeuroProxy label.');
      if (draft.state==='preparation_failed') this.db.prepare('DELETE FROM photon_preparations WHERE draft_id=?').run(id);
      const key=randomUUID();
      if(label!==undefined) this.db.prepare('INSERT OR REPLACE INTO photon_message_labels VALUES (?,?)').run(id,label);
      this.db.prepare('INSERT INTO photon_preparations VALUES (?,?,?,?)').run(id,phone,key,new Date().toISOString());
      this.db.prepare("UPDATE drafts SET state='preparing', body=? WHERE id=?").run(approvedBody,id);
      this.db.prepare("UPDATE nodes SET status='preparing' WHERE id=?").run(draft.task_id);
      this.db.prepare("UPDATE nodes SET status='preparing', source='photon', label=? WHERE id=?").run(approvedBody,draft.message_id);
      this.db.exec('COMMIT'); return {key,body:approvedBody};
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  failPreparation(id:string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft=this.db.prepare("SELECT task_id,message_id FROM drafts WHERE id=? AND state='preparing'").get(id) as {task_id:string;message_id:string}|undefined;
      if (!draft) throw Error('Draft is not being prepared.');
      this.db.prepare("UPDATE drafts SET state='preparation_failed' WHERE id=?").run(id);
      this.db.prepare("UPDATE nodes SET status='preparation_failed' WHERE id IN (?,?)").run(draft.task_id,draft.message_id);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  bindPreparedPhone(id:string, target:{spaceId:string;senderId:string;recipientId:string}, key:string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft=this.db.prepare("SELECT task_id,message_id FROM drafts WHERE id=? AND state='preparing'").get(id) as {task_id:string;message_id:string}|undefined;
      const prep=this.db.prepare('SELECT idempotency_key FROM photon_preparations WHERE draft_id=?').get(id) as {idempotency_key:string}|undefined;
      if(!draft || !prep || prep.idempotency_key!==key) throw Error('Draft is not being prepared.');
      this.db.prepare('INSERT INTO photon_dispatches VALUES (?,?,?,?,?,?,NULL)').run(id,target.spaceId,target.senderId,target.recipientId,key,'submitting');
      this.db.prepare("UPDATE drafts SET state='submitting' WHERE id=?").run(id);
      this.db.prepare("UPDATE nodes SET status='submitting', source='photon' WHERE id=?").run(draft.message_id);
      this.db.prepare("UPDATE nodes SET status='submitting' WHERE id=?").run(draft.task_id);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  node(kind: string, label: string, status = '', source = 'user') { const id = randomUUID(); this.db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?)').run(id, kind, label, status, source); return id; }
  edge(source: string, target: string, label: string) { this.db.prepare('INSERT INTO edges VALUES (?,?,?,?)').run(randomUUID(), source, target, label); }
  graph() { return { nodes: this.db.prepare('SELECT nodes.*, c.id AS contact_id,c.name AS contact_name,c.handle AS contact_handle FROM nodes LEFT JOIN person_contacts pc ON pc.person_id=nodes.id LEFT JOIN contacts c ON c.id=pc.contact_id ORDER BY nodes.rowid').all(), edges: this.db.prepare('SELECT * FROM edges ORDER BY rowid').all(), drafts: this.db.prepare('SELECT drafts.*, nodes.source AS transport, photon_message_labels.label AS message_label,c.id AS contact_id,c.name AS contact_name,c.handle AS contact_handle FROM drafts JOIN nodes ON nodes.id=drafts.message_id LEFT JOIN photon_message_labels ON photon_message_labels.draft_id=drafts.id LEFT JOIN person_contacts pc ON pc.person_id=drafts.person_id LEFT JOIN contacts c ON c.id=pc.contact_id ORDER BY drafts.rowid DESC').all() }; }
  reviseNode(id:string, expectedLabel:unknown, label:unknown) {
    if(typeof expectedLabel!=='string' || typeof label!=='string' || !label.trim()) throw Error('Enter the revised content.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const node=this.db.prepare('SELECT kind,label FROM nodes WHERE id=?').get(id) as {kind:string;label:string}|undefined;
      const editable=['topic','person','task','question','reported_fact','feeling','need','interpretation','core_question','suggested_action','message'];
      if(!node || !editable.includes(node.kind)) throw Error('This node cannot be edited.');
      if(node.label!==expectedLabel) throw Error('This content has changed. Refresh and review the latest version.');
      const value=label.trim();if(value.length>(node.kind==='message'?2000:500)) throw Error('Revised content is too long.');
      if(node.kind==='message') {
        const draft=this.db.prepare('SELECT id,state FROM drafts WHERE message_id=?').get(id) as {id:string;state:string}|undefined;
        if(!draft || draft.state!=='pending_approval') throw Error('Only an unsent draft can be edited.');
        this.db.prepare('UPDATE drafts SET body=? WHERE id=?').run(value,draft.id);
      }
      if(node.kind==='person') {
        const existing=this.db.prepare("SELECT 1 FROM drafts WHERE person_id=? AND state<>'pending_approval' LIMIT 1").get(id);
        if(existing) throw Error('A person with message history cannot be renamed.');
        const graph=this.graph();const groups=groupGraph(graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label)})),graph.edges.map(e=>({source:String(e.source),target:String(e.target)})));
        const group=groups.find(g=>g.nodeIds.has(id));
        if(group && graph.nodes.some(n=>n.id!==id && n.kind==='person' && group.nodeIds.has(String(n.id)) && String(n.label).toLocaleLowerCase()===value.toLocaleLowerCase())) throw Error('People in a conversation must have distinct names.');
        this.db.prepare('UPDATE drafts SET person=? WHERE person_id=?').run(value,id);
      }
      this.db.prepare('UPDATE nodes SET label=? WHERE id=?').run(value,id);
      this.db.exec('COMMIT');
    } catch(error) {this.db.exec('ROLLBACK');throw error;}
  }
  deleteConversation(topicId:string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const graph=this.graph();
      const nodes=graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label)}));
      const edges=graph.edges.map(e=>({source:String(e.source),target:String(e.target)}));
      const group=groupGraph(nodes,edges).find(g=>g.id===topicId);
      if(!group) throw Error('Conversation not found.');
      const ids=group.nodeIds;
      if(nodes.filter(n=>ids.has(n.id)&&n.kind==='topic').length!==(topicId==='unlinked'?0:1)) throw Error('This graph contains multiple connected topics and cannot be deleted as one conversation.');
      const affected=graph.drafts.filter(d=>ids.has(String(d.person_id)) || ids.has(String(d.task_id)) || ids.has(String(d.message_id)));
      for(const draft of affected) {
        if(![draft.person_id,draft.task_id,draft.message_id].every(id=>ids.has(String(id)))) throw Error('This graph shares a delegation with another conversation and cannot be deleted.');
        if(draft.state==='preparing' || draft.state==='submitting') throw Error('A message is being sent. Wait for the send attempt to finish before deleting.');
      }
      for(const id of ids) {
        const incoming=this.db.prepare('SELECT event_id,message_id FROM photon_inbox WHERE node_id=?').get(id) as {event_id:string;message_id:string}|undefined;
        if(incoming) this.db.prepare('INSERT OR IGNORE INTO deleted_photon_events VALUES (?,?)').run(eventHash(incoming.event_id),eventHash(incoming.message_id));
      }
      for(const id of ids) this.db.prepare('DELETE FROM edges WHERE source=? OR target=?').run(id,id);
      for(const id of ids) this.db.prepare('DELETE FROM photon_inbox WHERE node_id=?').run(id);
      for(const draft of affected) {
        this.db.prepare('DELETE FROM photon_dispatches WHERE draft_id=?').run(String(draft.id));
        this.db.prepare('DELETE FROM photon_preparations WHERE draft_id=?').run(String(draft.id));
        this.db.prepare('DELETE FROM photon_message_labels WHERE draft_id=?').run(String(draft.id));
        this.db.prepare('DELETE FROM drafts WHERE id=?').run(String(draft.id));
      }
      for(const id of ids) this.db.prepare('DELETE FROM nodes WHERE id=?').run(id);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  receivePhoton(message: PhotonMessage): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const deleted=this.db.prepare('SELECT 1 FROM deleted_photon_events WHERE event_hash=? OR message_hash=?').get(eventHash(message.eventId),eventHash(message.messageId));
      if(deleted) {this.db.exec('COMMIT');return false;}
      const existing = this.db.prepare('SELECT 1 FROM photon_inbox WHERE event_id=? OR message_id=?').get(message.eventId, message.messageId);
      if (existing) { this.db.exec('COMMIT'); return false; }
      type Match = {id:string;task_id:string;person_id:string;message_id:string};
      let match = message.parentMessageId ? this.db.prepare(`SELECT d.task_id, d.person_id, d.message_id, d.id FROM photon_dispatches p JOIN drafts d ON d.id=p.draft_id WHERE p.photon_message_id=? AND p.space_id=? AND p.sender_id=? AND p.recipient_id=? AND d.state='waiting_for_reply'`).get(message.parentMessageId, message.spaceId, message.recipientId, message.senderId) as Match|undefined : undefined;
      let inferred=false;
      if (!message.parentMessageId && message.createdAt && Number.isFinite(Date.parse(message.createdAt))) {
        const candidates=this.db.prepare(`SELECT d.task_id,d.person_id,d.message_id,d.id, prep.approved_at FROM photon_dispatches p JOIN drafts d ON d.id=p.draft_id JOIN photon_preparations prep ON prep.draft_id=d.id WHERE p.space_id=? AND p.sender_id=? AND p.recipient_id=? AND d.state='waiting_for_reply'`).all(message.spaceId,message.recipientId,message.senderId) as (Match & {approved_at:string})[];
        if(candidates.length===1 && Date.parse(message.createdAt)>=Date.parse(candidates[0].approved_at)) {match=candidates[0]; inferred=true;}
      }
      const nodeId = this.node('reply', message.body, match ? (inferred ? 'possible_reply' : 'received') : 'unlinked', 'photon');
      this.db.prepare('INSERT INTO photon_inbox VALUES (?,?,?,?,?,?)').run(message.eventId, message.messageId, message.spaceId, message.senderId, message.recipientId, nodeId);
      if(message.imessage) this.db.prepare('INSERT INTO imessage_sessions VALUES (?,?,?)').run(nodeId,message.imessage.humanHandle,message.imessage.agentHandle);
      if (match) {
        this.edge(match.message_id, nodeId, inferred ? 'possible reply' : 'reply'); this.edge(match.person_id, nodeId, 'from');
        const state=inferred ? 'possible_reply' : 'reply_received';
        this.db.prepare('UPDATE drafts SET state=? WHERE id=?').run(state,match.id);
        this.db.prepare('UPDATE nodes SET status=? WHERE id IN (?,?)').run(state,match.task_id, match.message_id);
      }
      this.db.exec('COMMIT'); return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  imessageSessions() {
    return this.db.prepare(`SELECT s.node_id AS nodeId,s.human_handle AS humanHandle,s.agent_handle AS agentHandle FROM imessage_sessions s JOIN photon_inbox i ON i.node_id=s.node_id ORDER BY i.rowid DESC LIMIT 50`).all();
  }
  imessageTarget(nodeId:string) {
    return this.db.prepare(`SELECT i.space_id AS spaceId,i.recipient_id AS senderId,i.sender_id AS recipientId,i.message_id AS parentMessageId,s.human_handle AS humanHandle FROM imessage_sessions s JOIN photon_inbox i ON i.node_id=s.node_id WHERE s.node_id=?`).get(nodeId) as {spaceId:string;senderId:string;recipientId:string;parentMessageId:string;humanHandle:string}|undefined;
  }
  reviewPossibleReply(nodeId:string, confirm:boolean) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const match=this.db.prepare(`SELECT d.id,d.task_id,d.message_id FROM nodes n JOIN edges e ON e.target=n.id AND e.label='possible reply' JOIN drafts d ON d.message_id=e.source WHERE n.id=? AND n.source='photon' AND n.status='possible_reply' AND d.state='possible_reply'`).get(nodeId) as {id:string;task_id:string;message_id:string}|undefined;
      if(!match) throw Error('This reply is not awaiting review.');
      const state=confirm?'reply_received':'waiting_for_reply';
      this.db.prepare('UPDATE drafts SET state=? WHERE id=?').run(state,match.id);
      this.db.prepare('UPDATE nodes SET status=? WHERE id IN (?,?)').run(state,match.task_id,match.message_id);
      if(confirm){this.db.prepare("UPDATE nodes SET status='received' WHERE id=?").run(nodeId);this.db.prepare("UPDATE edges SET label='reply' WHERE source=? AND target=? AND label='possible reply'").run(match.message_id,nodeId);}
      else {this.db.prepare("UPDATE nodes SET status='unlinked' WHERE id=?").run(nodeId);this.db.prepare('DELETE FROM edges WHERE target=?').run(nodeId);}
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  photonCandidates(nodeId:string) {
    return this.db.prepare(`SELECT d.id,d.person,d.body FROM photon_inbox i JOIN nodes n ON n.id=i.node_id JOIN photon_dispatches p ON p.space_id=i.space_id AND p.sender_id=i.recipient_id AND p.recipient_id=i.sender_id JOIN drafts d ON d.id=p.draft_id WHERE i.node_id=? AND n.status='unlinked' AND n.source='photon' AND d.state='waiting_for_reply'`).all(nodeId);
  }
  linkPhotonReply(nodeId:string,draftId:string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const match=this.db.prepare(`SELECT d.id,d.task_id,d.person_id,d.message_id FROM photon_inbox i JOIN nodes n ON n.id=i.node_id JOIN photon_dispatches p ON p.space_id=i.space_id AND p.sender_id=i.recipient_id AND p.recipient_id=i.sender_id JOIN drafts d ON d.id=p.draft_id WHERE i.node_id=? AND d.id=? AND n.status='unlinked' AND n.source='photon' AND d.state='waiting_for_reply'`).get(nodeId,draftId) as {id:string;task_id:string;person_id:string;message_id:string}|undefined;
      if(!match) throw Error('That message and delegation cannot be linked.');
      this.edge(match.message_id,nodeId,'reply');this.edge(match.person_id,nodeId,'from');
      this.db.prepare("UPDATE nodes SET status='received' WHERE id=?").run(nodeId);
      this.db.prepare("UPDATE drafts SET state='reply_received' WHERE id=?").run(match.id);
      this.db.prepare("UPDATE nodes SET status='reply_received' WHERE id IN (?,?)").run(match.task_id,match.message_id);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  reservePhoton(id: string, spaceId: string, senderId: string, recipientId: string, approvedBody: string, trackingHandle?:string, label?:string) {
    if (!/^pho_spc_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(spaceId) || !/^pho_usr_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(senderId) || !/^pho_usr_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(recipientId) || senderId === recipientId) throw new Error('Enter valid, distinct Photon space and user IDs.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft = this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as {state:string;body:string;task_id:string;message_id:string;person_id:string}|undefined;
      if (!draft || draft.state !== 'pending_approval') throw new Error('Draft is not awaiting approval.');
      this.requireContact(draft.person_id,trackingHandle);
      if (approvedBody !== labelRealSms(draft.body,label)) throw new Error('The approved text does not match this draft and its NeuroProxy label.');
      const key = randomUUID();
      if(label!==undefined) this.db.prepare('INSERT OR REPLACE INTO photon_message_labels VALUES (?,?)').run(id,label);
      if(trackingHandle) this.db.prepare('INSERT INTO photon_preparations VALUES (?,?,?,?)').run(id,trackingHandle,key,new Date().toISOString());
      this.db.prepare('INSERT INTO photon_dispatches VALUES (?,?,?,?,?,?,NULL)').run(id,spaceId,senderId,recipientId,key,'submitting');
      this.db.prepare("UPDATE drafts SET state='submitting', body=? WHERE id=?").run(approvedBody,id);
      this.db.prepare("UPDATE nodes SET status='submitting', source='photon', label=? WHERE id=?").run(approvedBody,draft.message_id);
      this.db.prepare("UPDATE nodes SET status='submitting' WHERE id=?").run(draft.task_id);
      this.db.exec('COMMIT'); return {body:approvedBody, key};
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  finishPhoton(id: string, messageId: string | null) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft = this.db.prepare('SELECT task_id,message_id FROM drafts WHERE id=? AND state=?').get(id,'submitting') as {task_id:string;message_id:string}|undefined;
      if (!draft) throw new Error('Draft is not being submitted.');
      const state = messageId ? 'waiting_for_reply' : 'send_unknown';
      this.db.prepare('UPDATE photon_dispatches SET status=?,photon_message_id=? WHERE draft_id=?').run(messageId ? 'submitted' : 'unknown',messageId,id);
      this.db.prepare('UPDATE drafts SET state=? WHERE id=?').run(state,id);
      this.db.prepare('UPDATE nodes SET status=? WHERE id IN (?,?)').run(state,draft.task_id,draft.message_id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  createReviewed(value: unknown) {
    const data: Extraction = validateExtraction(value);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const topicId = this.node('topic', data.topic);
      const people = new Map<string, string>();
      for (const name of data.people) { const id = this.node('person', name); people.set(name, id); this.edge(topicId, id, 'involves'); }
      const tasks = data.tasks.map((task, index) => {
        const hasDraft = data.draft?.taskIndex === index;
        const id = this.node('task', task.description, hasDraft ? 'pending_approval' : 'proposed');
        this.edge(topicId, id, 'contains');
        if (task.assignee) this.edge(people.get(task.assignee)!, id, 'assigned to');
        return id;
      });
      for (const uncertainty of data.uncertainties) {
        const id = this.node('question', uncertainty.question, 'unresolved');
        if (uncertainty.people.length) for (const name of uncertainty.people) this.edge(people.get(name)!, id, 'question about');
        else this.edge(topicId, id, 'unresolved');
      }
      if (data.relationship) {
        const r=data.relationship;
        const add=(kind:string, label:string, edgeLabel:string)=>{if(!label.trim())return;const id=this.node(kind,label,'reviewed','analysis');this.edge(topicId,id,edgeLabel);};
        r.facts.forEach(v=>add('reported_fact',v,'reported'));
        r.feelings.forEach(v=>add('feeling',v,'expressed feeling'));
        r.needs.forEach(v=>add('need',v,'expressed need'));
        r.interpretations.forEach(v=>add('interpretation',v,'possible interpretation'));
        add('core_question',r.coreQuestion,'core question');
        add('suggested_action',r.nextAction,'suggested action');
      }
      let draftId: string | null = null;
      if (data.draft) {
        const { recipient, body, taskIndex } = data.draft;
        const personId = people.get(recipient)!; const taskId = tasks[taskIndex!];
        const messageId = this.node('message', body, 'pending_approval', 'simulated');
        this.edge(taskId, messageId, 'draft'); this.edge(personId, messageId, 'recipient');
        draftId = randomUUID();
        this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(draftId, recipient, body, 'pending_approval', personId, taskId, messageId);
      }
      this.db.exec('COMMIT'); return { topicId, draftId };
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  addReplyInsights(replyId:string, value:unknown) {
    const r=relationshipSchema.parse(value);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const reply=this.db.prepare("SELECT id FROM nodes WHERE id=? AND kind='reply' AND status='received'").get(replyId);
      const linked=this.db.prepare("SELECT 1 FROM edges e JOIN drafts d ON d.message_id=e.source WHERE e.target=? AND e.label='reply'").get(replyId);
      if(!reply || !linked) throw Error('Confirm and link the reply before saving analysis.');
      const add=(kind:string,label:string,edgeLabel:string)=>{if(!label.trim())return;const id=this.node(kind,label,'reviewed','analysis');this.edge(replyId,id,edgeLabel);};
      r.facts.forEach(v=>add('reported_fact',v,'reported'));r.feelings.forEach(v=>add('feeling',v,'expressed feeling'));r.needs.forEach(v=>add('need',v,'expressed need'));r.interpretations.forEach(v=>add('interpretation',v,'possible interpretation'));add('core_question',r.coreQuestion,'core question');add('suggested_action',r.nextAction,'suggested action');
      this.db.exec('COMMIT');
    } catch(error) {this.db.exec('ROLLBACK');throw error;}
  }
  createReplyDraft(replyId:string, body:unknown, action:unknown) {
    if(typeof body!=='string' || !body.trim() || body.length>2000 || typeof action!=='string' || !action.trim() || action.length>500) throw Error('Enter a reply and action.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous=this.db.prepare("SELECT d.person,d.person_id FROM nodes n JOIN edges e ON e.target=n.id AND e.label='reply' JOIN drafts d ON d.message_id=e.source WHERE n.id=? AND n.kind='reply' AND n.status='received' AND d.state='reply_received'").get(replyId) as {person:string;person_id:string}|undefined;
      if(!previous) throw Error('Confirm and link the reply before creating a draft.');
      if(this.db.prepare("SELECT 1 FROM edges e JOIN nodes n ON n.id=e.target WHERE e.source=? AND e.label='follow-up' AND n.kind='task'").get(replyId)) throw Error('A follow-up draft has already been created for this reply.');
      const taskId=this.node('task',action.trim(),'pending_approval');const messageId=this.node('message',body.trim(),'pending_approval','simulated');
      this.edge(replyId,taskId,'follow-up');this.edge(taskId,messageId,'draft');this.edge(previous.person_id,messageId,'recipient');
      const id=randomUUID();this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(id,previous.person,body.trim(),'pending_approval',previous.person_id,taskId,messageId);
      this.db.exec('COMMIT');return {id};
    } catch(error) {this.db.exec('ROLLBACK');throw error;}
  }
  delegationContext(topicId:string, personId:unknown, newPerson:unknown, actionId:unknown, customAction:unknown) {
    const graph=this.graph();
    const group=groupGraph(graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label)})),graph.edges.map(e=>({source:String(e.source),target:String(e.target)}))).find(g=>g.id===topicId && g.id!=='unlinked');
    if(!group) throw Error('Choose a saved conversation.');
    const nodes=graph.nodes.filter(n=>group.nodeIds.has(String(n.id)));
    const selected=typeof personId==='string' && personId ? nodes.find(n=>n.id===personId && n.kind==='person') : undefined;
    if(personId && !selected) throw Error('Choose a person in this conversation.');
    const person=selected ? String(selected.label) : typeof newPerson==='string' ? newPerson.trim() : '';
    if(!person || person.length>100) throw Error('Choose or add a person.');
    if(!selected && nodes.some(n=>n.kind==='person' && String(n.label).toLocaleLowerCase()===person.toLocaleLowerCase())) throw Error('Choose the existing person with that name.');
    const selectedAction=typeof actionId==='string' && actionId ? nodes.find(n=>n.id===actionId && (n.kind==='task'||n.kind==='suggested_action')) : undefined;
    if(actionId && !selectedAction) throw Error('Choose an action in this conversation.');
    const action=selectedAction ? String(selectedAction.label) : typeof customAction==='string' ? customAction.trim() : '';
    if(!action || action.length>500) throw Error('Choose or enter an action.');
    return {person,personId:selected ? String(selected.id) : null,action,actionId:selectedAction ? String(selectedAction.id) : null,nodes};
  }
  createConversationDraft(topicId:string, input:{personId?:unknown;newPerson?:unknown;actionId?:unknown;customAction?:unknown;body?:unknown}) {
    if(typeof input.body!=='string'||!input.body.trim()||input.body.length>2000) throw Error('Enter a message draft (maximum 2000 characters).');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const context=this.delegationContext(topicId,input.personId,input.newPerson,input.actionId,input.customAction);
      let personId=context.personId;
      if(!personId){personId=this.node('person',context.person);this.edge(topicId,personId,'involves');}
      const taskId=this.node('task',context.action,'pending_approval');
      this.edge(context.actionId ?? personId,taskId,'delegation');
      const messageId=this.node('message',input.body.trim(),'pending_approval','simulated');
      this.edge(taskId,messageId,'draft');this.edge(personId,messageId,'recipient');
      const id=randomUUID();this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(id,context.person,input.body.trim(),'pending_approval',personId,taskId,messageId);
      this.db.exec('COMMIT');return {id};
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  create(topic: string, person: string, task: string, body: string) {
    if (![topic, person, task, body].every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 2000)) throw new Error('Complete each field (maximum 2000 characters).');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const topicId = this.node('topic', topic.trim()); const personId = this.node('person', person.trim()); const taskId = this.node('task', task.trim(), 'pending_approval'); const messageId = this.node('message', body.trim(), 'pending_approval', 'simulated');
      this.edge(topicId, personId, 'involves'); this.edge(personId, taskId, 'involved in'); this.edge(taskId, messageId, 'draft'); this.edge(personId, messageId, 'recipient');
      const id = randomUUID(); this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(id, person.trim(), body.trim(), 'pending_approval', personId, taskId, messageId); this.db.exec('COMMIT'); return id;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  transition(id: string, target: 'waiting_for_reply' | 'cancelled') {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as { state: string; task_id: string; message_id: string } | undefined;
      if (!row || (row.state !== 'pending_approval' && !(row.state === 'preparation_failed' && target === 'cancelled'))) throw new Error('Draft is not awaiting approval.');
      this.db.prepare('UPDATE drafts SET state=? WHERE id=?').run(target, id);
      this.db.prepare('UPDATE nodes SET status=? WHERE id IN (?,?)').run(target, row.task_id, row.message_id);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  reply(id: string, body: string, source: 'simulated' | 'photon') {
    if (typeof body !== 'string' || !body.trim() || body.length > 2000) throw new Error('Enter a reply (maximum 2000 characters).');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as { state: string; task_id: string; message_id: string; person_id: string } | undefined;
      if (!row || row.state !== 'waiting_for_reply') throw new Error('This message is not waiting for a reply.');
      const node = this.db.prepare('SELECT source FROM nodes WHERE id=?').get(row.message_id) as {source:string};
      if (source !== 'simulated' || node.source !== 'simulated') throw new Error('Simulated replies are only allowed for simulated messages.');
      const replyId = this.node('reply', body.trim(), 'received', source); this.edge(row.message_id, replyId, 'reply'); this.edge(row.person_id, replyId, 'from');
      this.db.prepare("UPDATE drafts SET state='reply_received' WHERE id=?").run(id); this.db.prepare("UPDATE nodes SET status='reply_received' WHERE id IN (?,?)").run(row.task_id, row.message_id); this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}
