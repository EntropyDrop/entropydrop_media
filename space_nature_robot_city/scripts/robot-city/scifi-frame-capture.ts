/** Fixed-time native rendering. Slower capture never creates repeated filler frames. */
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
export async function install(p:any){
 const g=p.g;
 if(!p.savedAnimate){p.savedAnimate=g.animate;g.animate=()=>{p.renderFrozen=true;};}
 while(!p.renderFrozen)await frame();
 const delta=g.clock.getDelta.bind(g.clock);
 let frameDelta=0,accumulator=0;
 g.clock.getDelta=()=>{g.clock.elapsedTime+=frameDelta;return frameDelta;};
 p.captureRunning=false;
 const render=async(dt:number)=>{
  frameDelta=dt;p.savedAnimate();
  await g.sceneRenderer.renderer.backend.device.queue.onSubmittedWorkDone();
  await frame();
 };
 p.captureFrame=async(options:any)=>{
  if(p.stage!=='ready')throw Error('Native scene is not ready');
  if(!(window as any).offlineSurfaceStatus?.complete||!g.world.getTerrainAoiLoadProgress().ready)throw Error('Terrain loading is incomplete');
  const canvas=g.sceneRenderer.renderer.domElement;
  if(canvas.width!==1920||canvas.height!==1080)throw Error('Capture must be native 1920x1080');
  if(options.fov!==undefined)g.controller.setFov(options.fov);
  accumulator+=(options.controllerRate??0)/30;
  let steps=0;
  while(accumulator+.0000001>=.05){
   p.stepControllers(.05);accumulator-=.05;steps++;
   const failed=p.team.entities.find((e:any)=>e.scriptError||p.team.state(e).fault);
   if(failed)throw Error('Controller fault: '+(failed.scriptError||JSON.stringify(p.team.state(failed))));
   // Yield outside guest execution so browser maintenance is not forced into a
   // long synchronous accelerated burst. Native controller dt remains 0.05 s.
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(options.followRole!==undefined){
   const pos=p.team.entities[options.followRole].position.toArray();
   options.position=pos.map((n:number,i:number)=>n+options.followOffset[i]);
   options.target=pos.map((n:number,i:number)=>n+(options.lookOffset?.[i]??0));
  }
  p.pose(options.position,options.target);
  for(const d of [[0,0,0],[.2,0,0],[-.2,0,0],[0,.2,0],[0,-.2,0],[0,0,.2],[0,0,-.2]]){
   const v=options.position.map((n:number,i:number)=>n+d[i]);
   if(g.world.getBlock(...v.map(Math.floor))||g.world.getMicroBlock(...v.map((n:number)=>Math.floor(n*8))))throw Error('Camera intersects terrain at '+JSON.stringify(v));
  }
  await render(1/30);
  // Publish all real edits before photographing this frame; simulation stays stopped.
  const micro=g.world.microVoxels;let settles=0;
  while(micro.dirtyMeshChunks.size||micro.activeMeshBuild||micro.workerBuilds.size||!g.world.getTerrainAoiLoadProgress().ready){
   if(++settles>600)throw Error('Native mesh publication did not settle');
   await render(0);
  }
  return {controllerRevision:p.team.revision||'static-rotors',validationAtRestore:p.validationAtRestore,clock:p.clock,steps,settles,checkpoint:p.checkpointName||'new-world',
   robots:p.team.snapshot().map((r:any)=>({role:r.role,position:r.position,job:r.state.job,progress:r.state.progress,paused:r.state.workPaused,survey:r.state.survey,road:r.state.road,built:r.state.built,planted:r.state.planted,status:r.state.status,error:r.error}))};
 };
 p.captureRestoreRealtime=()=>{g.clock.getDelta=delta;g.clock.getDelta();g.animate=p.savedAnimate;requestAnimationFrame(g.animate);};
 return {frozen:p.renderFrozen,width:g.sceneRenderer.renderer.domElement.width,height:g.sceneRenderer.renderer.domElement.height};
}
