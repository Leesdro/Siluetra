// Visual mockup regions: exact temporary cubic noding -> Turf polygonize ->
// original cubic slices. No surface prerequisite and no document mutation.
import polygonize from './vendor/turf-polygonize.js';
import {clone,I,worldPath,bounds,cubic} from './core.js';
import {cubicSlice,flattenCubic,nearestOnCubic} from './bezier.js';
import {curveIntersections,segmentsMayIntersect} from './curve-engine.js';
import {precision} from './precision.js';
import {hitObject} from './hit.js';
export const VISUAL_REGION_BACKEND='turf-polygonize-v1';
const EPS=precision.geometry;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const refKey=r=>JSON.stringify([r.source,r.subpath,r.edgeId,r.t0,r.t1]);
const overlap=(a,b)=>a.source===b.source&&a.subpath===b.subpath&&a.edgeId===b.edgeId&&Math.min(a.t1,b.t1)-Math.max(a.t0,b.t0)>1e-8;
const area=ps=>ps.reduce((v,p,i)=>{const q=ps[(i+1)%ps.length];return v+p.x*q.y-p.y*q.x;},0)/2;
const inside=(p,ps)=>{let v=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)v=!v;}return v;};
export function visualTolerance(zoom=1){return Math.max(.01,Math.min(.1,.25/zoom));}
function nearest(a,b,p){if(a.out||b.in)return nearestOnCubic(a,b,p);const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),point={x:a.x+t*dx,y:a.y+t*dy};return {t,point,distance:distance(p,point)};}
function segments(paths){const result=[];for(const o of paths)for(const [subpath,sp] of [o,...o.subpaths||[]].entries())for(let index=0;index<sp.nodes.length-(sp.closed?0:1);index++){
 let a=clone(sp.nodes[index]),b=clone(sp.nodes[(index+1)%sp.nodes.length]);const line=!a.out&&!b.in;if(line&&distance(a,b)<=EPS)continue;
 if(line){a.out={x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3};b.in={x:a.x+2*(b.x-a.x)/3,y:a.y+2*(b.y-a.y)/3};}
 result.push({a,b,line,source:o.id,subpath,index,edgeId:sp.nodes[index].edgeId||String(index),ts:[0,1]});
 }return result;}
function copiesWithSmallSnaps(objects,tolerance){const paths=objects.map(o=>({...worldPath(o),matrix:I(),modifiers:[],source:undefined,construction:undefined,regionSources:undefined}));
 // Freeze the targets before snapping, so object order cannot make a chain of
 // visual snaps bridge a gap larger than the accepted limit.
 const targets=segments(paths),moves=[];
 for(const o of paths)for(const [subpath,sp] of [o,...o.subpaths||[]].entries()){if(sp.closed)continue;for(const [index,handle] of [[0,'out'],[sp.nodes.length-1,'in']]){
  const n=sp.nodes[index];let best=null;for(const s of targets){if(s.source===o.id&&s.subpath===subpath)continue;const h=nearest(s.a,s.b,n);if(h.distance>tolerance)continue;if(!best||h.distance<best.distance-EPS||Math.abs(h.distance-best.distance)<=EPS&&s.source<best.source)best={...h,source:s.source};}
  // Exact endpoint contacts are noded separately; moving both near endpoints
  // to each other is avoided by retaining a deterministic source anchor.
  if(best&&best.distance>EPS){const target=paths.find(p=>p.id===best.source),endpoint=target&&[target,...target.subpaths||[]].some(sp=>!sp.closed&&(distance(sp.nodes[0],best.point)<=EPS||distance(sp.nodes.at(-1),best.point)<=EPS));if(endpoint&&o.id<best.source)continue;moves.push({n,handle,p:best.point});}
 }}for(const {n,handle,p} of moves){const dx=p.x-n.x,dy=p.y-n.y;n.x=p.x;n.y=p.y;if(n[handle]){n[handle].x+=dx;n[handle].y+=dy;}}return paths;}
