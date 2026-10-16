import {splitCubic,cubicSlice} from './bezier.js';
import {cubic,clone,worldPath,uid} from './core.js';
import {canonicalRefs,resolveRef,removeConstructions} from './construction-system.js';
export function eraseConstruction(p,view,ref){const refs=canonicalRefs(p,view,[ref]);for(const r of refs){const {owner}=resolveRef(p.views[view],r);if(owner?.construction&&!r.modifierId){delete owner.construction;owner.semanticType='path';owner.name='Trazado';}else removeConstructions(p,view,[r]);}}
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function segmentDistance(a,b,c,d){if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));}
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function flatten(a,c,d,b,depth=0){if(depth>12||Math.max(distance(c,a,b),distance(d,a,b))<.15)return [a,b];const ac=mid(a,c),cd=mid(c,d),db=mid(d,b),left=mid(ac,cd),right=mid(cd,db),center=mid(left,right);return [...flatten(a,ac,left,center,depth+1).slice(0,-1),...flatten(center,right,db,b,depth+1)];}
export const vectorEraserEligible=o=>o.type==='path'&&!o.closed&&!o.source&&!o.panelOf&&!o.construction&&!o.component&&!o.modifiers?.length&&!o.surfaceBoundaryIds&&!o.structureKey&&o.category!=='structure'&&!o.garmentSurface;
export function eraseVectorSegments(p,view,trail,radius,{eligible=()=>true}={}){if(!trail.length)return [];const os=p.views[view],removed=[];for(const o of os.slice()){if(!vectorEraserEligible(o)||!eligible(o)||o.instanceOf&&p.liveMirror)continue;const instances=p.liveMirror?os.filter(x=>x.instanceOf===o.id):[],geometries=[o,...instances].map(worldPath),hits=new Set();for(const w of geometries)for(let i=0;i<w.nodes.length-1;i++){const a=w.nodes[i],b=w.nodes[i+1],poly=flatten(a,a.out||a,b.in||b,b);if(poly.slice(1).some((q,j)=>trail.length===1?distance(trail[0],poly[j],q)<=radius:trail.slice(1).some((t,k)=>segmentDistance(poly[j],q,trail[k],t)<=radius)))hits.add(i);}
 if(!hits.size)continue;removed.push(o.id);const runs=[];let run=[];for(let i=0;i<o.nodes.length-1;i++){if(hits.has(i)){if(run.length>1)runs.push(run);run=[];}else{if(!run.length)run.push(clone(o.nodes[i]));run.push(clone(o.nodes[i+1]));}}if(run.length>1)runs.push(run);const replacements=runs.map((nodes,i)=>{delete nodes[0].in;delete nodes.at(-1).out;const r={...clone(o),id:i?uid():o.id,nodes};if(i){delete r.mirrorPeer;delete r.symmetry;}return r;});os.splice(os.indexOf(o),1,...replacements);
 if(!replacements.length)for(const peer of instances)os.splice(os.indexOf(peer),1);
 }return removed;}

// Partial vector erasure: locate brush crossings in world space, slice original cubics in local space.
// Existing whole-segment erasure remains available for backwards compatible programmatic workflows.
export function eraseVectorPartial(p,view,trail,radius,{eligible=()=>true}={}){
 if(!trail.length||!Number.isFinite(radius)||radius<=0||trail.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))return [];
 const os=p.views[view],changed=[],strokeDistance=q=>trail.length===1?Math.hypot(q.x-trail[0].x,q.y-trail[0].y):Math.min(...trail.slice(1).map((b,i)=>distance(q,trail[i],b)));
 for(const o of os.slice()){
  if(!vectorEraserEligible(o)||o.subpaths?.length||o.symmetry||!eligible(o)||o.instanceOf&&p.liveMirror)continue;
  const instances=p.liveMirror?os.filter(x=>x.instanceOf===o.id):[],geometries=[o,...instances].map(worldPath),segments=[];let touched=false;
  for(let i=0;i<o.nodes.length-1;i++){
   const intervals=[];
   for(const w of geometries){const a=w.nodes[i],b=w.nodes[i+1];if(!a||!b)continue;
    const visit=(a,b,lo,hi,depth)=>{const controls=[a,a.out||a,b.in||b,b],minX=Math.min(...controls.map(p=>p.x)),maxX=Math.max(...controls.map(p=>p.x)),minY=Math.min(...controls.map(p=>p.y)),maxY=Math.max(...controls.map(p=>p.y));
     if(!trail.some((q,j)=>{const r=trail[Math.min(j+1,trail.length-1)];return Math.max(q.x,r.x)+radius>=minX&&Math.min(q.x,r.x)-radius<=maxX&&Math.max(q.y,r.y)+radius>=minY&&Math.min(q.y,r.y)-radius<=maxY;}))return;
     const center=cubic(a,b,.5),bound=Math.max(...controls.map(q=>Math.hypot(q.x-center.x,q.y-center.y))),d=strokeDistance(center);if(d-bound>radius)return;if(d+bound<=radius){intervals.push([lo,hi]);return;}
     if(depth>=22||bound<=Math.min(.01,radius/32)){if(d<=radius)intervals.push([lo,hi]);return;}
     const [l,m,r]=splitCubic(a,b,.5),mid=(lo+hi)/2;visit(l,m,lo,mid,depth+1);visit(m,r,mid,hi,depth+1);
    };visit(a,b,0,1,0);
   }
   intervals.sort((a,b)=>a[0]-b[0]);const merged=[];for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+1e-9)last[1]=Math.max(last[1],interval[1]);else merged.push(interval.slice());}
   touched||=merged.length>0;let t=0;for(const [lo,hi] of merged){if(lo-t>1e-8)segments.push({i,lo:t,hi:lo});t=hi;}if(1-t>1e-8)segments.push({i,lo:t,hi:1});
  }
  if(!touched)continue;changed.push(o.id);const runs=[];let run=[],previous=null;for(const s of segments){const [a,b]=cubicSlice(o.nodes[s.i],o.nodes[s.i+1],s.lo,s.hi),connected=previous&&previous.i+1===s.i&&previous.hi===1&&s.lo===0;if(!connected&&run.length){runs.push(run);run=[];}if(run.length){run.at(-1).out=a.out;run.push(b);}else run=[a,b];previous=s;}if(run.length)runs.push(run);
  const replacements=runs.map((nodes,i)=>{delete nodes[0].in;delete nodes.at(-1).out;const r={...clone(o),nodes,id:i?uid():o.id};if(i){delete r.mirrorPeer;delete r.instanceOf;delete r.symmetry;}return r;});os.splice(os.indexOf(o),1,...replacements);if(!replacements.length)for(const peer of instances){const index=os.indexOf(peer);if(index>=0)os.splice(index,1);}
 }return changed;
}
