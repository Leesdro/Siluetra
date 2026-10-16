import {clone,validateProject} from './core.js';
const DB='atelier-flat-projects';
export async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function operation(mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{let t;try{t=db.transaction('projects',mode);}catch(error){db.close();reject(error);return;}let result;let r;try{r=fn(t.objectStore('projects'));}catch(error){db.close();reject(error);return;}r.onsuccess=()=>result=r.result;t.oncomplete=()=>{db.close();resolve(result);};t.onerror=t.onabort=()=>{db.close();reject(t.error||Error('No se pudo completar el guardado local.'));};});}
export const saveProject=p=>{validateProject(p);const snapshot=clone(p);return operation('readwrite',s=>s.put(snapshot));};
export const listProjects=()=>operation('readonly',s=>s.getAll());
export const loadProject=id=>operation('readonly',s=>s.get(id));
export const deleteProject=id=>operation('readwrite',s=>s.delete(id));
