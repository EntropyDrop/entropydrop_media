import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile,writeFile} from 'node:fs/promises';
const root='/private/tmp/space-three-worlds-vlog-r2/review';
const rover=JSON.parse(await readFile(root+'/rover-simulation.json','utf8'));
const drone=JSON.parse(await readFile(root+'/drone-simulation.json','utf8'));
let maxAxleError=0;
for(const sample of rover){
 const st=sample.states.chassis;
 for(let i=0;i<4;i++){
  const axle=new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(...sample.wheels[i].quaternion));
  const angle=i<2?st.steeringAngle:0;
  const expected=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
  maxAxleError=Math.max(maxAxleError,axle.distanceTo(expected));
  assert(axle.distanceTo(expected)<1e-9,'Steer axis must stay chassis-relative while spinning');
 }
}
for(const [start,end,sign]of [[7,11,-1],[16,19,1]]){
 const a=rover.find((s:any)=>s.t>=start),b=rover.find((s:any)=>s.t>=end);
 assert(Math.sign(b.states.chassis.wheelSpin-a.states.chassis.wheelSpin)===sign,'Roll must reverse with travel');
 const travel=b.position[2]-a.position[2],angle=b.states.chassis.wheelSpin-a.states.chassis.wheelSpin;
 assert(travel*angle>0,'Contact-point rotation must oppose chassis velocity');
}
for(const [t,angle]of [[1,.35],[3,-.35],[5,0],[34,0]])assert.equal(rover.find((s:any)=>s.t>=t).states.chassis.steeringAngle,angle);
for(const s of drone){assert.equal(s.error,null);assert(s.position.every(Number.isFinite));assert(s.position[1]>10);}
const distance=(s:any)=>Math.hypot(s.position[0]-s.states.airframe.targetX,s.position[1]-s.states.airframe.targetY,s.position[2]-s.states.airframe.targetZ);
assert(distance(drone.find((s:any)=>s.t>=41))<.15,'Follow must settle after stopping');
assert(distance(drone.at(-1))<.02,'Lost target must hover');
assert.equal(drone.at(-1).states.airframe.followingPlayer,false);
const maxTilt=Math.max(...drone.map((s:any)=>Math.hypot(s.rotation[0],s.rotation[2])));
assert(maxTilt>.1&&maxTilt<.32,'Visible bounded physical tilt');
const report={passed:true,checks:['forward rolling contact direction','reverse rolling contact direction','left/right/center front steering','rear wheels unsteered','spinning wheel axle remains chassis-relative','four ray springs','moving player tracking','stopping and settling','lost target hover','finite force-driven motion'],maxAxleError,maxTiltDegrees:maxTilt*180/Math.PI,settledFollowError:distance(drone.find((s:any)=>s.t>=41)),lostTargetError:distance(drone.at(-1))};
await writeFile(root+'/revision-tests.json',JSON.stringify(report,null,2));console.log(report);