export function sourceIntersections(a,b){if(!segmentsMayIntersect(a,b))return [];const out=[];
 if(a.line&&b.line){const dx=a.b.x-a.a.x,dy=a.b.y-a.a.y,ex=b.b.x-b.a.x,ey=b.b.y-b.a.y,den=dx*ey-dy*ex;
  if(Math.abs(den)>1e-12){const x=b.a.x-a.a.x,y=b.a.y-a.a.y,t=(x*ey-y*ex)/den,u=(x*dy-y*dx)/den;if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)out.push({t:Math.max(0,Math.min(1,t)),u:Math.max(0,Math.min(1,u))});}
  else if(Math.abs((b.a.x-a.a.x)*dy-(b.a.y-a.a.y)*dx)<=EPS){const project=(p,s)=>((p.x-s.a.x)*(s.b.x-s.a.x)+(p.y-s.a.y)*(s.b.y-s.a.y))/((s.b.x-s.a.x)**2+(s.b.y-s.a.y)**2);for(const [p,t] of [[a.a,0],[a.b,1]]){const u=project(p,b);if(u>=0&&u<=1)out.push({t,u});}for(const [p,u] of [[b.a,0],[b.b,1]]){const t=project(p,a);if(t>=0&&t<=1)out.push({t,u});}}
 }else out.push(...curveIntersections(a,b));
 for(const [p,t] of [[a.a,0],[a.b,1]]){const h=nearestOnCubic(b.a,b.b,p);if(h.distance<=EPS)out.push({t,u:h.t});}
 for(const [p,u] of [[b.a,0],[b.b,1]]){const h=nearestOnCubic(a.a,a.b,p);if(h.distance<=EPS)out.push({t:h.t,u});}
 return out.filter((h,i)=>!out.slice(0,i).some(q=>Math.abs(q.t-h.t)<1e-8&&Math.abs(q.u-h.u)<1e-8));
}
function reverse(nodes){const [a,b]=nodes;return [{...clone(b),out:b.in&&clone(b.in),in:undefined},{...clone(a),in:a.out&&clone(a.out),out:undefined}];}
function canonical(tokens){const variants=[];for(let i=0;i<tokens.length;i++)variants.push(JSON.stringify([...tokens.slice(i),...tokens.slice(0,i)]));return variants.sort()[0];}
function ringIdentity(perimeter,parameters=true){return canonical(perimeter.map(f=>JSON.stringify([f.ref.source,f.ref.subpath,f.ref.edgeId,f.ref.forward,...parameters?[f.ref.t0,f.ref.t1]:[]])));}
function boundaryPath(perimeter){return {nodes:perimeter.map((f,i)=>{const a=clone(f.nodes[0]),prev=perimeter[(i-1+perimeter.length)%perimeter.length].nodes[1];delete a.in;if(prev.in)a.in=clone(prev.in);return a;}),closed:true};}
function containsRegion(c,p){const b=c.box;if(p.x<b.x||p.x>b.x+b.w||p.y<b.y||p.y>b.y+b.h)return false;return inside(p,c.points)&&!(c.holes||[]).some(h=>inside(p,h.points));}
export function visualRegionAt(candidates,p){return candidates.find(c=>containsRegion(c,p))||null;}
export function discoverVisualRegions(objects,{tolerance=2,zoom=1}={}){
 const start=performance.now(),diagnostics=[],flattenTolerance=visualTolerance(zoom);
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>2)throw Error('Distancia de unión inválida.');
 if(!objects.length)return {backend:VISUAL_REGION_BACKEND,fragments:[],candidates:[],tolerance,diagnostics:[{code:'NO_LINEWORK'}],metrics:{prepareMs:0,polygonizeMs:0}};
 const paths=copiesWithSmallSnaps(objects,tolerance),segs=segments(paths);
 if(segs.length>600)throw Error('Elegí una zona más pequeña para crear el panel.');
 for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++)for(const h of sourceIntersections(segs[i],segs[j])){segs[i].ts.push(h.t);segs[j].ts.push(h.u);}
 const vertices=[],buckets=new Map(),vertex=p=>{const x=Math.round(p.x/EPS),y=Math.round(p.y/EPS);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of buckets.get((x+dx)+','+(y+dy))||[])if(distance(vertices[id],p)<=EPS*2)return id;const id=vertices.length;vertices.push({x:p.x,y:p.y});const key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;};
 const fragments=[];
 for(const s of segs){const ts=s.ts.map(t=>Math.max(0,Math.min(1,t))).sort((a,b)=>a-b).filter((t,i,all)=>!i||t-all[i-1]>1e-8);for(let k=1;k<ts.length;k++){
  const [a,b]=cubicSlice(s.a,s.b,ts[k-1],ts[k]);if(s.line){delete a.out;delete b.in;}const v0=vertex(a),v1=vertex(b);Object.assign(a,vertices[v0]);Object.assign(b,vertices[v1]);
  if(v0===v1&&distance(a.out||a,a)+distance(b.in||b,b)<EPS)continue;
  const ref={source:s.source,subpath:s.subpath,index:s.index,edgeId:s.edgeId,t0:ts[k-1],t1:ts[k],forward:true},path={id:refKey(ref),type:'path',matrix:I(),closed:false,nodes:[a,b],fill:'none',stroke:'none',width:0};
  fragments.push({id:refKey(ref),refs:[ref],nodes:[a,b],path,box:bounds(path)});
 }}
 const edgeMap=new Map(),features=[];
 const lineKey=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
 for(const f of fragments){const ps=flattenCubic(f.nodes[0],f.nodes[1],flattenTolerance),ids=ps.map(vertex);for(let i=1;i<ids.length;i++){const from=ids[i-1],to=ids[i];if(from===to)continue;const key=lineKey(from,to);if(!edgeMap.has(key)){edgeMap.set(key,[]);features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[vertices[from],vertices[to]].map(p=>[p.x,p.y])}});}edgeMap.get(key).push({f,from,to});}}
 if(features.length>25000)throw Error('Elegí una zona más pequeña para crear el panel.');
 const noded=performance.now();let polygons;try{polygons=polygonize({type:'FeatureCollection',features});}catch(error){const e=Error('No pudimos preparar esta zona. Probá con menos líneas.');e.code='NODING_FAILED';e.cause=error;throw e;}
 const polygonized=performance.now(),rings=new Map();
 for(const feature of polygons.features)for(const raw of feature.geometry.coordinates){const ids=raw.slice(0,-1).map(p=>vertex({x:p[0],y:p[1]})),perimeter=[];let failed=false;
  for(let i=0;i<ids.length;i++){const from=ids[i],to=ids[(i+1)%ids.length],matches=edgeMap.get(lineKey(from,to));if(!matches){failed=true;break;}const m=matches.slice().sort((a,b)=>a.f.id.localeCompare(b.f.id))[0],forward=m.from===from,previous=perimeter.at(-1);
   if(previous?.id===m.f.id&&previous.ref.forward===forward)continue;
   perimeter.push({id:m.f.id,nodes:forward?clone(m.f.nodes):reverse(m.f.nodes),ref:{...clone(m.f.refs[0]),forward},selected:false});
  }
  if(perimeter.length>1&&perimeter[0].id===perimeter.at(-1).id&&perimeter[0].ref.forward===perimeter.at(-1).ref.forward)perimeter.pop();
  if(failed||perimeter.length<2){diagnostics.push({code:'SOURCE_MAPPING_FAILED'});continue;}
  const ps=raw.slice(0,-1).map(p=>({x:p[0],y:p[1]})),A=Math.abs(area(ps));if(A<EPS)continue;
  const identity=ringIdentity(perimeter),opposite=ringIdentity(perimeter.slice().reverse().map(f=>({...f,ref:{...f.ref,forward:!f.ref.forward}}))),key=[identity,opposite].sort()[0];
  if(!rings.has(key))rings.set(key,{key,perimeter,points:ps,area:A,ring:boundaryPath(perimeter)});
 }
 // Turf returns nested edge rings individually. Attach immediate contained
 // rings as holes, without another graph traversal or alternate polygonizer.
 const all=[...rings.values()],parent=new Map();for(const r of all){const outer=all.filter(o=>o!==r&&o.area>r.area+EPS&&inside(r.points[0],o.points)).sort((a,b)=>a.area-b.area)[0];if(outer)parent.set(r,outer);}
 const scopeIds=objects.map(o=>o.id),candidates=all.map(r=>{const holes=all.filter(h=>parent.get(h)===r),perimeter=[...r.perimeter,...holes.flatMap(h=>h.perimeter)],path={...r.ring,subpaths:holes.map(h=>clone(h.ring)),type:'path',matrix:I(),fill:'#fff',stroke:'none',width:0};return {backend:VISUAL_REGION_BACKEND,key:r.key+'|'+holes.map(h=>h.key).sort().join('|'),path,points:r.points,holes,perimeter,required:clone(perimeter.map(f=>f.ref)),tolerance,autoComplete:true,scopeIds,box:bounds(path)};});
 if(!candidates.length)diagnostics.push({code:'NO_REGIONS'});
 return {backend:VISUAL_REGION_BACKEND,fragments,candidates,tolerance,flattenTolerance,scopeIds,diagnostics,metrics:{prepareMs:noded-start,polygonizeMs:polygonized-noded,mappingMs:performance.now()-polygonized,segments:segs.length,fragments:fragments.length,lines:features.length,regions:candidates.length}};
}
export function nearestVisualFragment(topology,p,tolerance){let best=null;for(const f of topology.fragments){const b=f.box;if(p.x<b.x-tolerance||p.x>b.x+b.w+tolerance||p.y<b.y-tolerance||p.y>b.y+b.h+tolerance)continue;const h=nearest(f.nodes[0],f.nodes[1],p);if(h.distance<=tolerance&&(!best||h.distance<best.distance))best={distance:h.distance,f};}return best?.f||null;}
export class VisualRegionSelection{
 constructor(topology,{mode='edges'}={}){this.topology=topology;this.mode=mode;this.selected=[];this.candidates=mode==='area'?topology.candidates:[];this.choice=null;this.hover=null;this.autoComplete=true;this.evaluations=0;}
 evaluate(){this.evaluations++;const required=this.topology.fragments.filter(f=>this.selected.includes(f.id));this.candidates=(!required.length&&this.mode!=='area')?[]:this.topology.candidates.filter(c=>required.every(f=>c.perimeter.some(b=>f.refs.some(r=>overlap(r,b.ref))))&& (this.autoComplete||c.perimeter.every(b=>required.some(f=>f.refs.some(r=>overlap(r,b.ref)))))).map(c=>({...c,perimeter:c.perimeter.map(b=>({...b,selected:required.some(f=>f.refs.some(r=>overlap(r,b.ref)))})),required:required.length?clone(required.map(f=>f.refs[0])):clone(c.perimeter.map(b=>b.ref))}));this.choice=this.mode==='edges'&&this.candidates.length===1?this.candidates[0]:null;this.hover=null;}
 toggle(fragment){if(!fragment)return;this.selected=this.selected.includes(fragment.id)?this.selected.filter(id=>id!==fragment.id):[...this.selected,fragment.id];this.evaluate();}
 clear(){this.selected=[];this.evaluate();}
 choose(p){this.choice=visualRegionAt(this.candidates,p);return this.choice;}
 move(p,tolerance){this.hover=nearestVisualFragment(this.topology,p,tolerance);return this.hover;}
 get message(){return this.mode==='area'?this.choice?'Área elegida · Creá el panel':'Pasá el cursor por un área y hacé clic':!this.selected.length?'Seleccioná los bordes que forman el panel.':!this.candidates.length?'Estos bordes no rodean una misma área.':this.candidates.length>1&&!this.choice?'Hay varias áreas posibles. Elegí una.':'Área encontrada · Creá el panel';}
}
export function visualPanelRecipe(c){return {backend:VISUAL_REGION_BACKEND,required:clone(c.required),perimeter:c.perimeter.map(f=>clone(f.ref)),scopeIds:clone(c.scopeIds),tolerance:c.tolerance,autoComplete:c.autoComplete};}
export function refreshVisualPanel(region,objects,base=null){const r=region.panelEdgeSelection,cache=refreshVisualPanel.cache??=new WeakMap(),ids=r.scopeIds||[...new Set(r.perimeter.map(v=>v.source))],geometry=()=>JSON.stringify([r,ids.map(id=>{const o=objects.find(o=>o.id===id);return o?[o.id,o.nodes,o.subpaths,o.closed,o.matrix,o.liveCorners,o.hidden,o.locked]:null;})]),sig=geometry();if(cache.get(region)===sig)return;
 try{const sources=ids.map(id=>objects.find(o=>o.id===id));if(sources.some(o=>!o))throw Error('SOURCE_MISSING');const t=discoverVisualRegions(sources,{tolerance:r.tolerance}),identity=refs=>canonical(refs.map(v=>JSON.stringify([v.source,v.subpath,v.edgeId,v.forward]))),original=identity(r.perimeter),matches=t.candidates.filter(c=>identity(c.perimeter.map(f=>f.ref))===original);if(matches.length!==1)throw Error('REGION_CHANGED');const c=matches[0];region.nodes=clone(c.path.nodes);region.subpaths=clone(c.path.subpaths);region.matrix=I();if(base?.visualPanelOwner){base.nodes=clone(c.path.nodes);base.subpaths=clone(c.path.subpaths);base.matrix=I();}region.panelEdgeSelection=visualPanelRecipe({...c,required:r.required,autoComplete:r.autoComplete});delete region.panelEdgeInvalid;}catch{region.panelEdgeInvalid=true;}cache.set(region,geometry());}
