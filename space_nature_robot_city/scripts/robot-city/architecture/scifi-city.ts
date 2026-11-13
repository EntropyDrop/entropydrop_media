import {TerrainGenerator} from '../../../engine/src/worldgen/TerrainGenerator.ts';
import {generateTree,treePresets} from './landscape.ts';
import {hash} from './grid.ts';
import {buildRoadNetwork,stations,type Path} from './scifi-roads.ts';
export type Vec=[number,number,number];
export const center=[5390,660];
const terrain=new TerrainGenerator(20260827,1);
const heightCache=new Map<string,number>();
export const ground=(x:number,z:number)=>{x=Math.floor(center[0]+x);z=Math.floor(center[1]+z);const k=x+','+z;let h=heightCache.get(k);if(h===undefined){h=terrain.sampleHeight(x,z)+1;heightCache.set(k,h);}return h;};
const C={ivory:0xd4d6c9,white:0xe5e4d6,shadow:0xa5aaa3,dark:0x33464f,glass:0x3b7287,blue:0x43899b,light:0x83cddd,road:0x46515a,line:0xe4dfc2,yellow:0xd8ad54,walk:0xaeb3aa,leaf:0x688a49};
const key=(x:number,y:number,z:number)=>((x+2048)*4096+y)*4096+z+2048;
const unpack=(k:number):Vec=>{const z=k%4096-2048;k=Math.floor(k/4096);return [Math.floor(k/4096)-2048,k%4096,z];};
const snap=(n:number)=>Math.round(n*8)/8;
/** Native standard volumes with exposed eighth-metre architectural detailing. */
export class CityGrid {
 standard=new Map<number,number>();micro=new Map<number,number>();
 districtOverride=-1;family=1; // 0: road, 1: building/public structures, 2: planting. Metadata never changes voxel appearance.
 district(x:number,z:number){return (z<-12?0:z<60?2:4)+(x>=10?1:0);}
 tagged(x:number,z:number,color:number,mat:number){return ((color|(mat<<24))>>>0)+(this.family*6+(this.districtOverride<0?this.district(x,z):this.districtOverride))*2**32;}
 put(x:number,y:number,z:number,color:number,mat=0){if(y>=ground(x,z)&&y<240)this.standard.set(key(x,y,z),this.tagged(x,z,color,mat));}
 cell(x:number,y:number,z:number,color:number,mat=0){if(y/8>=ground(x/8,z/8)&&y<1920)this.micro.set(key(x,y,z),this.tagged(x/8,z/8,color,mat));}
 box(a:Vec,b:Vec,color:number,mat=0){for(let x=Math.round(a[0]*8);x<Math.round(b[0]*8);x++)for(let y=Math.round(a[1]*8);y<Math.round(b[1]*8);y++)for(let z=Math.round(a[2]*8);z<Math.round(b[2]*8);z++)this.cell(x,y,z,color,mat);}
 stdBox(a:Vec,b:Vec,color:number){for(let x=Math.floor(a[0]);x<Math.ceil(b[0]);x++)for(let y=Math.floor(a[1]);y<Math.ceil(b[1]);y++)for(let z=Math.floor(a[2]);z<Math.ceil(b[2]);z++)this.put(x,y,z,color);}
 finish(){
  const full=new Map<number,{n:number,c:number}>();
  for(const[k,c]of this.micro){const[x,y,z]=unpack(k),parent=key(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8));
   if(this.standard.has(parent)){this.micro.delete(k);continue;}
   if(c>>>24)continue;const a=full.get(parent);if(a)a.n++;else full.set(parent,{n:1,c});
  }
  for(const[k,a]of full)if(a.n===512)this.standard.set(k,a.c);
  for(const k of this.micro.keys()){const[x,y,z]=unpack(k);if(this.standard.has(key(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8))))this.micro.delete(k);}
  const enclosed:number[]=[];
  const occupied=(x:number,y:number,z:number)=>this.micro.has(key(x,y,z))||this.standard.has(key(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8)));
  for(const[k,c]of this.micro)if((c>>>24)<2){const[x,y,z]=unpack(k);if(occupied(x+1,y,z)&&occupied(x-1,y,z)&&occupied(x,y+1,z)&&occupied(x,y-1,z)&&occupied(x,y,z+1)&&occupied(x,y,z-1))enclosed.push(k);}
  for(const k of enclosed)this.micro.delete(k);
 }
 binary(){this.finish();const out=new Uint32Array((this.standard.size+this.micro.size)*5);let i=0;for(const [type,entries]of [[1,this.standard],[0,this.micro]] as const)for(const[k,c]of entries){const p=unpack(k),m=type===1?1:8;out[i++]=p[0]+center[0]*m;out[i++]=p[1];out[i++]=p[2]+center[1]*m;out[i++]=c;out[i++]=type;}return out;}
}
export interface TowerOptions {x:number;z:number;width:number;depth:number;floors:number;floorHeight:number;setbacks:number;style:'frame'|'terrace'|'spire'|'twin'|'court'|'hall';seed:number}
export const towers:TowerOptions[]=[];
function add(x:number,z:number,width:number,depth:number,floors:number,style:TowerOptions['style']){towers.push({x,z,width,depth,floors,style,floorHeight:2,setbacks:style==='spire'?5:3,seed:400+towers.length});}
// A compact centre with broad, deliberately different silhouettes. Every parcel is parameterized.
add(-8,-35,26,24,34,'spire');add(-8,-63,22,18,28,'frame');
add(-51,-37,26,22,28,'twin');add(-51,-62,22,18,23,'terrace');
add(-51,10,26,24,23,'terrace');add(-51,37,26,18,5,'hall');
add(33,-62,24,18,27,'frame');add(33,-36,24,22,25,'twin');
add(33,10,24,24,24,'terrace');add(33,37,24,16,6,'court');
add(52,-35,12,18,10,'frame');add(52,10,12,20,8,'court');
for(const [i,z]of [-95,-61,-35,9,34,64,94].entries())add(-96,z,20,i===5?10:18,6+i%4,['frame','court','terrace'][i%3] as any);
for(const [i,x]of [-51,-8,33,85].entries())add(x,-96,24,18,7+i%4,['court','frame','terrace'][i%3] as any);
for(const [i,z]of [-61,-34,10,36].entries())add(86,z,20,18,7+i%3,['court','terrace','frame'][i%3] as any);
for(const [i,x]of [-53,-10,32].entries())add(x,95,26,20,6+i,'court');
add(-53,64,26,10,5,'frame');add(-8,64,26,10,5,'terrace');add(33,64,24,10,4,'court');


