import {MicroGrid,pick} from './grid.ts';
export interface BridgeOptions {kind:'core'|'ramp'|'street';seed?:number;level?:number;horizontalScale?:number;heightScale?:number}
export const BRIDGE={moduleLength:12,width:7.75,carriagewayWidth:5,height:5.5,rampRise:1.375,rampCount:4,grade:1.375/12,minimumClearance:4.375};
const stone=[0xa7a18e,0xb7ae99,0x959886,0xbcb39f],iron=0x4b5b57,cap=0xb4a382;
const mod=(a:number,b:number)=>(a%b+b)%b;
const masonry=(x:number,y:number,z:number)=>mod(Math.floor(y*8),4)===0||mod(Math.floor((x+z)*8)+Math.floor(y*2)%2*4,8)===0?0x838575:pick(stone,Math.floor(x+z),Math.floor(y*2),0,91);
export const bridgePresets=[
 {id:'11_overpass_core',name:'双层跨线立交 · 主桥',description:'石砌桥墩、双侧纵梁与金属护栏，上下层道路正交分离。',options:{kind:'core' as const,seed:111}},
 ...Array.from({length:4},(_,i)=>({id:`${12+i}_ramp_${i+1}`,name:`缓坡引道 · 第 ${i+1} 段`,description:'12米拼接模块，上升1.375米；四段接至主桥，另一侧旋转180度。',options:{kind:'ramp' as const,level:i,seed:111}})),
 {id:'bridge_lower_street',name:'立交下层道路衔接模块',description:'与主桥下层街道连续连接的深基础道路模块。',options:{kind:'street' as const,seed:111}},
];
function deck(g:MicroGrid,height:(x:number)=>number,seed:number,sidewalk=true){
 for(let ix=-48;ix<48;ix++)for(let iz=-31;iz<31;iz++){
  const x=(ix+.5)/8,z=(iz+.5)/8,base=Math.round(height(x)*8),d=Math.abs(z);let top:number,color:number;g.part='deck';
  if(d<2.5){const course=Math.floor(iz/5),u=ix+mod(course,2)*3,joint=mod(iz,5)===0||mod(u,7)===0;color=joint?0x858679:pick([0x969682,0xa5a08b,0x8b9182,0xaba38d],Math.floor(u/7),course,0,seed);top=d<1.25?2:1;}
  else if(d<2.75){g.part='drain';color=0x606e64;top=0;}
  else if(d<3){g.part='curb';color=mod(ix,8)===0?0x878b7b:stone[1];top=3;}
  else{g.part='sidewalk';color=mod(ix,4)===0||mod(iz,4)===0?0x91917e:stone[1];top=2;}
  for(let y=base-3;y<=base+top;y++)g.set(ix,y,iz,y<base?0x8f9486:color);
 }
 g.part='girders';for(let ix=-48;ix<48;ix++){const h=Math.round(height((ix+.5)/8)*8);for(const iz of [-25,-24,23,24])for(let y=h-6;y<h-3;y++)g.set(ix,y,iz,iron);}
 g.part='rails';for(const z of [-3.75,3.75]){
  for(let x=-5.875;x<6;x+=1.5){const y=Math.round(height(x)*8)/8;g.box([x-.0625,y+.375,z-.0625],[x+.0625,y+1.5,z+.0625],iron);g.box([x-.125,y+1.5,z-.125],[x+.125,y+1.625,z+.125],cap);}
  for(let ix=-48;ix<48;ix++){const x=ix/8,y=Math.round(height(x+.0625)*8)/8;for(const dy of [.875,1.375])g.box([x,y+dy,z-.0625],[x+.125,y+dy+.125,z+.0625],iron);}
 }
}
function lowerStreet(g:MicroGrid,seed:number){
 g.part='lower_road';for(let x=-31;x<31;x++)for(let z=-48;z<48;z++){
  const d=Math.abs((x+.5)/8),top=d<2.5?(d<1.25?2:1):d<2.75?0:d<3?3:2;
  const col=d<2.5?(mod(x,5)===0||mod(z+Math.floor(x/5)%2*3,7)===0?0x858679:pick(stone,Math.floor(x/5),Math.floor(z/7),0,seed)):d<2.75?0x606e64:stone[1];
  for(let y=-24;y<=top;y++)g.set(x,y,z,y<0?0x858576:col);
 }
}
export function generateBridge(options:BridgeOptions){
 const {kind,seed=111,level=0,horizontalScale=1,heightScale=1}=options,g=new MicroGrid();const finish=(id:string,name:string)=>{g.scale(horizontalScale,heightScale,horizontalScale);return g.export(id,name,true);};if(!Number.isInteger(level)||level<0||level>3)throw Error('Ramp level must be 0..3');
 if(kind==='street'){lowerStreet(g,seed);return finish('bridge_lower_street','立交下层道路衔接模块');}
 const height=(x:number)=>kind==='core'?BRIDGE.height:(level+(x+6)/12)*BRIDGE.rampRise;
 deck(g,height,seed);
 if(kind==='core'){
  // Lower street runs north/south; piers stand outside its sidewalks.
  lowerStreet(g,seed);
  g.part='piers';for(const x of [-5,5])for(const z of [-2.75,2.75]){
   g.box([x-.625,-3,z-.625],[x+.625,-.375,z+.625],masonry);
   g.box([x-.375,-.375,z-.375],[x+.375,4.625,z+.375],masonry);
   g.box([x-.625,4.625,z-.625],[x+.625,5.125,z+.625],stone[1]);
  }
  for(const x of [-5,5])g.box([x-.5,4.75,-3.5],[x+.5,5.125,3.5],stone[0]);
 }else{
  g.part='ramp_support';for(const x of [-4,4])for(const z of [-2.75,2.75]){
   const y=height(x)-.375;g.box([x-.375,-3,z-.375],[x+.375,y,z+.375],masonry);g.box([x-.5,y-.25,z-.5],[x+.5,y+.125,z+.5],stone[1]);
  }
 }
 const preset=bridgePresets.find(p=>p.options.kind===kind&&(kind==='core'||('level' in p.options && p.options.level===level)))!;return finish(preset.id,preset.name);
}
export function interchangeLayout(horizontalScale=1,heightScale=1){
 const parts:{assetId:string;position:[number,number,number];rotationY:number}[]=[{assetId:'11_overpass_core',position:[0,0,0],rotationY:0}];
 for(let i=0;i<4;i++)for(const side of [-1,1])parts.push({assetId:`${12+i}_ramp_${i+1}`,position:[side*(48-i*12),0,0],rotationY:side<0?0:Math.PI});
 for(const z of [-12,12])parts.push({assetId:'bridge_lower_street',position:[0,0,z],rotationY:0});
 for(const p of parts){p.position[0]*=horizontalScale;p.position[2]*=horizontalScale;}
 return {id:'overpass',name:'双层跨线立交与缓坡引道',bounds:[108*horizontalScale,10.125*heightScale,36*horizontalScale],profile:{horizontalScale,heightScale},spec:{...BRIDGE,moduleLength:12*horizontalScale,width:7.75*horizontalScale,height:5.5*heightScale,rampRise:1.375*heightScale,grade:BRIDGE.grade*heightScale/horizontalScale,minimumClearance:Math.floor(BRIDGE.minimumClearance*heightScale*8)/8},parts,notes:'Style prototype. Grade-separated crossing, not a full four-way interchange with turning slip roads. Ramps reach grade at both ends; vehicle navigation and terrain-fit acceptance remain pending.'};
}
