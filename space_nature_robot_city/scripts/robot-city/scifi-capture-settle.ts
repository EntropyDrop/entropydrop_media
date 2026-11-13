/** A player's voxel edit can invalidate nearby mesh readiness between captured frames. */
export function install(p:any){
 const capture=p.captureFrame;
 p.captureFrame=async(options:any)=>{
  let frames=0;
  while(!p.g.world.getTerrainAoiLoadProgress().ready){
   if(++frames>600)throw Error('Edited terrain did not settle before capture');
   const delta=p.g.clock.getDelta;p.g.clock.getDelta=()=>0;
   try{p.savedAnimate();await p.g.sceneRenderer.renderer.backend.device.queue.onSubmittedWorkDone();await new Promise(requestAnimationFrame);}finally{p.g.clock.getDelta=delta;}
  }
  return capture(options);
 };
}
