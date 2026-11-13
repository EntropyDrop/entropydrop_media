import {writeFile,mkdir} from 'node:fs/promises';
import {chinook,rover,drone} from './models.ts';
import {encodeInventoryResource,decodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {compileEntityScript} from '../../engine/src/scripting/AssemblyScriptCompiler.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
const root='/private/tmp/space-three-worlds-vlog-r2';
await mkdir(root+'/models',{recursive:true});
const results=[];
for(const[name,make]of Object.entries({chinook,rover,drone})){
 const model=make(),nodes=[model.root,...model.root.children];
 for(const node of nodes)if(node.script)await compileEntityScript(node.script);
 const bytes=encodeInventoryResource('entity',model),decoded=decodeInventoryResource(bytes,'entity');
 const parsed=parseInventoryImport(bytes,'entity');if(!parsed.ok)throw Error(parsed.error);
 await writeFile(root+'/models/'+name+'.edpb',bytes);
 await writeFile(root+'/models/'+name+'.json',JSON.stringify(decoded.portable));
 for(const node of nodes)if(node.script)await writeFile(root+'/models/'+name+'-'+node.id+'.as.txt',node.script);
 const stat={name,components:nodes.length,voxels:nodes.reduce((s,n)=>s+n.blocks.length,0),bytes:bytes.length,rootBody:model.root.body,compiled:true};
 if(stat.voxels>65536)throw Error('Voxel quota');results.push(stat);console.log(stat);
}
await writeFile(root+'/review/model-preflight.json',JSON.stringify(results,null,2));
