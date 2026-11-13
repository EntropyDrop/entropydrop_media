import {TerrainGenerator} from '../../engine/src/worldgen/TerrainGenerator.ts';
import {Chunk} from '../../engine/src/voxel/Chunk.ts';
for(const[name,seed,version,pts]of [
 ['nature',20260827,1,[[8192,1024],[8192,980],[8210,980]]],
 ['copper-metropolis',20260922,2,[[8200,1032],[8192,1024],[8208,1024],[8192,1000],[8176,1024],[8224,1024]]],
 ['aether-archipelago',42,3,[[8229,1022],[8235,1022],[8229,1014],[8229,1030]]]
] as const){const gen=new TerrainGenerator(seed,version);const out=[];for(const[x,z]of pts){const c=new Chunk(Math.floor(x/16),Math.floor(z/16),null);gen.generateChunk(c);let y=255;for(;y>=0;y--)if(c.getLocalBlock(x%16,y,z%16))break;out.push({x,z,ground:y+1,top:c.getLocalColor(x%16,y,z%16).toString(16)});}console.log(JSON.stringify({name,points:out}));}
