import {readFileSync,writeFileSync} from 'node:fs';
import {TerrainGenerator} from '../../engine/src/worldgen/TerrainGenerator.ts';
const path='.local/robot-city/review/scifi-construction.json',assets=JSON.parse(readFileSync(path,'utf8'));
const size=4,width=128,origin=[assets.center[0]-256,assets.center[1]-256],heights=new Uint16Array(width*width),terrain=new TerrainGenerator(20260827,1);
for(let z=0;z<width;z++)for(let x=0;x<width;x++){
 let h=0;for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++)h=Math.max(h,terrain.sampleHeight(origin[0]+x*size+dx,origin[1]+z*size+dz)+1);
 heights[z*width+x]=Math.ceil(h*8);
}
const bytes=readFileSync('.local/robot-city/review/scifi-city.bin'),cells=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
let included=0;
for(let i=0;i<cells.length;i+=5){const scale=cells[i+4]?1:8,x=Math.floor((cells[i]/scale-origin[0])/size),z=Math.floor((cells[i+2]/scale-origin[1])/size),y=Math.ceil((cells[i+1]+1)/scale*8);if(x<0||x>=width||z<0||z>=width)throw Error('Blueprint outside flight envelope');heights[z*width+x]=Math.max(heights[z*width+x],y);included++;}
assets.navigation={kind:'conservative-planned-city-and-native-terrain-height-envelope',cellSize:size,width,origin,ceilingUnits:8,heights:Array.from(heights,n=>String.fromCharCode(n+256)).join(''),blueprintSha256:assets.blueprintSha256};
writeFileSync(path,JSON.stringify(assets));writeFileSync('.local/robot-city/review/scifi-navigation.json',JSON.stringify({kind:assets.navigation.kind,cellSize:size,width,origin,blueprintSha256:assets.blueprintSha256,included,terrainSamples:width*width*size*size,maxHeight:Math.max(...heights)/8,limitation:'Conservative reserved flight airspace for this pre-surveyed blueprint; not a generic dynamic-obstacle planner.'},null,2));
console.log('Navigation envelope',included,'cells, max',Math.max(...heights)/8);
