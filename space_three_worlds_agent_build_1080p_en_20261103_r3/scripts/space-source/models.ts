import type {PortableEntity,PortableComponent,PortableVoxel} from '../../engine/src/storage/InventoryTypes.ts';
import {buildChinook} from '../vlog-chinook-r04/model.ts';
type V=[number,number,number];
class Grid {
 cells=new Map<string,{x:number,y:number,z:number,c:number,m:number}>();
 shape(lo:V,hi:V,test:(x:number,y:number,z:number)=>boolean,col:number|((x:number,y:number,z:number)=>number),mat=0){
  for(let x=Math.floor(lo[0]*8);x<Math.ceil(hi[0]*8);x++)for(let y=Math.floor(lo[1]*8);y<Math.ceil(hi[1]*8);y++)for(let z=Math.floor(lo[2]*8);z<Math.ceil(hi[2]*8);z++){
   const a=(x+.5)/8,b=(y+.5)/8,c=(z+.5)/8;if(test(a,b,c))this.cells.set(`${x},${y},${z}`,{x,y,z,c:typeof col==='number'?col:col(a,b,c),m:mat});
  }
 }
 box(p:V,s:V,c:number,mat=0){this.shape(p.map((a,i)=>a-s[i]/2) as V,p.map((a,i)=>a+s[i]/2) as V,()=>true,c,mat);}
 blocks():PortableVoxel[]{const groups=new Map<string,any[]>();for(const c of this.cells.values()){const k=[c.x,c.y,c.z].map(a=>Math.floor(a/8)).join(',');const a=groups.get(k)||[];a.push(c);groups.set(k,a);}
  const out:PortableVoxel[]=[];for(const[k,a]of groups){const[dx,dy,dz]=k.split(',').map(Number);if(a.length===512&&a.every(c=>c.c===a[0].c&&c.m===a[0].m)){out.push({dx,dy,dz,color:a[0].c,materialId:a[0].m});continue;}
   for(const c of a){if([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].every(d=>this.cells.has(`${c.x+d[0]},${c.y+d[1]},${c.z+d[2]}`)))continue;
    out.push({dx,dy,dz,mx:c.x-dx*8,my:c.y-dy*8,mz:c.z-dz*8,size:.125,color:c.c,materialId:c.m});}}
 return out;}
}
function component(id:string,name:string,g:Grid,position:V=[0,0,0]):PortableComponent{return{id,name,pivot:[0,0,0],localPosition:position,body:{type:'kinematic',mass:1,useGravity:false,collisionEnabled:false},blocks:g.blocks(),children:[],seats:[],decorations:[],scriptLanguage:'assemblyscript'};}

