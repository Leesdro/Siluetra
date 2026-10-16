import {clone,uid} from './core.js';
export const defaults={theme:'light',canvas:'#e9ece5',artboard:'#ffffff',gridColor:'#bac4bb',units:'px',exportScale:2,autosave:true,nodeSize:7.4,handles:true,strokeWidth:1.7,selection:'group',mirrorDefault:true,smoothing:55,snapCenter:true,snapNodes:true,snapBounds:true,snapGuides:true,snapObjects:true,snapIntersections:true,snapThreshold:5};
const read=(key,fallback)=>{try{return JSON.parse(globalThis.localStorage?.getItem?.(key))||fallback;}catch{return fallback;}};
export const settings={...defaults,...read('atelier-settings-v3',{})};
for(const [key,value] of Object.entries(defaults))if(typeof settings[key]!==typeof value||typeof value==='number'&&!Number.isFinite(settings[key]))settings[key]=value;
for(const [key,min,max] of [['nodeSize',4,16],['strokeWidth',.1,12],['smoothing',0,100],['snapThreshold',1,20]])if(settings[key]<min||settings[key]>max)settings[key]=defaults[key];
for(const [key,allowed] of [['theme',['light','dark','system']],['units',['px','mm']],['exportScale',[1,2,4]],['selection',['group','individual']]])if(!allowed.includes(settings[key]))settings[key]=defaults[key];
const array=key=>{const value=read(key,[]);return Array.isArray(value)?value:[];};
export const stylePresets=array('atelier-presets-v3').filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.values&&typeof p.values.type==='string');
export const favorites=array('atelier-favorites-v3').filter(v=>typeof v==='string'),recentResources=array('atelier-resource-recents-v3').filter(v=>typeof v==='string').slice(0,8);
const persist=(k,v)=>globalThis.localStorage?.setItem?.(k,JSON.stringify(v));
export function updateSettings(values){Object.assign(settings,values);persist('atelier-settings-v3',settings);}
const parameters=['type','width','stroke','offset','spacing','length','rows','position','rowGap','stitchType','zipWidth','slider','openAmount','teeth','teethSpacing','teethWidth','tapeWidth','zipType','tapeColor','cordWidth','cordStyle','endType','effectWidth','itemSize','count','direction','density','inset','thickness','angle','amount','intensity','irregularity','foldCount','region','pattern','depth','pleatType','randomness','seed'];
export function captureStyle(o){return Object.fromEntries(parameters.filter(k=>o[k]!==undefined).map(k=>[k,clone(o[k])]));}
export function saveStyle(name,o,overwriteId){const values=captureStyle(o);if(!values.type)throw Error('Elegí un efecto o modificador');const old=stylePresets.find(p=>p.id===overwriteId);if(old)Object.assign(old,{name,values});else stylePresets.push({id:uid(),name,values});persist('atelier-presets-v3',stylePresets);return old||stylePresets.at(-1);}
export function applyStyle(o,preset){if(o.type!==preset.values.type)throw Error('El preset corresponde a '+preset.values.type);Object.assign(o,clone(preset.values));}
export function favorite(key){const i=favorites.indexOf(key);if(i<0)favorites.push(key);else favorites.splice(i,1);persist('atelier-favorites-v3',favorites);}
export function rememberResource(key){const i=recentResources.indexOf(key);if(i>=0)recentResources.splice(i,1);recentResources.unshift(key);recentResources.splice(8);persist('atelier-resource-recents-v3',recentResources);}
