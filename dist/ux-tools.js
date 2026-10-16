import {uiIcon} from './ui-icons.js';
import {toolInfo} from './tool-learning.js';
import {esc} from './render.js';
export const toolFamilies=[
 {id:'selection',label:'Seleccionar',tools:['select','node','edge']},
 {id:'pen',label:'Curvas',tools:['pen','curvature']},
 {id:'draw',label:'Dibujar',tools:['pencil','line']},
 {id:'shapes',label:'Formas',tools:['rect','ellipse']},
 {id:'cut',label:'Cortar',tools:['scissors','knife','lineCut']},
 {id:'regions',label:'Construir',tools:['shapeBuilder']},
 {id:'erase',label:'Borrar',tools:['eraser']},
 {id:'color',label:'Color',tools:['fill','gradient','eyedropper']},
 {id:'fabric',label:'Tela',tools:['fabric']},
 {id:'content',label:'Contenido',tools:['text','image']},
 {id:'utility',label:'Medir',tools:['measure']}
];
export function readToolMemory(storage){try{const raw=JSON.parse(storage?.getItem('siluetra-tool-families')||'{}');return Object.fromEntries(toolFamilies.map(f=>[f.id,f.tools.includes(raw[f.id])?raw[f.id]:f.tools[0]]));}catch{return Object.fromEntries(toolFamilies.map(f=>[f.id,f.tools[0]]));}}
export function rememberTool(memory,id,storage){const family=toolFamilies.find(f=>f.tools.includes(id));if(!family)return;memory[family.id]=id;try{storage?.setItem('siluetra-tool-families',JSON.stringify(memory));}catch{}}
export function toolButton(id){const info=toolInfo[id];return `<button data-tool="${id}" data-learn="${id}" title="${esc(info.name+' · '+info.description)}" aria-label="${info.name}" aria-keyshortcuts="${info.shortcut}" aria-pressed="false">${uiIcon(id)}<span>${info.name}</span><kbd>${info.shortcut}</kbd></button>`;}
export function toolbarHtml(memory){return toolFamilies.map(f=>`<div class="tool-family" data-family="${f.id}">${toolButton(memory[f.id]||f.tools[0])}${f.tools.length>1?`<details class="tool-flyout"><summary aria-label="${f.label}: más herramientas" title="${f.label}: más herramientas">${uiIcon('chevronDown')}</summary><div class="tool-flyout-menu"><strong>${f.label}</strong>${f.tools.map(toolButton).join('')}</div></details>`:''}</div>`).join('')+`<div class="tool-cluster"><button id="mirror-tool" data-learn="copyMirror" aria-label="Duplicar y reflejar">${uiIcon('mirror')}</button><button id="command-tool" title="Buscar herramientas · Ctrl K" aria-label="Buscar herramientas">${uiIcon('search')}</button></div><div class="rail-colors"><button id="active-fill" class="rail-swatch" data-color-open="fill" title="Relleno activo" aria-label="Relleno activo"></button><button id="active-stroke" class="rail-swatch" data-color-open="stroke" title="Línea activa" aria-label="Línea activa"></button></div>`;}
export const pathActions=[['boolean:union','Unir formas','union'],['boolean:subtract','Restar frente','subtract'],['boolean:intersect','Intersecar','intersect'],['boolean:difference','Excluir','exclude'],['pathfinder:divide','Dividir','divide'],['pathfinder:trim','Recortar superposición','trim'],['pathfinder:merge','Fusionar colores','merge'],['pathfinder:crop','Recortar con frente','crop'],['pathfinder:minusBack','Restar fondo','minusBack'],['boolean:join','Unir extremos','join'],['compound','Crear compuesto','compound'],['releaseCompound','Separar contornos','releaseCompound'],['outline','Contornear línea','outline'],['offset','Desplazar trazado…','offset']];
export const independent=o=>o?.type==='path'&&!o.source&&!o.panelOf&&!o.construction&&!o.component&&!o.modifiers?.length&&!o.garmentSurface&&!o.surfaceBoundaryIds&&!o.structureKey&&o.category!=='structure';
export function unavailable(id,os){
 if(id.startsWith('tool:'))return id==='tool:shapeBuilder'&&!os.some(o=>o.type==='path')?'Seleccioná los trazados de la red de construcción.':'';
 if(['commandPalette','dimensions','importGraphic','exportDocument','helpTools','createPanel','selectPanelEdges','cancelDraft','pathfinderPanel'].includes(id))return '';
 if(!os.length)return 'Seleccioná un objeto en el lienzo o en Capas.';
 if(id==='traceImage')return os.length!==1||os[0].type!=='image'?'Seleccioná una sola imagen.':'';
 if(id==='removeClip')return !os.some(o=>o.clip)?'La selección no tiene recorte.':'';
 if(id==='clipSelection')return os.filter(o=>o.type==='path'&&o.closed).length!==1||!os.some(o=>['image','text'].includes(o.type)||o.category==='graphic')?'Seleccioná un contorno cerrado y el gráfico.':'';
 if(id==='gradientFill'||id==='removeGradient'||id==='reverseGradient')return !os.some(o=>o.type==='path'&&o.closed)?'Seleccioná una forma cerrada.':id!=='gradientFill'&&!os.some(o=>o.gradient)?'La selección no tiene degradado.':'';
 if(id==='smooth')return os.length!==1||os[0].type!=='path'?'Seleccioná un solo trazado.':'';
 const boolean=id.startsWith('boolean:')||id.startsWith('pathfinder:'),geometry=boolean||['compound','releaseCompound','simplify','cleanPath','outline','offset'].includes(id);
 if(geometry){if(os.some(o=>!independent(o)))return 'La selección tiene geometría de prenda vinculada. Conservá sus dependencias.';
 if(['simplify','offset','outline'].includes(id)&&os.length!==1)return 'Seleccioná un solo trazado independiente.';
 if(boolean||id==='compound'){if(os.length<2)return 'Seleccioná al menos dos trazados compatibles.';if(id==='boolean:join'){if(os.some(o=>o.closed||o.subpaths?.length))return 'Unir extremos requiere trazados abiertos simples.';}else if(os.some(o=>!o.closed))return 'Seleccioná formas cerradas.';if(boolean&&os.some(o=>o.gradient))return 'Usá rellenos sólidos para combinar formas.';}
 if(id==='releaseCompound'&&!os.some(o=>o.subpaths?.length))return 'La selección no tiene contornos compuestos.';
 if(id==='outline'&&!os.some(o=>o.stroke!=='none'&&o.width>0))return 'El trazado necesita una línea con grosor.';}
 if(id.startsWith('align:')&&os.length<2)return 'Seleccioná al menos dos objetos para alinear.';
 return '';
}
export function actionButton(id,label,os,icon='path'){const why=unavailable(id,os);return `<button data-ux-command="${esc(id)}" ${why?'disabled aria-disabled="true"':''} title="${esc(why||label)}" aria-label="${esc(label+(why?' · '+why:''))}">${uiIcon(icon)}<span>${esc(label)}</span></button>`;}
export function pathfinderHtml(os){return `<p class="ux-explanation">Dos formas cerradas independientes. La forma frontal determina el recorte; las operaciones son editables con Deshacer.</p><div class="pathfinder-grid">${pathActions.map(([id,label,icon])=>actionButton(id,label,os,icon)).join('')}</div>`;}
export function selectionActions(os){if(!os.length)return [['importGraphic','Importar gráfico','image'],['dimensions','Documento','garment'],['helpTools','Guía de herramientas','help']];
 const o=os.length===1?os[0]:null;
 if(o?.type==='image')return [['traceImage','Vectorizar B/N','trace'],['clip','Recortar a prenda','crop'],['removeClip','Quitar recorte','releaseCompound'],['exportSelection','Exportar selección','export']];
 if(o?.type==='text')return [['color','Color de texto','fill'],['duplicate','Duplicar','copy'],['exportSelection','Exportar selección','export']];
 if(os.some(o=>o.category==='structure'||o.panelOf||o.source||o.construction||o.component))return [['editNodes','Editar base','node'],['createPanel','Paneles','panel'],['mirrorObjects','Espejo vivo','liveMirror'],['stitch','Costura','stitch'],['fabric','Tela','fabric']];
 if(os.length>1)return [['group','Agrupar','group'],['pathfinderPanel','Pathfinder','divide'],['align:cx','Alinear centro','align'],['clipSelection','Recortar gráfico','crop'],['exportSelection','Exportar selección','export']];
 return [['color','Relleno','fill'],['gradientFill','Degradado','gradient'],['simplify','Simplificar','simplify'],['cleanPath','Limpiar','clean'],['duplicate','Duplicar','copy'],['pathfinderPanel','Pathfinder','divide']];}