const attitude=`
const right: f64[] = self.localToWorldDirection([1,0,0]);
const up: f64[] = self.localToWorldDirection([0,1,0]);
const back: f64[] = self.localToWorldDirection([0,0,1]);
const axLocal: f64 = Math.cos(ctx.rotation[1])*ax-Math.sin(ctx.rotation[1])*az;
const azLocal: f64 = Math.sin(ctx.rotation[1])*ax+Math.cos(ctx.rotation[1])*az;
const desiredPitch: f64 = Math.max(-maxTilt,Math.min(maxTilt,Math.atan2(azLocal,gravity)));
const desiredRoll: f64 = Math.max(-maxTilt,Math.min(maxTilt,-Math.atan2(axLocal,gravity)));
const angular: f64[] = ctx.angularVelocity;
const wx: f64 = angular[0]*right[0]+angular[1]*right[1]+angular[2]*right[2];
const wz: f64 = angular[0]*back[0]+angular[1]*back[1]+angular[2]*back[2];
let headingError: f64 = heading-ctx.rotation[1];
while(headingError>Math.PI)headingError-=Math.PI*2;
while(headingError<-Math.PI)headingError+=Math.PI*2;
const tx: f64 = mass*(attitudeK*(desiredPitch-ctx.rotation[0])-attitudeD*wx);
const tz: f64 = mass*(attitudeK*(desiredRoll-ctx.rotation[2])-attitudeD*wz);
const ty: f64 = mass*(yawK*headingError-yawD*angular[1]);
self.body.applyTorque([right[0]*tx+back[0]*tz, right[1]*tx+back[1]*tz+ty, right[2]*tx+back[2]*tz]);
const liftAccel: f64 = Math.max(-8.0,Math.min(14.0,(targetY-ctx.position[1])*3.0-ctx.velocity[1]*3.8));
const thrust: f64 = Math.max(0.0,mass*(gravity+liftAccel)/Math.max(0.55,up[1]));
self.body.applyLocalForce([0,thrust,0]);
self.body.applyForce([-ctx.velocity[0]*mass*0.12,0,-ctx.velocity[2]*mass*0.12]);
self.state.setNumber("targetPitch",desiredPitch);self.state.setNumber("targetRoll",desiredRoll);
self.state.setNumber("pitch",ctx.rotation[0]);self.state.setNumber("roll",ctx.rotation[2]);
self.state.setNumber("height",ctx.position[1]);self.state.setNumber("targetHeight",targetY);
`;
export const chinookCode=`// Simplified dynamic flight: gravity, tilted lift and attitude torque.
const mass: f64=ctx.mass, gravity: f64=Math.abs(ctx.gravity[1]), dt: f64=ctx.deltaTime;
if(!self.state.getBoolean("ready")){self.state.setBoolean("ready",true);self.state.setNumber("homeY",ctx.position[1]);self.state.setNumber("heightTarget",ctx.position[1]);self.state.setNumber("heading",ctx.rotation[1]);}
if(!ctx.driver.isNull){
const ahead: f64=(ctx.input.down("KeyW")?1.0:0.0)-(ctx.input.down("KeyS")?1.0:0.0);
const turn: f64=(ctx.input.down("KeyA")?1.0:0.0)-(ctx.input.down("KeyD")?1.0:0.0);
const climb: f64=(ctx.input.down("Space")?1.0:0.0)-(ctx.input.down("Shift")?1.0:0.0);
const heading: f64=self.state.getNumber("heading")+turn*0.22*dt;
const targetY: f64=Math.max(self.state.getNumber("homeY"),self.state.getNumber("heightTarget")+climb*3.5*dt);
self.state.setNumber("heading",heading);self.state.setNumber("heightTarget",targetY);
const ax: f64=Math.max(-3.0,Math.min(3.0,(-Math.sin(heading)*ahead*8.0-ctx.velocity[0])*1.1));
const az: f64=Math.max(-3.0,Math.min(3.0,(-Math.cos(heading)*ahead*8.0-ctx.velocity[2])*1.1));
const maxTilt: f64=0.22, attitudeK: f64=65.0, attitudeD: f64=55.0, yawK: f64=65.0, yawD: f64=65.0;
${attitude}
}
`;

export function chinook():PortableEntity{const e=buildChinook();e.root.name='AETHER 47 | Agent-built transport';e.root.body={type:'dynamic',mass:12000,useGravity:true,collisionEnabled:true,friction:.75,restitution:0};e.root.script=chinookCode;return e;}

export const roverCode=`// Four independent terrain ray springs with velocity damping.
const mass: f64=ctx.mass;
const velocity: f64[]=ctx.velocity, angular: f64[]=ctx.angularVelocity;
const right: f64[]=self.localToWorldDirection([1,0,0]);
const forward: f64[]=self.localToWorldDirection([0,0,-1]);
const xs: f64[]=[-1.75,1.75,-1.75,1.75], zs: f64[]=[-2.125,-2.125,2.125,2.125];
const ids: string[]=["wheel_fl","wheel_fr","wheel_rl","wheel_rr"];
let contacts: f64=0.0;
const speed: f64=velocity[0]*forward[0]+velocity[2]*forward[2];
const throttle: f64=ctx.driver.isNull?0.0:(ctx.input.down("KeyW")?1.0:0.0)-(ctx.input.down("KeyS")?1.0:0.0);
const steer: f64=ctx.driver.isNull?0.0:(ctx.input.down("KeyA")?1.0:0.0)-(ctx.input.down("KeyD")?1.0:0.0);
const braking: bool=ctx.driver.isNull||ctx.input.down("Space");
// Forward is -Z: negative local-X rotation cancels translation at the contact patch.
const spin: f64=self.state.getNumber("wheelSpin")-speed/0.8125*ctx.deltaTime;
self.state.setNumber("wheelSpin",spin);
for(let i:i32=0;i<4;i++){
 const offset:f64[]=self.localToWorldDirection([xs[i],0,zs[i]]);
 const origin:f64[]=[ctx.position[0]+offset[0],ctx.position[1]+offset[1]+0.6,ctx.position[2]+offset[2]];
 const hit:Value=ctx.world.raycast(origin,[0,-1,0],3.1);
 let extension:f64=1.3;
 if(!hit.isNull){
  extension=Math.max(0.25,Math.min(1.3,hit.getNumber("distance")-0.6-0.8125));
  const compression:f64=1.15-extension;
  const pointVelocity:f64=velocity[1]+angular[2]*offset[0]-angular[0]*offset[2];
  const force:f64=Math.max(0.0,Math.min(18000.0,compression*18000.0-pointVelocity*2600.0));
  if(compression>0.0){self.applyForceAt([0,force,0],[xs[i],0,zs[i]]);contacts+=1.0;}
 }
 const wheel=self.child(ids[i]);
 if(wheel!==null){wheel.setLocalPosition([xs[i],-extension,zs[i]]);wheel.setLocalEuler([spin,i<2?steer*0.35:0.0,0]);}
 self.state.setNumber("extension"+i.toString(),extension);
}
if(contacts>0.0){
 const lateral:f64=velocity[0]*right[0]+velocity[2]*right[2];
 const drive:f64=Math.max(-9000.0,Math.min(9000.0,((braking?0.0:throttle*6.0)-speed)*mass*(braking?3.0:1.5)));
 const side:f64=-lateral*mass*3.5;
 self.applyForceAt([forward[0]*drive+right[0]*side,0,forward[2]*drive+right[2]*side],[0,-0.7,0]);
}
const yawRate:f64=steer*Math.max(-0.65,Math.min(0.65,speed*0.12));
self.body.applyTorque([-angular[0]*mass*2.8,(yawRate-angular[1])*mass*5.0,-angular[2]*mass*2.8]);
self.state.setNumber("contacts",contacts);self.state.setNumber("speed",speed);
self.state.setNumber("steeringAngle",steer*0.35);
`;

