import {makePath,bounds,samples,evaluatedPath,point,I} from '../dist/core.js';
import {traceMask} from '../dist/image-trace.js';
import {collectSnapTargets} from '../dist/smart-guides.js';
import {newProject} from '../dist/templates.js';
// Baseline formula from core.js at a12986c9573c2f9f36025330aabb11b337d1cfa6.
function sampledBounds(o){const ps=samples(evaluatedPath(o),40).map(p=>point(o.matrix||I(),p)),xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};}
const objects=Array.from({length:400},(_,i)=>makePath('curve',`M ${i%20*30} ${Math.floor(i/20)*30} c0 100 100 100 100 0`));
const time=(fn,n=1)=>{const start=performance.now();for(let i=0;i<n;i++)fn();return +(performance.now()-start).toFixed(3);};
for(let i=0;i<3;i++){objects.forEach(sampledBounds);objects.forEach(bounds);}
const results={environment:'Node, synthetic geometry; not browser frame-rate measurements',objects:400,bounds400x30:{sampledMs:time(()=>objects.forEach(sampledBounds),30),analyticMs:time(()=>objects.forEach(bounds),30)}};
const p=newProject('blank');p.liveMirror=false;p.views.front=objects;results.snapTargetCollection400Ms=time(()=>collectSnapTargets(p,'front',[],{snapNodes:true,snapBounds:true,snapObjects:true}));
results.traceMs={};for(const size of [128,256,512])results.traceMs[size]=time(()=>traceMask(new Uint8Array(size*size).fill(1),size,size));
console.log(JSON.stringify(results,null,2));
