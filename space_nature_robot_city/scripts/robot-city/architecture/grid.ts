import type {PortableEntity,PortableVoxel} from '../../../engine/src/storage/InventoryTypes.ts';
export type V=[number,number,number];
type Cell={x:number;y:number;z:number;color:number;materialId:number;part:string};
export const MICRO=.125;
export function hash(a:number,b:number,c:number,seed=1){let n=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function pick(colors:number[],a:number,b:number,c:number,seed=1){return colors[Math.floor(hash(a,b,c,seed)*colors.length)];}
/** All geometry is authored on Space's native eighth-metre lattice. */
export class MicroGrid {
 cells=new Map<string,Cell>();part='structure';
 set(x:number,y:number,z:number,color:number,materialId=0){this.cells.set(`${x},${y},${z}`,{x,y,z,color,materialId,part:this.part});}
 shape(lo:V,hi:V,test:(x:number,y:number,z:number)=>boolean,color:number|((x:number,y:number,z:number)=>number),materialId=0){
  for(let x=Math.floor(lo[0]*8+1e-6);x<Math.ceil(hi[0]*8-1e-6);x++)for(let y=Math.floor(lo[1]*8+1e-6);y<Math.ceil(hi[1]*8-1e-6);y++)for(let z=Math.floor(lo[2]*8+1e-6);z<Math.ceil(hi[2]*8-1e-6);z++){
   const a=(x+.5)/8,b=(y+.5)/8,c=(z+.5)/8;if(test(a,b,c))this.set(x,y,z,typeof color==='number'?color:color(a,b,c),materialId);
  }
 }
 box(lo:V,hi:V,color:number|((x:number,y:number,z:number)=>number),materialId=0){this.shape(lo,hi,()=>true,color,materialId);}
 erase(lo:V,hi:V,test:(x:number,y:number,z:number)=>boolean=()=>true){for(let x=Math.floor(lo[0]*8);x<Math.ceil(hi[0]*8);x++)for(let y=Math.floor(lo[1]*8);y<Math.ceil(hi[1]*8);y++)for(let z=Math.floor(lo[2]*8);z<Math.ceil(hi[2]*8);z++)if(test((x+.5)/8,(y+.5)/8,(z+.5)/8))this.cells.delete(`${x},${y},${z}`);}
 line(a:V,b:V,r:number,color:number){const d=b.map((v,i)=>v-a[i]),len=d.reduce((s,v)=>s+v*v,0);this.shape(a.map((v,i)=>Math.min(v,b[i])-r) as V,a.map((v,i)=>Math.max(v,b[i])+r) as V,(x,y,z)=>{const p=[x,y,z];const t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/len));return p.reduce((s,v,i)=>s+(v-a[i]-t*d[i])**2,0)<=r*r;},color);}
 sphere(p:V,r:number,color:number){this.shape(p.map(v=>v-r) as V,p.map(v=>v+r) as V,(x,y,z)=>[x,y,z].reduce((s,v,i)=>s+(v-p[i])**2,0)<r*r,color);}
 /** Resample filled geometry before surface extraction, preserving continuous native micro cells. */
 scale(sx:number,sy:number,sz:number){
  if([sx,sy,sz].some(v=>!Number.isFinite(v)||v<.75||v>1.3))throw Error('Geometry scale must be .75..1.3');
  const source=this.cells;this.cells=new Map();
  for(const c of source.values())for(let x=Math.round(c.x*sx);x<Math.round((c.x+1)*sx);x++)for(let y=Math.round(c.y*sy);y<Math.round((c.y+1)*sy);y++)for(let z=Math.round(c.z*sz);z<Math.round((c.z+1)*sz);z++)this.cells.set(`${x},${y},${z}`,{...c,x,y,z});
 }
 export(id:string,name:string,centerPivot=false):PortableEntity {
  const blocks:PortableVoxel[]=[];const offsets=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  // Remove cells entirely enclosed by opaque neighbours, while preserving glass boundaries.
  for(const c of this.cells.values()){
   if(offsets.every(d=>{const n=this.cells.get(`${c.x+d[0]},${c.y+d[1]},${c.z+d[2]}`);return n&&n.materialId<2;}))continue;
   const dx=Math.floor(c.x/8),dy=Math.floor(c.y/8),dz=Math.floor(c.z/8);
   blocks.push({dx,dy,dz,mx:c.x-dx*8,my:c.y-dy*8,mz:c.z-dz*8,size:MICRO,color:c.color,materialId:c.materialId,part:c.part});
  }
  blocks.sort((a,b)=>(a.dy*8+a.my!)-(b.dy*8+b.my!)||(a.dz*8+a.mz!)-(b.dz*8+b.mz!)||(a.dx*8+a.mx!)-(b.dx*8+b.mx!));
  if(blocks.length>65536)throw Error(`${id}: ${blocks.length} microvoxels exceeds the native entity budget`);
  const pivot:V=centerPivot?[0,1,2].map(axis=>{const coordinates=blocks.map(b=>[b.dx+b.mx!/8,b.dy+b.my!/8,b.dz+b.mz!/8][axis]);return (Math.min(...coordinates)+Math.max(...coordinates)+MICRO)/2;}) as V:[0,0,0];
  return {type:'space-entity',version:8,root:{id,name,pivot,body:{type:'kinematic',mass:5000,useGravity:false,collisionEnabled:true},blocks,children:[],seats:[],decorations:[],scriptLanguage:'assemblyscript'},constraints:[]};
 }
}