export function rover():PortableEntity{
 const g=new Grid(),sand=0xc19146,dark=0x806333,light=0xe5c27b,black=0x222b2c;
 g.box([0,-.25,0],[2.75,.5,5.75],black);g.box([0,.125,0],[3.0,.5,5.5],sand);
 g.box([0,.625,-1.875],[2.75,.625,1.75],sand);g.box([0,1,-1.6],[2.5,.125,1.5],light);
 g.box([0,.75,1.875],[2.75,.75,1.25],sand);g.box([0,1.875,.25],[2.625,.125,3.125],light);
 for(const side of [-1,1]){
  g.box([side*1.25,.875,.1],[.125,1.5,3.25],sand);
  g.box([side*1.32,1.1,-.3],[.125,.625,1.875],0x3f6f7d,80);
  g.box([side*1.5,-.0625,0],[.375,.25,2.5],black);
  for(const z of [-2.125,2.125]){g.box([side*1.55,.35,z],[.625,.25,1.875],black);g.box([side*1.55,.49,z],[.625,.125,1.5],sand);}
  g.box([side*.875,.625,-2.8],[.625,.375,.125],0xfff6de,1);
  g.box([side*1.1,.625,2.7],[.25,.375,.125],0xe94432,1);
 }
 g.box([0,1.13,-1.35],[2.375,.625,.125],0x3f6f7d,80);
 g.box([0,1.13,1.5],[2.375,.625,.125],0x3f6f7d,80);
 g.box([0,.25,-2.95],[3.0,.25,.375],black);g.box([0,.25,2.95],[3,.25,.375],black);
 for(let i=-3;i<=3;i++)g.box([i*.1875,.625,-2.85],[.125,.375,.125],black);
 g.box([-.625,.35,-.2],[.75,.125,.75],black);g.box([-.625,.65,.2],[.75,.75,.125],black);
 g.box([.625,.35,-.2],[.75,.125,.75],black);g.box([.625,.65,.2],[.75,.75,.125],black);
 g.box([0,.7,-.9],[2.25,.25,.25],black);
 for(const x of [-.9,.9])g.box([x,2.0,.2],[.125,.125,2.5],black);
 for(const x of [-1.25,1.25])for(const z of [-1.25,1.5])g.box([x,1.25,z],[.125,1.25,.125],sand);
 const root=component('chassis','NATURE TRAIL | Independent suspension',g);delete root.localPosition;root.body={type:'dynamic',mass:800,useGravity:true,collisionEnabled:true,friction:.4,restitution:0};root.script=roverCode;
 root.seats=[{position:[-.625,-.17,-.2],rotation:[0,0,0,1],fixedOrientation:true}];
 for(const [i,id]of ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].entries()){
  const w=new Grid();w.shape([-.375,-.8125,-.8125],[.375,.8125,.8125],(_x,y,z)=>y*y+z*z<.8125*.8125,(_x,y,z)=>Math.floor(Math.atan2(y,z)*8)%2===0?0x252d2e:0x374143);
  for(const side of [-1,1]){w.shape([side*.375-.0625,-.375,-.375],[side*.375+.0625,.375,.375],(_x,y,z)=>y*y+z*z<.375*.375,0xa3a6a0);w.box([side*.44,0,0],[.125,.1875,.1875],black);}
  root.children.push(component(id,id.replaceAll('_',' '),w,[i%2?1.75:-1.75,-1.0,i<2?-2.125:2.125]));
 }
 return{type:'space-entity',version:8,root,constraints:[]};
}

