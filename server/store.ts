import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { validateExtraction, type Extraction } from '../shared/extraction.ts';
import type { PhotonMessage } from './photon-webhook.ts';

export class Store {
  db: DatabaseSync;
  constructor(path = 'neuroproxy.db') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'user'); CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES nodes(id), target TEXT NOT NULL REFERENCES nodes(id), label TEXT NOT NULL); CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, person TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL, person_id TEXT NOT NULL REFERENCES nodes(id), task_id TEXT NOT NULL REFERENCES nodes(id), message_id TEXT NOT NULL REFERENCES nodes(id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS photon_inbox (event_id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, space_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, node_id TEXT NOT NULL REFERENCES nodes(id));`);
  }
  node(kind: string, label: string, status = '', source = 'user') { const id = randomUUID(); this.db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?)').run(id, kind, label, status, source); return id; }
  edge(source: string, target: string, label: string) { this.db.prepare('INSERT INTO edges VALUES (?,?,?,?)').run(randomUUID(), source, target, label); }
  graph() { return { nodes: this.db.prepare('SELECT * FROM nodes').all(), edges: this.db.prepare('SELECT * FROM edges').all(), drafts: this.db.prepare('SELECT * FROM drafts ORDER BY rowid DESC').all() }; }
  receivePhoton(message: PhotonMessage): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare('SELECT 1 FROM photon_inbox WHERE event_id=? OR message_id=?').get(message.eventId, message.messageId);
      if (existing) { this.db.exec('COMMIT'); return false; }
      const nodeId = this.node('reply', message.body, 'unlinked', 'photon');
      this.db.prepare('INSERT INTO photon_inbox VALUES (?,?,?,?,?,?)').run(message.eventId, message.messageId, message.spaceId, message.senderId, message.recipientId, nodeId);
      this.db.exec('COMMIT'); return true;
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
      for (const uncertainty of data.uncertainties) { const id = this.node('question', uncertainty, 'unresolved'); this.edge(topicId, id, 'unresolved'); }
      let draftId: string | null = null;
      if (data.draft) {
        const { recipient, body, taskIndex } = data.draft;
        const personId = people.get(recipient)!; const taskId = tasks[taskIndex!];
        const messageId = this.node('message', body, 'pending_approval', 'simulated');
        this.edge(taskId, messageId, 'draft'); this.edge(messageId, personId, 'to');
        draftId = randomUUID();
        this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(draftId, recipient, body, 'pending_approval', personId, taskId, messageId);
      }
      this.db.exec('COMMIT'); return { topicId, draftId };
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  create(topic: string, person: string, task: string, body: string) {
    if (![topic, person, task, body].every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 2000)) throw new Error('Complete each field (maximum 2000 characters).');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const topicId = this.node('topic', topic.trim()); const personId = this.node('person', person.trim()); const taskId = this.node('task', task.trim(), 'pending_approval'); const messageId = this.node('message', body.trim(), 'pending_approval', 'simulated');
      this.edge(topicId, taskId, 'contains'); this.edge(personId, taskId, 'involved in'); this.edge(taskId, messageId, 'draft'); this.edge(messageId, personId, 'to');
      const id = randomUUID(); this.db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)').run(id, person.trim(), body.trim(), 'pending_approval', personId, taskId, messageId); this.db.exec('COMMIT'); return id;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  transition(id: string, target: 'waiting_for_reply' | 'cancelled') {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id) as { state: string; task_id: string; message_id: string } | undefined;
      if (!row || row.state !== 'pending_approval') throw new Error('Draft is not awaiting approval.');
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
      const replyId = this.node('reply', body.trim(), 'received', source); this.edge(row.message_id, replyId, 'reply'); this.edge(row.person_id, replyId, 'from');
      this.db.prepare("UPDATE drafts SET state='reply_received' WHERE id=?").run(id); this.db.prepare("UPDATE nodes SET status='reply_received' WHERE id IN (?,?)").run(row.task_id, row.message_id); this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}
