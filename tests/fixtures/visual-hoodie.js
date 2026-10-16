import {newProject} from '../../dist/templates.js';
import {makePath} from '../../dist/core.js';
import {ensureEdges} from '../../dist/edges.js';
// Reconstructed from the supplied Front screenshots: shoulder (528,285),
// sleeve tip (405,553), cuff/body junction (558,613), neck and open body sides.
// This is deliberately NOT a closed template or an endpoint-only loop.
export function visualHoodie({gap=0}={}){
 const p=newProject('blank');p.kind='hoodie';p.name='Hoodie · líneas independientes';p.liveMirror=false;
 const torso=makePath('Torso','M558 900L558 613C568 470 601 350 528 285L700 176C710 270 910 270 920 176L1094 285C1040 350 1045 470 1065 613L1065 900','none');
 const sleeve=makePath('Trazado Bézier',`M528 285L405 553Q470 600 ${558-gap} 613`,'none');
 torso.category=sleeve.category='construction';torso.semanticType=sleeve.semanticType='path';
 torso.modifiers=[{id:'hoodie-seam',type:'stitch',offset:5,spacing:7,rows:1}];
 const image={id:'hoodie-reference',type:'image',name:'Referencia',src:'data:image/png;base64,AA==',w:1000,h:1000,matrix:[1,0,0,1,0,0],opacity:1,hidden:true,locked:true};
 p.views.front=[torso,sleeve,image];[torso,sleeve].forEach(ensureEdges);
 return {p,torso,sleeve,inside:{x:505,y:490},outside:{x:450,y:300}};
}
