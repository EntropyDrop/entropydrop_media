/** Sample a 1.8 m × 3.2 m × 2.2 m vehicle envelope against the real native voxel stores. */
export async function audit(p:any){
 const w=p.g.world,conflicts:any[]=[],routes:any[]=[];let checked=0;
 for(const road of p.manifest.roads){if(road.kind==='street')continue;let distance=0,next=3,samples=0,hits=0;
  for(let i=1;i<road.points.length-1;i++){const a=road.points[i],prev=road.points[i-1],b=road.points[i+1];distance+=Math.hypot(a[0]-prev[0],a[2]-prev[2]);if(distance<next)continue;next+=2;
   const l=Math.hypot(b[0]-prev[0],b[2]-prev[2]),tx=(b[0]-prev[0])/l,tz=(b[2]-prev[2])/l;
   for(const lane of road.direction==='forward'?[0]:[road.width/4,-road.width/4]){samples++;let blocked=false;
    for(const side of [-.9,0,.9])for(const forward of [-1.6,0,1.6])for(const up of [.5,1,1.7,2.7]){
     const x=5390+a[0]-tz*(lane+side)+tx*forward,z=660+a[2]+tx*(lane+side)+tz*forward,y=a[1]+up;checked++;
     const std=w.getBlock(Math.floor(x),Math.floor(y),Math.floor(z)),micro=w.getMicroBlock(Math.floor(x*8),Math.floor(y*8),Math.floor(z*8));
     if(std||micro){blocked=true;if(conflicts.length<40)conflicts.push({road:road.id,lane,at:[x,y,z],station:distance,standard:std,micro});}
    }if(blocked)hits++;
   }
  }routes.push({road:road.id,vehicleSamples:samples,blockedSamples:hits});await new Promise(r=>setTimeout(r,0));
 }
 p.driveClearance={scope:'Native static voxel envelope; no vehicle physics or traffic simulation',envelope:{width:1.8,length:3.2,height:2.2,bottomAboveRoad:.5},checked,routes,conflicts,passed:routes.every(r=>r.blockedSamples===0)};return p.driveClearance;
}
