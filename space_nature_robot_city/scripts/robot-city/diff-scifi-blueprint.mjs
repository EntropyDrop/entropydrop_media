import {readFileSync,writeFileSync} from 'node:fs';
const bytes=p=>{const b=readFileSync(p);return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);};
const before=bytes('/private/tmp/scifi-city-before-lamps.bin'),after=bytes(new URL('./review/scifi-city.bin',import.meta.url));
const id=(a,i)=>a[i+4]*2**47+a[i]*2**27+a[i+1]*2**16+a[i+2];
const old=new Map();for(let i=0;i<before.length;i+=5)old.set(id(before,i),i);
const write=[];for(let i=0;i<after.length;i+=5){const k=id(after,i),j=old.get(k);if(j===undefined||before[j+3]!==after[i+3])write.push(Array.from(after.subarray(i,i+5)));old.delete(k);}
const remove=[...old.values()].map(i=>Array.from(before.subarray(i,i+5)));
writeFileSync(new URL('./review/scifi-blueprint-delta.json',import.meta.url),JSON.stringify({remove,write}));console.log({remove:remove.length,write:write.length});
