// One transient gesture owner, shared by canvas, windows, layers and previews.
export class InteractionRouter {
 constructor(){this.active=null;}
 begin(owner,kind,pointerId=null,cancel=null){if(this.active&&(this.active.owner!==owner||this.active.pointerId!=null&&pointerId!=null&&this.active.pointerId!==pointerId))return false;this.active={owner,kind,pointerId,cancel};return true;}
 allows(owner,pointerId=null){return !this.active||this.active.owner===owner&&(pointerId==null||this.active.pointerId==null||this.active.pointerId===pointerId);}
 end(owner){if(this.active?.owner===owner)this.active=null;}
 cancel(){const current=this.active;if(!current)return false;this.active=null;current.cancel?.();return true;}
}
export const interactions=new InteractionRouter();
