import {makePath,worldPath,pathD} from './core.js';
export function componentDetails(o,{zip=true}={}){const c=o.component;if(!c)return [];const w=c.width||86,h=c.height||100,paths=[];if(c.kind==='pocket'){
 const y=Math.min(h*.65,c.zipPosition||25),angle=(c.openingAngle||0)*Math.PI/180;
 if(c.style==='cargo'){if(c.flap){const f=c.flapHeight||22;paths.push(`M -2 0 L ${w+2} 0 L ${w-2} ${f} L ${w/2} ${f+5} L 2 ${f} Z`,`M ${w*.2} ${f*.6} L ${w*.2+3} ${f*.6}`,`M ${w*.8-3} ${f*.6} L ${w*.8} ${f*.6}`);}paths.push(`M ${w*.44} ${h*.28} L ${w*.44} ${h-6} M ${w*.56} ${h*.28} L ${w*.56} ${h-6}`);if(c.gussetDepth)paths.push(`M ${c.gussetDepth} ${h*.25} L ${c.gussetDepth} ${h-7} M ${w-c.gussetDepth} ${h*.25} L ${w-c.gussetDepth} ${h-7}`);}
 if(zip&&['zip','diagonalZip'].includes(c.style)){const dy=Math.tan(angle)*(w-14);paths.push(`M 7 ${y} L ${w-7} ${y+dy} M 7 ${y+4} L ${w-7} ${y+dy+4}`);for(let x=10;x<w-8;x+=4)paths.push(`M ${x} ${y+Math.tan(angle)*(x-7)} L ${x+1} ${y+Math.tan(angle)*(x-7)+4}`);}
 if(c.style==='utility')paths.push(`M ${w*.3} 4 L ${w*.3} ${h-4} M ${w*.65} 4 L ${w*.65} ${h-4} M 4 ${h*.42} L ${w*.3} ${h*.42}`);
 if(c.style==='welt')paths.push(`M 3 ${h*.11} L ${w-3} ${h*.11}`);
 if(c.style==='hidden')paths.push(`M 2 2 L ${w-2} 2`);
 if(c.style==='back')paths.push(`M 9 ${h*.28} C ${w*.3} ${h*.35} ${w*.4} ${h*.55} ${w/2} ${h*.37} C ${w*.6} ${h*.55} ${w*.7} ${h*.35} ${w-9} ${h*.28}`);
 if(c.style==='patch'||c.style==='side')paths.push(`M 4 8 L ${w-4} 8`);
 }else if(c.kind==='hood'){
 const width=w*(c.opening??.7),x=(w-width)/2,cross=c.overlap||0;
 if(c.style==='balaclava')paths.push(`M ${w*.22} ${h*.38} C ${w*.35} ${h*.29} ${w*.65} ${h*.29} ${w*.78} ${h*.38} L ${w*.72} ${h*.53} C ${w*.6} ${h*.59} ${w*.4} ${h*.59} ${w*.28} ${h*.53} Z`);
 else paths.push(`M ${w/2} ${h*.04} C ${x} ${h*.25} ${x-4} ${h*.66} ${x+8} ${h*.89} Q ${w/2+cross} ${h*1.01} ${w-x-8} ${h*.89} C ${w-x+4} ${h*.66} ${w-x} ${h*.25} ${w/2} ${h*.04}`);
 if(c.layers===2)paths.push(`M ${w/2} ${h*.06} C ${x+8} ${h*.25} ${x+5} ${h*.62} ${x+14} ${h*.85} Q ${w/2} ${h*.96} ${w-x-14} ${h*.85}`);
 if(c.style==='cross')paths.push(`M ${x+8} ${h*.89} Q ${w*.65} ${h*1.02} ${w-x+8} ${h*.95}`);
 if(c.style==='high')paths.push(`M ${w*.12} ${h*.82} Q ${w/2} ${h*.91} ${w*.88} ${h*.82}`);
 if(c.panels>1)paths.push(`M ${w*.32} ${h*.06} C ${w*.19} ${h*.3} ${w*.16} ${h*.7} ${w*.24} ${h*.94}`,`M ${w*.68} ${h*.06} C ${w*.81} ${h*.3} ${w*.84} ${h*.7} ${w*.76} ${h*.94}`);
 }
 return paths.flatMap(d=>d.split(/\s+(?=M )/)).map(d=>({d:pathD(worldPath({...makePath('',d),matrix:o.matrix})),stroke:o.stroke,width:.8,fill:'none',ownerId:o.id}));}
