import * as THREE from 'three';
export function install(p:any){
 const g=p.g,c=g.controller,phys=g.playerPhysics;
 const clear=()=>{for(const k of Object.keys(c.keys))c.keys[k]=false;};
 const sample=(t:number)=>{
  if(t-(p.lastCircleSample??-1)<.10)return;p.lastCircleSample=t;
  const e=p.entity,pr=phys.position,layer=g.world.distantSurface;
  p.circleSamples.push({t,player:pr.toArray(),playerVelocity:phys.velocity.toArray(),isFlying:phys.isFlying,perspective:c.perspective,cameraYaw:c.yaw,cameraPitch:c.pitch,distance:c.thirdPersonDistance,position:e.position.toArray(),rotation:e.quaternion.toArray(),velocity:e.velocity.toArray(),playerScreen:pr.clone().add(new THREE.Vector3(0,1,0)).project(c.camera).toArray(),droneScreen:e.position.clone().project(c.camera).toArray(),fov:c.camera.fov,status:e.scriptStatus,error:e.scriptError,states:e.getSerializableComponentStates(),near:g.world.getTerrainAoiLoadProgress(),pending:layer.hasPendingWork,terrainEdits:p.terrainEdits.length,fps:g.currentFps});
 };
 p.prepareCircle=(height=128)=>{clear();phys.position.set(8251,height,1041.5);phys.velocity.set(0,0,0);phys.isFlying=true;phys.resetRenderInterpolation();c.setPerspective('third_person',false);c.thirdPersonDistance=28;c.yaw=-.75+Math.PI/4;c.pitch=-.52;p.cleanTravel(true);g.uiStore.selectTool('brush');};
 p.circleTake=(seconds=55)=>{
  const s=(window as any).offlineSurfaceStatus;if(!s.complete||s.mode!=='full'||s.error)throw Error('Full unique terrain required');
  p.circleSamples=[];p.lastCircleSample=-1;
  p.frame(seconds,(t:number)=>{
   clear();const moving=t>=.5&&t<44.5;
   const travel=Math.min(44,Math.max(0,t-.5));
   c.yaw=-.75+Math.PI/4+2*Math.PI*travel/44;
   c.pitch=-.52-.06*Math.sin(Math.PI*travel/44);
   c.thirdPersonDistance=28;
   if(moving){c.keys.forward=true;c.keys.right=true;}
   sample(t);
  },clear);
  return true;
 };
 p.takeoffTake=(seconds=10)=>{p.circleSamples=[];p.lastCircleSample=-1;p.frame(seconds,(t:number)=>{clear();phys.isFlying=true;c.keys.jump=t>=.5&&t<3.0;c.yaw=-.75+Math.PI/4;c.pitch=-.52;c.thirdPersonDistance=28;sample(t);},clear);};
 return true;
}