export const droneCode=`// Follow a real player with an offset. Tilt redirects lift; no pose animation.
const mass:f64=ctx.mass,gravity:f64=Math.abs(ctx.gravity[1]);
if(!self.state.getBoolean("ready")){self.state.setBoolean("ready",true);self.state.setNumber("targetX",ctx.position[0]);self.state.setNumber("targetY",ctx.position[1]+3.0);self.state.setNumber("targetZ",ctx.position[2]);}
let targetX:f64=self.state.getNumber("targetX"),targetY:f64=self.state.getNumber("targetY"),targetZ:f64=self.state.getNumber("targetZ");
let pvx:f64=0.0,pvz:f64=0.0;
let following:bool=false;
// The recorded solo world selects its local player explicitly.
for(let i:i32=0;i<ctx.players.length;i++){
 const player:Value=ctx.players.at(i);
 if(!player.getBoolean("isLocal"))continue;
 const feet:Value=player.get("feetPosition");
 if(feet.isNull)continue;
 const p:f64[]=feet.asVector();
 targetX=p[0]+2.5;targetY=p[1]+3.2;targetZ=p[2]+3.5;
 const v:Value=player.get("velocity");
 if(!v.isNull){const speed:f64[]=v.asVector();pvx=speed[0];pvz=speed[2];}
 following=true;break;
}
// If the player disappears, hold the last target and brake to a hover.
const heading:f64=0.0;
const ax:f64=Math.max(-4.0,Math.min(4.0,(targetX-ctx.position[0])*1.2+(pvx-ctx.velocity[0])*1.8));
const az:f64=Math.max(-4.0,Math.min(4.0,(targetZ-ctx.position[2])*1.2+(pvz-ctx.velocity[2])*1.8));
const maxTilt:f64=0.32,attitudeK:f64=10.0,attitudeD:f64=7.0,yawK:f64=7.0,yawD:f64=5.0;
${attitude}
self.state.setNumber("targetX",targetX);self.state.setNumber("targetZ",targetZ);
self.state.setNumber("targetY",targetY);self.state.setBoolean("followingPlayer",following);
`;

export function drone():PortableEntity{
 const g=new Grid(),blue=0x427987,edge=0x75b1bd,black=0x212c32;
 g.box([0,.125,0],[1.25,.5,1.5],blue);g.box([0,.4375,0],[1,.125,1.25],edge);
 for(const x of [-1,1])for(const z of [-1,1]){g.box([x*.875,.125,z*.875],[1.0,.25,.25],black);g.box([x*1.25,.125,z*.625],[.25,.25,.75],blue);g.box([x*.625,-.3125,z*.5],[.125,.625,.125],black);g.box([x*.625,-.625,z*.5],[.375,.125,.375],black);}
 g.box([0,.0625,-.875],[.5,.375,.375],black);g.box([0,.0625,-1.125],[.25,.25,.125],0x69d6de,1);
 const root=component('airframe','COPPER SCOUT | Tilt-controlled quadcopter',g);delete root.localPosition;root.body={type:'dynamic',mass:12,useGravity:true,collisionEnabled:true,friction:.8,restitution:0};root.script=droneCode;
 for(let i=0;i<4;i++){const r=new Grid();r.box([0,0,0],[.25,.375,.25],0xa2adb2);r.box([0,.25,0],[1.75,.125,.1875],black);r.box([0,.25,0],[.1875,.125,1.75],black);r.box([-.75,.25,0],[.25,.125,.1875],0xc9cfbc);r.box([.75,.25,0],[.25,.125,.1875],0xc9cfbc);const n=component('rotor_'+i,'Rotor '+(i+1),r,[i%2?1.375:-1.375,.25,i<2?-1.125:1.125]);n.script=`self.setLocalSpin([0,1,0],${i===0||i===3?390:-390});`;root.children.push(n);}
 return{type:'space-entity',version:8,root,constraints:[]};
}
