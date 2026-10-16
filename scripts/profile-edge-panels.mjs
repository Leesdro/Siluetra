// CPU-only profile; this does not measure browser frame rate or visual QA.
import {performance} from 'node:perf_hooks';
import {makePath,cubic} from '../dist/core.js';
import {ensureEdges} from '../dist/edges.js';
import {buildPanelEdgeTopology,PanelEdgeSelection,nearestPanelFragment} from '../dist/edge-panels.js';
const base=makePath('Torso','M100 100L400 100C430 180 430 420 400 500L100 500C70 420 70 180 100 100Z','#fff'),a=makePath('Borde A','M85 250C150 210 190 280 250 260','none'),b=makePath('Borde B','M250 260C300 280 360 330 421 320','none');
const neighbors=Array.from({length:20},(_,i)=>makePath('Detalle '+i,`M${140+i*3} 350C${180+i*3} 330 ${200+i*3} 370 ${220+i*3} 350`,'none'));
Object.assign(a.nodes[0],cubic(base.nodes[3],base.nodes[0],.65));Object.assign(b.nodes.at(-1),cubic(base.nodes[1],base.nodes[2],.55));
[base,a,b,...neighbors].forEach(o=>ensureEdges(o));
const median=v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)],timed=fn=>{fn();const times=[];for(let i=0;i<5;i++){const start=performance.now();fn();times.push(performance.now()-start);}return Number(median(times).toFixed(3));};
const topologyMs=timed(()=>buildPanelEdgeTopology(base,[a,b,...neighbors]));
const topology=buildPanelEdgeTopology(base,[a,b,...neighbors]),selection=new PanelEdgeSelection(topology),fa=nearestPanelFragment(topology,cubic(a.nodes[0],a.nodes[1],.5),2),fb=nearestPanelFragment(topology,cubic(b.nodes[0],b.nodes[1],.5),2);
selection.toggle(fa);selection.toggle(fb);if(selection.candidates.length!==2)throw Error('Expected two valid candidate regions');
const before=selection.evaluations,hover100Ms=timed(()=>{for(let i=0;i<100;i++)selection.move({x:150+i*.8,y:240+i*.2},7);});
const selectionMs=timed(()=>{const s=new PanelEdgeSelection(topology);s.toggle(fa);s.toggle(fb);});
console.log(JSON.stringify({runtime:process.version,method:'warmup + median of 5, CPU only',sourcePaths:23,candidates:selection.candidates.length,fragments:topology.fragments.length,topologyMs,twoSelectionsMs:selectionMs,hover100Ms,topologyEvaluationsDuringHover:selection.evaluations-before},null,2));
