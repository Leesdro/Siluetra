import {resolveGarmentSurfaces} from './garment-surfaces.js';
import {garmentBoundary} from './edge-panels.js';

// Ownership is independent of edge eligibility: a selected seam/region may be
// generated and still point to an editable garment. Never traverse by name.
export function panelOwnerIds(os,ids){
 const byId=new Map(os.map(o=>[o.id,o])),seen=new Set(),pending=[...ids];
 while(pending.length){const id=pending.pop();if(!id||seen.has(id))continue;seen.add(id);const o=byId.get(id);if(!o)continue;
  pending.push(o.ownerId,o.panelOf,o.source,o.attachment?.source,...o.surfaceBoundaryIds||[],...o.garmentSurface?.boundaryIds||[]);
 }
 return seen;
}
export function panelOwnerSurfaces(eligible,os,selected=[]){
 const related=panelOwnerIds(os,selected);
 const roots=eligible.filter(o=>!o.panelOf&&!o.ownerId&&!o.attachment?.source);
 // Hand-authored paths migrate to path/construction (or path/detail). Their
 // endpoint topology, not a template-only category or a display name, decides
 // whether they form a surface. Open contours are never forcibly closed.
 const boundaries=roots.filter(o=>garmentBoundary(o)||related.has(o.id)||o.semanticType==='path'||!o.semanticType);
 // An authored open loop already bounds its own surface. A divider touching
 // its first node must not turn owner discovery into a branched network.
 const loops=boundaries.filter(o=>!o.closed&&!o.surfaceBoundaryIds).flatMap(o=>resolveGarmentSurfaces([o]).surfaces);
 const loopIds=new Set(loops.flatMap(s=>s.boundaryIds));
 const result=resolveGarmentSurfaces(boundaries.filter(o=>!loopIds.has(o.id)));
 result.surfaces.push(...loops);
 for(const o of roots.filter(o=>o.surfaceBoundaryIds?.length&&!o.surfaceInvalid&&o.closed)){
  if(!o.surfaceBoundaryIds.every(id=>eligible.some(b=>b.id===id)))continue;
  result.surfaces=result.surfaces.filter(s=>!s.boundaryIds.every(id=>o.surfaceBoundaryIds.includes(id)));
  result.surfaces.push({id:o.id,name:o.name,path:o,boundaryIds:o.surfaceBoundaryIds,kind:'network',diagnostics:[]});
 }
 return result;
}
export function selectedPanelOwner(surfaces,os,ids){
 const related=panelOwnerIds(os,ids),matches=surfaces.filter(s=>related.has(s.id)||s.boundaryIds.some(id=>related.has(id)));
 return matches.length===1?matches[0]:null;
}
