import assert from 'node:assert/strict';
import {makePath} from '../dist/core.js';import {ensureEdges} from '../dist/edges.js';
import {panelOwnerSurfaces} from '../dist/panel-owner.js';import {buildPanelEdgeTopology,PanelEdgeSelection} from '../dist/edge-panels.js';
import {discoverVisualRegions,visualRegionAt} from '../dist/visual-regions.js';import {visualHoodie} from '../tests/fixtures/visual-hoodie.js';
import {resolvePanelCut} from '../dist/panel-cut.js';
const p=d=>{const o=makePath('Línea',d,'none');ensureEdges(o);return o;},base=()=>{const b=p('M0 0L100 0L100 100L0 100Z');b.category='structure';return b;};
const real=visualHoodie();
const fixtures=[
 ['A simple',()=>[base(),p('M0 50L100 50')]],
 ['B Draw Division',()=>[base(),p('M0 50L100 50')]],
 ['C sleeve screenshots',()=>[real.torso,real.sleeve]],
 ['D open contour + two paths',()=>[p('M0 0L100 0L100 100L0 100'),p('M0 100L0 50'),p('M0 50L0 0')]],
 ['E dangle',()=>[base(),p('M50 0L50 30')]],
 ['F branch',()=>[base(),p('M0 50L100 50'),p('M50 50L50 70')]],
 ['G adjacent faces',()=>[base(),p('M0 50L100 50')]],
 ['H nested/hole',()=>[base(),p('M30 30L70 30L70 70L30 70Z')]],
 ['I curved',()=>[base(),p('M0 50C30 10 70 90 100 50')]],
 ['J tiny gap',()=>{const f=visualHoodie({gap:1});return [f.torso,f.sleeve];}],
 ['K large gap',()=>{const f=visualHoodie({gap:8});return [f.torso,f.sleeve];}]
];
const results=[];for(const [name,make] of fixtures){const os=make();let old;try{const surfaces=panelOwnerSurfaces(os,os,[os[0].id]).surfaces;if(!surfaces.length)old='FAIL: no surface';else{const t=buildPanelEdgeTopology(surfaces[0].path,os),s=new PanelEdgeSelection(t);for(const f of t.fragments.filter(f=>f.refs.some(r=>r.source!==surfaces[0].id)))s.toggle(f);old=s.candidates.length+' candidates';}}catch{old='FAIL';}const t=discoverVisualRegions(os);results.push({name,old,newRegions:t.candidates.length,metrics:t.metrics});if(name==='C sleeve screenshots'){assert.match(old,/FAIL/);assert.ok(visualRegionAt(t.candidates,real.inside));}if(name==='B Draw Division')assert.ok(resolvePanelCut(os[0],os[1]).valid);if(name==='J tiny gap')assert.equal(t.candidates.length,1);if(name==='K large gap')assert.equal(t.candidates.length,0);}
console.log(JSON.stringify(results,null,2));
