import { readdirSync, existsSync, mkdirSync, statSync, copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function collectFailures(source, target, { maxBytes = 5 * 1024 * 1024, maxFiles = 8, maxTraces = 1 } = {}) {
  const walk = dir => existsSync(dir) ? readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]) : [];
  const all = walk(source).sort();
  const candidates = all.filter(f => /(?:-actual\.png|-diff\.png|error-context\.md|trace\.zip)$/.test(f) ||
    (/test-failed-1\.png$/.test(f) && !all.some(x=>path.dirname(x)===path.dirname(f)&&x.endsWith('-actual.png'))));
  // Small diagnostics first; traces last. Never include expected images, HTML or downloads.
  candidates.sort((a,b) => Number(a.endsWith('.zip'))-Number(b.endsWith('.zip')) || a.localeCompare(b));
  let bytes=0, traces=0; const included=[], omitted=[];
  for(const f of candidates) {
    const size=statSync(f).size;
    if(included.length>=maxFiles || bytes+size>maxBytes || (f.endsWith('.zip')&&traces>=maxTraces)) { omitted.push(path.relative(source,f)); continue; }
    const relative=path.relative(source,f), dest=path.join(target,relative);
    mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(f,dest);
    included.push(relative);bytes+=size;if(f.endsWith('.zip'))traces++;
  }
  const summary={included,omitted,bytes,maxBytes,maxFiles,maxTraces};
  if(included.length) { mkdirSync(target,{recursive:true});writeFileSync(path.join(target,'manifest.json'),JSON.stringify(summary,null,2)+'\n'); }
  return summary;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(collectFailures('qa/results/playwright','qa/results/failure-artifacts')));
