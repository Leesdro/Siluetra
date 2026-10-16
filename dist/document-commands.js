import {assertDocumentGeometry,assertJsonSafety} from './path-validation.js';
import {validateAppearance} from './appearance.js';
import {clone} from './core.js';
import {appendObjects} from './document-store.js';
import {resolveMirrorChanges,mirrorDiagnostics} from './mirror-service.js';
const active=new WeakSet();
export {mirrorDiagnostics};
export function insertDocumentObjects(p,view,records,{group,policy,command='insert'}={}){for(const o of records){if(/^(Línea|Trazo libre|Trazo|Rectángulo|Elipse|Texto|Imagen)$/.test(o.name||'')){const stem=['Línea','Trazo libre'].includes(o.name)?'Trazo':o.name;const names=[...p.views[view],...records.filter(x=>x!==o)].map(x=>x.name);let n=1;while(names.includes(stem+' '+String(n).padStart(2,'0')))n++;o.name=stem+' '+String(n).padStart(2,'0');}if(group&&!o.group)o.group=group;if(policy)o.mirrorPolicy=policy;o.creationCommand??=command;o.mirrorPolicy??=o.symmetryExcluded?'none':'linked';if(o.mirrorPolicy==='none')o.symmetryExcluded=true;}return appendObjects(p.views[view],records);}
// Nested semantic commands participate in the editor's one History transaction.
export function modifyDocument(p,view,fn,{before,resolve=resolveMirrorChanges,command='modify'}={}){if(active.has(p))return fn();const snapshot=before||clone(p);active.add(p);try{const result=fn();resolve(p,snapshot,view,{command});assertFiniteDocument(p);return result;}catch(error){for(const k of Object.keys(p))delete p[k];Object.assign(p,clone(snapshot));throw error;}finally{active.delete(p);}}

export function assertFiniteDocument(p){assertJsonSafety(p);assertDocumentGeometry(p);for(const os of Object.values(p.views))for(const o of os)validateAppearance(o);return p;}
