import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encodeInventoryResource, decodeInventoryResource, wrapLegacyInventoryResource } from '../../engine/src/storage/InventoryProtobuf.ts';
import { compileEntityScript } from '../../engine/src/scripting/AssemblyScriptCompiler.ts';
import { parseInventoryImport } from '../../client/src/engine/inventory/InventoryImport.ts';

const root = '/Users/ha/Documents/entropydrop_website/entropydrop_media/space_three_worlds_agent_build_1080p_en_20261103_r3';
const specs = [
  ['chinook', 'chinook-refined.json', 'AETHER 47 | Chinook Transport Helicopter'],
  ['rover', 'rover-refined.json', 'NATURE TRAIL | Independent Suspension Rover'],
  ['drone', 'drone-zh-orbit.json', 'COPPER SCOUT | Player-Following Quadcopter'],
  ['windmill', 'medieval-windmill.json', 'OAK & STONE | Medieval Windmill'],
];
const records = [];
for (const [id, source, name] of specs) {
  const sourceBytes = await readFile(`${root}/models/${source}`);
  const model = JSON.parse(sourceBytes.toString());
  model.root.name = name;
  let blocks = 0, components = 0, scripts = 0;
  const enabled: string[] = [];
  async function visit(n: any) {
    components++;
    blocks += n.blocks?.length || 0;
    if (n.script) {
      await compileEntityScript(n.script);
      scripts++;
      if (n.scriptDisabled) enabled.push(n.id);
      delete n.scriptDisabled;
    }
    for (const child of n.children || []) await visit(child);
  }
  await visit(model.root);
  const item = wrapLegacyInventoryResource('entity', model, `vlog-${id}`);
  const bytes = encodeInventoryResource('item', item);
  const imported = parseInventoryImport(bytes, 'item');
  if (!imported.ok) throw new Error(`${id}: ${imported.error}`);
  const decoded = decodeInventoryResource(bytes, 'item');
  if (decoded.portable.name !== name) throw new Error('Resource name mismatch');
  const roundTrip = encodeInventoryResource('item', decoded.portable);
  if (!Buffer.from(bytes).equals(Buffer.from(roundTrip))) throw new Error('Noncanonical encoding');
  if (blocks > 65536 || bytes.byteLength > 8*1024*1024) throw new Error('Market quota exceeded');
  const file = `models/market-${id}.pb`;
  await writeFile(`${root}/${file}`, bytes);
  const record = { id, name, source: `models/${source}`, sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),
    file, sha256:createHash('sha256').update(bytes).digest('hex'), bytes:bytes.byteLength,
    blocks, components, scripts, scriptsCompiled:true, importValidated:true, enabledComponents:enabled };
  records.push(record);
  console.log(JSON.stringify(record));
}
await writeFile(`${root}/review/market-publication-preflight.json`, JSON.stringify({
  preparedAt:new Date().toISOString(), destination:'https://space.entropydrop.com',
  license:'AGPL-3.0-only', records,
},null,2)+'\n');
