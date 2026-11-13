import{TerrainGenerator}from'../../engine/src/worldgen/TerrainGenerator.ts';import{Chunk}from'../../engine/src/voxel/Chunk.ts';
const gen=new TerrainGenerator(20260922,2),size=128;
for(const[ox,oz]of [[8128,512],[8160,960]]){
 const h=new Uint8Array(size*size);
 for(let cx=ox/16;cx<(ox+size)/16;cx++)for(let cz=oz/16;cz<(oz+size)/16;cz++){const c=new Chunk(cx,cz,null);gen.generateChunk(c,false);for(let x=0;x<16;x++)for(let z=0;z<16;z++){let y=255;for(;y>=0;y--)if(c.getLocalBlock(x,y,z))break;h[(cz*16+z-oz)*size+cx*16+x-ox]=y+1;}}
 let best:any=null;
 for(let x=4;x<size-20;x++)for(let z=28;z<size-4;z++){let min=255,max=0;for(let dx=-3;dx<=18;dx++)for(let dz=-24;dz<=3;dz++){const v=h[(z+dz)*size+x+dx];min=Math.min(min,v);max=Math.max(max,v);}if(max-min===0&&(!best||max<best.height))best={x:ox+x,z:oz+z,height:max};}
 console.log(JSON.stringify({origin:[ox,oz],best}));
}
