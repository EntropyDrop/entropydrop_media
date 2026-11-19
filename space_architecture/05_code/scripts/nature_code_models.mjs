// Portable Space entities. Coordinates of each child share the root's authored grid.
export function buildCodeModels(q, physics, makeBlades) {
  const palette = {
    ink: 0x28383c, tire: 0x272f31, tread: 0x384346, steel: 0x829291,
    yellow: 0xe4a445, gold: 0xf1c36b, ivory: 0xe2e1cf, teal: 0x416e64,
    red: 0xbe725b, cyan: 0x7edfdf, glass: 0x8dbcbe, white: 0xffe4b4,
  };
  const { ink, tire, tread, steel, yellow, gold, ivory, teal, red, cyan, glass, white } = palette;
  const body = (type = 'kinematic', mass = 40) => ({
    type, mass, useGravity: type === 'dynamic', collisionEnabled: type === 'dynamic',
  });
  const part = (id, name, pivot = [0, 0, 0]) => ({
    id, name, pivot, body: body(), blocks: [], decorations: [], children: [], seats: [],
  });
  const shell = root => ({ type: 'space-entity', version: 8, constraints: [], root });
  const box = (node, id, position, scale, color, materialId = 0, angles = [0, 0, 0]) => {
    node.decorations.push({ id: id.replaceAll('.', '_'), position, scale, color, materialId, rotation: q(...angles) });
  };
  const strut = (node, id, a, b, width, color) => {
    const [x, y, z] = b.map((v, i) => v - a[i]);
    const length = Math.hypot(x, y, z);
    // Orient a Y-aligned decoration along its endpoints.
    const orientation = [z, 0, -x, length + y];
    const norm = Math.hypot(...orientation);
    node.decorations.push({
      id: id.replaceAll('.', '_'), position: a.map((v, i) => (v + b[i]) / 2), scale: [width, length, width],
      color, materialId: 0,
      rotation: orientation.map(v => v / norm),
    });
  };
  const voxel = (node, x, y, z, color, materialId = 0) => {
    const index = [x, y, z].map(v => Math.floor(v * 8 + 1e-5));
    const [dx, dy, dz] = index.map(v => Math.floor(v / 8));
    const [mx, my, mz] = index.map(v => (v % 8 + 8) % 8);
    node.blocks.push({ dx, dy, dz, mx, my, mz, size: 0.125, color, materialId });
  };

  function rover(script, dynamic) {
    const source = physics.rover;
    const root = part('rover', 'Field Service Rover');
    root.body = { ...body(dynamic ? 'dynamic' : 'kinematic', 1500), useGravity: false, collisionEnabled: false };
    root.blocks = source.blocks.filter(b => !b.part);
    root.decorations = source.decorations.slice();
    const wheels = [
      ['wheel_fl', 'Front left wheel', [8.5, 1.125, 6.5]],
      ['wheel_fr', 'Front right wheel', [8.5, 1.125, 0.5]],
      ['wheel_rl', 'Rear left wheel', [2.5, 1.125, 6.5]],
      ['wheel_rr', 'Rear right wheel', [2.5, 1.125, 0.5]],
    ];
    for (const [id, name, pivot] of wheels) {
      const wheel = part(id, name, pivot);
      wheel.blocks = source.blocks.filter(b => b.part === id);
      root.children.push(wheel);
    }
    const hatch = part('hatch', 'Service hatch', [4.9, 4.1, 3.48]);
    hatch.blocks = source.blocks.filter(b => b.part === 'hatch');
    box(hatch, 'raised-grip', [3.56, 4.53, 3.48], [0.58, 0.10, 0.26], ink);
    root.children.push(hatch);
    box(root, 'deck-well', [4.03, 4.018, 3.48], [1.78, 0.09, 2.75], ink);
    for (const z of [1.50, 5.50]) {
      box(root, `deck-rail-${z}`, [3.02, 4.30, z], [3.98, 0.17, 0.17], steel);
      for (const x of [1.15, 4.89]) box(root, `deck-leg-${x}-${z}`, [x, 4.17, z], [0.15, 0.42, 0.17], ink);
    }
    root.seats = [{ position: [6.52, 5.067, 4.60], rotation: q(0, -Math.PI / 2, 0) }];
    root.scriptLanguage = 'assemblyscript';
    root.script = script;
    return shell(root);
  }

  function aircraft(script) {
    const model = structuredClone(physics.plane);
    const hub = part('hub', 'Propeller', [6.375, 2.28, 0]);
    hub.blocks = model.root.blocks.filter(b => b.part === 'hub' || b.color === physics.hubColor);
    hub.decorations = makeBlades(q, hub.pivot).flat();
    model.root.children.push(hub);
    for (const [id, name, pivot] of [
      ['main_wheel_l', 'Left landing wheel', [2, 0.53, -1.5]],
      ['main_wheel_r', 'Right landing wheel', [2, 0.53, 1.5]],
      ['tailwheel', 'Tailwheel', [-6.44, 0.25, 0]],
    ]) {
      const wheel = part(id, name, pivot);
      wheel.blocks = model.root.blocks.filter(b => b.part === id);
      if (!wheel.blocks.length) throw new Error(`Aircraft blueprint lacks ${id}`);
      model.root.children.push(wheel);
    }
    const movingBlocks = new Set(model.root.children.flatMap(node => node.blocks));
    model.root.blocks = model.root.blocks.filter(b => !movingBlocks.has(b));
    model.root.body = { ...body('dynamic', 1200), collisionEnabled: false };
    model.root.scriptLanguage = 'assemblyscript';
    model.root.script = script;
    return model;
  }

  function paver(script) {
    const root = part('paver', 'Survey & Paving Machine');
    // Powered tracks, rear articulated screed and walkaround cab.
    box(root, 'chassis', [0.04, 1.24, 0], [7.14, 0.71, 4.69], ink);
    box(root, 'engine-cover', [-1.54, 2.08, 0], [3.72, 1.22, 3.12], yellow);
    box(root, 'rear-bumper', [-3.56, 1.08, 0], [0.29, 0.88, 4.88], ink);
    box(root, 'rear-service-panel', [-3.43, 2.10, 0], [0.16, 0.85, 2.92], gold);
    box(root, 'cab-floor', [0.95, 1.75, 0], [2.22, 0.20, 3.74], steel);
    box(root, 'canopy', [0.82, 3.88, 0], [2.64, 0.22, 3.55], ivory);
    for (const side of [-1, 1]) {
      const z = side * 1.83;
      const trackZ = side * 2.19;
      box(root, `sill-${side}`, [0.05, 1.6, z], [7.48, 0.35, 0.62], yellow);
      box(root, `handrail-${side}`, [-2.04, 2.92, z], [2.85, 0.10, 0.09], gold);
      for (const x of [-3.12, -1.03]) box(root, `handrail-post-${x}-${side}`, [x, 2.65, z], [0.09, 0.60, 0.09], gold);
      box(root, `cab-panel-${side}`, [1.00, 1.97, z * 0.9], [2.10, 0.36, 0.17], yellow);
      box(root, `cab-glass-${side}`, [0.85, 2.91, z * 0.87], [1.99, 1.64, 0.06], glass, 69);
      for (const x of [-0.25, 1.92]) box(root, `cab-stile-${x}-${side}`, [x, 2.89, z * 0.87], [0.14, 1.81, 0.14], ink);
      for (let i = 0; i < 8; i++) box(root, `vent-${i}-${side}`, [-3.05 + i * 0.20, 2.25, side * 1.572], [0.088, 0.42, 0.029], ink);
      for (const x of [-2.7, -1.35, 0, 1.35, 2.7]) {
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5;
          const r = x === -2.7 || x === 2.7 ? 0.61 : 0.43;
          box(root, `roller-${x}-${i}-${side}`, [x + Math.cos(a) * r * 0.66, 0.72 + Math.sin(a) * r * 0.66, trackZ],
            [r * 0.65, r * 0.65, 0.86], i % 2 ? steel : ink, 0, [0, 0, a]);
        }
        box(root, `roller-hub-${x}-${side}`, [x, 0.72, side * 2.65], [0.29, 0.29, 0.15], yellow);
      }
      box(root, `belt-core-${side}`, [0, 0.72, trackZ], [5.52, 0.80, 0.77], tire);
      for (let i = 0; i <= 17; i++) {
        const x = -2.72 + 0.32 * i;
        for (const y of [0.13, 1.31]) box(root, `tread-${i}-${y}-${side}`, [x, y, trackZ], [0.28, 0.19, 1.12], tread);
      }
      for (const end of [-1, 1]) for (let i = -2; i <= 2; i++) {
        const a = i * 0.46;
        box(root, `radius-${end}-${i}-${side}`, [end * (2.72 + 0.59 * Math.cos(a)), 0.72 + 0.59 * Math.sin(a), trackZ],
          [0.18, 0.28, 1.12], tread, 0, [0, 0, a * end]);
      }
      box(root, `hopper-wall-${side}`, [2.78, 1.58, side * 1.51], [2.08, 0.20, 1.25], yellow, 0, [side * 0.56, 0, 0]);
      box(root, `hopper-lip-${side}`, [3.73, 1.33, side * 1.25], [0.25, 0.27, 2.27], ink);
      box(root, `work-lamp-${side}`, [2.11, 3.70, side * 1.52], [0.095, 0.20, 0.34], white, 1);
      box(root, `beacon-${side}`, [-0.04, 4.04, side * 1.25], [0.18, 0.22, 0.23], gold, 1);
      strut(root, `screed-ram-${side}`, [-1.9, 1.5, side * 2.52], [-4.54, 0.57, side * 3.01], 0.14, steel);
      strut(root, `screed-arm-${side}`, [-2.49, 1.06, side * 2.5], [-4.24, 0.46, side * 2.96], 0.24, ink);
    }
    box(root, 'windscreen', [1.945, 2.9, 0], [0.06, 1.66, 3.20], glass, 67);
    box(root, 'hopper-bed', [2.92, 1.22, 0], [2.10, 0.22, 2.75], ink);
    box(root, 'hopper-feed', [2.24, 1.38, 0], [0.19, 0.52, 2.77], steel);
    box(root, 'screed', [-4.43, 0.20, 0], [1.30, 0.37, 6.94], ink);
    box(root, 'screed-cover', [-4.35, 0.47, 0], [0.92, 0.20, 6.74], yellow);
    for (let i = 0; i < 7; i++) {
      box(root, `screed-light-${i}`, [-4.93, 0.46, i - 3], [0.055, 0.08, 0.45], white, 1);
    }
    box(root, 'survey-arm', [2.52, 2.27, 0], [0.47, 0.15, 0.15], ink);
    box(root, 'survey-head', [2.70, 2.23, 0], [0.49, 0.31, 0.46], steel);
    box(root, 'survey-optics', [2.70, 2.04, 0], [0.21, 0.08, 0.22], cyan, 1);
    box(root, 'survey-ray', [2.70, 1.06, 0], [0.044, 1.95, 0.044], cyan, 1);
    voxel(root, 0, 1.25, 0, ink);
    root.scriptLanguage = 'assemblyscript';
    root.script = script;
    return shell(root);
  }

  function gate(script) {
    const root = part('gate', 'North Service Gate');
    for (const side of [-1, 1]) {
      const z = side * 5.65;
      box(root, `foundation-${side}`, [0, 0.16, z], [1.86, 0.34, 2.53], steel);
      box(root, `pillar-${side}`, [0, 2.78, z], [1.00, 5.27, 1.27], ink);
      box(root, `panel-${side}`, [0.56, 2.34, z], [0.16, 3.42, 0.91], teal);
      box(root, `sensor-${side}`, [0.68, 3.63, z], [0.09, 0.25, 0.47], cyan, 1);
      box(root, `cap-${side}`, [0, 5.46, z], [1.37, 0.25, 1.48], ivory);
      box(root, `guardrail-${side}`, [0, 1.62, side * 8.15], [0.19, 0.22, 5.87], steel);
      for (const p of [6.7, 8.8, 10.8]) box(root, `fence-post-${side}-${p}`, [0, 0.91, side * p], [0.21, 1.83, 0.20], ink);
      const leaf = part(side < 0 ? 'left' : 'right', 'Sliding door', [0, 0, 0]);
      box(leaf, 'lower-panel', [0, 0.98, side * 2.57], [0.26, 1.00, 4.97], teal);
      for (const y of [0.44, 1.52, 3.7]) box(leaf, `rail-${y}`, [0, y, side * 2.56], [0.23, 0.19, 5.15], ink);
      for (let i = 0; i < 12; i++) {
        box(leaf, `slat-${i}`, [0, 2.58, side * (0.14 + i * 0.43)], [0.10, 2.18, 0.105], steel);
      }
      for (let i = 0; i < 8; i++) {
        box(leaf, `warning-${i}`, [-0.142, 1.16, side * (0.42 + i * 0.61)],
          [0.035, 0.38, 0.24], i % 2 ? ink : gold, 0, [0.45, 0, 0]);
      }
      box(leaf, 'edge-frame', [0, 2.10, side * 0.07], [0.24, 3.37, 0.13], ink);
      box(leaf, 'edge-light', [-0.13, 2.10, side * 0.17], [0.045, 2.84, 0.09], red, 1);
      root.children.push(leaf);
    }
    box(root, 'header', [0, 5.26, 0], [0.89, 0.65, 11.66], teal);
    box(root, 'header-inset', [-0.47, 5.26, 0], [0.08, 0.40, 8.50], ink);
    for (const z of [-4.1, -3.8, 3.8, 4.1]) box(root, `header-lamp-${z}`, [-0.535, 5.24, z], [0.06, 0.17, 0.23], white, 1);
    voxel(root, 0.25, 0, 5.625, ink);
    root.scriptLanguage = 'assemblyscript';
    root.script = script;
    return shell(root);
  }

  function radar(script) {
    const root = part('radar', 'Approach Radar');
    box(root, 'slab', [0, 0.17, 0], [3.82, 0.33, 3.78], steel);
    box(root, 'cabinet', [0, 0.83, 0], [2.11, 1.34, 2.18], teal);
    box(root, 'access-panel', [-1.07, 0.9, 0], [0.14, 0.89, 1.63], ivory);
    box(root, 'status', [-1.15, 1.03, 0.53], [0.09, 0.18, 0.27], cyan, 1);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      strut(root, `leg-${x}-${z}`, [x * 1.45, 0.31, z * 1.45], [x * 0.72, 7.1, z * 0.72], 0.27, ivory);
      for (const y of [1.5, 3.2, 4.8]) {
        const span = 1.49 - y * 0.107;
        const next = span - 0.18;
        strut(root, `cross-${x}-${z}-${y}`, [x * span, y, z * span], [-x * next, y + 1.58, z * next], 0.117, steel);
        strut(root, `side-${x}-${z}-${y}`, [x * span, y, z * span], [x * next, y + 1.58, -z * next], 0.115, steel);
      }
    }
    box(root, 'upper-platform', [0, 6.99, 0], [2.64, 0.25, 2.63], ink);
    box(root, 'drive-pedestal', [0, 7.44, 0], [1.11, 0.85, 1.10], teal);
    const dish = part('dish', 'Rotating radar dish', [0, 8.9, 0]);
    // A sampled paraboloid with metal edging and a feed at its focal point.
    for (let i = -22; i <= 22; i++) for (let j = -13; j <= 13; j++) {
      const z = i / 8;
      const y = j / 8;
      const r = Math.hypot(z / 2.78, y / 1.68);
      if (r > 1.01 || (i + j) % 2 === 1 && r < 0.93) continue;
      voxel(dish, 0.83 * r * r, 8.95 + y, z, r > 0.88 ? steel : ivory);
    }
    for (const z of [-1.64, 1.64]) {
      strut(dish, `feed-brace-${z}`, [0.45, 8.23, z], [1.79, 8.94, 0], 0.13, ink);
    }
    box(dish, 'feed', [1.68, 8.95, 0], [0.51, 0.28, 0.28], ink);
    box(dish, 'feed-lens', [1.96, 8.95, 0], [0.079, 0.19, 0.19], cyan, 1);
    box(dish, 'counterweight', [-0.32, 8.92, 0], [0.65, 0.73, 0.77], teal);
    box(dish, 'turntable', [0, 7.86, 0], [1.49, 0.22, 1.53], ink);
    voxel(root, 0, 0.25, 0, ink);
    root.children.push(dish);
    root.scriptLanguage = 'assemblyscript';
    root.script = script;
    return shell(root);
  }

  return { rover, aircraft, paver, gate, radar };
}
