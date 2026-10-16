import {traceImageObjects} from './image-trace.js';
export function traceJob({image,rgba,width,height,options}){return traceImageObjects(image,rgba,width,height,options);}
if(typeof self!=='undefined')self.onmessage=e=>{try{self.postMessage({objects:traceJob(e.data)});}catch(error){self.postMessage({error:error.message});}};
