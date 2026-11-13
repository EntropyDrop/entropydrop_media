import {TerrainGenerator} from '../../engine/src/worldgen/TerrainGenerator.ts';
import {generateHouse,generateRoad,housePresets} from './architecture/generate.ts';
import {generateTree,treePresets} from './architecture/landscape.ts';
import {generateBridge,interchangeLayout} from './architecture/bridges.ts';
export type Cell=[number,number,number,number,number]; // integer micro-coordinate, colour, material
export const origin=[5330,660],terrain=new TerrainGenerator(20260827,1);
export const height=(x:number,z:number)=>terrain.sampleHeight(Math.floor(x),Math.floor(z))+1;
export const roles=['surveyor','road','builder_a','builder_b','planter'];
export const colors=[0xece7cd,0xee862e,0x3e7dbc,0x4cbbb9,0x7eaa49];
export const names=['ATLAS · Survey Drone','PAVER · Road Drone','MASON A · Builder Drone','MASON B · Builder Drone','GROVE · Planting Drone'];
const snap=(n:number)=>Math.round(n*8)/8;
const bounds=(m:any)=>{const b=m.root.blocks;return{lo:[0,1,2].map(i=>Math.min(...b.map((v:any)=>[v.dx+v.mx/8,v.dy+v.my/8,v.dz+v.mz/8][i]))),hi:[0,1,2].map(i=>Math.max(...b.map((v:any)=>[v.dx+v.mx/8,v.dy+v.my/8,v.dz+v.mz/8][i]))+.125)}};
function place(m:any,x:number,y:number,z:number,angle=0):Cell[]{const c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle));return m.root.blocks.map((b:any)=>{const u=b.dx*8+b.mx+.5,v=b.dz*8+b.mz+.5;return [Math.round(x*8+u*c+v*s-.5),Math.round(y*8+b.dy*8+b.my),Math.round(z*8-u*s+v*c-.5),b.color,b.materialId||0] as Cell}).filter((b:Cell)=>(b[1]+.5)/8>=height((b[0]+.5)/8,(b[2]+.5)/8));}
const sorted=(cells:Cell[],axis='y')=>cells.sort((a,b)=>axis==='x'?a[0]-b[0]||a[1]-b[1]||a[2]-b[2]:a[1]-b[1]||a[2]-b[2]||a[0]-b[0]);
export const bridgeCenter=[5444,20,660];
// One continuous grade envelope keeps the five connected approach modules compatible.
const terrainLine=Array.from({length:61},(_,i)=>Math.max(...Array.from({length:9},(_,j)=>height(origin[0]+i,origin[1]+j-4))));
const grade=(x:number)=>snap(Math.max(20-Math.abs(x-(origin[0]+60))*.125,...terrainLine.map((h,i)=>h+.125-Math.abs(x-(origin[0]+i))*.125)));
export const roadProfiles=Array.from({length:5},(_,i)=>({kind:'straight' as const,finish:(['cobble','cobble','brick','brick','slate'] as const)[i],seed:701+i,moduleLength:12,carriagewayWidth:5,sidewalkWidth:.875,crown:.25,paverLength:7+(i%2),paverWidth:5}));
export const roads:Cell[][]=roadProfiles.map((p,i)=>{
 const m=generateRoad(p),cells:Cell[]=[];
 for(const b of m.root.blocks){const x=origin[0]+i*12+6+b.dx+b.mx/8,z=origin[1]+b.dz+b.mz/8,y=grade(x)+b.dy+b.my/8;if(y+.0625>=height(x,z))cells.push([Math.round(x*8),Math.round(y*8),Math.round(z*8),b.color,b.materialId||0]);}
 return sorted(cells,'x');
});
const bridgeParts=interchangeLayout().parts.sort((a,b)=>a.position[0]-b.position[0]||a.position[2]-b.position[2]);
const bridgeCells:Cell[]=[];for(const p of bridgeParts){const kind=p.assetId==='11_overpass_core'?'core':p.assetId==='bridge_lower_street'?'street':'ramp',level=kind==='ramp'?Number(p.assetId.slice(0,2))-12:0;bridgeCells.push(...sorted(place(generateBridge({kind,level,seed:111}),bridgeCenter[0]+p.position[0],bridgeCenter[1],bridgeCenter[2]+p.position[2],p.rotationY),'x'));}roads.push(bridgeCells);
export const plots=housePresets.map((p,i)=>{
 const side=i%2===0?-1:1,column=Math.floor(i/2),x=origin[0]+14+column*24,z=origin[1]+side*19;
 const options={...p.options,seed:1101+i*137,widthScale:[1.05,.95,1.08,.92,1.0,1.04][i],depthScale:[.95,1.08,1,1.04,.93,1.02][i],heightScale:[1.0,1.02,.96,1.02,1.04,.98][i],roofRiseScale:[1.05,.92,1.08,1,1.04,.95][i]};
 const model=generateHouse(options),b=bounds(model);let y=0;for(let dx=Math.floor(b.lo[0])-1;dx<=Math.ceil(b.hi[0])+1;dx++)for(let dz=Math.floor(b.lo[2])-1;dz<=Math.ceil(b.hi[2])+1;dz++)y=Math.max(y,height(x+dx,z+dz));
 return{id:i,x,y:y+.125,z,side,segment:1+column*2,angle:side<0?Math.PI:0,options,model,kind:p.options.kind,name:p.name};
});
const roadOwned=new Set(roads.flat().map(c=>c.slice(0,3).join(',')));
export const houses:Cell[][]=plots.map(p=>{
 const cells=place(p.model,p.x,p.y,p.z,p.angle),doorDirection=-p.side;
 // A narrow approach joins the front door to the public street, without flattening its surroundings.
 for(let n=4;n<16;n++)for(let dx=-1;dx<=1;dx++){const x=p.x+dx,z=p.z+doorDirection*n,base=Math.max(height(x,z),p.y-Math.max(0,n-4)*.25);for(let mx=0;mx<8;mx++)for(let mz=0;mz<8;mz++)cells.push([x*8+mx,Math.round(base*8),z*8+mz,0xb5ad99,0]);}
 const unique=new Map(cells.map(c=>[c.slice(0,3).join(','),c]));return sorted([...unique.values()].filter(c=>!roadOwned.has(c.slice(0,3).join(','))));
});
export const treeInstances:any[]=[];
export const trees:Cell[][]=plots.map((p,i)=>{
 const cells:Cell[]=[];for(let j=0;j<2;j++){
  const preset=treePresets[(i+j*3)%6],seed=2101+i*73+j*19,options={...preset.options,seed,height:snap(preset.options.height!*(j?.96:1.04)),crownScale:j?.88:1.02};
  const x=p.x+(j?8.5:-8.5),z=p.z+p.side*8,y=height(x,z),model=generateTree(options),a=(i+j)%4*Math.PI/2;
  const bb=bounds(model),r=Math.max(...[bb.lo[0],bb.hi[0],bb.lo[2],bb.hi[2]].map(Math.abs));if(Math.abs(z-origin[1])-r<4.5)throw Error('Tree encroaches on road');
  treeInstances.push({plot:i,x,y,z,angle:a,options,radius:r});cells.push(...place(model,x,y,z,a));
 }return sorted(cells);
});
export const bases=[-20,-10,2,14,26].map((dz,i)=>[origin[0]-9,height(origin[0]-9,origin[1]+dz)+[15,9,11,12,10][i],origin[1]+dz]);
export const surveyCells=[...new Map([...roads,...houses,...trees].flat().map(c=>{const p=c.slice(0,3).map(n=>Math.floor(n/8));return[p.join(','),p]})).values()];
export const plan={version:2,origin,bridgeCenter,plots:plots.map(({model,...p})=>p),roadProfiles,treeInstances,roads,houses,trees,bases,roles,microSize:.125,allRobotsAreDrones:true,resources:"unlimited",noHauler:true};
