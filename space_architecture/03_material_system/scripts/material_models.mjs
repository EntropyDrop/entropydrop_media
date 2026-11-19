// Built inside the offline Nature client. Every visible surface uses Space
// blocks, microvoxels or rotated decoration voxels and the engine's materials.
export async function installMaterialFilm() {
  const rec = window.__rec;
  const { g } = rec;
  const world = g.world;
  const c = {
    slate: 0x424f58, steel: 0x657780, dark: 0x263238, pale: 0xe5dfd1,
    stone: 0xb9b3a7, oak: 0xa5744d, darkOak: 0x664832, cyan: 0x65eafa,
    glass: 0x8dcbda, greenhouseGlass: 0xc0ded1, gold: 0xf2a93b,
    rubber: 0x20262b, ivory: 0xf4e7cc, moss: 0x51744a,
  };
  const opaque = 0;
  const emit = 1;
  const trans = pct => pct + 1;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const ease = (start, end, time) => {
    const u = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return u * u * (3 - 2 * u);
  };
  const shadeAt = (palette, x, z) => palette[((x * 53 + z * 19) % palette.length + palette.length) % palette.length];
  const counts = {};
  const terrain = (name, origin) => {
    let nextId = 0;
    const stats = counts[name] = { blocks: 0, micro: 0, decorations: 0 };
    const at = (...v) => add(origin, v);
    const block = (x, y, z, color, material = opaque) => {
      const p = at(x, y, z);
      world.setBlock(...p, 1, true, color, material);
      stats.blocks++;
    };
    const box = (x0, x1, y0, y1, z0, z1, color) => {
      for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) {
        block(x, y, z, Array.isArray(color) ? shadeAt(color, x, z) : color);
      }
    };
    const micro = (x, y, z, color, material = opaque) => {
      const p = [x, y, z].map((v, i) => v + origin[i] * 8);
      if (world.setMicroBlock(...p, color, null, material)) stats.micro++;
    };
    const detail = (x0, x1, y0, y1, z0, z1, color, material = opaque) => {
      const [a,b,d,e,f,h] = [x0,x1,y0,y1,z0,z1].map(v => Math.round(v * 8));
      for (let x = a; x < b; x++) for (let y = d; y < e; y++) for (let z = f; z < h; z++) {
        micro(x, y, z, color, material);
      }
    };
    const attach = (center, size, color, material = opaque, r = [0, 0, 0]) => {
      const anchor = [Math.floor(center[0]), -1, Math.floor(center[2])];
      const [x, y, z] = at(...anchor);
      const id = `m03-${name}-${nextId++}`;
      // Space measures an attached voxel's offset from the centre of its anchor.
      const position = center.map((v, i) => v - (anchor[i] + 0.5));
      const rotation = rec.qEuler(...r);
      const set = (color, material) => world.setTerrainDecoration({ x, y, z, id, position, rotation, scale: size, color, materialId: material });
      set(color, material);
      stats.decorations++;
      return set;
    };
    const pad = (x0, x1, z0, z1, color, clearHeight = 2) => {
      for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
        const [wx, wy, wz] = at(x, 0, z);
        const ground = rec.groundY(wx, wz);
        for (let y = wy; y < Math.min(wy + clearHeight, ground); y++) {
          if (world.getBlock(wx, y, wz)) world.setBlock(wx, y, wz, 0, true);
        }
        const rim = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
        for (let y = Math.min(-1, ground - wy); y < -1; y++) block(x, y, z, rim ? c.slate : c.stone);
        block(x, -1, z, Array.isArray(color) ? shadeAt(color, x, z) : color);
      }
    };
    return { at, block, box, micro, detail, attach, pad };
  };

  const lab = terrain('lab', [5378, 19, 821]);
  const hall = terrain('curtain', [5413, 19, 803]);
  const garden = terrain('greenhouse', [5343, 19, 806]);
  const airfield = terrain('aircraft', [5438, 21, 837]);
  const tiles = [0x929489, 0x989a91, 0x9ea198, 0x9a9b93, 0x94968c];

  // Open-front showroom with recessed display bays, an exposed limestone frame
  // and dark louvers. The stone set is backed by calibrated contrast markers.
  lab.pad(-13, 15, -7, 11, tiles, 10);
  lab.box(-13, 15, 0, 7, -6, -5, [c.dark, 0x34424b, 0x3e4a53]);
  lab.box(-13, -12, 0, 7, -5, 3, c.slate);
  lab.box(13, 14, 0, 7, -5, -1, c.slate);
  lab.box(-13, 15, 7, 8, -6, -1, c.slate);
  lab.box(-13, 15, 7, 8, -1, 0, c.pale);
  lab.box(-13, -12, 0, 7, 2, 3, c.pale);
  lab.box(13, 14, 0, 7, -2, -1, c.pale);
  for (const x of [-10.5, -8.5, -6.5, -4.5, -2.5, -0.5, 1.5, 3.5, 5.5, 7.5, 9.5, 11.5]) {
    lab.attach([x, 3.85, -4.82], [0.16, 6.3, 0.32], c.steel);
  }
  for (const x of [-6.2, -0.25, 5.3]) {
    lab.attach([x, 0.22, 1.2], [4.25, 0.44, 3.0], c.dark);
    lab.attach([x, 0.48, 1.2], [3.98, 0.13, 2.78], c.steel);
    lab.attach([x, 0.57, 1.2], [3.75, 0.08, 2.55], c.slate);
  }
  lab.attach([-6.5, 0.805, 1.0], [3.46, 0.39, 2.54], c.steel);
  for (let i = 0; i < 9; i++) {
    lab.attach([-7.8 + i * 0.4, 1.48 + (i % 3) * 0.28, -1.05], [0.17, 0.18 + i * 0.13, 0.11], i % 2 ? c.pale : c.steel);
  }

  // Standard specimen. Adjacent shades isolate the original metre block and
  // show independent color assignments on the faces during the color sweep.
  const standard = [];
  for (const [x, y, z] of [[-8,1,1],[-7,1,1],[-6,1,1],[-8,1,0],[-7,1,0],[-6,1,0],[-7,2,0],[-7,2,1],[-6,2,0]]) {
    standard.push({ x, y, z, phase: (x + 8) * 0.18 + (2 - y) * 0.35, u: (x + 8) / 4 + (y - 1) / 2 });
  }
  // Micro-window, with a stepped reveal and a deep sill at real 12.5 cm increments.
  const windowFrame = [];
  for (let y = 5; y < 33; y++) for (let x = -16; x < 12; x++) {
    for (let z = 8; z < 12; z++) {
      const a = x + 16;
      const b = y - 5;
      const border = z < 10 ? 3 : 2;
      const edge = a < border || a >= 28 - border || b < border || b >= 28 - border;
      const mullion = z < 11 && (a === 13 || a === 14 || b === 17 || b === 18);
      const sill = b < 2 && z < 12;
      if (edge || mullion || sill) windowFrame.push({ x, y, z, phase: (33 - y) / 32, u: (a + b) / 54 });
    }
  }
  lab.attach([5.3, 0.99, 1.7], [0.95, 0.82, 0.72], c.dark);
  lab.attach([5.3, 1.54, 0.79], [1.8, 0.14, 1.52], c.steel, opaque, [0.49, 0, 0]);
  const slab = lab.attach([5.3, 2.48, 1.04], [3.38, 0.24, 2.92], c.stone, opaque,
    [0.72, 0.07, -0.08]);

  const strip = [];
  for (let i = 0; i < 8; i++) {
    const x = -10.5 + i * 3.0;
    lab.attach([x, 5.92, -4.34], [2.93, 0.3, 0.41], c.slate);
    strip.push(lab.attach([x, 5.88, -4.10], [2.89, 0.14, 0.085], 0x52717a));
  }

  // Sports coupé in the adjacent test bay. Analytic body sections, ring
  // wheels, layered glass belt, grille, brake hubs and individually lit lamps.
  const carX = 10.55;
  const carZ = 1.2;
  const carAt = (x, y, z) => [x + carX, y, z + carZ];
  const carV = (x, y, z, color) => lab.micro(Math.floor((carX + x) * 8), Math.floor(y * 8), Math.floor((carZ + z) * 8), color);
  const paint = [0xb43630, 0xbe4034, 0xc7473a, 0xb73831];
  for (let zi = -22; zi < 22; zi++) {
    const z = (zi + 0.5) / 8;
    const end = Math.max(0, Math.abs(z) - 1.93);
    const halfWidth = 1.18 - end * 0.31;
    const roof = Math.max(0, 1 - ((z + 0.53) / 1.87) ** 2) ** 0.92;
    for (let xi = -10; xi < 10; xi++) {
      const x = (xi + 0.5) / 8;
      if (Math.abs(x) > halfWidth) continue;
      const top = 0.96 + 0.11 * (1 - Math.abs(z) / 2.75) - 0.14 * end + 0.71 * roof * Math.max(0, 1 - (x / 1.07) ** 4);
      for (let yi = 2; (yi + 0.5) / 8 <= top; yi++) {
        const y = (yi + 0.5) / 8;
        const arch = ((Math.abs(z) - 1.64) ** 2 + (y - 0.49) ** 2 < 0.58 ** 2) && Math.abs(x) > 0.62;
        if (arch) continue;
        const hood = y < 1.04;
        const color = y < 0.39 ? c.rubber : hood ? shadeAt(paint, xi, Math.floor(zi / 6)) :
          y > top - 0.10 && roof > 0.57 && Math.abs(x) < 0.69 && z < 0.28 && z > -1.16 ? 0xb64a3b : 0x3e6878;
        carV(x, y, z, color);
      }
    }
  }
  for (const s of [-1, 1]) for (const axle of [-1.64, 1.64]) {
    for (let y = 0; y < 8; y++) for (let z = -5; z <= 5; z++) for (let x = 0; x < 3; x++) {
      const d = Math.hypot((y + 0.5) / 8 - 0.5, (z + 0.5) / 8);
      if (d > 0.515) continue;
      const spoke = x === 2 && d < 0.32;
      carV(s * (0.81 + x / 8), (y + 0.5) / 8, axle + (z + 0.5) / 8,
        spoke ? (d < 0.145 ? 0xab5342 : (y + z) % 3 ? 0xa3adb0 : 0x506066) : c.rubber);
    }
  }
  // A continuous nose fascia anchors both lamps, the intake and the splitter.
  lab.attach(carAt(0, 0.59, 2.66), [1.93, 0.56, 0.33], 0xb74034);
  lab.attach(carAt(0, 0.43, 2.825), [1.44, 0.21, 0.04], c.rubber);
  lab.attach(carAt(0, 0.487, 2.853), [1.31, 0.025, 0.016], c.steel);
  lab.attach(carAt(0, 0.29, 2.73), [1.91, 0.06, 0.25], c.dark);
  lab.attach(carAt(0, 0.67, 2.84), [0.39, 0.09, 0.028], c.pale);
  const headlights = [];
  const taillights = [];
  for (const side of [-1, 1]) {
    lab.attach(carAt(side * 0.64, 0.756, 2.809), [0.54, 0.177, 0.075], c.rubber);
    headlights.push(lab.attach(carAt(side * 0.64, 0.762, 2.849), [0.44, 0.092, 0.028], 0x9babae));
    taillights.push(lab.attach(carAt(side * 0.63, 0.76, -2.73), [0.6, 0.08, 0.06], 0x793533));
    lab.attach(carAt(side * 1.22, 1.04, 0.89), [0.26, 0.14, 0.29], 0x263e4a, opaque, [0, side * 0.15, 0]);
  }

  // Curtain-wall visitor centre. Thin modular glass panes sit outside the
  // slab edges. Clear spans reveal a mezzanine, timber stairs and an interior lounge.
  hall.pad(-11, 11, -9, 10, [0xb3ac99, 0xaca593, 0xb0ab9a, 0xb8b4a5], 11);
  hall.box(-9, 9, 0, 1, -6, 5, c.pale);
  hall.box(-8, 8, 1, 8, -6, -5, [c.oak, 0x946444, 0xa8744b, c.darkOak]);
  hall.box(-8, -5, 1, 8, -5, 4, c.pale);
  hall.box(1, 8, 4, 5, -5, 4, c.pale);
  hall.box(-9, 9, 8, 9, -7, 6, c.dark);
  for (const side of [-1, 1]) {
    hall.attach([side * 4.675, 8.98, -0.48], [9.35, 0.19, 13.55], c.pale);
    hall.attach([side * 4.35, 7.88, 4.96], [8.7, 0.14, 0.17], c.steel);
    hall.attach([side * 4.35, 1.13, 4.96], [8.7, 0.23, 0.16], c.steel);
  }
  for (let x = -5; x <= 8; x += 1.625) {
    hall.attach([x, 4.62, 4.92], [0.13, 6.55, 0.14], c.steel);
    if (x < 7.99) {
      hall.attach([x + 0.8125, 4.59, 4.88], [1.625, 6.57, 0.057], c.glass, trans(55));
    }
  }
  for (let z = -5; z <= 4.75; z += 1.625) {
    hall.attach([8.01, 4.62, z], [0.14, 6.55, 0.13], c.steel);
    if (z < 4.74) hall.attach([7.97, 4.59, z + 0.8125], [0.057, 6.57, 1.625], c.glass, trans(55));
  }
  hall.attach([0.15, 4.65, 4.98], [15.72, 0.09, 0.15], c.steel);
  hall.attach([8.06, 4.65, 0], [0.16, 0.09, 9.91], c.steel);
  for (let i = 0; i < 16; i++) {
    const x = -3 + i * 0.265;
    const y = 1 + i * 0.1875;
    hall.attach([x, y, -2.65], [0.28, 0.22, 1.75], c.oak);
  }
  hall.attach([4.4, 5.88, 3.85], [6.7, 0.10, 0.12], c.oak);
  for (let x = 1.25; x < 7.8; x += 0.72) hall.attach([x, 5.46, 3.85], [0.07, 0.85, 0.07], c.steel);
  for (const [x, z] of [[-3.3, 1.8], [-0.2, 0.2], [3.75, 1.5]]) {
    hall.attach([x, 1.25, z], [2.0, 0.5, 0.88], c.pale);
    hall.attach([x, 1.65, z - 0.39], [2.0, 0.6, 0.15], c.pale);
    hall.attach([x, 1.37, z + 1.15], [1.16, 0.2, 0.56], c.oak);
  }
  for (const x of [-3, 0, 4, 6.5]) {
    hall.attach([x, 6.78, 1.2], [0.17, 0.44, 0.94], c.ivory, emit);
    hall.attach([x, 7.32, 1.2], [0.035, 0.82, 0.035], c.steel);
  }
  hall.box(-6, 8, 0, 1, 5, 7, c.pale);
  hall.attach([1, 0.43, 7.18], [13.6, 0.20, 0.45], c.pale);

  // Botanical greenhouse. Fine roof panes are actual tilted glass decorations,
  // while the two triangular gables use cut-to-profile translucent microvoxels.
  const cream = 0xe4e3d2;
  const glass = trans(70);
  garden.pad(-7, 7, -10, 10, [0xb5ab90, 0xa9a287, 0xb2ae92, 0xaeab91], 9);
  garden.box(-5, 5, 0, 1, -7, 7, 0xaa9d80);
  const h = 3.8;
  const ridgeY = 6.28;
  const eaveX = 4.35;
  const slope = Math.atan2(ridgeY - h, eaveX);
  const span = Math.hypot(eaveX, ridgeY - h);
  for (let z = -6.5; z < 6.5; z += 2.6) for (const side of [-1, 1]) {
    garden.attach([side * eaveX, 2.36, z + 1.3], [0.058, 2.75, 2.6], c.greenhouseGlass, glass);
    garden.attach([side * eaveX / 2, (ridgeY + h) / 2, z + 1.3],
      [span, 0.052, 2.6], c.greenhouseGlass, glass, [0, 0, -side * slope]);
  }
  for (let i = 0; i <= 5; i++) {
    const z = -6.5 + i * 2.6;
    for (const side of [-1, 1]) {
      garden.attach([side * eaveX, 2.37, z], [0.15, 2.76, 0.15], cream);
      garden.attach([side * eaveX / 2, (ridgeY + h) / 2, z], [span + 0.05, 0.13, 0.13], cream,
        opaque, [0, 0, -side * slope]);
    }
  }
  for (const side of [-1, 1]) {
    garden.attach([side * eaveX, h, 0], [0.16, 0.17, 13.17], cream);
    garden.attach([side * eaveX, 1.1, 0], [0.16, 0.18, 13.17], c.stone);
    garden.attach([side * eaveX, 2.5, 0], [0.1, 0.085, 13.17], cream);
  }
  garden.attach([0, ridgeY, 0], [0.16, 0.16, 13.18], cream);
  for (const z of [-6.5, 6.5]) {
    for (let i = -34; i < 35; i++) {
      const x = (i + 0.5) / 8;
      const top = ridgeY - Math.abs(x) * Math.tan(slope);
      for (let y = 8; y < Math.floor(top * 8); y++) {
        if (z > 0 && Math.abs(x) < 0.88 && y < 26) continue;
        garden.micro(i, y, Math.round(z * 8), c.greenhouseGlass, glass);
      }
    }
    for (const x of [-4.35, -2.62, -0.88, 0.88, 2.62, 4.35]) {
      const top = ridgeY - Math.abs(x) * Math.tan(slope);
      garden.attach([x, (1 + top) / 2, z + 0.04], [0.129, top - 1, 0.13], cream);
    }
    garden.attach([0, 3.8, z + 0.04], [8.8, 0.13, 0.13], cream);
  }
  garden.attach([0, 3.28, 6.61], [1.88, 0.20, 0.22], cream);
  for (const x of [-0.89, 0.89]) garden.attach([x, 2.11, 6.59], [0.17, 2.35, 0.17], cream);
  garden.attach([0, 1.02, 6.85], [2.15, 0.10, 0.58], c.pale);
  for (const x of [-2.64, 2.64]) for (const z of [-3.5, 2.5]) {
    garden.attach([x, 1.33, z], [2.30, 0.66, 3.73], c.oak);
    garden.attach([x, 1.69, z], [2.17, 0.10, 3.56], 0x564734);
    for (let i = 0; i < 6; i++) {
      const a = x + (i % 2 ? 0.59 : -0.59);
      const b = z - 1.24 + Math.floor(i / 2) * 1.21;
      const tall = 0.58 + 0.24 * ((i + (x > 0 ? 2 : 0)) % 3);
      const stem = Math.round(a * 8) / 8;
      const pos = Math.round(b * 8) / 8;
      garden.detail(stem, stem + 0.125, 1.73, 1.78 + tall, pos, pos + 0.125, 0x476338);
      garden.detail(stem - 0.30, stem + 0.375, 1.85, 2.10, pos - 0.34, pos + 0.375, 0x638755);
      garden.detail(stem - 0.36, stem + 0.25, 2.05, 2.30, pos - 0.125, pos + 0.25, 0x86ae56);
      garden.detail(stem - 0.125, stem + 0.25, 2.11 + tall / 3, 2.36 + tall / 3, pos - 0.18, pos + 0.25, 0x608b47);
      if (i % 2 === 1) {
        garden.detail(stem - 0.125, stem + 0.125, 2.12, 2.37, pos + 0.23, pos + 0.48, 0xc85b43);
      }
      if (x > 0) garden.attach([a + 0.21, 2.32, b], [0.06, 1.22, 0.06], c.darkOak);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 2.95;
    garden.attach([x, 1.24, 5.12], [1.16, 0.48, 0.72], 0x9f6f52);
    garden.attach([x, 1.49, 5.12], [1.03, 0.08, 0.63], c.darkOak);
    for (const dx of [-0.32, 0, 0.32]) {
      garden.detail(x + dx - 0.05, x + dx + 0.10, 1.50, 2.09, 5.09, 5.21, c.moss);
      garden.detail(x + dx - 0.14, x + dx + 0.14, 1.82, 1.96, 5.0, 5.32, 0x789b56);
      garden.detail(x + dx - 0.10, x + dx + 0.10, 2.04, 2.17, 5.02, 5.28, side < 0 ? 0xe4ac68 : 0xc96d60);
    }
  }
  for (let step = 0; step < 4; step++) {
    const top = 1 - (step + 1) * 0.2;
    garden.attach([0, top / 2, 7.22 + 0.47 * step], [2.65, top, 0.47], step % 2 ? c.stone : c.pale);
  }

  // Nature airfield, with fine service marks and recessed perimeter beacons.
  airfield.pad(-12, 12, -10, 11, [0x677379, 0x6e7678, 0x747c7b, 0x717a7b], 9);
  for (const x of [-9.5, 9.5]) {
    for (const z of [-4.45, 4.05]) airfield.attach([x, 0.021, z], [0.16, 0.039, 8.5], 0xe4d9b8);
    for (const z of [-8, 0, 8]) {
      airfield.attach([x, 0.14, z], [0.41, 0.29, 0.41], c.dark);
      airfield.attach([x, 0.31, z], [0.19, 0.055, 0.19], 0x70ebd5, emit);
    }
  }
  for (const z of [-8.1, 8.15]) for (const x of [-4.75, 4.75]) {
    airfield.attach([x, 0.021, z], [9.5, 0.038, 0.16], 0xe4d9b8);
  }
  const r = aircraftModel(rec);
  const aircraft = await rec.spawnModel(r, airfield.at(0, 0, 0), 0);
  const aircraftOrigin = aircraft.position.toArray();
  counts.aircraft.assemblyMicros = r.root.blocks.length;
  counts.aircraft.assemblyDecorations = r.root.decorations.length;

  // Timeline values match the parent composition's RGB, material meter and cuts.
  const gray = [0x7b8082, 0x8b9090, 0x6e777c, 0x919391];
  function hslColor(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const component = n => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return (component(0) << 16) | (component(8) << 8) | component(4);
  }
  const lastState = new Map();
  function updateMaterial(t) {
    const paintAt = [2.0, 2.9, 3.8];
    const blend = ease(4.8, 8.9, t);
    const angle = 36 + 360 * blend;
    const swing = Math.sin(blend * Math.PI) * 70;
    const material = kind => t >= 16.5 ? trans(Math.round(4 + 61 * ease(16.7, 18.6, t))) :
      t >= [11.9, 12.15, 12.4][kind] ? emit : opaque;
    const color = (kind, phase, u, base) => {
      if (t < paintAt[kind] + phase * 0.8) return base;
      if (t < 4.8 || t >= 9.0) return c.gold;
      return hslColor(angle + u * swing, 0.86, 0.58);
    };
    const change = (key, tone, mat, set) => {
      const value = tone * 128 + mat;
      if (lastState.get(key) === value) return;
      set(tone, mat);
      lastState.set(key, value);
    };
    standard.forEach(({ x, y, z, phase, u }, i) => change(i, color(0, phase, u, gray[i % 4]), material(0),
      (tone, mat) => lab.block(x, y, z, tone, mat)));
    windowFrame.forEach(({ x, y, z, phase, u }, i) => change(standard.length + i,
      color(1, phase, u, gray[(x + y + 24) % 4]), material(1),
      (tone, mat) => lab.micro(x, y, z, tone, mat)));
    change('slab', color(2, 0, 0.5, c.steel), material(2), slab);
    strip.forEach((set, i) => {
      const on = t >= 12.55 + i * 0.10;
      change(set, on ? c.cyan : 0x52717a, on ? emit : opaque, set);
    });
    const on = t >= 13.6;
    for (const set of headlights) change(set, on ? 0xe8f8ff : 0x9babae, on ? emit : opaque, set);
    for (const set of taillights) change(set, on ? 0xff6e56 : 0x793533, on ? emit : opaque, set);
  }

  function move(site, a, b, lookA, lookB, k) {
    const pos = site.at(...mix(a, b, k));
    const target = site.at(...mix(lookA, lookB, k));
    rec.pose(pos, target);
  }
  function frame(clip, t) {
    updateMaterial(clip === 'lab' ? t : 19.5);
    if (clip === 'lab') {
      const opening = [[-0.7, 4.35, 16.3], [-1.28, 2.59, 1.08]];
      const overview = [[0.32, 4.36, 15.1], [-0.96, 2.49, 1.06]];
      const wide = [[0.55, 4.6, 18.35], [1.28, 3.15, 0.72]];
      const carStart = [[7.15, 2.76, 10.8], [7.55, 1.72, 2.42]];
      const carEnd = [[7.6, 2.52, 10.15], [7.85, 1.65, 2.52]];
      const glassStart = [[-0.26, 4.04, 14.6], [-0.52, 2.37, 0.73]];
      const close = [[-1.0, 3.78, 12.35], [-0.65, 2.19, 0.62]];
      const [start, end, progress] = t < 9.3 ? [opening, overview, ease(0, 9.3, t)] :
        t < 13.60 ? [overview, wide, ease(10.8, 13.50, t)] :
        t < 16.35 ? [carStart, carEnd, ease(13.60, 16.35, t)] : [glassStart, close, ease(16.35, 18.8, t)];
      move(lab, start[0], end[0], start[1], end[1], progress);
    } else if (t < 1.6) {
      move(hall, [16.0, 6.65, 21], [13.3, 6.3, 18], [0.4, 3.75, 1.7], [0.3, 3.9, 1.7], ease(0, 1.6, t));
    } else if (t < 2.75) {
      move(garden, [9.0, 7.2, 17.2], [7.0, 6.4, 15.3], [0, 2.63, 1.0], [0.1, 2.67, 1.6], ease(1.6, 2.75, t));
    } else {
      const k = ease(2.75, 6.8, t);
      rec.pose(add(aircraftOrigin, mix([-9.2, 4.4, 13.2], [-4.45, 3.6, 9.2], k)),
        add(aircraftOrigin, mix([0.1, 1.11, 0.65], [0.0, 1.24, 1.48], k)));
    }
  }
  frame('lab', 0);
  window.__materialFilm = { frame, counts };
  return { counts, aircraftOrigin, locations: { lab: lab.at(0,0,0), hall: hall.at(0,0,0), garden: garden.at(0,0,0), airfield: airfield.at(0,0,0) } };

  // The entity format uses metre-local decoration positions and eighth-metre
  // microcell offsets. Its geometry can be re-spawned at any Nature runway.
  function aircraftModel(rec) {
    const fuselage = new Map();
    const hull = 0xe0e3dc;
    const teal = 0x365971;
    const graphite = 0x2b363e;
    const seats = 0x755045;
    const glass = 0x8bbed1;
    const microAt = (x, y, z, color, materialId = 0) => {
      const p = [x, y, z].map(v => Math.floor(v * 8 + 1e-6));
      const [dx, dy, dz] = p.map(v => Math.floor(v / 8));
      const [mx, my, mz] = p.map(v => (v % 8 + 8) % 8);
      fuselage.set(p.join(','), { dx, dy, dz, mx, my, mz, size: 0.125, color, materialId });
    };
    const decorations = [];
    const part = (name, position, scale, color, materialId = 0, rotation = [0, 0, 0]) => {
      decorations.push({ id: name, position, scale, color, materialId, rotation: rec.qEuler(...rotation) });
    };
    for (let zi = -47; zi < 39; zi++) {
      const z = (zi + 0.5) / 8;
      const front = Math.max(0, z - 2.85) / 2.02;
      const rear = Math.max(0, -z - 1.0) / 4.9;
      const width = Math.max(0.26, 1.39 * (1 - 0.80 * front ** 1.25 - 0.81 * rear));
      const belly = 0.73 + 0.69 * rear + 0.48 * front;
      const crown = z > -0.65 && z < 3.55 ? 2.0 : 2.0 + 0.22 * rear - 0.33 * front;
      for (let xi = -12; xi < 12; xi++) for (let yi = 5; yi < 20; yi++) {
        const x = (xi + 0.5) / 8, y = (yi + 0.5) / 8;
        if (y < belly || y > crown || Math.abs(x) > width * (0.64 + 0.36 * Math.min(1, (y - belly) / 0.44))) continue;
        microAt(x, y, z, y < belly + 0.25 ? graphite : y > 1.5 && y < 1.74 ? teal : hull);
      }
    }
    for (const side of [-1, 1]) {
      // Swept main wing with dihedral, tapered in chord and increasing in height.
      for (let xi = 10; xi < 54; xi++) {
        const x = (xi + 0.5) / 8;
        const u = (x - 1.32) / 5.5;
        const front = 0.95 - 1.72 * u;
        const back = -2.72 - 0.44 * u;
        const y = 1.16 + 0.51 * u;
        for (let zi = Math.ceil(back * 8); zi < Math.floor(front * 8); zi++) {
          const z = (zi + 0.5) / 8;
          microAt(side * x, y, z, z > front - 0.32 ? teal : z < back + 0.29 ? graphite : hull);
          if (u < 0.52 && z > back + 0.7 && z < front - 0.28) microAt(side * x, y + 0.125, z, hull);
        }
      }
      part(`wingtip-${side}`, [side * 6.63, 1.91, -1.72], [0.16, 0.77, 1.48], teal, opaque, [0.13, 0, side * -0.21]);
      part(`winglight-${side}`, [side * 6.69, 1.7, -0.91], [0.24, 0.13, 0.24], side === 1 ? 0x7feec8 : 0xff6d56, emit);
      part(`stabilizer-${side}`, [side * 1.41, 2.13, -4.9], [2.45, 0.17, 1.42], hull, opaque, [0.04, side * 0.22, side * 0.10]);
      part(`tail-fin-${side}`, [side * 2.31, 2.62, -5.15], [0.18, 1.15, 0.93], teal, opaque, [-0.35, 0, -side * 0.25]);

      // Twin enclosed propulsors and an open intake face with a six-blade fan.
      for (let xi = -6; xi <= 6; xi++) for (let yi = -6; yi <= 6; yi++) {
        const x = (xi + 0.5) / 8, y = (yi + 0.5) / 8;
        const radial = Math.hypot(x, y);
        if (radial > 0.737 || radial < 0.526) continue;
        for (let zi = -21; zi < 1; zi++) {
          microAt(side * 3.3 + x, 2.0 + y, (zi + 0.5) / 8, zi > -3 ? teal : zi < -18 ? graphite : hull);
        }
      }
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        part(`fan-${side}-${i}`, [side * 3.3 + 0.27 * Math.cos(a), 2 + 0.27 * Math.sin(a), -0.30],
          [0.43, 0.105, 0.12], graphite, opaque, [0.15, 0, a]);
      }
      part(`fan-hub-${side}`, [side * 3.3, 2, -0.22], [0.25, 0.25, 0.39], c.steel);
      part(`strut-${side}`, [side * 1.55, 0.84, -0.55], [0.14, 1.18, 0.18], c.steel, opaque, [0, 0, -side * 0.32]);
      for (let y = 0; y < 7; y++) for (let z = -4; z < 4; z++) {
        if (Math.hypot((y + 0.5) / 8 - 0.43, (z + 0.5) / 8) > 0.43) continue;
        for (let x = 0; x < 3; x++) microAt(side * (1.62 + x / 8), (y + 0.5) / 8, -0.56 + (z + 0.5) / 8,
          x === 2 && Math.hypot((y + 0.5) / 8 - 0.43, (z + 0.5) / 8) < 0.21 ? c.steel : c.rubber);
      }

      // Deep two-seat cockpit, with furnishings visible through a sculpted canopy.
      part(`seat-${side}`, [side * 0.53, 2.14, 1.13], [0.6, 0.23, 0.68], seats);
      part(`seatback-${side}`, [side * 0.53, 2.43, 0.9], [0.57, 0.64, 0.18], seats, opaque, [-0.21, 0, 0]);
      part(`headrest-${side}`, [side * 0.53, 2.77, 0.85], [0.30, 0.22, 0.16], c.dark);
      part(`belt-${side}`, [side * 0.53, 2.52, 1.01], [0.1, 0.49, 0.03], c.pale, opaque, [0, 0, -side * 0.25]);
      part(`canopy-side-${side}`, [side * 1.27, 2.31, 1.49], [0.055, 0.65, 3.25], glass, trans(45));
      part(`canopy-shoulder-${side}`, [side * 1.01, 2.82, 1.49], [0.66, 0.055, 3.25], glass, trans(45),
        [0, 0, -side * 0.70]);
      part(`canopy-sill-${side}`, [side * 1.265, 2.02, 1.5], [0.13, 0.13, 3.42], graphite);
      part(`canopy-top-rail-${side}`, [side * 0.75, 3.03, 1.49], [0.095, 0.095, 3.26], graphite);
      part(`canopy-corner-${side}`, [side * 1.27, 2.64, 1.49], [0.09, 0.09, 3.26], graphite);
      part(`canopy-post-${side}`, [side * 1.27, 2.31, 0.32], [0.09, 0.67, 0.095], graphite);
      part(`windscreen-frame-${side}`, [side * 1.183, 2.52, 3.401], [0.081, 1.17, 0.089], graphite, opaque, [-0.49, 0, 0]);
    }

    part('canopy-roof', [0, 3.025, 1.49], [1.51, 0.055, 3.25], glass, trans(45));
    part('front-screen', [0, 2.52, 3.36], [2.4, 1.16, 0.069], glass, trans(45), [-0.49, 0, 0]);
    part('front-crossbar', [0, 3.03, 3.09], [2.42, 0.082, 0.091], graphite);
    part('front-centerbar', [0, 2.52, 3.405], [0.069, 1.17, 0.075], graphite, opaque, [-0.49, 0, 0]);
    part('back-screen', [0, 2.53, -0.38], [2.42, 1.16, 0.060], glass, trans(45), [0.44, 0, 0]);
    part('gauge-housing', [0, 2.23, 2.68], [1.51, 0.32, 0.33], graphite, opaque, [-0.38, 0, 0]);
    for (let i = 0; i < 4; i++) {
      part(`gauge-${i}`, [-0.56 + i * 0.36, 2.37, 2.50], [0.25, 0.12, 0.035], i === 2 ? c.ivory : 0x73c5d2, emit);
    }
    part('nose-landing-strut', [0.0, 0.66, 3.06], [0.11, 0.88, 0.12], c.steel);
    for (let y = 0; y < 5; y++) for (let z = -4; z < 4; z++) {
      if (Math.hypot((y + 0.5) / 8 - 0.325, (z + 0.5) / 8) > 0.33) continue;
      for (const x of [-0.1, 0.025]) microAt(x, (y + 0.5) / 8, 3.06 + (z + 0.5) / 8, c.rubber);
    }
    return {
      type: 'space-entity', version: 8, constraints: [],
      root: {
        id: 'root', name: 'Nature Survey VTOL', pivot: [0, 0, 0], children: [],
        body: { type: 'kinematic', mass: 2700, useGravity: false, collisionEnabled: false },
        blocks: [...fuselage.values()], decorations,
      }
    };
  }
}
