/** Batch native scene import without cancelling the mesh builder per individual cell. */
export function apply(p:any){
 const w=p.g.world,original=w.setMicroBlock.bind(w);let queued:number[]=[],scheduled=false;
 const flush=()=>{scheduled=false;if(!queued.length)return;const data=new Uint32Array(queued);queued=[];w.microVoxels.setPackedTerrainCells(0,0,data,()=>true);w.terrainVersion++;if(p.stage!=='placing')w.setMicroBlock=original;};
 w.setMicroBlock=(x:number,y:number,z:number,color:number,part:any,material=0)=>{
  if(p.stage!=='placing'){flush();w.setMicroBlock=original;return original(x,y,z,color,part,material);}
  queued.push(x,y,z,(color|(material<<24))>>>0);if(!scheduled){scheduled=true;queueMicrotask(flush);}return true;
 };
 p.restoreImporter=()=>{flush();w.setMicroBlock=original;};
}
