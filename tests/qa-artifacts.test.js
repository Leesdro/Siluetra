import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {collectFailures} from '../qa/collect-failures.mjs';

test('CI artifacts keep failures, omit accepted images/downloads/duplicate screenshots, bound traces',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'siluetra-artifacts-'));
 try {
  const source=path.join(root,'results'), target=path.join(root,'upload');
  for(const file of ['visual/a-actual.png','visual/a-diff.png','visual/a-expected.png','visual/test-failed-1.png','visual/error-context.md','visual/trace.zip','functional/test-failed-1.png','functional/trace.zip','exported.garment.json','report.html']) {
   const p=path.join(source,file);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,'evidence');
  }
  const result=collectFailures(source,target,{maxTraces:1});
  assert.ok(result.included.includes(path.join('visual','a-diff.png')));
  assert.ok(result.included.includes(path.join('functional','test-failed-1.png')));
  assert.equal(result.included.filter(f=>f.endsWith('.zip')).length,1);
  assert.ok(!existsSync(path.join(target,'visual','a-expected.png')));
  assert.ok(!existsSync(path.join(target,'visual','test-failed-1.png')));
  assert.ok(!existsSync(path.join(target,'exported.garment.json')));
  const capped=collectFailures(source,path.join(root,'capped'),{maxBytes:16,maxFiles:2});
  assert.ok(capped.bytes<=16);assert.ok(capped.included.length<=2);assert.ok(capped.omitted.length>0);
 } finally {rmSync(root,{recursive:true,force:true});}
});
