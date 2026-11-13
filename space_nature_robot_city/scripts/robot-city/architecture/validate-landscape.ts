import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {generateTree,treePresets,generatePlanting,plantingPresets} from './landscape.ts';
import {interchangeLayout,BRIDGE} from './bridges.ts';
const out=process.argv[2]||'.local/robot-city/architecture/output';
const manifest=JSON.parse(await readFile(`${out}/manifest.json`,'utf8'));
// A root pivot different from the native COM offsets independently imported modules.
for(const a of manifest.assets.filter((a:any)=>a.category==='tree'||a.category==='bridge')){
 const m=JSON.parse(await readFile(`${out}/${a.id}.json`,'utf8'));
 assert.deepEqual(m.root.pivot,a.bounds.lo.map((lo:number,i:number)=>(lo+a.bounds.hi[i])/2),`${a.id}: render pivot must match native bounds centre`);
}
const trees=[];
for(const p of treePresets){
 const m=JSON.parse(await readFile(`${out}/${p.id}.json`,'utf8'));
 const radius=Math.max(...m.root.blocks.map((b:any)=>Math.hypot(b.dx+(b.mx+.5)/8,b.dz+(b.mz+.5)/8)))+.09;
 assert(radius<=p.radius,`${p.id}: crown exceeds planting exclusion radius ${radius} > ${p.radius}`);
 const different=generateTree({...p.options,seed:p.options.seed!+1});
 const geometry=(model:any)=>model.root.blocks.map((b:any)=>`${b.dx},${b.dy},${b.dz},${b.mx},${b.my},${b.mz}`).join(';');
 assert.notEqual(geometry(m),geometry(different),'Seed must vary branching, not only leaf colours');
 trees.push({id:p.id,radius,placementRadius:p.radius,seedChangesGeometry:true});
}
const planted=[];
for(const p of plantingPresets){
 const r=generatePlanting(p.options);assert.equal(r.placedCount,p.options.count);assert.deepEqual(r,generatePlanting(p.options));
 for(let i=0;i<r.placements.length;i++){
  const a=r.placements[i];for(const b of r.placements.slice(i+1))assert(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])>=a.crownRadius+b.crownRadius+.75);
  for(const b of r.exclusions)assert(Math.hypot(Math.max(b.minX-a.position[0],0,a.position[0]-b.maxX),Math.max(b.minZ-a.position[2],0,a.position[2]-b.maxZ))>=a.crownRadius+(b.clearance??.75));
 }
 planted.push({id:p.id,count:r.placedCount,deterministic:true,crownSpacingAndExclusionsVerified:true});
}
const layout=interchangeLayout(),world=new Map<string,string>(),top=new Map<number,number>();
for(const p of layout.parts){
 const model=JSON.parse(await readFile(`${out}/${p.assetId}.json`,'utf8')),c=Math.cos(p.rotationY),s=Math.sin(p.rotationY);
 for(const b of model.root.blocks){
  const x=b.dx+(b.mx+.5)/8,y=b.dy+(b.my+.5)/8,z=b.dz+(b.mz+.5)/8;
  const X=Math.round((x*c+z*s+p.position[0]-.0625)*8),Y=Math.round((y+p.position[1]-.0625)*8),Z=Math.round((-x*s+z*c+p.position[2]-.0625)*8),key=`${X},${Y},${Z}`;
  assert(!world.has(key),`Assembly overlap at ${key}: ${p.assetId} / ${world.get(key)}`);world.set(key,p.assetId);
  if(Z===0)top.set(X,Math.max(top.get(X)??-Infinity,(Y+1)/8));
 }
}
let maxStep=0;for(let x=-432;x<432;x++){assert(top.has(x),`Upper route gap at ${x/8}`);if(x>-432)maxStep=Math.max(maxStep,Math.abs(top.get(x)!-top.get(x-1)!));}
assert(maxStep<=.125,`Ramp seam step ${maxStep}`);
for(const [key,id]of world){const [x,y,z]=key.split(',').map(n=>(Number(n)+.5)/8);if(Math.abs(x)<2.5&&Math.abs(z)<6&&y>.375&&y<4.75)assert.fail(`Lower carriageway blocked by ${id} at ${key}`);}
const report={nativeRootPivotsVerified:true,nativeImportAndDeterminismVerified:manifest.assets.every((a:any)=>a.importVerified&&a.deterministic),trees,planting:planted,bridge:{parts:layout.parts.length,voxels:world.size,overlapFree:true,upperRouteContinuous:true,maxMicroStep:maxStep,clearance:BRIDGE.minimumClearance,grade:BRIDGE.grade},scope:'Geometric checks only; vehicle driving, natural-terrain earthworks and robot construction acceptance are not yet tested.'};
await writeFile(`${out}/landscape-checks.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
