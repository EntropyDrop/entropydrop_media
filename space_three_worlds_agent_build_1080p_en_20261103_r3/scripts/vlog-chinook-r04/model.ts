import { createChinook } from '../../client/tools/nature-chinook/model.ts';
export const origin = [8229,80.625,1022];
export const flightCode = `// Arcade flight prototype: only the mounted pilot receives input.
const dt: f64 = ctx.deltaTime;
const piloted: bool = !ctx.driver.isNull;
const forward: f64 = piloted ? (ctx.input.down("KeyW") ? 1 : 0) - (ctx.input.down("KeyS") ? 1 : 0) : 0;
const turn: f64 = piloted ? (ctx.input.down("KeyA") ? 1 : 0) - (ctx.input.down("KeyD") ? 1 : 0) : 0;
const lift: f64 = piloted ? (ctx.input.down("Space") ? 1 : 0) - (ctx.input.down("Shift") ? 1 : 0) : 0;
let speed: f64 = self.state.getNumber("speed");
let climb: f64 = self.state.getNumber("climb");
speed += (forward * 12.0 - speed) * Math.min(1.0, dt * 2.4);
climb += (lift * 5.0 - climb) * Math.min(1.0, dt * 3.0);
let yaw: f64 = self.state.getNumber("heading", ctx.rotation[1]);
yaw += turn * 0.20 * dt;
const p: f64[] = ctx.position;
if (!self.state.getBoolean("initialized")) {
  self.state.setNumber("landingHeight", p[1]);
  self.state.setBoolean("initialized", true);
}
let y: f64 = Math.max(self.state.getNumber("landingHeight"), p[1] + climb * dt);
self.setLocalPosition([p[0] - Math.sin(yaw) * speed * dt, y, p[2] - Math.cos(yaw) * speed * dt]);
self.setLocalEuler([0.0, yaw, 0.0]);
self.state.setNumber("speed", speed);
self.state.setNumber("climb", climb);
self.state.setNumber("heading", yaw);
self.state.setBoolean("pilotPresent", piloted);
if (ctx.tick % 40 == 0 && piloted) ctx.log("Pilot active | speed " + speed.toString() + " | altitude " + y.toString());`;
export function buildChinook(stage=4){
 const m=createChinook(),root=m.root;
 root.name='CH-47 Workshop | Pilot Controlled';
 root.script=flightCode;
 // Hollow the cabin for a usable first-person cockpit; existing glazing becomes transparent.
 root.blocks=root.blocks.filter(b=>{
  const s=b.size||1,x=b.dx+(b.mx||0)/8+s/2,y=b.dy+(b.my||0)/8+s/2,z=b.dz+(b.mz||0)/8+s/2;
  return [0x234b58,0x91b4bc].includes(b.color as number) || !(Math.abs(x)<1.4 && y>-.92 && y<1.12 && z>-7.5 && z<6.65);
 }).map(b=>({...b,materialId:[0x234b58,0x91b4bc].includes(b.color as number)?87:b.materialId}));
 root.seats=[{position:[-.625,-.95,-6.625],rotation:[0,0,0,1],fixedOrientation:true}];
 const decor=(id:string,p:number[],s:number[],color:number,mat=0)=>root.decorations!.push({id,position:p,scale:s,color,materialId:mat});
 // Visible instrument console and two cushions; these are visual decoration blocks.
 decor('console',[0,.15,-7.65],[2.0,.2,.35],0x202a32);
 for(const side of [-1,1]){
  decor('seat_'+side,[side*.625,-.18,-6.12],[.75,.2,.75],0x313b32);
  decor('back_'+side,[side*.625,.2,-5.74],[.75,.75,.18],0x313b32);
  decor('display_'+side,[side*.5,.27,-7.64],[.36,.06,.28],0x53d9c5,1);
 }
 for(const n of root.children)n.script=`self.setLocalSpin([0, 1, 0], ${n.id==='aft_rotor'?-150:150});`;
 if(stage===1){root.blocks=root.blocks.filter(b=>b.dy<1&&b.dy>=-1&&b.dz>-6&&b.dz<6).map(b=>({...b,color:0x92989c,materialId:0}));root.children=[];root.decorations=[];root.seats=[];}
 if(stage===2){root.blocks=root.blocks.filter(b=>b.dy<2).map(b=>({...b,materialId:0}));root.children=[];root.decorations=[];root.seats=[];}
 if(stage===3)root.children=[];
 return m;
}

export function createParts(){
 const full=buildChinook(4),r=full.root;
 const bins:Record<string,any[]>={fuselage:[],shell:[],cockpit:[],gear:[],mounts:[]};
 for(const b of r.blocks){const size=b.size||1;const y=b.dy+(b.my||0)/8+size/2,z=b.dz+(b.mz||0)/8+size/2;
 const key=y< -1?'gear':y>=2?'mounts':z< -6?'cockpit':y<0?'fuselage':'shell';bins[key].push(b);}
 const names:Record<string,string>={fuselage:'01 Lower fuselage',shell:'02 Cabin shell',cockpit:'03 Glazed nose',gear:'04 Landing gear',mounts:'05 Towers and housings'};
 const parts:any[]=[];
 for(const [id,blocks] of Object.entries(bins))parts.push({key:id,offset:[0,0,0],model:{type:'space-entity',version:8,constraints:[],root:{...r,id,name:names[id],blocks,children:[],decorations:[],seats:[],script:''}}});
 for(const child of r.children)parts.push({key:child.id,offset:child.localPosition,model:{type:'space-entity',version:8,constraints:[],root:{...child,localPosition:undefined,script:'',name:child.id==='forward_rotor'?'06 Front rotor':'07 Rear rotor'}}});
 return parts;
}
