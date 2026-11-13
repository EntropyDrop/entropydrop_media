import * as THREE from 'three';
import {installTeam} from './scifi-runtime.ts';
import {apply as applyCamera} from './scifi-camera.ts';
import {apply as applyBatches} from './scifi-batch.ts';
import {prepare} from './scifi-prewarm.ts';
const root='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/';
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
export async function install(g:any){
 if((window as any).cityProduction)return (window as any).cityProduction;
 g.uiStore.startGame(false);g.uiStore.setLightingQuality('ultra',false);g.uiStore.setShadowsEnabled(true,false);g.uiStore.setResolutionScale(1,false);g.uiStore.setRenderDistance(16,false);g.uiStore.setDistantSurfaceEnabled(true,false);g.world.setRenderDistance(16,14);
 for(const[k,v]of Object.entries({subdivisionSizePx2:1,renderDistanceChunks:2048,dataBudgetMiB:1024,geometryBudgetMiB:512,torusBackfaceCulling:false}))g.uiStore.setDistantSurfaceSetting(k,v,false);
 const assets=await(await fetch(root+'review/scifi-construction.json')).json(),team=await installTeam(g.contraptionManager,assets),c=g.controller;
 const p:any={g,c,team,assets,entities:team.entities,stage:'terrain-loading',captureRunning:false,fixed:null,views:{overview:[[5460,140,845],[5390,10,675]]},viewFovs:{overview:45},samples:[],verification:null};(window as any).cityProduction=p;
 p.pose=(pos:number[],target:number[])=>{p.fixed={pos,target};g.playerPhysics.isFlying=true;g.playerPhysics.position.set(5390,40,660);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();};
 c.setPerspective('first_person',false);p.view=(name:string)=>{c.setFov(p.viewFovs[name]);p.pose(...p.views[name]);};p.view('overview');applyCamera(p);
 const render=g.sceneRenderer,shadow=render.sunLight.shadow;render.renderer.toneMappingExposure=1.2;render.sunLight.intensity=4.5;render.hemiLight.intensity=.65;shadow.camera.left=shadow.camera.bottom=-140;shadow.camera.right=shadow.camera.top=140;shadow.camera.near=-160;shadow.camera.far=400;shadow.camera.updateProjectionMatrix();shadow.bias=-.15/560;shadow.normalBias=.06;shadow.needsUpdate=true;
 const style=document.createElement('style');style.textContent='.entity-nameplate,#dev-render-diagnostics,#dev-frame-profiler,#crosshair{display:none!important}body.city-clean *{cursor:none!important}';document.head.appendChild(style);document.body.classList.add('city-clean');
 const avatar=render.setPlayerAvatarVisible.bind(render);render.setPlayerAvatarVisible=(v:boolean,h:boolean)=>avatar(false,p.toolDemo&&h);const aim=c.updateAimRaycast.bind(c);c.updateAimRaycast=()=>{if(!p.fixed||p.toolDemo)return aim();c.syncDrivenVehiclePose();c.updateCameraPosition();c.currentRaycast={hit:false};c.hoveredContraption=null;c.hoveredContraptionHit=null;};
 p.setToolDemo=(show:boolean)=>{p.toolDemo=show;document.body.classList.toggle('city-tool-demo',show);if(show)c.activeTool='shovel';};
 const toolStyle=document.createElement('style');toolStyle.textContent='body.city-tool-demo #hotbar{display:flex!important}body.city-tool-demo #crosshair{display:block!important}';document.head.appendChild(toolStyle);
 p.removeSurveyObstacle=()=>{const b=p.surveyObstacle;if(!b)throw Error('No staged survey test block');c.updateAimRaycast();const hit=c.currentRaycast;if(!hit?.hit||hit.kind==='micro'||[hit.hitPos.x,hit.hitPos.y,hit.hitPos.z].some((n:number,i:number)=>n!==b[i]))throw Error('Shovel is not aimed at the exact survey test block');c.handleLeftClick();if(g.world.getBlock(...b))throw Error('Native shovel did not remove test block');return {removed:b,method:'native-shovel-left-click'};};
 const update=g.contraptionManager.update.bind(g.contraptionManager);g.contraptionManager.update=(dt:any,input:any)=>{if(p.captureRunning){p.clock+=dt;team.setClock(p.clock);update(dt,input);}};
 p.clock=0;p.stepControllers=(dt=.05,steps=1)=>{if(dt!==.05)throw Error('Use the native 20 Hz simulation step');for(let i=0;i<steps;i++){p.clock+=dt;team.setClock(p.clock);update(dt,{down:[],pressed:[],released:[]});}};
 p.start=()=>{team.start();p.captureRunning=true;};p.pause=(i:number)=>team.pause(i);
 p.status=()=>({stage:p.stage,surface:(window as any).offlineSurfaceStatus,terrain:g.world.getTerrainAoiLoadProgress(),fps:g.currentFps,robots:team.snapshot(),verification:p.verification,checkpoint:p.checkpointName,meshRemaining:p.meshRemaining,controllerErrors:team.entities.filter(e=>e.scriptError).map(e=>e.scriptError)});
 p.frame=(duration:number,fn:(t:number)=>void)=>{const start=performance.now();p.cameraRunning=true;const tick=()=>{if(!p.cameraRunning)return;const t=Math.min(duration,(performance.now()-start)/1000);fn(t);if(t<duration)requestAnimationFrame(tick);else p.cameraRunning=false;};requestAnimationFrame(tick);};
 p.orbit=(target:number[],radius:number,height:number,seconds:number,start=0,turn=Math.PI*1.2)=>p.frame(seconds,t=>{const a=start+turn*t/seconds;p.pose([target[0]+Math.sin(a)*radius,height,target[2]+Math.cos(a)*radius],target);});
 p.restore=async(name:string)=>{
  if(p.checkpointName)throw Error('Use a fresh native scene for each checkpoint; never overwrite earlier scene state');
  p.captureRunning=false;const report=await(await fetch(root+'review/scifi-simulation.json')).json();
  const full=report.complete&&report.verified&&report.parallelWrites&&report.controllerRevision===team.revision;
  if(name==='complete'&&!full)throw Error('Complete-city checkpoint requires current full validation');
  const checkpoints=await(await fetch(root+'review/'+(full?'scifi-checkpoints.json':'scifi-checkpoints-progress.json'))).json();
  const cp=name==='complete'?{robots:report.robots,blueprintSha256:assets.blueprintSha256,controllerRevision:team.revision,name}:checkpoints.find((v:any)=>v.name===name);
  if(!cp||cp.blueprintSha256!==assets.blueprintSha256||cp.controllerRevision!==team.revision||cp.robots.some((r:any)=>r.error||r.state.fault))throw Error('Checkpoint mismatch or controller error');
  p.validationAtRestore=full?(report.uninterrupted===false?'resumed-functional-validation-complete':'single-run-functional-validation-complete'):'committed-prefix-verified; full-run-pending';
  const completeMask=(key:string)=>cp.robots.reduce((mask:number,r:any)=>mask|(r.state[key]||0),0),progress=assets.jobs.map((j:any)=>((completeMask(j.family===0?'road':j.family===1?'built':'planted')&(1<<j.district))?j.count:0));
  for(let role=1;role<5;role++){const s=cp.robots[role].state;if(s.job>=0){const id=(role===1?0:role===4?12:6)+s.job;progress[id]=Math.max(progress[id],s.progress||0);}}
  const expected:Uint32Array[]=[];for(const j of assets.jobs){let left=progress[j.id];if(!left)continue;const records:number[]=[];for(let i=0;i<j.data.length&&left>0;i+=5){const a=[0,1,2].map(k=>j.data.charCodeAt(i+k)-256),pi=j.data.charCodeAt(i+3)-256,code=j.data.charCodeAt(i+4)-256,axis=Math.floor(code/2048),n=Math.min(left,code%2048),packed=(assets.palette[pi]|(assets.materials[pi]<<24))>>>0;for(let k=0;k<n;k++){const v=a.slice();v[axis]+=k;records.push(...v,packed,assets.types[pi]);}left-=n;}expected.push(Uint32Array.from(records));}
  p.stage='placing';applyBatches(p);let restored=0;
  for(const cells of expected)for(let i=0;i<cells.length;){const until=performance.now()+15,end=Math.min(cells.length,i+5000*5);for(;i<end&&performance.now()<until;i+=5){const[x,y,z,packed,type]=cells.subarray(i,i+5);if(type)g.world.setBlock(x,y,z,1,true,packed&0xffffff,packed>>>24);else{if(g.world.getBlock(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8)))throw Error('Checkpoint overlaps a standard cell');g.world.setMicroBlock(x,y,z,packed&0xffffff,null,packed>>>24);}restored++;}await frame();}
  p.restoreImporter();p.stage='verifying';let mismatch=0,checked=0;
  for(const cells of expected)for(let i=0;i<cells.length;){const end=Math.min(cells.length,i+40000*5);for(;i<end;i+=5){const[x,y,z,packed,type]=cells.subarray(i,i+5),actual=type?{color:g.world.getBlockColor(x,y,z),materialId:g.world.getBlockMaterial(x,y,z)}:g.world.getMicroBlock(x,y,z);if(!actual||actual.color!==(packed&0xffffff)||(actual.materialId||0)!==(packed>>>24))mismatch++;checked++;}await frame();}
  p.verification={checked,mismatch,restored,source:'Verified committed AssemblyScript checkpoint prefix, restored and read back in the native renderer before filming',validationAtRestore:p.validationAtRestore,blueprintSha256:assets.blueprintSha256};if(mismatch)throw Error('Native checkpoint readback mismatch');
  for(let i=0;i<5;i++){const e=team.entities[i],old=cp.robots[i],state=structuredClone(old.state);state.pending=[];state.pendingIds="";state.pendingCells="";state.loadedJob=-1;state.loadedPage=-1;state.nextPageRequest=0;e.syncComponentStatesFromWorker({root:state});e.scriptRuntimeClient.reset(e.getSerializableComponentStates());e.position.set(...old.position);e.updateTransform();e.capturePreviousEntityTransforms();e.scriptRuntime=Math.max(state.nextStatus||0,state.nextClaim||0,state.releaseRetry||0);e.scriptError=null;e.nodeScriptErrors.clear();}
  p.checkpointName=name;p.checkpoint=cp;p.clock=Math.max(...team.entities.map(e=>e.scriptRuntime));await prepare(p);await g.world.preloadTerrainAoi(5390,660);team.start();return p.status();
 };
 while(!(window as any).offlineSurfaceStatus?.complete)await new Promise(r=>setTimeout(r,200));
 g.world.fixedTerrainCenter={cx:Math.floor(5390/16),cz:Math.floor(660/16)};
 await g.world.preloadTerrainAoi(5390,660);
 p.stage='ready';return p;
}
