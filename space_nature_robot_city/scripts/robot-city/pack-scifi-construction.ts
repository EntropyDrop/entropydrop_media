import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('./review/',import.meta.url),buf=readFileSync(new URL('scifi-city.bin',root)),cells=new Uint32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),owners=readFileSync(new URL('scifi-city-ownership.bin',root)),manifest=JSON.parse(readFileSync(new URL('scifi-city.json',root),'utf8'));
const palette:number[]=[],materials:number[]=[],types:number[]=[],lookup=new Map<number,number>(),groups:number[][]=Array.from({length:18},()=>[]),parents=Array.from({length:6},()=>new Map<number,number[]>());
const center=manifest.center;
const coordinates=(i:number)=>{const o=i*5,scale=cells[o+4]?1:8;return [cells[o]/scale,cells[o+1]/scale,cells[o+2]/scale];};
for(let i=0;i<owners.length;i++){groups[owners[i]].push(i);const [x,y,z]=coordinates(i).map(Math.floor),k=(x*2048+y)*16384+z;parents[owners[i]%6].set(k,[x,y,z]);}
function anchor(x:number,z:number,owner:number){if(owner<6)return [Math.floor((x-center[0])/16),Math.floor((z-center[1])/16)];let best=0,d=Infinity;for(let j=0;j<manifest.buildings.length;j++){const b=manifest.buildings[j],v=Math.hypot(x-center[0]-b.x,z-center[1]-b.z);if(v<d){d=v;best=j;}}return [best,0];}
const tile=new Float64Array(owners.length);for(let i=0;i<owners.length;i++){const [x,y,z]=coordinates(i),a=anchor(x,z,owners[i]);tile[i]=(a[0]+20)*100+a[1]+20;}
const jobs=groups.map((indices,id)=>{
 indices.sort((a,b)=>tile[a]-tile[b]||coordinates(a)[1]-coordinates(b)[1]||cells[a*5+4]-cells[b*5+4]||coordinates(a)[2]-coordinates(b)[2]||coordinates(a)[0]-coordinates(b)[0]);
 const runs:number[][]=[];let last:number[]|null=null;
 for(let j=0;j<indices.length;j++){const i=indices[j]*5,x=cells[i],y=cells[i+1],z=cells[i+2],packed=cells[i+3],type=cells[i+4],k=type*2**32+packed;let pi=lookup.get(k);if(pi===undefined){pi=palette.length;lookup.set(k,pi);palette.push(packed&0xffffff);materials.push(packed>>>24);types.push(type);}
  if(last){const axis=Math.floor(last[4]/2048),len=last[4]%2048,next=last.slice(0,3);next[axis]+=len;if(len<2047&&last[3]===pi&&next[0]===x&&next[1]===y&&next[2]===z){last[4]++;continue;}}
  const ni=indices[j+1]*5;let axis=0;if(ni<cells.length&&cells[ni]===x&&cells[ni+1]===y&&cells[ni+2]===z+1)axis=2;
  last=[x,y,z,pi,axis*2048+1];runs.push(last);
 }
 const chunks=[];for(let start=0;start<runs.length;start+=10000)chunks.push(runs.slice(start,start+10000).map(r=>String.fromCharCode(...r.map(n=>n+256))).join(''));
 return{id,family:Math.floor(id/6),district:id%6,count:indices.length,runs:runs.length,data:chunks.join('')};
});
const survey=parents.map((p,district)=>({district,count:p.size,data:[...p.values()].map(c=>String.fromCharCode(...c.map(n=>n+256))).join('')}));
const result={schema:3,blueprintSha256:'7e27f4c0a19ceda654d8bc3a60920a042f947ab9147199ce944a1cc4ee7abff0',center,palette,materials,types,jobs,survey,buildings:manifest.buildings.map((b:any)=>({x:center[0]+b.x,z:center[1]+b.z,roof:b.roof,width:b.width,depth:b.depth})),resources:'unlimited',total:owners.length};
writeFileSync(new URL('scifi-construction.json',root),JSON.stringify(result));console.log(JSON.stringify({palette:palette.length,jobs:jobs.map(({data,...j})=>j),survey:survey.map(({data,...s})=>s)}));
