import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generateHouse,generateRoad,housePresets,roadPresets,roadDistance,roadPorts} from './generate.ts';
import {generateTree,treePresets,generatePlanting,plantingPresets} from './landscape.ts';
import {generateBridge,bridgePresets,interchangeLayout,BRIDGE} from './bridges.ts';
const spaceRoot=resolve(process.env.SPACE_ROOT||process.cwd());
const {encodeInventoryResource}=await import(pathToFileURL(resolve(spaceRoot,'engine/src/storage/InventoryProtobuf.ts')).href);
const {parseInventoryImport}=await import(pathToFileURL(resolve(spaceRoot,'client/src/engine/inventory/InventoryImport.ts')).href);
const out=process.argv[2]||'.local/robot-city/architecture/output';await mkdir(out,{recursive:true});
const digest=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
const report:any[]=[];
for(const [category,presets,generator] of [['house',housePresets,generateHouse],['road',roadPresets,generateRoad],['bridge',bridgePresets,generateBridge],['tree',treePresets,generateTree]] as const){
 for(const preset of presets){
  const model=(generator as any)(preset.options),bytes=encodeInventoryResource('entity',model),parsed=parseInventoryImport(bytes,'entity');
  if(!parsed.ok)throw Error(`${preset.id}: ${parsed.error}`);
  const blocks=model.root.blocks,coords=blocks.map((b:any)=>[b.dx*8+b.mx,b.dy*8+b.my,b.dz*8+b.mz]);
  const lo=[0,1,2].map(i=>Math.min(...coords.map((p:number[])=>p[i]))/8),hi=[0,1,2].map(i=>(Math.max(...coords.map((p:number[])=>p[i]))+1)/8);
  const cellSet=new Set(coords.map((p:number[])=>p.join(',')));if(cellSet.size!==blocks.length)throw Error('Overlapping voxels');
  if(blocks.some((b:any)=>b.size!==.125||[b.mx,b.my,b.mz].some(n=>!Number.isInteger(n)||n<0||n>7)))throw Error('Off lattice');
  const repeat=encodeInventoryResource('entity',(generator as any)(preset.options));if(digest(repeat)!==digest(bytes))throw Error('Nondeterministic generator');
  const partCounts:Record<string,number>={};for(const b of blocks)partCounts[b.part]=(partCounts[b.part]||0)+1;
  const meta={id:preset.id,category,name:preset.name,description:preset.description,options:preset.options,microSize:.125,voxels:blocks.length,bounds:{lo,hi,size:hi.map((n,i)=>n-lo[i])},parts:partCounts,bytes:bytes.length,sha256:digest(bytes),importVerified:true,deterministic:true,...(category==='road'?{ports:roadPorts((preset.options as any).kind),portWidth:7.75,length:12}:{})};
  await writeFile(`${out}/${preset.id}.pb`,bytes);await writeFile(`${out}/${preset.id}.json`,JSON.stringify(model));report.push(meta);console.log(`${preset.id}: ${blocks.length} microvoxels; ${bytes.length} bytes; import OK`);
 }
}
// Geometry contract at all compatible ports, tested on the actual boundary rather than cell centres.
for(let t=-3.875;t<=3.875;t+=.125){const ref=roadDistance(6,t,'straight');for(const x of [roadDistance(-6,t,'curve'),roadDistance(t,6,'curve'),roadDistance(6,t,'tee'),roadDistance(t,-6,'tee'),roadDistance(t,-6,'cross')])if(Math.abs(ref-x)>1e-9)throw Error(`Road port mismatch at ${t}`);}
const layout=interchangeLayout(),planting=plantingPresets.map(p=>({...p,recipe:generatePlanting(p.options)}));
await writeFile(`${out}/interchange-layout.json`,JSON.stringify(layout,null,2));
await writeFile(`${out}/planting-layouts.json`,JSON.stringify(planting,null,2));
for(const p of planting)await writeFile(`${out}/planting-${p.id}.json`,JSON.stringify(p,null,2));
await writeFile(`${out}/manifest.json`,JSON.stringify({version:2,stage:'style_review_only',nativeResolution:.125,notIntegratedIntoRobotPlan:true,roadPortContractVerified:true,bridge:BRIDGE,assemblies:[{id:'overpass',name:layout.name,layout:'interchange-layout.json'}],planting:planting.map(p=>({id:p.id,name:p.name,count:p.recipe.placedCount})),assets:report},null,2));
