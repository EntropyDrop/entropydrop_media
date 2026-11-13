import {installTeam} from './runtime.ts';
import {origin,plan} from './plan.ts';
export async function setup(g:any){
 if(!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local development capture only');
 g.uiStore.startGame(false);g.uiStore.setLightingQuality('ultra',false);g.uiStore.setShadowsEnabled(true,false);g.uiStore.setResolutionScale(1,false);g.uiStore.setRenderDistance(16,false);
 g.uiStore.setDistantSurfaceEnabled(true,false);
 for(const[k,v]of Object.entries({subdivisionSizePx2:1,renderDistanceChunks:2048,dataBudgetMiB:1024,geometryBudgetMiB:512,torusBackfaceCulling:false}))g.uiStore.setDistantSurfaceSetting(k,v,false);
 const diag=document.getElementById('dev-render-diagnostics');if(diag)diag.style.display='none';
 const style=document.createElement('style');style.textContent='*{cursor:none!important}';document.head.appendChild(style);
 const team=await installTeam(g.contraptionManager);
 const c=g.controller,p:any={g,c,team,plan,samples:[],running:false};
 p.pose=(pos:number[],target:number[])=>{p.fixedCamera={pos,target};g.playerPhysics.isFlying=true;g.playerPhysics.position.set(origin[0]+78,40,origin[1]);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();};
 c.setPerspective('first_person',false);c.setFov(55);
 c.updateCameraPosition=()=>{if(p.fixedCamera){c.camera.position.set(...p.fixedCamera.pos);c.camera.up.set(0,1,0);c.camera.lookAt(...p.fixedCamera.target);c.camera.updateMatrixWorld();}};
 p.pose([origin[0]+36,54,origin[1]+64],[origin[0]+34,18,origin[1]]);
 p.start=()=>{p.started=performance.now();team.start();};
 p.status=()=>({surface:(window as any).offlineSurfaceStatus,robots:team.snapshot(),fps:g.currentFps});
 p.frame=(duration:number,fn:(t:number)=>void)=>{p.running=true;const start=performance.now();const step=()=>{if(!p.running)return;const t=(performance.now()-start)/1000;fn(Math.min(t,duration));if(t<duration)requestAnimationFrame(step);else p.running=false;};requestAnimationFrame(step);};
 p.orbit=(center:number[],radius:number,y:number,seconds:number,start=0,turn=Math.PI*2)=>p.frame(seconds,t=>{const a=start+turn*t/seconds;p.pose([center[0]+Math.sin(a)*radius,y,center[2]+Math.cos(a)*radius],center);});
 p.follow=(index:number,seconds:number,range=12)=>p.frame(seconds,t=>{const e=team.entities[index],v=e.position;const a=.6+t*.05;p.pose([v.x+Math.sin(a)*range,v.y+range*.55,v.z+Math.cos(a)*range],[v.x,v.y+1,v.z]);});
 p.walk=(from:number[],to:number[],look:number[],seconds:number)=>p.frame(seconds,t=>{const f=t/seconds;p.pose(from.map((n,i)=>n+(to[i]-n)*f),look);});
 p.pause=(index:number)=>team.pause(index);
 setInterval(()=>{team.setClock(p.started?(performance.now()-p.started)/1000:0);if(p.started)p.samples.push({t:(performance.now()-p.started)/1000,robots:team.snapshot()});},1000);
 (window as any).city=p;return p.status();
}
