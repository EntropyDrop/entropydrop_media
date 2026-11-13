import {writeFileSync,mkdirSync} from 'node:fs';
import {generateCity} from './architecture/scifi-city.ts';
const started=Date.now();
const {binary,manifest}=generateCity();
mkdirSync(new URL('./review/',import.meta.url),{recursive:true});
writeFileSync(new URL('./review/scifi-city.bin',import.meta.url),Buffer.from(binary.buffer));
writeFileSync(new URL('./review/scifi-city.json',import.meta.url),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({seconds:(Date.now()-started)/1000,bytes:binary.byteLength,...manifest.counts,terrainHeightRange:[Math.min(...manifest.buildings.map(p=>p.base)),Math.max(...manifest.buildings.map(p=>p.base))]}));
