import assert from 'node:assert/strict';
import { visibleVoxelFaceQuads } from '@entropydrop/space-engine/contraption/EntityVoxelMeshes.ts';
import { getGeometryKernels } from '@entropydrop/space-engine/wasm/GeometryKernels.ts';

const faces = Array.from({ length: 3 }, (_, axis) => {
  const others = [0, 1, 2].filter(candidate => candidate !== axis);
  return [0, 1].map(side => ({
    normal: Array.from({ length: 3 }, (_, candidate) => candidate === axis ? side * 2 - 1 : 0),
    corners: [[0, 0], [1, 0], [1, 1], [0, 1]].map(offset => {
      const corner = [0, 0, 0];
      corner[axis] = side;
      for (let i = 0; i < 2; i++) corner[others[i]] = offset[i];
      return corner;
    }),
  }));
}).flat();

/** Count authored voxels that emit at least one face in the real entity mesh. */
export function measureAircraftGeometry(aircraft) {
  const stats = { authoredVoxels: aircraft.blocks.length, surfaceVoxels: 0, surfaceQuads: 0, meshTriangles: 0 };
  for (const node of aircraft.entityNodes.values()) {
    for (const blocks of node.voxelChunkBlocks.values()) {
      for (const block of blocks) {
        let quads = 0;
        for (const { normal, corners } of faces) {
          for (const quad of visibleVoxelFaceQuads(block, normal, corners, node.meshCellMap)) {
            assert.equal(quad.length, 4);
            quads++;
          }
        }
        if (quads) stats.surfaceVoxels++;
        stats.surfaceQuads += quads;
      }
    }
    for (const mesh of node.voxelChunks.values()) {
      stats.meshTriangles += mesh.geometry.getAttribute('position').count / 3;
    }
  }
  assert.equal(stats.surfaceQuads * 2, stats.meshTriangles, 'Count must match the actual aircraft voxel mesh');
  stats.collisionBoxes = aircraft.getPhysicsCollisionWorldAABBs().length;
  stats.decorationBoxes = aircraft.getDecorationCollisionBoxes().length;
  return stats;
}

/** Per-worker counts after entity broadphase and swept-AABB filtering. */
export function countAircraftCollisionWork(physics) {
  const kernels = getGeometryKernels();
  assert.ok(kernels, 'Workload instrumentation uses the benchmark WASM geometry path');
  const obbContacts = kernels.obbContacts.bind(kernels);
  const sweptContact = physics.sweptAabbContact.bind(physics);
  let exactPairs = 0;
  let sweptPairs = 0;
  kernels.obbContacts = (first, second, terrain) => {
    if (!terrain) {
      for (let i = 0; i < first.length; i++) {
        if (first[i] && second[i]) exactPairs++;
      }
    }
    return obbContacts(first, second, terrain);
  };
  physics.sweptAabbContact = (...args) => {
    sweptPairs++;
    return sweptContact(...args);
  };
  return () => {
    const counts = { exactPairs, sweptPairs };
    exactPairs = 0;
    sweptPairs = 0;
    return counts;
  };
}
