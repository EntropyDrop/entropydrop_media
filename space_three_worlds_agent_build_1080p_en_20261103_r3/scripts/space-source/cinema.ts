export function install(p:any){
 const g=p.g,c=g.controller;
 g.uiStore.setDistantSurfaceEnabled(true,false);
 p.edits=[];p.terrainEdits=[];p.telemetry=[];
 const act=c.performBasicAction.bind(c);
 c.performBasicAction=(a:any)=>{const r=act(a);if(a.domain!=='query')p.edits.push({t:performance.now(),domain:a.domain,action:a.action,ok:r?.ok,removed:r?.removed,placed:r?.placed});return r};
 for(const n of ['setBlock','setMicroBlock','removeMicroBlock']){const f=g.world[n]?.bind(g.world);if(f)g.world[n]=(...a:any[])=>{p.terrainEdits.push({method:n,args:a.slice(0,5)});return f(...a);};}
 p.frame=(seconds:number,fn:any,done:any=()=>{})=>{if(p.animation)cancelAnimationFrame(p.animation);p.running=true;const epoch=performance.now();function f(now:number){const t=(now-epoch)/1000;fn(Math.min(t,seconds),Math.min(1,t/seconds));if(t<seconds)p.animation=requestAnimationFrame(f);else{p.running=false;done();}}p.animation=requestAnimationFrame(f);return true;};
 p.tour=(pos:number[],yaw=2.45,pitch=-.12,seconds=42)=>{c.setPerspective('first_person',true);p.pose(pos,[pos[0],pos[1],pos[2]-10]);p.frame(seconds,(t:number,q:number)=>{c.yaw=yaw+Math.PI*2*q;c.pitch=pitch;});};
 p.walk=(a:number[],b:number[],target:number[],seconds:number)=>p.frame(seconds,(_t:number,q:number)=>{q=q*q*(3-2*q);p.pose(a.map((x,i)=>x+(b[i]-x)*q),target);});
 p.inspect=(radius:number,height:number,seconds:number=40,angle:number=.8,sweep:number=Math.PI*2)=>{c.setPerspective('first_person',true);const center=p.entity.position.clone();p.frame(seconds,(_t:number,q:number)=>{const a=angle+sweep*q;p.pose([center.x+Math.sin(a)*radius,center.y+height,center.z+Math.cos(a)*radius],[center.x,center.y,center.z]);});};
 p.keys=(keys:string[])=>{c.entityInputDown.clear();for(const k of keys)c.entityInputDown.add(k);};
 p.drive=(segments:any[],seconds:number,followOffset=.5)=>{
  const epoch=performance.now();p.driveEpoch=epoch;
  p.frame(seconds,(t:number)=>{p.keys(segments.find((s:any)=>t>=s[0]&&t<s[1])?.[2]||[]);
   const e=p.entity,q=e.quaternion;c.yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z))+followOffset;c.pitch=-.22;
   if(!p.lastSample||performance.now()-p.lastSample>200){p.lastSample=performance.now();p.telemetry.push({t,position:e.position.toArray(),rotation:[q.x,q.y,q.z,q.w],velocity:e.velocity.toArray(),fov:c.camera.fov,projection:c.camera.projectionMatrix.elements[5],distance:c.camera.position.distanceTo(c._cameraSession.getEyePosition()),status:e.scriptStatus,error:e.scriptError,driving:c.isDriving,states:e.getSerializableComponentStates()});}
  },()=>p.keys([]));
 };
 p.followDrone=(seconds:number=86)=>{p.frame(seconds,(t:number)=>{const v=p.entity.position;const angle=.8+.45*Math.sin(t/28);p.pose([v.x+Math.sin(angle)*8,v.y+3,v.z+Math.cos(angle)*8],[v.x,v.y,v.z]);if(!p.lastSample||performance.now()-p.lastSample>200){p.lastSample=performance.now();p.telemetry.push({t,position:v.toArray(),rotation:p.entity.quaternion.toArray(),velocity:p.entity.velocity.toArray(),states:p.entity.getSerializableComponentStates(),status:p.entity.scriptStatus,error:p.entity.scriptError});}});};
 p.status=()=>{const e=p.entity;return{surface:(window as any).offlineSurfaceStatus,entity:e?{position:e.position.toArray(),status:e.scriptStatus,error:e.scriptError,states:e.getSerializableComponentStates()}:null,terrainEdits:p.terrainEdits.length,edits:p.edits,driving:c.isDriving,perspective:c.perspective,fps:g.currentFps};};
 return p.status();
}
