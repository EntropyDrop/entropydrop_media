// Record real on-foot physics input and the standard third-person player camera.
export function install(p:any){
 const g=p.g,c=g.controller;
 p.prepareCharacter=(feet:number[],yaw=.1)=>{
  if(c.isDriving)c.toggleDriveVehicle();
  for(const k of Object.keys(c.keys))c.keys[k]=false;
  g.playerPhysics.position.set(...feet);g.playerPhysics.velocity.set(0,0,0);
  g.playerPhysics.isFlying=false;g.playerPhysics.resetRenderInterpolation();
  c.setPerspective('third_person',false);c.setThirdPersonDistance(10);c.yaw=yaw;c.pitch=-.22;
  g.uiStore.selectTool('brush');return p.status();
 };
 p.walkTest=(segments:any[],seconds:number)=>{
  p.telemetry=[];
  p.frame(seconds,(t:number)=>{
   const active=segments.find((s:any)=>t>=s[0]&&t<s[1]);
   for(const k of ['forward','backward','left','right','jump','sprint','crouch'])c.keys[k]=false;
   for(const k of active?.[2]||[])c.keys[k]=true;
   if(!p.lastSample||performance.now()-p.lastSample>100){p.lastSample=performance.now();const e=p.entity;
    p.telemetry.push({t,player:g.playerPhysics.position.toArray(),playerVelocity:g.playerPhysics.velocity.toArray(),isFlying:g.playerPhysics.isFlying,onGround:g.playerPhysics.isOnGround,perspective:c.perspective,position:e.position.toArray(),rotation:e.quaternion.toArray(),velocity:e.velocity.toArray(),fov:c.camera.fov,states:e.getSerializableComponentStates(),status:e.scriptStatus,error:e.scriptError});
   }
  },()=>{for(const k of Object.keys(c.keys))c.keys[k]=false;});
 };
 return true;
}
