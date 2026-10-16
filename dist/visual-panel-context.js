// Context is a temporary neighborhood of editable linework, not a prerequisite
// closed surface. Ownership is consulted only for scope and for the final panel.
import {clone,I,bounds,worldPath,uid} from './core.js';
import {panelOwnerIds} from './panel-owner.js';
import {hitObject} from './hit.js';
import {ensureEdges} from './edges.js';
const connected=(a,b,t)=>a.x<=b.x+b.w+t&&a.x+a.w+t>=b.x&&a.y<=b.y+b.h+t&&a.y+a.h+t>=b.y;
export function visualPanelContexts(linework,objects,selected=[],tolerance=2){
 const related=panelOwnerIds(objects,selected),remaining=new Set(linework),contexts=[];
 const boxes=new Map(linework.map(o=>[o,bounds(o)]));
 while(remaining.size){const seed=remaining.values().next().value,paths=[seed];remaining.delete(seed);let added=true;while(added){added=false;for(const o of remaining){if(paths.some(p=>connected(boxes.get(p),boxes.get(o),tolerance))){paths.push(o);remaining.delete(o);added=true;}}}
  const owner=paths.find(o=>related.has(o.id)&&!o.source&&!o.panelOf&&!o.ownerId)||paths.find(o=>o.role==='body')||paths.find(o=>o.closed&&o.category==='structure')||paths[0];
  const ws=paths.map(worldPath),display={...clone(ws[0]),subpaths:[...ws[0].subpaths||[],...ws.slice(1).flatMap(w=>[{nodes:w.nodes,closed:w.closed},...w.subpaths||[]])],matrix:I()};
  const semanticOwner=objects.find(o=>related.has(o.id)&&(o.visualPanelOwner||o.surfaceBoundaryIds)&&paths.some(p=>p.id===o.ownerId||o.surfaceBoundaryIds?.includes(p.id)));
  contexts.push({id:semanticOwner?.id||owner.id,name:owner.name,boundaryIds:paths.map(o=>o.id),path:display,owner,linework:paths,kind:'visual-context'});
 }return contexts;
}
export function materializeVisualOwner(objects,context,candidate){
 const sources=new Set(candidate.perimeter.map(f=>f.ref.source));
 const owners=objects.filter(o=>o.type==='path'&&o.closed&&!o.surfaceInvalid&&!o.panelOf&&!o.visualPanelOwner&&!o.hidden&&!o.locked&&(sources.has(o.id)||context.boundaryIds.includes(o.id)||o.surfaceBoundaryIds?.every(id=>context.boundaryIds.includes(id))));
 const contains=o=>candidate.points.every(p=>hitObject({...o,fill:'#fff',stroke:'#fff',width:.3},[],p,.15));
 const existing=owners.filter(contains).sort((a,b)=>{const A=bounds(a),B=bounds(b);return A.w*A.h-B.w*B.h;})[0];if(existing)return existing;
 const saved=objects.find(o=>o.visualPanelOwner&&!o.hidden&&!o.locked&&o.visualBoundaryKey===candidate.key);if(saved)return saved;
 const root=context.owner,base={...clone(candidate.path),id:uid(),name:'Superficie · '+(root?.name||'Prenda'),semanticType:'garmentSurface',category:root?.category||'structure',group:root?.group,fill:'none',stroke:'none',width:0,opacity:1,modifiers:[],visualPanelOwner:true,visualBoundaryKey:candidate.key,ownerId:root?.id,symmetryExcluded:true,mirrorPolicy:root?.mirrorPolicy==='centered'?'centered':'custom'};
 if(root?.symmetry)base.symmetry=clone(root.symmetry);
 ensureEdges(base);objects.push(base);return base;
}
