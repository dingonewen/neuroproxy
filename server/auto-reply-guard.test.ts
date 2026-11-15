import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {repeatsPreviousMessage} from './auto-reply-guard.ts';

test('detects exact and near copies, including AutoReply disclosure',()=>{
 assert.equal(repeatsPreviousMessage('HELLO!', '[NeuroProxy AutoReply]\nHello'),true);
 assert.equal(repeatsPreviousMessage('I really want to see you again', 'I really want to see you again!'),true);
 assert.equal(repeatsPreviousMessage('I really want to see you again soon', 'I really want to see you again'),true);
 assert.equal(repeatsPreviousMessage('I can meet Saturday', 'Could we meet Saturday?'),false);
 assert.equal(repeatsPreviousMessage('谢谢你', '谢谢你！'),true);
});
