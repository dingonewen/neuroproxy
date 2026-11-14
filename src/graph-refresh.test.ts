import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createGraphRefresh } from './graph-refresh.ts';

test('newest graph wins when concurrent refreshes finish out of order',async()=>{
 const pending:((r:Response)=>void)[]=[];const snapshots:unknown[]=[];const statuses:string[]=[];
 const loader=createGraphRefresh((_url,init)=>{assert.equal(init?.cache,'no-store');return new Promise(resolve=>pending.push(resolve));},x=>snapshots.push(x),s=>statuses.push(s));
 const older=loader();const newer=loader();
 const graph=(n:number)=>({nodes:[n],edges:[],drafts:[]});
 pending[1](Response.json(graph(2)));await newer;pending[0](Response.json(graph(1)));await older;
 assert.deepEqual(snapshots,[graph(2)]);assert.deepEqual(statuses,['']);
});
test('refresh failure is visible and a later success clears it',async()=>{
 const statuses:string[]=[];let count=0;
 const loader=createGraphRefresh(async()=>{if(count++===0)throw Error('offline');return Response.json({nodes:[],edges:[],drafts:[]});},()=>{},s=>statuses.push(s));
 await assert.rejects(loader());await loader();assert.deepEqual(statuses,['Graph could not refresh. Check the backend connection.','']);
});
