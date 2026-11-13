import {readFile,writeFile} from 'node:fs/promises';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
const root='/private/tmp/space-three-worlds-vlog-r2';
for(const name of ['rover','drone']){
 const model=JSON.parse(await readFile(`${root}/models/${name}-refined.json`,'utf8'));
 const bytes=encodeInventoryResource('entity',model);
 const parsed=parseInventoryImport(bytes,'entity');
 if(!parsed.ok)throw Error(`${name}: ${parsed.error}`);
 await writeFile(`${root}/models/${name}-refined.edpb`,bytes);
 console.log(name,bytes.length,'validated');
}
