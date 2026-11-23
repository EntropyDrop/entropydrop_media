// The Chapter 04 model with the same split nose hub and authored blades.
export function buildFlightAircraft(q, buildBlueprints, buildBlades) {
  const { plane, hubColor } = buildBlueprints(q);
  const pivot = [6.375, 2.28, 0];
  const hubVoxels = plane.root.blocks.filter(block => block.part === 'hub' || block.color === hubColor);
  if (!hubVoxels.length) throw new Error('Aircraft blueprint has no propeller hub');
  const moving = new Set(hubVoxels);
  plane.root.blocks = plane.root.blocks.filter(block => !moving.has(block));
  plane.root.children.push({
    id: 'hub', name: 'Propeller', pivot,
    body: { type: 'kinematic', mass: 40, useGravity: false, collisionEnabled: true },
    blocks: hubVoxels, decorations: buildBlades(q, pivot).flat(), children: [],
  });
  return plane;
}
