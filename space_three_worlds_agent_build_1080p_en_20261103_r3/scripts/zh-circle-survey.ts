import{TerrainGenerator}from'../../engine/src/worldgen/TerrainGenerator.ts';
import{Chunk}from'../../engine/src/voxel/Chunk.ts';
const gen=new TerrainGenerator(20260922,2),cache=new Map<string,Chunk>();
const heights=[];
for(let i=0;i<80;i++){
 const h=-.75+Math.PI*2*i/80,r=14*44/(Math.PI*2);
 const x=Math.floor(8251+r*(Math.cos(h)-Math.cos(-.75))),z=Math.floor(1041.5-r*(Math.sin(h)-Math.sin(-.75)));
 const cx=Math.floor(x/16),cz=Math.floor(z/16),key=`${cx},${cz}`;
 let c=cache.get(key);if(!c){c=new Chunk(cx,cz,null);gen.generateChunk(c,false);cache.set(key,c);}
 let y=255;while(y>=0&&!c.getLocalBlock(x-cx*16,y,z-cz*16))y--;
 heights.push({x,z,height:y+1});
}
console.log(JSON.stringify({maxHeight:Math.max(...heights.map(h=>h.height)),heights}));
