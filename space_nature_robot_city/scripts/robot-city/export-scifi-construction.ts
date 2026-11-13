import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateCity} from './architecture/scifi-city.ts';
const {binary,ownership,manifest}=generateCity();
const sha=createHash('sha256').update(Buffer.from(binary.buffer)).digest('hex');
if(sha!=='7e27f4c0a19ceda654d8bc3a60920a042f947ab9147199ce944a1cc4ee7abff0')throw Error('Construction tagging changed approved city: '+sha);
writeFileSync(new URL('./review/scifi-city-ownership.bin',import.meta.url),ownership);
const counts=Array.from({length:18},()=>({standard:0,micro:0}));ownership.forEach((o,i)=>counts[o][binary[i*5+4]?'standard':'micro']++);
console.log(JSON.stringify({sha,owners:counts,total:ownership.length}));
