// Additional Pathfinder commands over the current Siluetra geometry adapter.
import {clone,uid,worldPath} from './core.js';
import {booleanPaths} from './geometry.js';
import {planarRegions} from './planar-regions.js';
import {adaptivePoints} from './bezier.js';
function contains(o,p){let inside=false;for(const sp of [worldPath(o),...worldPath(o).subpaths||[]]){const pts=adaptivePoints(sp,.03);for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}return inside;}
export function pathfinder(os,operation){if(os.length<2||os.some(o=>o.type!=='path'||!o.closed))throw Error('Seleccioná dos o más formas cerradas independientes.');if(!['divide','trim','merge','crop','minusBack'].includes(operation))throw Error('Operación no admitida.');if(operation==='minusBack'){const r=booleanPaths([os.at(-1),...os.slice(0,-1)],'subtract');return r?[r]:[];}
 if(operation==='divide'){const faces=planarRegions(os);return faces.filter(f=>{const pts=adaptivePoints(f,.05),a=pts[0],b=pts[1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,p={x:(a.x+b.x)/2-dy/len*.0001,y:(a.y+b.y)/2+dx/len*.0001},owners=os.filter(o=>contains(o,p)),top=owners.at(-1);if(!top)return false;Object.assign(f,{fill:top.fill,stroke:top.stroke,width:top.width,opacity:top.opacity??1,category:top.category||'graphic',semanticType:'path',name:'División · '+top.name});delete f.regionSources;return true;});}
 const results=[];for(let i=0;i<os.length-(operation==='crop'?1:0);i++){let r=clone(os[i]);r.id=uid();if(operation==='crop')r=booleanPaths([r,os.at(-1)],'intersect');if(!r)continue;const above=os.slice(i+1,operation==='crop'?-1:undefined);if(above.length)r=booleanPaths([r,...above],'subtract');if(r){r.opacity=os[i].opacity??1;r.name=(operation==='crop'?'Recorte':'Recortado')+' · '+os[i].name;results.push(r);}}
 if(operation==='merge'){const buckets=new Map();for(const r of results){const key=JSON.stringify([r.fill,r.stroke,r.width,r.opacity]);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}return [...buckets.values()].map(rs=>rs.length>1?booleanPaths(rs,'union'):rs[0]).filter(Boolean);}return results;
}
