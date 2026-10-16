import {precision} from './precision.js';
import {clone,worldPath,I} from './core.js';
// Endpoint topology uses document geometry precision, never UI snapping tolerance.
const EPS=precision.geometry,equal=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=EPS;
function reverse(nodes){return nodes.slice().reverse().map((n,i,all)=>{const r={...clone(n)};delete r.in;delete r.out;if(n.out)r.in=clone(n.out);if(n.in)r.out=clone(n.in);r.edgeId=all[i+1]?.edgeId||n.edgeId;return r;});}
export function resolveGarmentSurfaces(os,{exclude=[],eligible=o=>!o.hidden&&!o.locked}={}){
 const paths=os.filter(o=>o.type==='path'&&o.nodes?.length>1&&!exclude.includes(o.id)&&!o.source&&!o.panelOf&&!o.construction&&!o.surfaceBoundaryIds&&eligible(o));
 const surfaces=paths.filter(o=>o.closed).map(o=>({id:o.id,name:o.name,boundaryIds:[o.id],path:o,kind:'closed',diagnostics:[]})),diagnostics=[];
 const open=paths.filter(o=>!o.closed&&o.semanticType!=='hemGuide'),remaining=new Set(open.map(o=>o.id)),world=new Map(open.map(o=>{const path=worldPath(o);path.nodes=path.nodes.map((n,i)=>({...n,nid:o.id+':'+(n.nid||i),edgeId:o.id+':'+(n.edgeId||i)}));return [o.id,path];}));
 while(remaining.size){const seed=open.find(o=>remaining.has(o.id)),component=[seed];remaining.delete(seed.id);let added=true;
  while(added){added=false;for(const o of open.filter(o=>remaining.has(o.id))){const n=world.get(o.id).nodes,ends=[n[0],n.at(-1)];if(component.some(c=>{const ns=world.get(c.id).nodes;return ends.some(e=>equal(e,ns[0])||equal(e,ns.at(-1)));})){component.push(o);remaining.delete(o.id);added=true;}}}
  const degree=p=>component.reduce((n,o)=>{const ns=world.get(o.id).nodes;return n+Number(equal(p,ns[0]))+Number(equal(p,ns.at(-1)));},0),ends=component.flatMap(o=>{const n=world.get(o.id).nodes;return [n[0],n.at(-1)];});
  if(ends.some(p=>degree(p)!==2)){diagnostics.push({boundaryIds:component.map(o=>o.id),message:'Contorno abierto o ramificado: conectá sus extremos.',endpoints:ends.filter(p=>degree(p)!==2)});continue;}
  let nodes=clone(world.get(seed.id).nodes),unused=component.filter(o=>o!==seed),boundaryIds=[seed.id];
  while(unused.length){const last=nodes.at(-1),next=unused.find(o=>{const ns=world.get(o.id).nodes;return equal(last,ns[0])||equal(last,ns.at(-1));});if(!next)break;const raw=world.get(next.id).nodes,ns=equal(last,raw[0])?clone(raw):reverse(raw);nodes[nodes.length-1]={...nodes.at(-1),out:ns[0].out,edgeId:ns[0].edgeId};nodes.push(...ns.slice(1));boundaryIds.push(next.id);unused=unused.filter(o=>o!==next);}
  if(unused.length||!equal(nodes[0],nodes.at(-1)))continue;
  nodes[0].in=nodes.at(-1).in;nodes.pop();const id='surface:'+boundaryIds.slice().sort().join(':'),reference=component.find(o=>o.category==='structure')||seed;
  const path={id,type:'path',name:'Superficie · '+reference.name,nodes,closed:true,matrix:I(),fill:reference.fill==='none'?'#fff':reference.fill||'#fff',stroke:'none',width:0,opacity:1,category:reference.category||'structure',semanticType:'garmentSurface',surfaceBoundaryIds:boundaryIds,symmetryExcluded:true,mirrorPolicy:'custom'};
  surfaces.push({id,name:path.name,boundaryIds,path,kind:'network',diagnostics:[]});
 }
 return {surfaces,diagnostics};
}
export function refreshGarmentSurfaces(os){for(const o of os.filter(o=>o.surfaceBoundaryIds)){const result=resolveGarmentSurfaces(os.filter(x=>o.surfaceBoundaryIds.includes(x.id)),{eligible:()=>true}).surfaces.find(s=>s.kind==='network');if(result){o.nodes=result.path.nodes;o.closed=true;o.surfaceInvalid=false;}else o.surfaceInvalid=true;}}
export function materializeSurface(os,surface){let base=os.find(o=>o.id===surface.id);if(!base){base=clone(surface.path);os.push(base);}return base;}
