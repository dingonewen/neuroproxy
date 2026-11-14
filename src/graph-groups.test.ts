import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { groupGraph } from '../shared/graph-groups.ts';

test('groups old and new conversations without dropping legacy cycles or unlinked messages',()=>{
 const nodes=[{id:'t1',kind:'topic',label:'Old'},{id:'p1',kind:'person',label:'Alex'},{id:'m1',kind:'message',label:'Draft'},{id:'t2',kind:'topic',label:'New'},{id:'p2',kind:'person',label:'Sam'},{id:'r',kind:'reply',label:'Received'}];
 const edges=[{source:'t1',target:'p1'},{source:'p1',target:'m1'},{source:'m1',target:'p1'},{source:'t2',target:'p2'}];
 const groups=groupGraph(nodes,edges);
 assert.deepEqual(groups.map(g=>g.id),['t2','t1','unlinked']);
 assert.deepEqual([...groups[0].nodeIds].sort(),['p2','t2']);
 assert.deepEqual([...groups[1].nodeIds].sort(),['m1','p1','t1']);
 assert.deepEqual([...groups[2].nodeIds],['r']);
});

test('a reply linked to a waiting message stays with its original conversation',()=>{
 const nodes=[{id:'t1',kind:'topic',label:'First'},{id:'m1',kind:'message',label:'Message'},{id:'t2',kind:'topic',label:'Second'},{id:'r1',kind:'reply',label:'Reply'}];
 const groups=groupGraph(nodes,[{source:'t1',target:'m1'},{source:'m1',target:'r1'}]);
 assert.deepEqual(groups.map(g=>g.id),['t2','t1']);
 assert.ok(groups[1].nodeIds.has('r1'));assert.ok(!groups[0].nodeIds.has('r1'));
});
