import {assertFiniteDocument} from './document-commands.js';
import {interactions} from './interaction-router.js';
import {clone} from './core.js';
// Transient document snapshots never enter history until the interaction ends.
export class PreviewTransaction {
 constructor({get,set,resolve,draw,commit}){Object.assign(this,{get,set,resolve,draw,commit});this.before=null;}
 get active(){return !!this.before;}
 begin(label){if(this.active)this.finish();if(!interactions.begin('preview','COLOR_PREVIEW',null,()=>this.cancel()))return false;this.before=clone(this.get());this.label=label;return true;}
 update(fn){if(!this.active)this.begin('Editar apariencia');if(!this.active)return;const p=this.get(),previous=clone(p);try{fn(p);this.resolve(p,previous);assertFiniteDocument(p);this.draw();}catch(error){this.cancel();throw error;}}
 finish(){if(!this.active)return;const label=this.label,before=this.before;try{assertFiniteDocument(this.get());this.commit(label);this.before=null;interactions.end('preview');}catch(error){this.set(clone(before));this.before=null;interactions.end('preview');this.draw();throw error;}}
 cancel(){if(!this.active)return false;this.set(clone(this.before));this.before=null;interactions.end('preview');this.draw();return true;}
}
