import type {PortableEntity,PortableComponent,PortableVoxel} from '../../engine/src/storage/InventoryTypes.ts';
type V=[number,number,number];
export class Grid {
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
export function component(id:string,name:string,g:Grid,position:V=[0,0,0]):PortableComponent{return{id,name,pivot:[0,0,0],localPosition:position.map(v=>Math.round(v*8)/8) as V,body:{type:'kinematic',mass:1,useGravity:false,collisionEnabled:false},blocks:g.blocks(),children:[],seats:[],decorations:[],scriptLanguage:'assemblyscript'};}
