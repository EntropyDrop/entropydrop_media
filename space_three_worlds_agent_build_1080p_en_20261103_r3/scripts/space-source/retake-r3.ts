import * as THREE from 'three';
export function install(p:any){
 const g=p.g,c=g.controller;
 const css=document.createElement('style');css.id='retake-clean-pointer';css.textContent='html,body,body *{cursor:none!important}';document.head.appendChild(css);
 p.cleanTravel=(on:boolean)=>{p.travelClean=on;document.querySelector<HTMLElement>('#crosshair')?.style.setProperty('display',on?'none':'');};
 if(!p.visibilityWrapped){const f=g.sceneRenderer.setPlayerAvatarVisible.bind(g.sceneRenderer);g.sceneRenderer.setPlayerAvatarVisible=(v:boolean,h:boolean)=>f(v,p.travelClean?false:h);p.visibilityWrapped=true;}
 p.cleanTravel(true);
 p.sequence=(seconds:number,events:any[],step:any=()=>{})=>{let next=0;p.frame(seconds,(t:number,q:number)=>{while(next<events.length&&t>=events[next][0])events[next++][1]();step(t,q);});};
 p.toolbarTake=()=>{p.cleanTravel(false);p.pose([8265,108,1060],[8240,100,1022]);c.setPerspective('first_person',false);p.sequence(34,[[0,()=>g.uiStore.selectTool('selector')],[3,()=>g.uiStore.selectTool('hammer')],[5,()=>g.uiStore.selectTool('wrench')],[8,()=>g.uiStore.selectTool('shovel')],[10,()=>g.uiStore.selectTool('spoon')],[12.6,()=>g.uiStore.selectTool('brush')],[15,()=>g.uiStore.selectTool('modeling')],[24,()=>g.uiStore.selectTool('selector')]]);};
 p.refineTake=()=>{p.cleanTravel(false);p.stop();c.setPerspective('first_person',false);const e=p.entity;const aim=(z:number)=>p.pose([e.position.x+5,e.position.y-2.05,e.position.z+z],[e.position.x+1.6875,e.position.y-.4375,e.position.z+z]);
 p.sequence(33,[[0,()=>{g.uiStore.selectTool('spoon');aim(-1.0625);}],[14,()=>c.performBasicAction({domain:'entity',action:'remove-micro',target:{contraption:e,nodeId:e.rootComponentId},micro:[13,-4,-9]})],[22.1,()=>{g.uiStore.selectTool('brush');aim(3.0625);g.uiStore.openColorPicker();}],[24.6,()=>{g.uiStore.selectPresetColor(4);g.uiStore.closeColorPicker();}],[26,()=>c.performBasicAction({domain:'entity',action:'paint-micro',target:{contraption:e,nodeId:e.rootComponentId},micro:[13,-4,24],color:13809509})],[28.5,()=>p.pose([e.position.x+9,e.position.y+1,e.position.z+7],[e.position.x,e.position.y,e.position.z])]]);};
 p.controlsTake=()=>{p.cleanTravel(true);p.sequence(31,[[0,()=>g.uiStore.openCodeEditor(p.entity)],[11.5,()=>{g.uiStore.closeAllModals(false);const e=p.entity;p.pose([e.position.x+2,e.position.y-1.5,e.position.z-9],[e.position.x-.625,e.position.y-.95,e.position.z-6.625]);}],[17,()=>p.mount()]]);};
 p.scenicDrive=(segments:any[],seconds:number)=>{p.telemetry=[];p.lastSample=0;p.frame(seconds,(t:number)=>{p.keys(segments.find((s:any)=>t>=s[0]&&t<s[1])?.[2]||[]);c.yaw=.9+.12*Math.sin(t/15);c.pitch=-.23;
 if(performance.now()-p.lastSample>150){p.lastSample=performance.now();const e=p.entity;p.telemetry.push({t,position:e.position.toArray(),rotation:e.quaternion.toArray(),velocity:e.velocity.toArray(),fov:c.camera.fov,perspective:c.perspective,driving:c.isDriving,states:e.getSerializableComponentStates(),status:e.scriptStatus,error:e.scriptError});}},()=>p.keys([]));};
 p.prepareFlightFollow=()=>{if(c.isDriving)c.toggleDriveVehicle();for(const k of Object.keys(c.keys))c.keys[k]=false;g.playerPhysics.position.set(8251,93,1041.5);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.isFlying=false;g.playerPhysics.resetRenderInterpolation();c.setPerspective('third_person',false);c.setThirdPersonDistance(15);c.yaw=-.75;c.pitch=-.27;g.uiStore.selectTool('brush');p.cleanTravel(true);};
 p.flightFollow=(phase:number,seconds:number)=>{
  p.telemetry=[];p.lastSample=0;let toggled=false;
  const ease=(t:number,a:number,b:number)=>{let q=Math.max(0,Math.min(1,(t-a)/(b-a)));return q*q*(3-2*q);};
  p.frame(seconds,(t:number)=>{
   for(const k of ['forward','backward','left','right','jump','sprint','crouch'])c.keys[k]=false;
   if(phase===1){
    if(t>=3&&!toggled){toggled=true;const now=performance.now();c.handleKeyDown(new KeyboardEvent('keydown',{code:'Space'}));c.handleKeyUp(new KeyboardEvent('keyup',{code:'Space'}));c.handleKeyDown(new KeyboardEvent('keydown',{code:'Space'}));}
    if(t>=3&&t<3.65)c.keys.jump=true;
    if(t>=11.5&&t<12.08)c.keys.forward=true;
    c.yaw=-.75+2.55*ease(t,17,seconds-1);c.pitch=-.27-.11*Math.sin(Math.PI*ease(t,15,seconds));
   }else{
    c.yaw=1.8+Math.PI*2*ease(t,0,seconds-1);c.pitch=-.27-.14*Math.sin(Math.PI*ease(t,0,seconds));
    if(t>=14&&t<14.5)c.keys.right=true;
    if(t>=23&&t<23.28)c.keys.jump=true;
   }
   if(!p.lastSample||performance.now()-p.lastSample>=100){p.lastSample=performance.now();const e=p.entity,pr=g.playerPhysics.position,eye=pr.clone().add(new THREE.Vector3(0,1,0));const ep=e.position.clone();const pp=eye.project(c.camera);const dp=ep.project(c.camera);
    p.telemetry.push({t,player:pr.toArray(),playerVelocity:g.playerPhysics.velocity.toArray(),isFlying:g.playerPhysics.isFlying,onGround:g.playerPhysics.isOnGround,perspective:c.perspective,cameraYaw:c.yaw,cameraPitch:c.pitch,position:e.position.toArray(),rotation:e.quaternion.toArray(),velocity:e.velocity.toArray(),playerScreen:pp.toArray(),droneScreen:dp.toArray(),fov:c.camera.fov,states:e.getSerializableComponentStates(),status:e.scriptStatus,error:e.scriptError});
   }
  },()=>{for(const k of Object.keys(c.keys))c.keys[k]=false;});
 };
 return true;
}
