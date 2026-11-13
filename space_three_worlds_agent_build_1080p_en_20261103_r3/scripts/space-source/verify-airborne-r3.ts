import * as THREE from 'three';
import {writeFile} from 'node:fs/promises';
import {ContraptionManager} from '../../engine/src/contraption/ContraptionManager.ts';
import {ContraptionPhysics} from '../../engine/src/physics/ContraptionPhysics.ts';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
import {rover,drone,chinook} from './models.ts';
const name=process.argv[2]||'drone';
const floor=(x:number,z:number)=>name==='rover'&&z< -12&&z> -15&&x>0?10.5:10;
const world:any={getBlock:(x:number,y:number,z:number)=>y<floor(x,z)&&y>=0?1:0,
 getBlockMaterial:()=>0,getBlockColor:()=>0x6c8352,
 raycast:(origin:any,dir:any,maxDistance:number)=>{const h=floor(origin.x,origin.z),distance=(h-origin.y)/dir.y;if(dir.y>=0||distance<0||distance>maxDistance)return{hit:false};return{hit:true,kind:'standard',hitPos:{x:origin.x,y:h,z:origin.z},normal:{x:0,y:1,z:0},distance,block:1,color:0x6c8352};},
 raycastMicro:()=>({hit:false}),microVoxels:{get:()=>null,getForStdCell:()=>null,getLoadedStdCells:()=>[]},
};
const manager=new ContraptionManager(new THREE.Scene(),world,null,null);
manager.physics=new ContraptionPhysics(world);
const make=({rover,drone,chinook} as any)[name],model=make(),parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);
const entity=manager.buildFromSlot(parsed.item,new THREE.Vector3(0,10+(name==='chinook'?2.625:name==='rover'?1.8:.6875),0),null,false)!;
await entity.scriptRuntimeClient.ready();
manager.activeDrivable=name==='drone'?null:entity;
let tickTime=0;
const playerAt=(t:number)=>{const ramp=(a:number,b:number)=>Math.max(0,Math.min(b-a,t-a)); const y=10+14*ramp(3,3.65)+14*ramp(32,32.28); const x=14*ramp(25,25.5),z=-14*ramp(11.5,12.08);return {id:'local',isLocal:true,feetPosition:[x,y,z],position:[x,y+1.62,z],velocity:[t>=25&&t<25.5?14:0,(t>=3&&t<3.65)||(t>=32&&t<32.28)?14:0,t>=11.5&&t<12.08?-14:0]};};
manager.runtimeContextProvider=()=>({players:tickTime<42?[playerAt(tickTime)]:[],driver:name==='drone'?null:{entityId:entity.publicId,playerId:'test',componentId:entity.rootComponentId,seatIndex:0}});
entity.enableAllNodeScripts();
const samples:any[]=[];const length=name==='drone'?50:35;
for(let i=0;i<length*20;i++){
 const t=i*.05;tickTime=t;const down=name==='rover'?(t<2?['KeyA','Space']:t<4?['KeyD','Space']:t<6?['Space']:t<12?['KeyW']:t<15?['Space']:t<20?['KeyS']:t<23?['Space']:t<27?['KeyW','KeyA']:t<31?['KeyW','KeyD']:['Space']):name==='chinook'?(t<5?['Space']:t<15?['KeyW']:t<20?['KeyW','KeyA']:[]):[];
 manager.update(.05,{down,pressed:[],released:[]});
 if(i%2===0)samples.push({t,player:playerAt(t),wheels:entity.rootComponentId?['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(id=>{const n=entity.entityNodes.get(id);return n?{id,quaternion:n.localQuaternion.toArray()}:null;}):[],position:entity.position.toArray(),velocity:entity.velocity.toArray(),rotation:new THREE.Euler().setFromQuaternion(entity.quaternion,'YXZ').toArray().slice(0,3),status:entity.scriptStatus,error:entity.scriptError,states:entity.getSerializableComponentStates()});
 if(entity.scriptError)throw Error(entity.scriptError);
 if(!entity.position.toArray().every(Number.isFinite)||entity.position.y< -10||entity.position.y>2000)throw Error('Unstable physics');
 if(i%100===0)await new Promise(r=>setTimeout(r,0));
}
await writeFile('/private/tmp/drone-airborne-r3-simulation.json',JSON.stringify(samples,null,2));
console.log(JSON.stringify({name,samples:samples.length,minY:Math.min(...samples.map(s=>s.position[1])),maxY:Math.max(...samples.map(s=>s.position[1])),maxTilt:Math.max(...samples.map(s=>Math.hypot(s.rotation[0],s.rotation[2])))}));
const tail=samples.at(-1),st=tail.states.airframe;const error=Math.hypot(tail.position[0]-st.targetX,tail.position[1]-st.targetY,tail.position[2]-st.targetZ);if(error>.1)throw Error('Airborne tracking failed to settle: '+error);console.log('Airborne tracking settled error',error);entity.dispose();
