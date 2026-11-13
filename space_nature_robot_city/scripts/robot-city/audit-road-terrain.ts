import {readFileSync,writeFileSync} from 'node:fs';
import {ground} from './architecture/scifi-city.ts';
const m=JSON.parse(readFileSync(new URL('./review/scifi-city.json',import.meta.url),'utf8'));
const report=[];
for(const p of m.roads){let gap=Infinity,at:any=null,count=0;for(let i=0;i<p.points.length;i++){const a=p.points[i],b=p.points[Math.min(i+1,p.points.length-1)],c=p.points[Math.max(0,i-1)],l=Math.hypot(b[0]-c[0],b[2]-c[2])||1;for(let u=-p.width/2;u<=p.width/2;u+=.5){const x=a[0]-(b[2]-c[2])/l*u,z=a[2]+(b[0]-c[0])/l*u,d=a[1]-ground(x,z);if(d<gap){gap=d;at=[x,a[1],z,ground(x,z)];}if(d<0)count++;}}report.push({road:p.id,minTerrainClearance:gap,at,intrusions:count});}
writeFileSync(new URL('./review/road-terrain-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(report.filter(r=>r.intrusions));