const vegetation:any[]=[];
const shapeCache=new Map<string,any>();
function tree(g:CityGrid,x:number,y:number,z:number,index:number,roof=false){
 const previousFamily=g.family;g.family=2;
 const kind=treePresets[index%6].options.kind,height=roof?4:4.5+(index%4)*.65,crownScale=roof?.65:.7+(index%3)*.08;
 const k=kind+height+crownScale+(index%3);let model=shapeCache.get(k);
 if(!model){model=generateTree({kind,height,crownScale,seed:800+index%3});shapeCache.set(k,model);}
 for(const b of model.root.blocks)g.cell(Math.round((x+b.dx)*8+b.mx!),Math.round((y+b.dy)*8+b.my!),Math.round((z+b.dz)*8+b.mz!),b.color,b.materialId||0);
 vegetation.push({x,y,z,kind,height,crownScale,seed:800+index%3,roof});g.family=previousFamily;
}
function planter(g:CityGrid,x:number,y:number,z:number,w:number,d:number,seed:number,withTree=false){
 g.box([x-w/2,y,z-d/2],[x+w/2,y+.25,z+d/2],C.shadow);
 g.box([x-w/2+.125,y+.25,z-d/2+.125],[x+w/2-.125,y+.5,z+d/2-.125],0x69864c);
 for(let u=-w/2+.5;u<w/2;u++)g.box([x+u-.25,y+.5,z-.25],[x+u+.25,y+.75+(seed%3)*.125,z+.25],seed%2?0x91a45d:0x416d4b);
 if(withTree)tree(g,x,y+.5,z,seed,true);
}
function roof(g:CityGrid,x:number,z:number,w:number,d:number,y:number,seed:number,garden=true){
 g.stdBox([x-w/2,y-1,z-d/2],[x+w/2,y,z+d/2],C.shadow);
 for(const s of [-1,1]){
  g.box([x-w/2-.25,y,z+s*d/2-.125],[x+w/2+.25,y+.375,z+s*d/2+.125],C.white);
  g.box([x+s*w/2-.125,y,z-d/2-.25],[x+s*w/2+.125,y+.375,z+d/2+.25],C.white);
 }
 for(let j=0;j<Math.min(3,Math.floor(w/4));j++){
  g.stdBox([x-w/2+2+j*3,y,z-d/2+2],[x-w/2+4+j*3,y+1,z-d/2+4],C.dark);
  for(let l=0;l<4;l++)g.box([x-w/2+2+j*3,y+1,z-d/2+2+l*.5],[x-w/2+4+j*3,y+1.125,z-d/2+2.25+l*.5],C.shadow);
 }
 if(garden&&w>=10){
  planter(g,x-w/2+3,y,z+d/2-3,3,3,seed,true);planter(g,x+w/2-3,y,z+d/2-3,3,3,seed+1,true);
  if(w>=14){planter(g,x,y,z+d/2-2,w-8,2,seed+2,false);for(let j=0;j<4;j++)g.box([x-w/2+5+j*2,y+.75,z+d/2-2.25],[x-w/2+5.375+j*2,y+1,z+d/2-1.875],j%2?0xe1a8b8:0xd5b85a);}
  if(d>=14)planter(g,x-w/2+2,y,z,2,d-8,seed+3,false);
 }
}
function facade(g:CityGrid,x:number,z:number,w:number,d:number,y:number,levels:number,seed:number,frame=false){
 for(let f=0;f<levels;f++){
  const yy=y+f*2;
  for(let a=-w/2;a<w/2;a++)for(let b=-d/2;b<d/2;b++){
   if(a!==-w/2&&a!==w/2-1&&b!==-d/2&&b!==d/2-1)continue;
   const corner=(a===-w/2||a===w/2-1)&&(b===-d/2||b===d/2-1);
   const tint=hash(Math.floor(a/3),f,Math.floor(b/3),seed);
   const col=corner?C.ivory:(tint>.91?0xc5b77b:tint>.63?0x4f8193:tint>.25?0x315b71:0x254858);
   g.put(x+a,yy,z+b,col);g.put(x+a,yy+1,z+b,col);
  }
  // Thin projecting floor ledges; the glass remains the dominant facade surface.
  for(const s of [-1,1]){
   const zz=z+s*(d/2+.125),xx=x+s*(w/2+.125);
   g.box([x-w/2-.25,yy,zz],[x+w/2+.25,yy+.25,zz+.125],C.white);
   g.box([xx,yy,z-d/2-.25],[xx+.125,yy+.25,z+d/2+.25],C.white);
   for(let u=-w/2+2;u<w/2;u+=3)g.box([x+u-.125,yy+.25,zz-.0625],[x+u+.125,yy+2,zz+.0625],C.shadow);
   for(let u=-d/2+2;u<d/2;u+=3)g.box([xx-.0625,yy+.25,z+u-.125],[xx+.0625,yy+2,z+u+.125],C.shadow);
   if(f%5===2)g.box([x-w/2+.5,yy+.25,zz-.0625],[x+w/2-.5,yy+.375,zz+.0625],C.light,1);
  }
 }
 // Broad ivory corner frames and occasional doubled vertical fins.
 for(const a of [-1,1])for(const b of [-1,1]){
  g.stdBox([x+a*w/2-(a>0?1:0),y,z+b*d/2-(b>0?1:0)],[x+a*w/2+(a<0?1:0),y+levels*2,z+b*d/2+(b<0?1:0)],C.white);
  if(frame)g.box([x+a*w/2-.25,y,z+b*(d/2+.375)-.25],[x+a*w/2+.25,y+levels*2+.5,z+b*(d/2+.375)+.25],C.white);
 }
 if(frame)for(const s of [-1,1])g.box([x-w/2-.5,y+levels*2-1,z+s*(d/2+.25)-.25],[x+w/2+.5,y+levels*2,z+s*(d/2+.25)+.25],C.white);
}
function building(g:CityGrid,p:TowerOptions){
 const {x,z,width:w,depth:d,floors,style,seed}=p;
 const priorDistrict=g.districtOverride;g.districtOverride=g.district(x,z);
 let base=0;for(let xx=x-w/2-1;xx<x+w/2+1;xx++)for(let zz=z-d/2-1;zz<z+d/2+1;zz++)base=Math.max(base,ground(xx,zz));
 const y0=Math.ceil(base),y=y0+1,entryZ=[-76,-12,52,74].sort((a,b)=>Math.abs(a-z)-Math.abs(b-z))[0],entrySide=entryZ<z?-1:1;
 for(let xx=x-w/2-1;xx<x+w/2+1;xx++)for(let zz=z-d/2-1;zz<z+d/2+1;zz++)for(let yy=ground(xx,zz);yy<=y0;yy++)g.put(xx,yy,zz,C.shadow);
 facade(g,x,z,w,d,y,3,seed);roof(g,x,z,w,d,y+6,seed,false);
 const terraces:any[]=[];let roofY=y+floors*2;
 if(style==='twin'){
  const sw=Math.floor((w-6)/2/2)*2;
  for(const side of [-1,1]){const sx=x+side*(sw/2+2),sz=z+side*2,lev=floors-3-(side>0?4:0),sd=d-4;
   facade(g,sx,sz,sw,sd,y+6,lev,seed+side,true);roof(g,sx,sz,sw,sd,y+6+lev*2,seed+side);terraces.push({x:sx,z:sz,w:sw,d:sd,y:y+6+lev*2});}
  // Paired towers are tied by two sky-lobbies, leaving a readable central slot.
  for(const yy of [y+16,y+32])if(yy<roofY-8){g.stdBox([x-3,yy,z-2],[x+3,yy+3,z+2],C.glass);g.stdBox([x-3,yy+3,z-2],[x+3,yy+4,z+2],C.white);}
 }else if(style==='hall'){
  facade(g,x,z,w-4,d-4,y+6,2,seed);roofY=y+10;roof(g,x,z,w-4,d-4,roofY,seed,false);
  const r=(w-8)/2;
  for(let xx=-r;xx<=r;xx+=.125){const yy=roofY+Math.sqrt(Math.max(0,r*r-xx*xx))*.48;
   for(let zz=-d/2+4;zz<=d/2-4;zz+=.125)g.cell(Math.round((x+xx)*8),Math.round(yy*8),Math.round((z+zz)*8),Math.round((zz+d/2)*8)%16<2?C.white:C.blue);
  }
  roofY+=r*.48;
 }else{
  const n=style==='spire'?6:style==='terrace'?4:style==='court'?2:1;
  let done=3,prevW=w,prevD=d;
  for(let tier=0;tier<n;tier++){
   const lev=tier===n-1?floors-done:Math.floor((floors-3)/n),shrink=style==='spire'?tier*4+2:style==='terrace'?tier*2+2:2;
   const fw=Math.max(4,w-shrink),fd=Math.max(6,d-shrink),sx=style==='terrace'?x-tier%2:style==='court'?x-1:x,sz=style==='court'?z-1:z,yy=y+done*2;
   if(tier>0||fw<w){g.stdBox([x-prevW/2,yy-1,z-prevD/2],[x+prevW/2,yy,z+prevD/2],C.shadow);
    if(prevW-fw>=4&&prevD-fd>=4)planter(g,x,yy,z+prevD/2-1,Math.max(2,prevW-6),1.5,seed+tier,false);
    if(prevW-fw>=2&&prevD-fd>=2){for(const s of [-1,1])planter(g,x+s*(prevW/2-1.25),yy,z+prevD/2-2.5,1.5,3,seed+tier+s,style==='spire'&&tier%2===0);}
    terraces.push({x,z,w:prevW,d:prevD,y:yy});
   }
   facade(g,sx,sz,fw,fd,yy,lev,seed+tier,style==='frame'||style==='spire');
   done+=lev;prevW=fw;prevD=fd;
   if(tier===n-1)roof(g,sx,sz,fw,fd,y+done*2,seed);
  }
  if(style==='spire'){
   // Stepped buttresses climb the sides of the landmark, visibly different from a box tower.
   for(let level=0;level<28;level++)for(const s of [-1,1]){
    const xx=x+s*(w/2-1-Math.floor(level/5)*2),yy=y+level*2;
    g.stdBox([xx-1,yy,z+d/2-2-Math.floor(level/7)*2],[xx+1,yy+2,z+d/2-Math.floor(level/7)*2],C.white);
   }
   for(let j=0;j<5;j++)g.stdBox([x-2+(j>2?1:0),roofY+j*2,z-2+(j>2?1:0)],[x+2-(j>2?1:0),roofY+j*2+2,z+2-(j>2?1:0)],j%2?C.white:C.blue);
   g.box([x-.125,roofY+10,z-.125],[x+.125,roofY+18,z+.125],C.light,1);roofY+=18;
  }
 }
 // Warm shops, canopy, separate door and planted podium corners give the street a human scale.
 const doorZ=z+entrySide*d/2;
 for(let u=-w/2+2;u<w/2-1;u+=3){g.box([x+u-.75,y+.25,doorZ+entrySide*.125-.0625],[x+u+.75,y+1.75,doorZ+entrySide*.125+.0625],seed%3===0?0xb9cbd0:0xd7af65,seed%3===0?0:1);}
 g.box([x-2,y+2.5,Math.min(doorZ,doorZ+entrySide*2)],[x+2,y+2.75,Math.max(doorZ,doorZ+entrySide*2)],C.white);
 g.box([x-.75,y,doorZ+entrySide*.25-.125],[x+.75,y+2.25,doorZ+entrySide*.25+.125],C.dark);
 
 g.districtOverride=priorDistrict;return {...p,base:y0,height:roofY-y0,roof:roofY,entrySide,doorZ,terraces};
}
export type {Path} from './scifi-roads.ts';
const lerp=(a:Vec,b:Vec,t:number):Vec=>a.map((v,i)=>v+(b[i]-v)*t) as Vec;
function straight(a:Vec,b:Vec){const n=Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])*2);return Array.from({length:n+1},(_,i)=>lerp(a,b,i/n));}
function bezier(a:Vec,b:Vec,c:Vec,d:Vec){return Array.from({length:401},(_,i)=>{const t=i/400,s=1-t;return a.map((v,k)=>v*s*s*s+3*b[k]*s*s*t+3*c[k]*s*t*t+d[k]*t*t*t) as Vec;});}
function roads(g:CityGrid,blueprintPaths:Path[]){
 const paths=blueprintPaths.map(p=>{const points:Vec[]=[];for(let i=0;i<p.points.length-1;i++){const a=p.points[i],b=p.points[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.125));for(let j=0;j<n;j++)points.push(lerp(a,b,j/n));}points.push(p.points.at(-1)!);return {...p,points};});
 // Collapse flat interior 8×8 micro tiles into native 1 m deck blocks. Curves, paint and rails retain micro precision.
 const tiles=new Map<number,Map<number,number>>();
 for(const p of paths){let distance=0;const total=stations(p.points).at(-1)!;
  for(let i=0;i<p.points.length;i++){
   const a=p.points[i],b=p.points[Math.min(i+1,p.points.length-1)],prev=p.points[Math.max(i-1,0)],dx=b[0]-prev[0],dz=b[2]-prev[2],len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
   if(i)distance+=Math.hypot(a[0]-prev[0],a[2]-prev[2]);
   const width=p.width/2+(p.kind==='street'?1.5:0),y=Math.round(a[1]*8);
   for(let u=-width;u<=width;u+=.0625)for(const along of [-.125,-.0625,0,.0625,.125]){
    const x=Math.round((a[0]+nx*u+dx/len*along)*8),z=Math.round((a[2]+nz*u+dz/len*along)*8),edge=Math.abs(u)>p.width/2;
    let col=edge?C.walk:C.road;
    if(!edge&&p.kind==='street'&&Math.abs(u)<.13&&Math.floor(distance/2)%3!==0)col=C.line;
    if(!edge&&p.kind!=='street'){
     if(p.direction!=='forward'&&Math.abs(Math.abs(u)-.19)<.065)col=C.yellow;
     const lanes=p.direction==='forward'?[[0,1]]:[[p.width/4,1],[-p.width/4,-1]];
     for(const[offset,dir]of lanes){const phase=((dir>0?distance:total-distance)+28)%28,du=Math.abs(u-offset);if((phase>=2&&phase<6&&du<.13)||(phase>=6&&phase<8&&du<(8-phase)*.4))col=C.line;}
    }
    if(!edge&&Math.abs(Math.abs(u)-p.width/2+.3)<.08)col=C.line;
    if(p.kind==='street'&&!edge){const v=p.id.includes('-ns-')?a[2]:a[0],junctions=p.id.includes('-ns-')?[-76,-12,52,74]:[-77,-28,10,64];if(junctions.some(j=>Math.abs(Math.abs(v-j)-5)<1.25)&&Math.floor((u+3)*2)%2===0)col=C.line;}
    const k=key(Math.floor(x/8),y,Math.floor(z/8));let t=tiles.get(k);if(!t){t=new Map();tiles.set(k,t);}t.set(((x%8+8)%8)*8+(z%8+8)%8,col);
   }
  }
 }
 const supports:{road:string;kind:string;min:Vec;max:Vec}[]=[];
 const supportClear=(road:string,a:Vec,b:Vec)=>{
  const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,r=Math.hypot(b[0]-a[0],b[2]-a[2])/2;
  return towers.every(t=>Math.abs(x-t.x)>t.width/2+(b[0]-a[0])/2+.5||Math.abs(z-t.z)>t.depth/2+(b[2]-a[2])/2+.5)&&blueprintPaths.every(q=>q.id===road||q.points.every(v=>b[1]<=v[1]-.75||a[1]>=v[1]+5||Math.hypot(v[0]-x,v[2]-z)>q.width/2+r+.25));
 };
 const putSupport=(road:string,kind:string,a:Vec,b:Vec,color:number)=>{if(b[1]<=a[1])return;g.stdBox(a,b,color);supports.push({road,kind,min:a,max:b});};
 let compressedTiles=0;
 for(const[k,t]of tiles){const[x,y,z]=unpack(k),full=t.size===64&&y%8===0;
  if(full){const base=[...t.values()].filter(c=>c===C.walk).length>32?C.walk:C.road;g.put(x,y/8-1,z,base);compressedTiles++;
   for(const[i,col]of t)if(col!==base)g.cell(x*8+Math.floor(i/8),y,z*8+i%8,col);
  }else for(const[i,col]of t){g.cell(x*8+Math.floor(i/8),y,z*8+i%8,col);}
 }
 for(const p of paths){let dist=0,nextPier=5,nextPost=0,nextLamp=7;
  for(let i=0;i<p.points.length;i++){
   const a=p.points[i],b=p.points[Math.min(i+1,p.points.length-1)],prev=p.points[Math.max(i-1,0)],dx=b[0]-prev[0],dz=b[2]-prev[2],len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
   if(i)dist+=Math.hypot(a[0]-prev[0],a[2]-prev[2]);
   if(p.kind!=='street'){
    const merged=(x:number,z:number)=>blueprintPaths.some(q=>q.id!==p.id&&q.points.some(v=>Math.abs(v[1]-a[1])<.5&&Math.hypot(v[0]-x,v[2]-z)<q.width/2+.5));
    for(const side of [-1,1]){const x=snap(a[0]+nx*side*(p.width/2+.125)),z=snap(a[2]+nz*side*(p.width/2+.125)),y=snap(a[1]);if(merged(x,z))continue;
     g.box([x-.125,y-.75,z-.125],[x+.125,y+.25,z+.125],C.ivory);g.box([x-.0625,y+.875,z-.0625],[x+.0625,y+1,z+.0625],C.shadow);
    }
    if(dist>=nextPier){nextPier+=15;const x=Math.round(a[0]),z=Math.round(a[2]),top=Math.floor(a[1])-1;
     const column:Vec[]=[[x-1,ground(x,z),z-1],[x+1,top,z+1]],cap:Vec[]=[[x-2,top-1,z-2],[x+2,top,z+2]];
     if(supportClear(p.id,column[0],column[1])&&supportClear(p.id,cap[0],cap[1])){putSupport(p.id,'pier',column[0],column[1],C.shadow);putSupport(p.id,'cap',cap[0],cap[1],C.ivory);}
     else{
      const boxes:{kind:string;a:Vec;b:Vec;color:number}[]=[];
      for(const side of [-1,1]){const px=Math.round(x+nx*side*6.5),pz=Math.round(z+nz*side*6.5);boxes.push({kind:'portal-column',a:[px,ground(px,pz),pz],b:[px+1,top,pz+1],color:C.shadow});}
      for(let off=-6.5;off<=6.5;off+=.5){const px=Math.round(x+nx*off),pz=Math.round(z+nz*off);boxes.push({kind:'portal-beam',a:[px,top-1,pz],b:[px+1,top,pz+1],color:C.ivory});}
      if(boxes.every(v=>supportClear(p.id,v.a,v.b)))for(const v of boxes)putSupport(p.id,v.kind,v.a,v.b,v.color);
     }
    }
    if(dist>=nextPost){nextPost+=2;for(const side of [-1,1]){const x=snap(a[0]+nx*side*(p.width/2+.125)),z=snap(a[2]+nz*side*(p.width/2+.125));if(!merged(x,z))g.box([x-.125,a[1],z-.125],[x+.125,a[1]+1,z+.125],C.ivory);}}
   }
   if(dist>=nextLamp){nextLamp+=p.kind==='street'?19:24;const side=nextLamp%2?1:-1,x=snap(a[0]+nx*side*(p.width/2+(p.kind==='street'?.875:.125))),z=snap(a[2]+nz*side*(p.width/2+(p.kind==='street'?.875:.125))),y=snap(a[1]);
    g.box([x-.125,y,z-.125],[x+.125,y+4,z+.125],C.dark);g.box([x-.375,y+3.75,z-.375],[x+.375,y+4,z+.375],C.light,1);
   }
  }
 }
 return {compressedRoadTiles:compressedTiles,supports};
}
export function generateCity(){
 vegetation.length=0;const g=new CityGrid(),buildings=towers.map(p=>building(g,p)),paths:Path[]=[];
 const xs=[-77,-28,10,64],zs=[-76,-12,52,74];
 const sh=(x:number,z:number,vertical:boolean)=>Math.max(...[-4,-2,0,2,4].map(u=>ground(x+(vertical?u:0),z+(vertical?0:u))))+1;
 for(const x of xs)paths.push({id:'street-ns-'+x,points:straight([x,0,-110],[x,0,110]).map(p=>[p[0],sh(p[0],p[2],true),p[2]]),width:6,kind:'street'});
 for(const z of zs)paths.push({id:'street-ew-'+z,points:straight([-114,0,z],[114,0,z]).map(p=>[p[0],sh(p[0],p[2],false),p[2]]),width:6,kind:'street'});
 const streets=paths.slice();
 // Raise the two approach landings above the natural ridge, with an 8% transition back to the city avenue.
 for(const p of streets)if(p.id==='street-ns--28')for(const v of p.points)v[1]=Math.max(v[1],20-Math.max(0,110-Math.abs(v[2]))*.08);
 for(let pass=0;pass<8;pass++){
  const junctions=new Map<string,number>();for(const p of streets)for(const v of p.points){const k=v[0]+','+v[2];junctions.set(k,Math.max(junctions.get(k)||0,v[1]));}
  for(const p of streets){for(const v of p.points)v[1]=junctions.get(v[0]+','+v[2])!;for(let i=1;i<p.points.length;i++)p.points[i][1]=Math.max(p.points[i][1],p.points[i-1][1]-.0625);for(let i=p.points.length-2;i>=0;i--)p.points[i][1]=Math.max(p.points[i][1],p.points[i+1][1]-.0625);}
 }
 paths.push(...buildRoadNetwork(streets));
 g.family=0;const {compressedRoadTiles,supports}=roads(g,paths);g.family=1;
 const entrances=[];
 for(const b of buildings){const street=streets.filter(p=>p.id.includes('-ew-')).sort((a,c)=>Math.abs(a.points[0][2]-b.doorZ)-Math.abs(c.points[0][2]-b.doorZ))[0],end=street.points.reduce((a,v)=>Math.abs(v[0]-b.x)<Math.abs(a[0]-b.x)?v:a),endZ=end[2]-b.entrySide*4,dist=Math.abs(endZ-b.doorZ),steps=Math.ceil(dist*4);
  for(let i=0;i<=steps;i++){const t=i/Math.max(steps,1),z=b.doorZ+(endZ-b.doorZ)*t,y=snap((b.base+1)*(1-t)+end[1]*t);g.box([b.x-1.5,y,z-.25],[b.x+1.5,y+.125,z+.25],C.walk);}
  entrances.push({buildingSeed:b.seed,from:[b.x,b.base+1,b.doorZ],to:[b.x,end[1],endZ]});
 }
 const bridges=[];
 for(const[a,b,y]of [[[-51,-37],[-8,-35],54],[[-8,-63],[33,-62],60],[[33,-36],[33,10],52]] as const){
  const pts=straight([a[0],y,a[1]],[b[0],y,b[1]]);bridges.push({a:[a[0],y,a[1]],b:[b[0],y,b[1]]});
  for(const p of pts){g.stdBox([p[0]-1,y,p[2]-1],[p[0]+1,y+1,p[2]+1],C.white);g.box([p[0]-1,y+3,p[2]-1],[p[0]+1,y+3.25,p[2]+1],C.white);
   for(const s of [-1,1]){const xx=p[0]+(a[0]===b[0]?s:0),zz=p[2]+(a[0]===b[0]?0:s);g.box([xx-.0625,y+1,zz-.0625],[xx+.0625,y+3,zz+.0625],C.blue);}}
 }
 // The civic square is a real paved, planted destination aligned with the main landmark.
 const plazaY=Math.max(...[-19,-8,3].flatMap(x=>[3,20,42].map(z=>ground(x,z))))+1;
 for(let x=-21;x<5;x++)for(let z=1;z<45;z++)for(let y=ground(x,z);y<plazaY-1;y++)g.put(x,y,z,C.shadow);
 g.stdBox([-21,plazaY-1,1],[5,plazaY,45],C.walk);
 // Broad shallow steps connect the raised civic square to both flanking streets.
 for(const side of [-1,1])for(const zc of [10,35])for(let step=0;step<12;step++){
  const edge=side<0?-21:5,x=side<0?edge-3+step*.25:edge+3-step*.25;
  const low=Math.max(ground(x,zc),ground(x,zc+2))+1,y=snap(low+(plazaY-low)*(step+1)/12);
  g.box([x,y-.25,zc-2],[x+.25,y,zc+2],C.walk);
  for(let zz=zc-2;zz<zc+2;zz++)for(let yy=ground(x,zz);yy<Math.floor(y-.25);yy++)g.put(Math.floor(x),yy,zz,C.shadow);
 }
 for(let x=-20;x<5;x+=3)g.box([x,plazaY,1],[x+.125,plazaY+.125,45],0x87958e);
 for(let z=2;z<45;z+=3)g.box([-21,plazaY,z],[5,plazaY+.125,z+.125],0x87958e);
 for(let x=-13;x<=-3;x++)for(let z=17;z<=27;z++){const r=Math.hypot(x+8,z-22);if(r<5)g.put(x,plazaY,z,r>3.6?C.white:C.blue);}
 for(let j=0;j<6;j++){const a=j*Math.PI/3,x=-8+Math.cos(a)*2,z=22+Math.sin(a)*2;g.box([x-.125,plazaY+1,z-.125],[x+.125,plazaY+3+(j%2),z+.125],C.light,1);}
 g.stdBox([-9,plazaY+1,21],[-7,plazaY+5,23],C.white);
 for(const x of [-18,2])for(const z of [6,17,32,41]){planter(g,x,plazaY,z,3,3,Math.abs(x+z),false);tree(g,x,plazaY+.5,z,Math.abs(x+z));}
 for(const x of [-17,0])for(const z of [13,27,37]){g.box([x-.375,plazaY+.5,z-1.5],[x+.375,plazaY+.75,z+1.5],0x997d56);g.box([x-.5,plazaY+.5,z-1.5],[x-.375,plazaY+1.25,z+1.5],C.dark);}
 // Streets, roof terraces, loop gardens and a varied surrounding green belt.
 const fit=(x:number,z:number,r=2)=>buildings.every(b=>Math.abs(x-b.x)>b.width/2+r||Math.abs(z-b.z)>b.depth/2+r)&&paths.every(p=>p.points.every(v=>Math.hypot(v[0]-x,v[2]-z)>p.width/2+r||v[1]>ground(x,z)+9));
 let index=0;
 for(const x of [-70,-35,3,57,72,102])for(let z=-105;z<=107;z+=11)if(fit(x,z,1.6)){tree(g,x,ground(x,z),z,index++);}
 for(let i=0;i<36;i++){const a=i*Math.PI*2/36,x=86+Math.cos(a)*(i%2?12:7),z=75+Math.sin(a)*(i%2?12:7);if(i%2===0&&fit(x,z,1.6))tree(g,snap(x),ground(x,z),snap(z),i+2);}
 for(let i=0;i<64;i++){const side=i%4,t=Math.floor(i/4),x=side<2?-116+side*235:-111+t*14,z=side<2?-108+t*14:-117+(side-2)*238;if(fit(x,z,2.2))tree(g,x,ground(x,z),z,i+8);}
 g.finish();const binary=g.binary();
 const ownership=Uint8Array.from([...g.standard.values(),...g.micro.values()],c=>Math.floor(c/2**32));
 return {binary,ownership,manifest:{schema:2,world:'nature',seed:20260827,center,microSize:.125,resources:'unlimited',drones:5,purpose:'Native appearance redesign; autonomous construction migration waits for visual approval',buildings,roads:paths,entrances,skybridges:bridges,vegetation,compressedRoadTiles,supports,counts:{buildings:buildings.length,standard:g.standard.size,micro:g.micro.size,roads:paths.length,trees:vegetation.length,roofTrees:vegetation.filter(t=>t.roof).length},bounds:{minX:-233,maxX:238,minZ:-215,maxZ:220}}};
}
