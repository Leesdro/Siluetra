import {readdirSync,readFileSync,existsSync} from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const root=process.cwd(),dist=path.join(root,'dist'),walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]),files=walk(dist),js=files.filter(f=>f.endsWith('.js'));
for(const file of [...js,...walk(path.join(root,'tests')).filter(f=>f.endsWith('.js'))]){execFileSync(process.execPath,['--check',file]);for(const m of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))assert.ok(existsSync(path.resolve(path.dirname(file),m[1])),`${file}: ${m[1]}`);}
const html=readFileSync(path.join(dist,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)=['"]([^'"]+)['"]/g)){const ref=m[1].split('?')[0];if(!/^(https?:|data:|#)/.test(ref))assert.ok(existsSync(path.join(dist,ref)),ref);}
for(const file of js) for(const m of readFileSync(file,'utf8').matchAll(/new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g)) assert.ok(existsSync(path.resolve(path.dirname(file),m[1])),`${file}: URL asset ${m[1]}`);
const css=readFileSync(path.join(dist,'style.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/"[^"]*"|'[^']*'/g,'');let depth=0;for(const c of css){if(c==='{')depth++;if(c==='}')depth--;assert.ok(depth>=0,'CSS braces');}assert.equal(depth,0);assert.ok(!/\bzoom\s*:/.test(css),'No browser-zoom workaround');
const {newProject,resources,resource}=await import('../dist/templates.js'),{exportSvg,objectSvg}=await import('../dist/render.js');for(const kind of ['tee','hoodie','pants','shorts','blank'])for(const view of ['front','back'])assert.ok(!/NaN|Infinity|undefined/.test(exportSvg(newProject(kind),view)),kind+' '+view);for(const [,key] of resources){const os=resource(key);assert.ok(os.length,key);for(const o of os)assert.ok(!/NaN|Infinity|undefined/.test(objectSvg(o,os)),key);}
assert.ok(readFileSync(path.join(dist,'vendor/VECTORCRAFT-LICENSE-MIT.txt'),'utf8').includes('ArtCraft Team'));assert.ok(existsSync(path.join(dist,'vendor/VECTORCRAFT-NOTICE.txt')));assert.ok(existsSync(path.join(dist,'trace-worker.js')));
console.log(`PASS: ${js.length} production JS files + test syntax, local imports, HTML assets, CSS structure, 10 template views and ${resources.length} resource exports.`);

for(const f of ['PAPER-LICENSE.txt','PAPER-NOTICE.txt'])assert.ok(existsSync(path.join(dist,'vendor',f)),f);assert.ok(readFileSync(path.join(dist,'vendor/PAPER-LICENSE.txt'),'utf8').includes('Permission is hereby granted'));console.log('PASS: Paper.js license and geometry-adapter provenance notices.');

execFileSync(process.execPath,['scripts/verify-polygonize.mjs'],{stdio:'inherit'});

execFileSync(process.execPath,['scripts/verify-desktop-ui.mjs'],{stdio:'inherit'});
