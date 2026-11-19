// Serialized into the offline Space client by record_villa.mjs.
// Local coordinates are in metres, with +Z toward the cliff and the front terrace.
export function installVilla() {
  const rec = window.__rec;
  const world = rec.g.world;
  const origin = [8180, 79, 1052];
  const at = (x, y, z) => [origin[0] + x, origin[1] + y, origin[2] + z];
  const colors = {
    limestone: 0xded0b7, limestoneLight: 0xebdfc9, sandstone: 0xbfa884,
    concrete: 0x827b70, charcoal: 0x39434b, slate: 0x4e5354, basalt: 0x555b5d,
    bronze: 0xb98754, timber: 0x9b6139, darkTimber: 0x694329, mullion: 0x354957,
    glass: 0xaad0d9, fabric: 0xe5c9a3, moss: 0x64814b, leaf: 0x477441, glow: 0xffc18a,
  };
  const stages = [];
  const detailWrites = new Map();
  const counts = { coarse: 0, micro: 0, decorations: 0, steppedRoof: 0 };
  const block = (x, y, z, color, material = 0) => {
    world.setBlock(...at(x, y, z), 1, true, color, material);
    counts.coarse++;
  };
  const stone = (x, y, z, palette) => {
    const i = ((x * 31 + y * 13 + z * 17) % palette.length + palette.length) % palette.length;
    return palette[i];
  };
  const fill = (x0, x1, y0, y1, z0, z1, color) => {
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      block(x, y, z, Array.isArray(color) ? stone(x, y, z, color) : color);
    }
  };
  const microBox = (x0, x1, y0, y1, z0, z1, color, material = 0) => {
    const [mx0, mx1, my0, my1, mz0, mz1] = [x0, x1, y0, y1, z0, z1].map(v => Math.round(v * 8));
    for (let x = mx0; x < mx1; x++) for (let y = my0; y < my1; y++) for (let z = mz0; z < mz1; z++) {
      detailWrites.set(`${x},${y},${z}`, [x, y, z, color, material]);
    }
  };
  const writeMicro = (x, y, z, color, material = 0) => world.setMicroBlock(
    origin[0] * 8 + x, origin[1] * 8 + y, origin[2] * 8 + z, color, null, material,
  );
  const deco = (id, anchor, center, scale, color, materialId = 0, angle = 0) => {
    const [x, y, z] = at(...anchor);
    return world.setTerrainDecoration({
      id, x, y, z,
      position: center.map((v, i) => v - anchor[i]),
      rotation: rec.qEuler(0, 0, angle),
      scale, color, materialId,
    });
  };

  function prepareSite() {
    // Avoid stray vegetation inside the footprint while keeping the Aether cliff intact.
    for (let x = -16; x < 16; x++) for (let z = -8; z < 11; z++) for (let y = 0; y < 10; y++) {
      if (world.getBlock(...at(x, y, z))) world.setBlock(...at(x, y, z), 0, true);
    }
    for (let x = -4; x < 5; x++) for (let z = 10; z < 15; z++) for (let y = -3; y < 1; y++) {
      if (world.getBlock(...at(x, y, z))) world.setBlock(...at(x, y, z), 0, true);
    }
  }

  // Coarse voxel reveal, from the stepped foundation to the offset second story.
  const foundation = [colors.basalt, 0x5e6361, 0x626766, 0x6d6e68, colors.basalt];
  for (let y = -6; y < -1; y++) {
    stages.push(() => {
      const retreat = Math.max(0, -2 - y);
      // Continuous courses keyed into the hillside, with lower terraces stepped back.
      fill(-16 + retreat, 16 - retreat, y, y + 1, -8, 10 - retreat, foundation);
    });
  }
  stages.push(() => {
    fill(-16, 16, -1, 0, -8, 10, [colors.concrete, 0x8b8275, 0x938a7e, colors.concrete]);
    fill(-16, 16, -1, 0, 9, 10, colors.sandstone);
    fill(-16, -15, -1, 0, -6, 9, colors.sandstone);
    fill(15, 16, -1, 0, -6, 9, colors.sandstone);
    fill(-2, 4, -3, -2, 10, 13, foundation);
    fill(-2, 4, -2, -1, 10, 12, colors.sandstone);
    fill(-2, 4, -1, 0, 10, 11, colors.limestone);
    fill(-4, 5, -4, -3, 11, 15, foundation);
    fill(-4, 5, -3, -2, 13, 15, colors.sandstone);
  });
  const limestone = [colors.limestone, 0xd8c9af, 0xe2d2b7, colors.limestone, colors.limestoneLight];
  for (let y = 0; y < 8; y++) {
    stages.push(() => {
      // Tall living wing and its return facade, with open bays for the microvoxel glazing frames.
      fill(-14, -1, y, y + 1, -7, -6, limestone);
      fill(-2, -1, y, y + 1, -6, 3, limestone);
      for (let z = -6; z < 4; z++) {
        if (y === 0 || y >= 6 || z < -4 || z >= 3) block(-14, y, z, stone(-14, y, z, limestone));
      }
      for (let x = -14; x < -1; x++) {
        if (y === 0 || y >= 6 || x === -14 || x === -2) block(x, y, 3, stone(x, y, 3, limestone));
      }

      // Recessed wood entry leads between the two wings.
      if (y < 6) {
        fill(-1, 4, y, y + 1, -7, -6, limestone);
        if (y === 3) fill(-1, 4, y, y + 1, -6, 5, colors.limestoneLight);
        if (y < 3) {
          block(-1, y, 4, colors.limestoneLight);
          block(3, y, 4, colors.limestoneLight);
          for (let x = 0; x < 3; x++) if (x !== 1 || y === 2) block(x, y, 1, colors.timber);
        }
      }

      // The dark upper volume is shifted forward and separated by a stone belt course.
      if (y < 4) {
        fill(4, 13, y, y + 1, -7, -6, limestone);
        fill(4, 5, y, y + 1, -6, 4, limestone);
        fill(12, 13, y, y + 1, -6, 4, limestone);
        for (let x = 5; x < 12; x++) {
          if (y === 0 || y === 3) block(x, y, 3, colors.limestone);
        }
      }
      if (y === 4 || y === 7) fill(2, 14, y, y + 1, -6, y === 4 ? 7 : 6, colors.charcoal);
      if (y === 5 || y === 6) {
        fill(2, 14, y, y + 1, -6, -5, colors.charcoal);
        fill(2, 3, y, y + 1, -5, 5, colors.charcoal);
        fill(13, 14, y, y + 1, -5, 5, colors.charcoal);
        block(2, y, 5, colors.charcoal);
        block(13, y, 5, colors.charcoal);
        block(8, y, 5, colors.charcoal);
      }
    });
  }

  let nextStage = 0;
  const coarseAt = fraction => {
    const target = Math.min(stages.length, Math.floor(fraction * stages.length));
    while (nextStage < target) stages[nextStage++]();
  };

  function windowDetail(x0, x1, y0, y1, z, divisions, side = false) {
    const put = (a, b, c, d, p, q, color) => {
      if (side) microBox(p, q, c, d, a, b, color);
      else microBox(a, b, c, d, p, q, color);
    };
    const trim = (a, b, c, d) => put(a, b, c, d, z - 0.25, z, colors.mullion);
    trim(x0, x0 + 0.25, y0, y1);
    trim(x1 - 0.25, x1, y0, y1);
    trim(x0, x1, y0, y0 + 0.25);
    trim(x0, x1, y1 - 0.25, y1);
    for (const x of divisions) trim(x, x + 0.125, y0, y1);
    if (y1 - y0 > 3) trim(x0, x1, y0 + 2.5, y0 + 2.625);

    // Two 12.5 cm offsets cast a readable shadow across the sill and jamb.
    for (let step = 0; step < 2; step++) {
      const out = side ? -1 : 1;
      const a = z + out * (step * 0.125);
      const b = z + out * ((step + 1) * 0.125);
      const thickness = (2 - step) * 0.125;
      put(x0, x1, y0, y0 + thickness, Math.min(a, b), Math.max(a, b), colors.limestoneLight);
      put(x0, x0 + thickness, y0, y1, Math.min(a, b), Math.max(a, b), colors.sandstone);
    }
  }

  let detailReady = false;
  function details() {
    if (detailReady) return;
    detailReady = true;
    windowDetail(-13, -2, 1, 6, 3.875, [-10.375, -7.625, -4.875]);
    windowDetail(-4, 3, 1, 6, -13.125, [-1.75, 0.625], true);
    windowDetail(5, 12, 1, 3, 3.875, [7.25, 9.625]);
    windowDetail(3, 8, 5, 7, 5.75, [5.5]);
    windowDetail(9, 13, 5, 7, 5.75, [11]);

    // Terrace railing and its balcony return, each built with true microvoxels.
    const rail = (x0, x1, z, y, rotated = false) => {
      const put = (a, b, c, d, p, q, color) => {
        if (rotated) microBox(p, q, c, d, a, b, color);
        else microBox(a, b, c, d, p, q, color);
      };
      put(x0, x1, y + 0.875, y + 1.125, z, z + 0.25, colors.bronze);
      for (let x = x0 + 0.125; x < x1 - 0.125; x += 0.875) {
        put(x, x + 0.125, y, y + 0.875, z + 0.0625, z + 0.1875, colors.charcoal);
      }
    };
    rail(-15.625, -2.25, 8.875, 0);
    rail(4.25, 15.5, 8.875, 0);
    rail(4.25, 9.125, -15.625, 0, true);
    rail(4.25, 9.125, 15.25, 0, true);
    rail(3.0, 13.75, 6.75, 5);
    for (let step = 0; step < 3; step++) {
      microBox(-1.875, 3.875, -1, -0.25 * (step + 1), 11 + step * 0.25, 11.25 + step * 0.25, colors.limestoneLight);
      microBox(-1.875, 3.875, -2, -1 - 0.25 * (step + 1), 12 + step * 0.25, 12.25 + step * 0.25, colors.limestoneLight);
    }

    // Furniture silhouettes and warm light visible through the curtain wall.
    microBox(-11.875, -8.5, 0, 0.5, -1, 0.25, colors.fabric);
    microBox(-11.875, -8.5, 0.5, 1, -1, -0.625, colors.fabric);
    microBox(-12, -11.625, 0.5, 0.75, -0.625, 0.25, colors.fabric);
    microBox(-8.75, -8.375, 0.5, 0.75, -0.625, 0.25, colors.fabric);
    microBox(-10.75, -9.125, 0.375, 0.625, 1.0, 1.875, colors.timber);
    microBox(-10.5, -9.375, 0, 0.375, 1.25, 1.625, colors.darkTimber);
    for (const [x, y, z] of [[-11, 3.5, 0], [-8.5, 4.125, -0.5], [-6, 4.75, -1]]) {
      microBox(x, x + 0.25, y, y + 0.625, z, z + 0.25, colors.glow, 1);
      microBox(x, x + 0.125, y + 0.625, 7, z, z + 0.125, colors.charcoal);
    }
    microBox(7, 10.5, 0.75, 1, 1, 2, colors.timber);
    microBox(7.25, 7.5, 0, 0.75, 1.25, 1.75, colors.darkTimber);
    microBox(10, 10.25, 0, 0.75, 1.25, 1.75, colors.darkTimber);
    for (const x of [-3.25, 4.5, 13.75]) {
      microBox(x, x + 1.25, 0, 0.5, 6.125, 7.375, colors.charcoal);
      microBox(x + 0.375, x + 0.875, 0.5, 1.125, 6.5, 7, colors.leaf);
      microBox(x + 0.125, x + 1.125, 0.75, 1, 6.375, 7.125, colors.moss);
      microBox(x + 0.375, x + 0.75, 1.125, 1.375, 6.625, 7, colors.moss);
    }
    microBox(0, 0.25, 1.625, 2.25, 2, 2.25, colors.glow, 1);
    microBox(2.75, 3, 1.625, 2.25, 2, 2.25, colors.glow, 1);

    // Infill follows the underside of the sloping cuboid and closes the high side.
    for (let i = -112; i < -8; i++) {
      const x = i / 8;
      const top = Math.ceil((roofCenter[1] - 0.06 + Math.tan(roofAngle) * (x + 0.0625 - roofCenter[0])) * 8) / 8;
      microBox(x, x + 0.125, 8, top, 3.5, 4, colors.darkTimber);
      microBox(x, x + 0.125, 8, top, -7, -6.5, colors.darkTimber);
      if (i < -108 || i >= -12) microBox(x, x + 0.125, 8, top, -6.5, 3.5, colors.darkTimber);
    }

    for (const args of detailWrites.values()) {
      if (writeMicro(...args)) counts.micro++;
    }
    detailWrites.clear();

    // Thin translucent planes leave microvoxel frames free of overlapping coarse blocks.
    const glazing = [
      ['living', [-8, 0, 3], [-7.5, 3.5, 3.55], [10.75, 4.75, 0.06]],
      ['return', [-14, 0, 0], [-13.05, 3.5, -0.5], [0.06, 4.75, 6.75]],
      ['dining', [8, 0, 3], [8.5, 2, 3.55], [6.75, 1.75, 0.06]],
      ['upper-west', [5, 4, 5], [5.5, 6, 5.45], [4.75, 1.75, 0.06]],
      ['upper-east', [11, 4, 5], [11, 6, 5.45], [3.75, 1.75, 0.06]],
    ];
    for (const [id, anchor, center, size] of glazing) {
      deco(`villa-glass-${id}`, anchor, center, size, colors.glass, 81);
      counts.decorations++;
    }
  }

  const roofAnchor = [-8, 7, 3];
  // A single rotated cuboid is the entire overhanging roof of the living wing.
  const roofCenter = [-7.875, 9.55, -0.65];
  const roofAngle = -Math.PI / 15;
  let roofPlaced = false;
  const markRoofAnchor = marked => world.setBlock(...at(...roofAnchor), 1, true,
    marked ? 0xedb467 : stone(...roofAnchor, limestone),
  );
  function roof(fraction = 1) {
    const firstPlacement = !roofPlaced;
    roofPlaced = true;
    const t = Math.max(0, Math.min(1, fraction));
    const offset = [0.5, 1.5, 1.25];
    const center = roofCenter.map((v, axis) => (1 - t) * (roofAnchor[axis] + offset[axis]) + t * v);
    const size = [15.75, 0.32, 11.75].map(v => 1 + (v - 1) * t);
    deco('villa-shed-roof', roofAnchor, center, size, colors.slate, 0, roofAngle * t);
    if (firstPlacement) counts.decorations++;
  }
  function steppedRoof() {
    // A five-metre sample at the eave, constructed on the same 12.5 cm grid.
    for (let x = -118; x < -76; x++) {
      const y = Math.floor((roofCenter[1] + Math.tan(roofAngle) * ((x + 0.5) / 8 - roofCenter[0])) * 8);
      for (let dz = 38; dz < 44; dz++) for (let dy = -2; dy <= 0; dy++) {
        if (writeMicro(x, y + dy, dz, colors.slate)) counts.steppedRoof++;
      }
    }
  }

  function removeSteppedRoof() {
    for (let x = -118; x < -76; x++) {
      const y = Math.floor((roofCenter[1] + Math.tan(roofAngle) * ((x + 0.5) / 8 - roofCenter[0])) * 8);
      for (let dz = 38; dz < 44; dz++) for (let dy = -2; dy <= 0; dy++) {
        world.removeMicroBlock(origin[0] * 8 + x, origin[1] * 8 + y + dy, origin[2] * 8 + dz);
      }
    }
  }

  async function spawnCollisionProbe() {
    const root = {
      id: 'root', name: 'Roof collision test', pivot: [0, 0, 0], children: [],
      body: { type: 'dynamic', mass: 2, useGravity: true, collisionEnabled: true },
      blocks: [{ dx: 0, dy: 0, dz: 0, color: 0xffa331, materialId: 0 }], decorations: [],
    };
    const bounds = {
      minX: origin[0] - 14.25, maxX: origin[0] - 13,
      minY: origin[1] + 9.5, maxY: origin[1] + 12.5,
      minZ: origin[2] + 4, maxZ: origin[2] + 5,
    };
    const footprint = world.getTerrainDecorationCollisionBoxesInAABB(bounds);
    if (!footprint.length) throw new Error('No eave collider above the open terrace');
    const probe = await rec.spawnModel({ type: 'space-entity', version: 8, root, constraints: [] }, at(-13.65, 15, 4.4));
    return { probe, roofCollisionBoxes: footprint.length };
  }

  window.__villa = { at, prepareSite, coarseAt, details, markRoofAnchor, roof, steppedRoof, removeSteppedRoof, spawnCollisionProbe, counts };
}