export function menusHtml(os){const sections=[['Archivo',[['importGraphic','Importar PNG, JPG, WebP o SVG','image'],['exportDocument','Exportar documento','export'],['exportSelection','Exportar selección','export']]],['Objeto',[['duplicate','Duplicar','copy'],['group','Agrupar','group'],['ungroup','Desagrupar','group'],['shear','Inclinar…','shear'],['clipSelection','Recortar con forma','crop'],['removeClip','Quitar recorte','releaseCompound']]],['Trazado',[['pathfinderPanel','Pathfinder','divide'],['smooth','Suavizar…','smooth'],['simplify','Simplificar…','simplify'],['cleanPath','Limpiar puntos','clean'],['boolean:join','Unir extremos','join'],['compound','Crear compuesto','compound'],['releaseCompound','Separar contornos','releaseCompound'],['outline','Contornear línea','outline'],['offset','Desplazar trazado…','offset']]],['Prenda',[['createPanel','Crear panel…','panel'],['selectPanelEdges','Panel: seleccionar bordes','edge'],['regionsFromLines','Regiones desde trazados','shapeBuilder'],['convert:stitch','Convertir en costura','stitch'],['mirrorObjects','Espejo vivo','liveMirror'],['breakSymmetry','Romper simetría','unlink'],['fabric','Textura de tela','fabric']]]];const editMenu=`<details class="ux-menu"><summary>Editar</summary><div><button data-editor-command="undo">Deshacer</button><button data-editor-command="redo">Rehacer</button></div></details>`;return sections.map(([name,items])=>`<details class="ux-menu"><summary>${name}</summary><div>${items.map(([id,l,icon])=>actionButton(id,l,os,icon)).join('')}</div></details>`+(name==='Archivo'?editMenu:'')).join('');}
export const toolCursor={select:'default',node:'crosshair',edge:'crosshair',pen:'crosshair',curvature:'crosshair',pencil:'crosshair',knife:'crosshair',lineCut:'crosshair',eraser:'cell',scissors:'crosshair',gradient:'crosshair',measure:'crosshair',text:'text',fill:'copy',eyedropper:'crosshair',shapeBuilder:'copy'};

// Tool-specific cursors use Siluetra's own SVG outline icons, with native fallback.
for(const id of ['pen','curvature','pencil','knife','lineCut','scissors','gradient','measure','eraser','eyedropper']){const markup=uiIcon(id).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ').replaceAll('currentColor','#27634b');toolCursor[id]=`url("data:image/svg+xml,${encodeURIComponent(markup)}") 4 20, ${toolCursor[id]||'crosshair'}`;}
