import {readdirSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk('dist').filter(f=>f.endsWith('.js')).sort();
const graph=new Map(files.map(f=>[path.resolve(f),[...readFileSync(f,'utf8').matchAll(/(?:from\s*|import\s*\(|import\s*)["'](\.[^"']+)["']/g)].map(m=>path.resolve(path.dirname(f),m[1]))]));
for(const [f,imports] of graph) for(const i of imports) assert.ok(existsSync(i),`${f}: missing ${i}`);
const cycles=new Set();
const canonical=nodes=>nodes.map((_,i)=>[...nodes.slice(i),...nodes.slice(0,i)].join('|')).sort()[0];
for(const start of graph.keys()) {
 const active=new Set([start]);
 function visit(f,stack){for(const next of graph.get(f)||[]) {
  if(next===start) cycles.add(canonical(stack.map(x=>path.relative('.',x).replaceAll('\\','/'))));
  else if(next>start&&!active.has(next)){active.add(next);visit(next,[...stack,next]);active.delete(next);}
 }}
 visit(start,[start]);
}
const baseline=JSON.parse(readFileSync('qa/import-cycles.json','utf8')).map(c=>canonical(c.slice(0,-1)));
assert.deepEqual([...cycles].sort(),baseline.sort(),'Cycles must match approved baseline exactly');
assert.ok(![...cycles].some(c=>c.includes('dist/editor/')),'Editor must remain acyclic');
const bundle=readFileSync('dist/vendor/desktop-ui.js','utf8');
assert.ok(!bundle.includes('playwright')&&!bundle.includes('sparticuz'));
for(const f of ['playwright-cli','better-ui']) assert.ok(existsSync(`.agents/skills/${f}/LICENSE`));
console.log(`PASS: ${files.length} modules; approved cycles; no QA runtime`);
