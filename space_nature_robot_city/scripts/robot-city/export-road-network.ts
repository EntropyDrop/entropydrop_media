import {readFileSync,writeFileSync} from 'node:fs';
import {buildRoadNetwork} from './architecture/scifi-roads.ts';
const old=JSON.parse(readFileSync(new URL('./review/scifi-city.json',import.meta.url),'utf8'));
const streets=old.roads.filter(p=>p.kind==='street');const roads=[...streets,...buildRoadNetwork(streets)];
writeFileSync(new URL('./review/road-network-candidate.json',import.meta.url),JSON.stringify({...old,roads},null,2));
for(const p of roads.filter(p=>p.kind!=='street')){let grade=0;for(let i=1;i<p.points.length;i++){const a=p.points[i-1],b=p.points[i];grade=Math.max(grade,Math.abs(b[1]-a[1])/Math.hypot(b[0]-a[0],b[2]-a[2]));}console.log(p.id,p.length||'',grade.toFixed(4),p.points[0],p.points.at(-1));}
