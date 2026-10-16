import {graphIds} from './object-graph.js';
import {visibleBounds} from './hit.js';
import {orderedObjects} from './layers.js';
import {visible} from './model.js';
import {objectSvg,definitions,esc} from './render.js';
export function selectionExport(project,view,ids,background='transparent'){
 const objects=project.views[view],paintIds=new Set(graphIds(objects,ids,{includeOwners:false})),art=orderedObjects(project,view).filter(o=>paintIds.has(o.id)&&visible(project,view,o)),boxes=art.map(o=>visibleBounds(o,objects)).filter(Boolean);if(!boxes.length)throw Error('Seleccioná objetos para exportar.');let x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));const pad=Math.max(...art.map(o=>(o.width||0)*Math.max(Math.hypot(o.matrix[0],o.matrix[1]),Math.hypot(o.matrix[2],o.matrix[3]))/2),0);x-=pad;y-=pad;right+=pad;bottom+=pad;const width=Math.max(1,right-x),height=Math.max(1,bottom-y),selectionOnly=objects.map(o=>o.semanticType==='region'&&paintIds.has(o.id)&&!paintIds.has(o.panelOf)?{...o,panelOf:undefined}:o),markup=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><title>${esc(project.name)} · selección</title>${definitions(objects)}${background==='transparent'?'':`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${esc(background)}"/>`}${art.map(o=>objectSvg(selectionOnly.find(s=>s.id===o.id),selectionOnly)).join('')}</svg>`;return {markup,width,height};
}
