// Native voxel blueprints for the Nature physics demonstration. The rover is
// planted in terrain before recording so the Selector can assemble it in shot.
export function buildPhysicsBlueprints(qEuler, { tagAircraftWheels = false } = {}) {
  const color = {
    ivory: 0xe7e5d6, ivoryShade: 0xc5ccca, petrol: 0x36665f, lightTeal: 0x548580,
    slate: 0x3c4a50, graphite: 0x263137, steel: 0x89999c, rubber: 0x212a2e,
    tread: 0x333c40, amber: 0xe3a54c, orange: 0xd38638, warm: 0xffe3b1,
    cyan: 0x8be1e4, red: 0xf27460, glass: 0x81b9c7, seat: 0x756557,
    wing: 0xf3c26e, wingDark: 0xb67b3d, navy: 0x325163,
  };
  const lattice = () => {
    const coarse = new Map();
    const fine = new Map();
    const decorations = [];
    const micro = (x, y, z, tint, part = null, materialId = 0) => {
      const cell = [x, y, z].map(v => Math.floor(v * 8 + 1e-6));
      const [dx, dy, dz] = cell.map(v => Math.floor(v / 8));
      if (coarse.has(`${dx},${dy},${dz}`)) return;
      const [mx, my, mz] = cell.map(v => (v % 8 + 8) % 8);
      fine.set(cell.join(','), { dx, dy, dz, mx, my, mz, size: 0.125, color: tint, part, materialId });
    };
    const fill = (x0, x1, y0, y1, z0, z1, tint, part = null, material = 0) => {
      const [a, b, c, d, e, f] = [x0, x1, y0, y1, z0, z1].map(v => Math.round(v * 8));
      for (let x = a; x < b; x++) for (let y = c; y < d; y++) for (let z = e; z < f; z++) {
        micro(x / 8, y / 8, z / 8, tint, part, material);
      }
    };
    const cube = (x, y, z, color, materialId = 0) => coarse.set(`${x},${y},${z}`, { dx: x, dy: y, dz: z, color, materialId });
    const box = (x0, x1, y0, y1, z0, z1, tint) => {
      for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) cube(x, y, z, tint);
    };
    const trim = (id, position, scale, color, materialId = 0, angle = [0, 0, 0]) => {
      decorations.push({ id: id.replaceAll('.', '_'), position, scale, color, materialId, rotation: qEuler(...angle) });
    };
    const blocks = () => [...coarse.values(), ...fine.values()];
    return { micro, fill, box, trim, blocks, decorations };
  };
  const wheel = (model, x, y, z, radius, width, side, label) => {
    // Square tread lugs sit one microcell proud of the sidewall; the hub and
    // rivets remain part of one wheel selection and rotate around its axle.
    const extent = Math.ceil(radius * 8);
    const z0 = z - width / 2;
    const layers = Math.round(width * 8);
    for (let ix = -extent; ix < extent; ix++) for (let iy = -extent; iy < extent; iy++) {
      const px = (ix + 0.5) / 8;
      const py = (iy + 0.5) / 8;
      const d = Math.hypot(px, py);
      if (d > radius) continue;
      const angle = Math.atan2(py, px);
      for (let layer = 0; layer < layers; layer++) {
        const outer = side < 0 ? layer : layers - 1 - layer;
        const shoulder = outer === 0 || layer === (side < 0 ? layers - 1 : 0);
        if (shoulder && d > radius - 0.08) continue;
        const notch = Math.abs(Math.cos(angle * 12 + layer * 0.34)) < 0.30;
        if (d > radius - 0.105 && notch) continue;
        let tint = d > radius - 0.12 ? color.tread : color.rubber;
        if (outer <= 1 && d < radius * 0.62) {
          const bolt = Math.abs(Math.sin(angle * 5)) < 0.34;
          tint = d < radius * 0.21 ? color.amber :
            d > radius * 0.52 ? color.steel :
            bolt ? color.ivory : color.slate;
        }
        model.micro(x + px, y + py, z0 + layer / 8 + 0.004, tint, label);
      }
    }
  };

  const rover = lattice();
  rover.box(1, 10, 1, 3, 1, 6, color.slate);
  rover.box(1, 10, 3, 4, 1, 6, color.petrol);
  // Slightly wider ivory shoulder, tapered sill ends and two-tier front grille.
  for (const z of [0.875, 6.0]) {
    // The rocker and trims use decorations on the root, outside the wheel selections.
    const side = z < 1 ? 'left' : 'right';
    rover.trim(`rocker-${side}`, [5.5, 1.58, z], [5.9, 0.19, 0.22], color.graphite);
    rover.trim(`shoulder-${side}`, [5.5, 2.98, z], [9.7, 0.25, 0.32], color.ivory);
    rover.trim(`pinstripe-${side}`, [5.45, 2.76, z], [9.12, 0.094, 0.33], color.amber);
    for (const wx of [2.5, 8.5]) {
      rover.trim(`arch-top-${side}-${wx}`, [wx, 2.53, z], [2.51, 0.25, 0.37], color.petrol);
      for (const end of [-1, 1]) {
        rover.trim(`arch-${side}-${wx}-${end}`, [wx + end * 1.0, 2.23, z],
          [0.62, 0.22, 0.37], color.petrol, 0, [0, 0, -end * 0.56]);
      }
    }
  }
  rover.fill(0.38, 1, 1.38, 2.87, 1.125, 5.875, color.petrol);
  rover.fill(10, 10.75, 1.25, 2.75, 1.13, 5.88, color.ivoryShade);
  rover.fill(10, 10.48, 2.75, 3.45, 1.38, 5.62, color.ivory);
  rover.trim('lower-skid', [10.63, 1.65, 3.5], [0.42, 0.39, 4.93], color.graphite);
  rover.trim('front-intake', [10.74, 2.22, 3.50], [0.10, 0.47, 2.85], color.graphite);
  for (let y = 2.07; y < 2.41; y += 0.13) {
    rover.trim(`grille-${y.toFixed(2)}`, [10.81, y, 3.5], [0.045, 0.037, 2.62], color.steel);
  }
  for (const z of [1.66, 5.34]) {
    rover.trim(`headlamp-trim-${z}`, [10.68, 2.58, z], [0.27, 0.28, 0.97], color.graphite);
    rover.trim(`daylight-${z}`, [10.83, 2.61, z], [0.047, 0.12, 0.80], color.warm, 1);
    rover.trim(`rear-lamp-${z}`, [0.34, 2.39, z], [0.09, 0.27, 0.42], color.red, 1);
  }
  for (const [id, x, z, side] of [
    ['wheel_fl', 8.5, 6.5, 1], ['wheel_rl', 2.5, 6.5, 1],
    ['wheel_fr', 8.5, 0.5, -1], ['wheel_rr', 2.5, 0.5, -1],
  ]) wheel(rover, x, 1.125, z, 1.125, 1.0, side, id);

  // Glazed two-seat cab, roof rack, twin amber beacons and bevelled side panels.
  rover.fill(5.58, 9.12, 4, 4.25, 1.28, 5.72, color.graphite);
  rover.fill(5.53, 8.91, 5.48, 5.75, 1.24, 5.76, color.ivory);
  rover.fill(5.75, 8.85, 5.75, 5.88, 1.5, 5.5, color.ivoryShade);
  for (const z of [2.4, 4.6]) {
    rover.fill(6.02, 6.89, 4.25, 4.5, z - 0.44, z + 0.44, color.seat);
    rover.fill(6.01, 6.30, 4.5, 5.25, z - 0.44, z + 0.44, color.seat);
    rover.trim(`headrest-${z}`, [6.16, 5.24, z], [0.23, 0.25, 0.49], color.graphite);
  }
  rover.trim('dashboard', [8.58, 4.47, 3.50], [0.62, 0.35, 3.85], color.graphite);
  for (const z of [2.19, 4.77]) {
    rover.trim(`gauge-${z}`, [8.29, 4.59, z], [0.06, 0.14, 0.5], color.cyan, 1);
  }
  rover.trim('windscreen', [9.04, 4.86, 3.5], [0.073, 1.47, 4.11], color.glass, 66, [0, 0, 0.24]);
  for (const z of [1.43, 3.50, 5.57]) {
    rover.trim(`windscreen-post-${z}`, [9.04, 4.86, z], [0.125, 1.49, 0.11], color.graphite, 0, [0, 0, 0.24]);
  }
  for (const z of [1.34, 5.66]) {
    rover.trim(`side-glass-${z}`, [7.11, 4.87, z], [3.35, 1.26, 0.068], color.glass, 66);
    for (const x of [5.48, 7.10, 8.78]) {
      rover.trim(`door-post-${z}-${x}`, [x, 4.86, z], [0.12, 1.29, 0.14], color.graphite);
    }
    rover.trim(`rack-${z}`, [7.29, 5.91, z], [2.91, 0.16, 0.13], color.graphite);
    rover.trim(`beacon-base-${z}`, [7.72, 5.95, z], [0.74, 0.12, 0.28], color.graphite);
    rover.trim(`beacon-${z}`, [7.72, 6.04, z], [0.61, 0.072, 0.19], color.amber, 1);
  }
  rover.trim('rear-cab-glass', [5.45, 4.86, 3.5], [0.073, 1.27, 4.27], color.glass, 63);
  for (const z of [2, 5]) rover.trim(`mirror-${z}`, [8.96, 4.77, z < 3.5 ? 0.91 : 6.09],
    [0.44, 0.27, 0.28], color.slate, 0, [0, z < 3.5 ? 0.27 : -0.27, 0]);

  // One deliberately isolated group for the top hatch and a second group for
  // the stylised game turret. Their parent-cell ownership is verified in capture.
  rover.fill(3.13, 5.0, 4.0, 4.26, 2.12, 4.87, color.orange, 'hatch');
  rover.fill(3.25, 4.87, 4.26, 4.39, 2.27, 4.74, color.amber, 'hatch');
  for (const z of [2.3, 4.6]) rover.fill(3.17, 3.47, 4.30, 4.49, z, z + 0.22, color.graphite, 'hatch');
  rover.fill(4.52, 4.81, 4.39, 4.52, 3.24, 3.77, color.graphite, 'hatch');
  for (let x = 1; x < 22; x++) for (let z = 17; z < 39; z++) {
    const u = (x + 0.5) / 8;
    const v = (z + 0.5) / 8;
    if (Math.hypot(u - 1.53, v - 3.5) > 1.15) continue;
    rover.fill(u - 0.0625, u + 0.06, 4, 4.28, v - 0.0625, v + 0.06, color.graphite, 'turret');
  }
  rover.fill(0.63, 2.50, 4.25, 4.95, 2.49, 4.51, color.petrol, 'turret');
  rover.fill(0.88, 2.36, 4.95, 5.12, 2.75, 4.25, color.ivory, 'turret');
  rover.fill(0.05, 0.87, 4.57, 4.91, 3.25, 3.75, color.slate, 'turret');
  rover.fill(0.0, 0.24, 4.48, 4.98, 3.15, 3.85, color.graphite, 'turret');
  rover.fill(2.47, 2.60, 4.65, 4.88, 3.16, 3.84, color.cyan, 'turret', 1);

  const airplane = lattice();
  // Airframe along +X. Native micro sections taper from the cockpit into the
  // tail and the rounded engine cowling, leaving the cabin canopy hollow.
  for (let i = -58; i < 48; i++) {
    const x = (i + 0.5) / 8;
    const tail = Math.max(0, -x - 0.55) / 6.7;
    const nose = Math.max(0, x - 3.65) / 2.35;
    const radius = 1.29 - 0.98 * tail - 0.54 * nose ** 1.6;
    const low = 1.01 + 0.53 * tail + 0.43 * nose;
    const top = x >= 2.55 ? 2.84 - 0.40 * nose : x < -0.55 ? 2.57 - 0.50 * tail : 2.39;
    for (let iy = 8; (iy + 0.5) / 8 <= top; iy++) for (let iz = -11; iz < 11; iz++) {
      const y = (iy + 0.5) / 8;
      const z = (iz + 0.5) / 8;
      const h = (y - low) / (top - low);
      if (h < 0 || Math.abs(z) > radius * Math.sqrt(Math.max(0, 1 - ((h - 0.56) / 0.70) ** 2))) continue;
      airplane.micro(x, y, z, y < low + 0.19 ? color.navy : y >= 1.77 && y < 2.02 ? color.wingDark :
        x > 5.35 ? color.navy : color.ivory);
    }
  }
  // No fixed wing, propeller or turbine template is imported. The surfaces use
  // a 0.125 m lattice, with separate thin trim parts at the control surfaces.
  for (const side of [-1, 1]) {
    for (let i = 8; i < 68; i++) {
      const z = (i + 0.5) / 8;
      const span = z / 8.5;
      const leading = 2.04 - 1.15 * span;
      const trailing = -1.72 + 0.24 * span;
      const y = 4.08 + 0.52 * span;
      for (let x = Math.ceil(trailing * 8); x < Math.floor(leading * 8); x++) {
        const px = (x + 0.5) / 8;
        airplane.micro(px, y, side * z, px < trailing + 0.38 ? color.navy : color.wing);
        if (span < 0.82 && px > trailing + 0.48 && px < leading - 0.33) airplane.micro(px, y + 0.125, side * z, color.wing);
      }
    }
    airplane.trim(`wingtip-${side}`, [-0.18, 4.68, side * 8.45], [2.15, 0.22, 0.33], color.navy);
    airplane.trim(`nav-${side}`, [0.79, 4.65, side * 8.44], [0.25, 0.13, 0.23], side > 0 ? color.cyan : color.red, 1);
    airplane.trim(`wing-strut-${side}`, [0.16, 3.03, side * 2.60],
      [0.16, 0.17, 3.57], color.steel, 0, [-side * 0.66, 0.02, 0]);
    airplane.trim(`tailplane-${side}`, [-6.13, 2.18, side * 1.73],
      [1.77, 0.21, 2.86], color.wing, 0, [side * 0.08, side * 0.17, 0]);
    airplane.trim(`main-gear-${side}`, [2.08, 1.08, side * 1.25],
      [0.21, 1.39, 0.19], color.steel, 0, [side * 0.40, 0, -0.13]);
    wheel(airplane, 2.00, 0.53, side * 1.50, 0.54, 0.5, side,
      tagAircraftWheels ? (side < 0 ? 'main_wheel_l' : 'main_wheel_r') : null);
    airplane.trim(`cab-side-${side}`, [1.11, 3.16, side * 1.18],
      [2.82, 1.36, 0.062], color.glass, 67, [side * 0.10, 0, 0]);
    for (const x of [-0.24, 1.44, 2.51]) airplane.trim(`cab-post-${side}-${x}`, [x, 3.16, side * 1.18],
      [0.09, 1.39, 0.10], color.navy, 0, [side * 0.10, 0, x === 2.51 ? 0.21 : 0]);
    airplane.trim(`cab-sill-${side}`, [1.13, 2.51, side * 1.22], [2.98, 0.16, 0.09], color.navy);
    airplane.trim(`seat-${side}`, [0.85, 2.63, side * 0.57], [0.67, 0.26, 0.63], color.seat);
    airplane.trim(`backrest-${side}`, [0.53, 2.91, side * 0.57], [0.22, 0.62, 0.57], color.seat, 0, [0, 0, 0.19]);
  }
  airplane.trim('cabin-roof', [1.13, 3.93, 0], [3.01, 0.15, 2.43], color.ivory);
  airplane.trim('wing-centre', [-0.00, 4.15, 0], [3.42, 0.30, 2.34], color.wing);
  airplane.trim('windscreen', [2.58, 3.19, 0], [0.058, 1.46, 2.36], color.glass, 63, [0, 0, 0.25]);
  airplane.trim('windscreen-pillar', [2.613, 3.19, 0], [0.092, 1.48, 0.072], color.navy, 0, [0, 0, 0.25]);
  for (const z of [-1.14, 1.14]) airplane.trim(`windscreen-border-${z}`, [2.613, 3.19, z],
    [0.092, 1.48, 0.082], color.navy, 0, [0, 0, 0.25]);
  airplane.trim('instrument-housing', [2.27, 2.68, 0], [0.48, 0.3, 1.93], color.graphite);
  airplane.trim('instrument-strip', [2.02, 2.73, 0], [0.036, 0.084, 1.51], color.cyan, 1);
  airplane.trim('fin', [-6.35, 3.17, 0], [1.60, 2.0, 0.22], color.wing, 0, [0, 0, 0.36]);
  airplane.trim('rudder', [-7.02, 3.37, 0], [0.54, 1.37, 0.145], color.navy, 0, [0, 0, 0.36]);
  airplane.trim('tailwheel-strut', [-6.3, 0.88, 0], [0.17, 1.28, 0.16], color.steel, 0, [0, 0, 0.27]);
  wheel(airplane, -6.44, 0.25, 0, 0.27, 0.26, 1, tagAircraftWheels ? 'tailwheel' : null);
  // The registry keeps the hub in its own parent cells beyond the cowling.
  const hubColor = 0xc59251;
  const hub = [6.375, 2.28, 0];
  for (let x = 48; x < 54; x++) for (let y = 13; y < 23; y++) for (let z = -5; z < 5; z++) {
    const py = (y + 0.5) / 8;
    const pz = (z + 0.5) / 8;
    const radius = 0.50 - 0.026 * (x - 48);
    if (Math.hypot(py - hub[1], pz) <= radius) airplane.micro((x + 0.5) / 8, py, pz, hubColor, 'hub');
  }
  const plane = {
    type: 'space-entity', version: 8, constraints: [],
    root: {
      id: 'root', name: 'Nature Utility Aircraft', pivot: [0, 0, 0], children: [],
      body: { type: 'kinematic', mass: 1200, useGravity: false, collisionEnabled: false },
      blocks: airplane.blocks(), decorations: airplane.decorations,
    },
  };
  return { rover: { blocks: rover.blocks(), decorations: rover.decorations }, plane, hubColor, color };
}

export function buildPropellerBlades(q, [x, y, z]) {
  const group = [];
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + 0.12;
    const offsets = [[0.79, -0.07, 0.85, 0.40, 0x314c60], [1.43, -0.14, 0.70, 0.31, 0x536873],
      [1.88, -0.20, 0.23, 0.26, 0xeac170]];
    group.push(offsets.map(([span, sweep, length, chord, color], j) => ({
      id: `airfoil-${i}-${j}`,
      position: [x + 0.07, y + Math.cos(angle) * span - Math.sin(angle) * sweep,
        z + Math.sin(angle) * span + Math.cos(angle) * sweep],
      scale: [0.115, length, chord], rotation: q(angle - 0.13, 0.31 - 0.09 * j, -0.04),
      color,
    })));
  }
  return group;
}
