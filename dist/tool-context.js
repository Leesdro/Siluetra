// Primary tools choose mode; their metadata declares configuration commands.
export const toolContexts={
knife:[{label:"Cortar panel",hint:"Dibujá entre bordes y confirmá Crear paneles"}],
shapeBuilder:[{label:"Regiones",hint:"Clic: crear o pintar · Alt clic: quitar región creada · originales conservados"}],
curvature:[{label:"Curvatura",items:[["penFinish","Terminar"],["penClose","Cerrar"]]},{label:"Dibujo",hint:"Clic: curva · Alt clic: esquina · Enter: terminar"}],
measure:[{label:"Medir",hint:"Arrastrar: distancia y ángulo · Shift: 45° · Medidas de ilustración"}],
scissors:[{label:"Tijeras",hint:"Clic sobre un trazado abierto · Para dividir prendas usá Cortar panel"}],
lineCut:[{label:"Panel",hint:"Arrastrá el corte · Shift: 45° · Confirmá Crear paneles"}],
gradient:[{label:"Degradado",hint:"Arrastrar: dirección · Shift: 45°"}],
node:[{label:'Nodo',items:[['nodeType:corner','Esquina'],['nodeType:smooth','Suave'],['nodeType:symmetric','Simétrico']]},{label:'Trazado',items:[['joinNodes','Unir'],['split','Dividir'],['togglePath','Abrir / cerrar']]},{label:'Tiradores',items:[['breakHandles','Romper'],['moveHint','Mover pieza']],secondary:true}],
edge:[{label:'Construcción',items:[['stitch','Costura'],['double','Doble'],['hem','Dobladillo'],['piping','Vivo'],['binding','Bies']]},{label:'Selección',items:[['connectedEdges','Conectados'],['clearEdges','Despejar']],secondary:true}],
select:[{label:'Transformar',items:[['mirror','Reflejar'],['flipV','Reflejar Y'],['mirrorObjects','Espejo']]},{label:'Alinear',items:[['align:left','Izq.'],['align:cx','Centro'],['align:right','Der.']],secondary:true},{label:'Prenda',items:[['stitch','Costura'],['hem','Dobladillo'],['createPanel','Panel'],['stack','Stack']],secondary:true}],
pen:[{label:'Trazado',items:[['penNew','Nuevo'],['penFinish','Terminar'],['penClose','Cerrar']]},{label:'Dibujo',hint:'Clic: punto · Arrastrar: curva · Enter: terminar'}],
pencil:[{label:'Lápiz',control:'smoothing'}],eraser:[{label:'Borrador',hint:'Objetivo: construcciones · La forma de base se conserva'}],line:[{label:'Línea',hint:'Arrastrar · Shift: restringir ángulo'}],rect:[{label:'Forma',hint:'Rectángulo vectorial · Medidas en el inspector'}],ellipse:[{label:'Forma',hint:'Elipse vectorial · Medidas en el inspector'}],text:[{label:'Texto',hint:'Hacé clic en el lienzo para agregar texto'}]
};
export const garmentOverflow=[['zipper','Cierre'],['cord','Cordón'],['rib','Rib'],['binding','Bies'],['quilt','Quilt'],['addModifier','Modificador…'],['finish','Terminaciones…'],['presets','Estilo…'],['createPanel','Crear panel'],['stack','Caída / Stack'],['mirrorObjects','Espejo vivo'],['breakSymmetry','Romper simetría'],['align:top','Alinear arriba'],['align:cy','Alinear medio'],['align:bottom','Alinear abajo'],['freeze','Convertir a vectores']];
