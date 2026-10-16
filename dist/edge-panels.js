import {VISUAL_REGION_BACKEND,visualPanelRecipe,refreshVisualPanel} from './visual-regions.js';
// Temporary edge selection reuses the native cubic half-edge adapter.
// No document writes: all snapping and slicing are performed on world-space copies.
import {clone,I,worldPath,bounds} from './core.js';
import {planarTopology} from './planar-regions.js';
import {nearestOnCubic} from './bezier.js';
import {hitObject} from './hit.js';
import {precision,documentTolerance} from './precision.js';

export const edgePanelTolerance=zoom=>Math.max(precision.geometry,Math.min(2,documentTolerance(2,zoom)));
export const garmentBoundary=o=>o?.type==='path'&&!o.source&&!o.panelOf&&!o.construction&&o.category!=='graphic'&&(o.category==='structure'||o.role==='body'||o.garmentSurface||o.surfaceBoundaryIds);
export const selectablePanelEdge=o=>o?.type==='path'&&o.nodes?.length>1&&!o.source&&!o.construction&&!o.component&&o.category!=='graphic'&&o.semanticType!=='region'&&(!o.panelOf||o.semanticType==='panelBoundary');
const refreshCache=new WeakMap();
const refKey=r=>JSON.stringify([r.source,r.subpath,r.edgeId,r.t0,r.t1]);
const spanMatch=(a,b)=>a.source===b.source&&a.subpath===b.subpath&&a.edgeId===b.edgeId&&Math.min(a.t1,b.t1)-Math.max(a.t0,b.t0)>1e-8;
const fragmentPath=f=>({id:refKey(f.refs[0]),type:'path',nodes:clone(f.nodes),closed:false,matrix:I(),fill:'none',stroke:'none',width:0});
const refsOf=face=>face.boundaryFragments.flatMap(f=>f.refs);
function nearestSpan(a,b,p){if(a.out||b.in)return nearestOnCubic(a,b,p);const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),point={x:a.x+dx*t,y:a.y+dy*t};return {t,point,distance:Math.hypot(p.x-point.x,p.y-point.y)};}
function copiedPaths(base,paths,tolerance){
 const all=[base,...paths.filter(o=>o.id!==base.id)].map(o=>{const w=worldPath(o);return {...w,source:undefined,construction:undefined,regionSources:undefined,modifiers:[],matrix:I()};});
 // Only endpoints of explicitly participating open paths can move. The garment
 // contour stays exact. Translate the adjacent handle to preserve its tangent.
 for(const o of all.slice(1))for(const sp of [o,...o.subpaths||[]]){
  if(sp.closed)continue;
  for(const [index,handle] of [[0,'out'],[sp.nodes.length-1,'in']]){
   const n=sp.nodes[index];let best=null;
   for(const other of all){if(other===o)continue;
    for(const path of [other,...other.subpaths||[]])for(let i=0;i<path.nodes.length-(path.closed?0:1);i++){
     const hit=nearestSpan(path.nodes[i],path.nodes[(i+1)%path.nodes.length],n);
     if(hit.distance>tolerance)continue;
     if(!best||other===all[0]&&best.owner!==all[0]||other===best.owner&&hit.distance<best.distance||best.owner!==all[0]&&hit.distance<best.distance)best={...hit,owner:other};
    }
   }
   if(best&&best.distance>precision.geometry){const dx=best.point.x-n.x,dy=best.point.y-n.y;n.x=best.point.x;n.y=best.point.y;if(n[handle]){n[handle].x+=dx;n[handle].y+=dy;}}
  }
 }
 return all;
}
export function buildPanelEdgeTopology(base,paths,{tolerance=2}={}){
 if(!base?.closed||base.surfaceInvalid)throw Error('Elegí una pieza de prenda disponible.');
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>2)throw Error('Distancia de unión inválida.');
 const eligible=paths.filter(selectablePanelEdge),all=copiedPaths(base,eligible,tolerance),topology=planarTopology(all);
 const fragments=topology.fragments.map(f=>({...f,id:refKey(f.refs[0]),path:fragmentPath(f),box:bounds(fragmentPath(f))}));
 return {baseId:base.id,base:all[0],fragments,tolerance};
}
export function nearestPanelFragment(topology,p,tolerance){
 let best=null;for(const f of topology.fragments){const b=f.box;if(p.x<b.x-tolerance||p.x>b.x+b.w+tolerance||p.y<b.y-tolerance||p.y>b.y+b.h+tolerance)continue;const hit=nearestSpan(f.nodes[0],f.nodes[1],p);if(hit.distance<=tolerance&&(!best||hit.distance<best.distance))best={...hit,fragment:f};}return best?.fragment||null;
}
export function panelEdgeCandidates(topology,selected,{autoComplete=true}={}){
 const required=topology.fragments.filter(f=>selected.includes(f.id));if(!required.length)return [];
 const inputs=required.map(f=>f.path);
 if(autoComplete)inputs.unshift(topology.base);
 const graph=planarTopology(inputs),base=topology.base;
 return graph.faces.filter(face=>{
  const refs=refsOf(face);
  // A dangling selected edge is never accepted just because it touches a face.
  if(!required.every(f=>refs.some(r=>r.source===f.path.id)))return false;
  // Every boundary piece must lie on or inside the current garment surface.
  return face.points.every(p=>hitObject({...base,fill:'#fff',stroke:'#fff',width:.3},[],p,.15));
 }).map(face=>{
  const perimeter=face.boundaryFragments.map(f=>{
   const selectedRef=f.refs.find(r=>required.some(x=>x.path.id===r.source));
   const ref=selectedRef||f.refs[0],picked=required.find(x=>x.path.id===ref.source);
   const original=picked?.refs[0];
   return {nodes:clone(f.nodes),selected:!!picked,ref:original?{...original,t0:original.t0+(original.t1-original.t0)*ref.t0,t1:original.t0+(original.t1-original.t0)*ref.t1,forward:ref.forward}:ref};
  });
  return {key:JSON.stringify(perimeter.map(f=>[f.ref.source,f.ref.subpath,f.ref.edgeId,f.ref.forward])),path:face.path,perimeter,required:required.map(f=>clone(f.refs[0])),tolerance:topology.tolerance,autoComplete};
 });
}
export function panelCandidateAt(candidates,p){return candidates.find(c=>hitObject({...c.path,fill:'#fff',stroke:'none',width:0},[],p,0))||null;}
export function panelEdgeRecipe(candidate){if(candidate.backend===VISUAL_REGION_BACKEND)return visualPanelRecipe(candidate);return {required:clone(candidate.required),perimeter:candidate.perimeter.map(f=>clone(f.ref)),tolerance:candidate.tolerance,autoComplete:candidate.autoComplete};}
export function refreshEdgePanel(region,base,objects){
 const recipe=region.panelEdgeSelection;if(!recipe)return;if(recipe.backend===VISUAL_REGION_BACKEND){refreshVisualPanel(region,objects,base);return;}const geometry=o=>o?[o.id,o.nodes,o.subpaths,o.closed,o.matrix,o.modifiers,o.liveCorners,o.surfaceInvalid]:null;const signature=JSON.stringify([recipe,geometry(base),recipe.required.map(r=>geometry(objects.find(o=>o.id===r.source)))]);if(refreshCache.get(region)===signature)return;
 try{
  const sources=[...new Set(recipe.required.map(r=>r.source))].filter(id=>id!==base.id).map(id=>objects.find(o=>o.id===id));
  if(sources.some(o=>!o)||base.surfaceInvalid)throw Error('missing');
  const topology=buildPanelEdgeTopology(base,sources,{tolerance:recipe.tolerance}),selected=[];
  for(const ref of recipe.required){const midpoint=(ref.t0+ref.t1)/2,f=topology.fragments.find(f=>f.refs.some(r=>spanMatch(r,ref)&&r.t0<=midpoint+1e-8&&r.t1>=midpoint-1e-8));if(!f)throw Error('changed');selected.push(f.id);}
  const candidates=panelEdgeCandidates(topology,selected,{autoComplete:recipe.autoComplete});
  // Choose by the oriented source perimeter, never by face index or count.
  const identity=refs=>JSON.stringify(refs.map(r=>[r.source,r.subpath,r.edgeId,r.forward]));
  const cyclic=refs=>refs.map((_,i)=>identity([...refs.slice(i),...refs.slice(0,i)]));
  const original=identity(recipe.perimeter),matches=candidates.filter(c=>cyclic(c.perimeter.map(f=>f.ref)).includes(original));
  if(matches.length!==1)throw Error('changed');
  const c=matches[0];region.nodes=clone(c.path.nodes);region.subpaths=clone(c.path.subpaths);region.matrix=I();region.panelEdgeSelection=panelEdgeRecipe(c);delete region.panelEdgeInvalid;
 }catch{region.panelEdgeInvalid=true;}
 refreshCache.set(region,JSON.stringify([region.panelEdgeSelection,geometry(base),recipe.required.map(r=>geometry(objects.find(o=>o.id===r.source)))]));
}
export class PanelEdgeSelection{
 constructor(topology){this.topology=topology;this.selected=[];this.candidates=[];this.choice=null;this.hover=null;this.autoComplete=true;this.evaluations=0;}
 evaluate(){this.evaluations++;this.candidates=panelEdgeCandidates(this.topology,this.selected,{autoComplete:this.autoComplete});this.choice=this.candidates.length===1?this.candidates[0]:null;this.hover=null;}
 toggle(fragment){if(!fragment)return;this.selected=this.selected.includes(fragment.id)?this.selected.filter(id=>id!==fragment.id):[...this.selected,fragment.id];this.evaluate();}
 clear(){this.selected=[];this.evaluate();}
 choose(p){this.choice=panelCandidateAt(this.candidates,p);return this.choice;}
 move(p,tolerance){this.hover=nearestPanelFragment(this.topology,p,tolerance);return this.hover;}
 get message(){const count=this.selected.length;return !count?'Elegí los bordes que rodean el panel':!this.candidates.length?`${count} bordes seleccionados · Faltan bordes para cerrar una región`:this.candidates.length>1&&!this.choice?`${count} bordes seleccionados · Hay varias regiones posibles · Elegí una`:`${count} bordes seleccionados · Región encontrada`;}
}
