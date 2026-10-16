import {makePath} from './core.js';
import {modifier} from './effects.js';
export const collarResources=[['collars','collar-fine','Cuello rib fino'],['collars','collar-wide','Cuello rib ancho'],['collars','collar-crew','Redondo clásico'],['collars','collar-mock','Mock neck'],['collars','collar-v','V-neck rib'],['collars','collar-polo','Polo collar']];
// Original technical-flat contours; all nodes and seam modifiers remain editable.
export function collarResource(key){if(!key.startsWith('collar-'))return null;const style=key.slice(7),name=collarResources.find(r=>r[1]===key)?.[2];if(!name)return null;let d;
if(style==='v')d='M 0 0 L 60 74 L 120 0 L 128 8 L 60 90 L -8 8 Z';
else if(style==='mock')d='M 0 4 C 26 -5 94 -5 120 4 L 116 35 C 90 48 30 48 4 35 Z';
else if(style==='polo')d='M 0 6 C 30 -3 90 -3 120 6 L 144 42 L 104 64 L 60 20 L 16 64 L -24 42 Z';
else{const band=style==='fine'?7:style==='wide'?18:11;d=`M 0 0 C 10 49 110 49 120 0 L ${120+band*.6} ${band*.4} C ${114+band} ${49+band*1.7} ${6-band} ${49+band*1.7} ${-band*.6} ${band*.4} Z`;}
const o=makePath(name,d,'#fff',{category:'detail',semanticType:'collar',resourceKey:key,width:1.2});
if(style==='mock')o.modifiers=[modifier('rib',{spacing:4,inset:2,width:.55})];
else if(['fine','wide','v'].includes(style))o.modifiers=[modifier('rib',{spacing:style==='fine'?2.8:4,inset:1,width:.5,direction:'vertical'})];
else o.modifiers=[modifier('stitch',{offset:2,width:.65,spacing:2.5})];
if(style==='polo'){const fold=makePath('Quiebre de cuello','M 0 6 L 16 26 L 60 20 L 104 26 L 120 6','none',{width:.85,category:'detail',semanticType:'collarFold'}),placket=makePath('Cartera de polo','M 53 23 L 53 96 L 67 96 L 67 23','none',{width:.85,category:'detail',semanticType:'placket'});return [o,fold,placket];}
if(style==='mock')return [o,makePath('Costura cuello','M 4 33 C 30 45 90 45 116 33','none',{width:.7,category:'construction'})];return [o];}
