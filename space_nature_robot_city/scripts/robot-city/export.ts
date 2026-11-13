import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {robot} from './models.ts';
import {controller} from './controllers.ts';
import {roles,plan} from './plan.ts';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
import {compileEntityScript} from '../../engine/src/scripting/AssemblyScriptCompiler.ts';
const root=process.argv[2]||'.local/robot-city/export';await mkdir(root,{recursive:true});
// Offline templates: bind peer UUIDs and immutable blueprint endpoint at install time.
const report=[];
for(let i=0;i<roles.length;i++){
 const model=robot(i,'// Local construction template. Bind controller and blueprint library using runtime.ts. Leave stopped until installed.');
 for(const n of [model.root,...model.root.children])if(n.script)await compileEntityScript(n.script);
 const bytes=encodeInventoryResource('entity',model),parsed=parseInventoryImport(bytes,'entity');if(!parsed.ok)throw Error(roles[i]+': '+parsed.error);
 await writeFile(root+'/'+roles[i]+'.pb',bytes);await writeFile(root+'/'+roles[i]+'.json',JSON.stringify(model));await writeFile(root+'/'+roles[i]+'.as.txt',model.root.script);
 report.push({role:roles[i],components:model.root.children.length+1,voxels:[model.root,...model.root.children].reduce((s,n)=>s+n.blocks.length,0),bytes:bytes.length,compiled:true});
}
await writeFile(root+'/plan.json',JSON.stringify(plan));await writeFile(root+'/preflight.json',JSON.stringify(report,null,2));console.log(report);
