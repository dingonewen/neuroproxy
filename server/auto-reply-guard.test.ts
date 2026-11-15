import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {isAutoReplyOptOut,repeatsPreviousMessage} from './auto-reply-guard.ts';

test('opt-out recognizes commands and contact boundaries without stopping ordinary conversation',()=>{
 for(const text of ['STOP',' Stop! ','Please stop.','stop please','unsubscribe','unsubscribe me','opt out','Stop contacting me','Please stop texting me.','Do not message me again',"Don't contact me",'Don’t text me','Leave me alone','不要再联系我'])assert.equal(isAutoReplyOptOut(text),true,text);
 for(const text of ['I can stop by Friday.','I cannot stop thinking about you.','Do not text while driving.','I need to stop working now.','Can you help me unsubscribe from a newsletter?'])assert.equal(isAutoReplyOptOut(text),false,text);
});

test('detects exact and near copies, including AutoReply disclosure',()=>{
 assert.equal(repeatsPreviousMessage('HELLO!', '[NeuroProxy AutoReply]\nHello'),true);
 assert.equal(repeatsPreviousMessage('I really want to see you again', 'I really want to see you again!'),true);
 assert.equal(repeatsPreviousMessage('I really want to see you again soon', 'I really want to see you again'),true);
 assert.equal(repeatsPreviousMessage('I can meet Saturday', 'Could we meet Saturday?'),false);
 assert.equal(repeatsPreviousMessage('谢谢你', '谢谢你！'),true);
});
