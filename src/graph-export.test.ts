import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {fullGraphLayout} from './graph-export.ts';

test('export layout keeps all graph bounds inside the image at any position or scale',()=>{
 for(const bounds of [{x:-250,y:-400,width:1000,height:800},{x:1000,y:500,width:14000,height:8000}]){
  const result=fullGraphLayout(bounds);const left=bounds.x*result.scale+result.x,top=bounds.y*result.scale+result.y;
  assert.ok(left>0 && top>0);assert.ok(left+bounds.width*result.scale<result.width);assert.ok(top+bounds.height*result.scale<result.height);
  assert.ok(result.width<=4001 && result.height<=4001);
 }
});

test('graph text wraps without losing words or Unicode characters',async()=>{
 const {wrapGraphText}=await import('./graph-export.ts');
 const lines=wrapGraphText('Hello world 中文测试',5,s=>Array.from(s).length);
 assert.deepEqual(lines,['Hello','world','中文测试']);
 assert.deepEqual(wrapGraphText('abcdefgh',3,s=>s.length),['abc','def','gh']);
});
