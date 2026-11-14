import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { validateExtraction, relationshipSchema, type Extraction } from '../shared/extraction.ts';
import type { PhotonMessage } from './photon-webhook.ts';
import { groupGraph } from '../shared/graph-groups.ts';
import { labelRealSms } from '../shared/sms.ts';

export class Store {
  db: DatabaseSync;
  constructor(path = 'neuroproxy.db') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'user'); CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES nodes(id), target TEXT NOT NULL REFERENCES nodes(id), label TEXT NOT NULL); CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, person TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL, person_id TEXT NOT NULL REFERENCES nodes(id), task_id TEXT NOT NULL REFERENCES nodes(id), message_id TEXT NOT NULL REFERENCES nodes(id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_inbox (event_id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, space_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, node_id TEXT NOT NULL REFERENCES nodes(id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_dispatches (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), space_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, photon_message_id TEXT UNIQUE);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_preparations (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), recipient_phone TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, approved_at TEXT NOT NULL);`);
  }
  preparePhone(id: string, phone: string, approvedBody: string) {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter the recipient number in E.164 format.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft=this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as {state:string;body:string;task_id:string;message_id:string}|undefined;
      if (!draft || !['pending_approval','preparation_failed'].includes(draft.state)) throw new Error('Draft is not awaiting approval.');
      if (labelRealSms(draft.body)!==approvedBody) throw new Error('The approved text does not match this draft and its NeuroProxy label.');
      if (draft.state==='preparation_failed') this.db.prepare('DELETE FROM photon_preparations WHERE draft_id=?').run(id);
      const key=randomUUID();
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
  graph() { return { nodes: this.db.prepare('SELECT * FROM nodes ORDER BY rowid').all(), edges: this.db.prepare('SELECT * FROM edges ORDER BY rowid').all(), drafts: this.db.prepare('SELECT drafts.*, nodes.source AS transport FROM drafts JOIN nodes ON nodes.id=drafts.message_id ORDER BY drafts.rowid DESC').all() }; }
  deleteConversation(topicId:string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const graph=this.graph();
      const nodes=graph.nodes.map(n=>({id:String(n.id),kind:String(n.kind),label:String(n.label)}));
      const edges=graph.edges.map(e=>({source:String(e.source),target:String(e.target)}));
      const group=groupGraph(nodes,edges).find(g=>g.id===topicId && g.id!=='unlinked');
      if(!group) throw Error('Conversation not found.');
      const ids=group.nodeIds;
      if(nodes.filter(n=>ids.has(n.id)&&n.kind==='topic').length!==1) throw Error('This graph contains multiple connected topics and cannot be deleted as one conversation.');
      const affected=graph.drafts.filter(d=>ids.has(String(d.person_id)) || ids.has(String(d.task_id)) || ids.has(String(d.message_id)));
      for(const draft of affected) {
        if(![draft.person_id,draft.task_id,draft.message_id].every(id=>ids.has(String(id)))) throw Error('This graph shares a delegation with another conversation and cannot be deleted.');
        if(this.db.prepare('SELECT 1 FROM photon_dispatches WHERE draft_id=?').get(String(draft.id)) || this.db.prepare('SELECT 1 FROM photon_preparations WHERE draft_id=?').get(String(draft.id))) throw Error('This conversation has Photon activity and cannot be deleted while its messaging history is needed.');
      }
      for(const id of ids) {
        if(this.db.prepare("SELECT 1 FROM nodes WHERE id=? AND source='photon'").get(id) || this.db.prepare('SELECT 1 FROM photon_inbox WHERE node_id=?').get(id)) throw Error('This conversation has Photon activity and cannot be deleted while its messaging history is needed.');
      }
      for(const id of ids) this.db.prepare('DELETE FROM edges WHERE source=? OR target=?').run(id,id);
      for(const draft of affected) this.db.prepare('DELETE FROM drafts WHERE id=?').run(String(draft.id));
      for(const id of ids) this.db.prepare('DELETE FROM nodes WHERE id=?').run(id);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  receivePhoton(message: PhotonMessage): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
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
      if (match) {
        this.edge(match.message_id, nodeId, inferred ? 'possible reply' : 'reply'); this.edge(match.person_id, nodeId, 'from');
        const state=inferred ? 'possible_reply' : 'reply_received';
        this.db.prepare('UPDATE drafts SET state=? WHERE id=?').run(state,match.id);
        this.db.prepare('UPDATE nodes SET status=? WHERE id IN (?,?)').run(state,match.task_id, match.message_id);
      }
      this.db.exec('COMMIT'); return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
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
  reservePhoton(id: string, spaceId: string, senderId: string, recipientId: string, approvedBody: string) {
    if (!/^pho_spc_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(spaceId) || !/^pho_usr_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(senderId) || !/^pho_usr_[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(recipientId) || senderId === recipientId) throw new Error('Enter valid, distinct Photon space and user IDs.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const draft = this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as {state:string;body:string;task_id:string;message_id:string}|undefined;
      if (!draft || draft.state !== 'pending_approval') throw new Error('Draft is not awaiting approval.');
      if (approvedBody !== labelRealSms(draft.body)) throw new Error('The approved text does not match this draft and its NeuroProxy label.');
      const key = randomUUID();
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
