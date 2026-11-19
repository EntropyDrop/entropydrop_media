// In-page scene for chapter 07. `sceneInit` is serialized into the Space page.
// Local frame: origin = abs (8192, 79, 1055) on Aether's south cliff meadow,
// +z points south over the cliff edge (aircraft nose direction).

export const FLIGHT_SCRIPT = `// 登机推杆：W 加推力；推力托起后向前掠出悬崖
if (!self.state.getBoolean("init")) {
  self.state.setBoolean("init", true);
  self.body.setType("kinematic");
  self.body.setGravityEnabled(false);
  self.state.setNumber("x0", ctx.position[0]);
  self.state.setNumber("y0", ctx.position[1]);
  self.state.setNumber("z0", ctx.position[2]);
}
const dt: f64 = ctx.deltaTime;
const held: bool = !ctx.driver.isNull && ctx.input.down("KeyW");
let spool: f64 = self.state.getNumber("spool");
spool = held ? Math.min(1.0, spool + dt * 0.55) : Math.max(0.0, spool - dt * 0.4);
let h: f64 = self.state.getNumber("h");
let v: f64 = self.state.getNumber("v");
let lift: f64 = Math.max(0.0, spool - 0.5) * 12.0;
lift = lift * Math.max(0.0, Math.min(1.0, (16.0 - h) / 8.0));
h = h + lift * dt;
if (h > 1.2) v = Math.min(22.0, v + spool * 9.0 * dt);
const d: f64 = self.state.getNumber("d") + v * dt;
self.state.setNumber("spool", spool);
self.state.setNumber("h", h);
self.state.setNumber("v", v);
self.state.setNumber("d", d);
self.setLocalPosition([self.state.getNumber("x0"), self.state.getNumber("y0") + h, self.state.getNumber("z0") + d]);
self.setLocalEuler([-0.16 * lift / 6.0, 0, Math.sin(d * 0.04) * 0.05]);`;

export function sceneInit(opts) {
  const rec = window.__rec;
  const g = rec.g;
  const O = [8192, 79, 1055];
  const A = (lx, ly, lz) => [O[0] + lx, O[1] + ly, O[2] + lz];
  const C = {
    basalt: 0x3b4852, basaltDark: 0x232c33, hull: 0xd9dee3, accent: 0x3b4852,
    wall: 0xe7e2d6, trim: 0x5b6670, glass: 0x8fd3e8, green: 0x4ade80, cyan: 0x38bdf8,
    frame: 0x2b3640, roof: 0x7c4a32, roofDark: 0x5a3424,
  };
  const steps = [];
  const stats = { blocks: 0, microVoxels: 0, terrainDecorations: 0, entityDecorations: 0, scriptLines: 0 };
  const spread = (list, t0, t1) => list.forEach((fn, i) => steps.push({ t: t0 + (t1 - t0) * (list.length === 1 ? 0 : i / (list.length - 1)), fn }));
  const block = (lx, ly, lz, color, mat = 0) => () => {
    const [x, y, z] = A(lx, ly, lz);
    g.world.setBlock(x, y, z, 1, true, color, mat);
    stats.blocks++;
  };
  const batch = (fns) => () => fns.forEach(f => f());

  // 1. Foundation 2.43–5.55: basalt slab, rows from north to the cliff edge.
  const found = [];
  for (let lz = -6; lz <= 7; lz++) {
    const row = [];
    for (let lx = -16; lx <= 13; lx++) {
      row.push(block(lx, -2, lz, C.basaltDark));
      const conduit = lz === -3 && lx >= 4 && lx <= 8;
      row.push(block(lx, -1, lz, conduit ? C.cyan : (lx === -16 || lx === 13 || lz === 7 ? C.basaltDark : C.basalt), conduit ? 1 : 0));
    }
    found.push(batch(row));
  }
  spread(found, 2.45, 3.9);

  // Aircraft skeleton on the pad (center lx=1), raised with the foundation.
  const skel = [];
  const cx = 1;
  for (let lz = -5; lz <= 5; lz++) for (let dx = -1; dx <= 1; dx++) skel.push(block(cx + dx, 0, lz, lz >= 4 && dx === 0 ? C.cyan : C.hull, lz >= 4 && dx === 0 ? 1 : 0));
  for (let lz = -4; lz <= 2; lz++) { skel.push(block(cx - 1, 1, lz, C.accent)); skel.push(block(cx + 1, 1, lz, C.accent)); skel.push(block(cx, 1, lz, C.hull)); }
  for (let lz = 3; lz <= 5; lz++) for (let dx = -1; dx <= 1; dx++) skel.push(block(cx + dx, 1, lz, C.glass, 61));
  skel.push(block(cx, 2, 3, C.glass, 61)); skel.push(block(cx, 2, 4, C.glass, 61));
  for (let lz = -1; lz <= 1; lz++) for (const dx of [-3, -2, 2, 3]) skel.push(block(cx + dx, 0, lz, C.accent));
  for (let dx = -2; dx <= 2; dx++) skel.push(block(cx + dx, 1, -5, C.hull));
  skel.push(block(cx, 2, -5, C.accent)); skel.push(block(cx, 2, -4, C.accent)); skel.push(block(cx, 3, -5, C.accent));
  const skelGroups = [];
  for (let i = 0; i < skel.length; i += 6) skelGroups.push(batch(skel.slice(i, i + 6)));
  spread(skelGroups, 3.9, 5.5);

  // Base building walls 3.47–5.55 (hollow box with window openings on the south face).
  const bx0 = -15, bx1 = -8, bz0 = -5, bz1 = 3;
  const isWindow = (lx, ly, lz) => lz === bz1 && ly >= 1 && ly <= 2 && [-14, -13, -11, -10].includes(lx);
  const isDoor = (lx, ly, lz) => lz === bz1 && lx === -9 && ly <= 1;
  const wallLayers = [];
  for (let ly = 0; ly <= 4; ly++) {
    const layer = [];
    for (let lx = bx0; lx <= bx1; lx++) for (let lz = bz0; lz <= bz1; lz++) {
      const edge = lx === bx0 || lx === bx1 || lz === bz0 || lz === bz1;
      if (!edge || isWindow(lx, ly, lz) || isDoor(lx, ly, lz)) continue;
      const corner = (lx === bx0 || lx === bx1) && (lz === bz0 || lz === bz1);
      layer.push(block(lx, ly, lz, corner || ly === 0 || ly === 4 ? C.trim : C.wall));
    }
    wallLayers.push(batch(layer));
  }
  const roof = [];
  for (let lx = bx0; lx <= bx1; lx++) for (let lz = bz0; lz <= bz1; lz++) roof.push(block(lx, 5, lz, C.trim));
  wallLayers.push(batch(roof));
  spread(wallLayers, 3.55, 5.5);

  // 2. Micro-voxel window frames 5.55–7.42.
  const microFrame = (wx0) => {
    const [ax, ay, az] = A(wx0, 1, bz1);
    const mx0 = ax * 8, my0 = ay * 8, mz = az * 8 + 5;
    const fns = [];
    for (let i = 0; i < 16; i++) {
      const col = [];
      for (let j = 0; j < 16; j++) {
        const isFrame = i <= 0 || i >= 15 || j <= 0 || j >= 15 || i === 7 || i === 8 || j === 7 || j === 8;
        col.push(() => {
          if (isFrame) g.world.setMicroBlock(mx0 + i, my0 + j, mz, C.frame, null, 0);
          else g.world.setMicroBlock(mx0 + i, my0 + j, mz + 1, C.glass, null, 61);
          stats.microVoxels++;
        });
        if (isFrame && (j === 0 || j === 15)) {
          col.push(() => { g.world.setMicroBlock(mx0 + i, my0 + j, mz - 1, C.frame, null, 0); g.world.setMicroBlock(mx0 + i, my0 + j, mz - 2, C.frame, null, 0); stats.microVoxels += 2; });
        }
      }
      fns.push(batch(col));
    }
    return fns;
  };
  spread([...microFrame(-14), ...microFrame(-11)], 5.6, 7.3);

  // 3. Sloped eaves (terrain decorations on the roof only) 7.42–9.70.
  const eaves = [];
  const anchor = A(-12, 5, -1);
  const addDeco = (d) => () => {
    g.world.setTerrainDecoration({ ...d, x: anchor[0], y: anchor[1], z: anchor[2] });
    stats.terrainDecorations++;
  };
  const tilt = 0.5;
  eaves.push(addDeco({ id: 'eave_s', position: [0.5, 1.6, 3.0], scale: [10.2, 0.28, 6.4], rotation: rec.qEuler(tilt, 0, 0), color: C.roof, materialId: 0 }));
  eaves.push(addDeco({ id: 'eave_n', position: [0.5, 1.6, -2.0], scale: [10.2, 0.28, 6.4], rotation: rec.qEuler(-tilt, 0, 0), color: C.roof, materialId: 0 }));
  eaves.push(addDeco({ id: 'ridge', position: [0.5, 2.95, 0.5], scale: [10.4, 0.34, 0.6], color: C.roofDark, materialId: 0 }));
  eaves.push(addDeco({ id: 'gutter_s', position: [0.5, 0.2, 5.75], scale: [10.4, 0.18, 0.25], color: C.roofDark, materialId: 0 }));
  eaves.push(addDeco({ id: 'gutter_n', position: [0.5, 0.2, -4.75], scale: [10.4, 0.18, 0.25], color: C.roofDark, materialId: 0 }));
  spread(eaves, 7.5, 9.4);

  // 4. Glass curtain wall on the east face 9.70–11.2.
  const glassCols = [];
  for (let lz = bz0 + 1; lz <= bz1 - 1; lz++) {
    const col = [];
    for (let ly = 1; ly <= 3; ly++) col.push(block(bx1, ly, lz, C.glass, 61));
    glassCols.push(batch(col));
  }
  spread(glassCols, 9.75, 11.0);

  // 5. Glowing energy station 11.1–12.8.
  const station = [];
  const sx0 = 9, sx1 = 12, sz0 = -5, sz1 = -2;
  const ring = [];
  for (let lx = sx0; lx <= sx1; lx++) for (let lz = sz0; lz <= sz1; lz++) ring.push(block(lx, 0, lz, (lx === sx0 || lx === sx1 || lz === sz0 || lz === sz1) ? C.basaltDark : C.cyan, (lx === sx0 || lx === sx1 || lz === sz0 || lz === sz1) ? 0 : 1));
  station.push(batch(ring));
  for (let ly = 1; ly <= 3; ly++) {
    const lay = [];
    for (let lx = 10; lx <= 11; lx++) for (let lz = -4; lz <= -3; lz++) lay.push(block(lx, ly, lz, C.green, 1));
    for (const [lx, lz] of [[sx0, sz0], [sx1, sz0], [sx0, sz1], [sx1, sz1]]) lay.push(block(lx, ly, lz, C.trim));
    station.push(batch(lay));
  }
  const cap = [];
  for (let lx = sx0; lx <= sx1; lx++) for (let lz = sz0; lz <= sz1; lz++) cap.push(block(lx, 4, lz, (lx === sx0 || lx === sx1 || lz === sz0 || lz === sz1) ? C.trim : C.cyan, (lx === sx0 || lx === sx1 || lz === sz0 || lz === sz1) ? 0 : 1));
  station.push(batch(cap));
  spread(station, 11.1, 12.7);

  // Selection box around the skeleton.
  const selA = A(cx - 3, 0, -5), selB = A(cx + 3, 3, 5);
  // The controller rewrites boxSelectionPreview from the live cursor every update;
  // let the scripted A→B drag take precedence while it runs.
  let realPreview = g.controller.boxSelectionPreview ?? null;
  let forcedPreview = null;
  Object.defineProperty(g.controller, 'boxSelectionPreview', {
    configurable: true,
    get: () => (forcedPreview === false ? null : (forcedPreview ?? realPreview)),
    set: (v) => { realPreview = v; },
  });
  const S = {
    O, A, C, steps: steps.sort((a, b) => a.t - b.t), stats, idx: 0, ent: null, log: [],
    selA, selB, cx,
    apply(t) {
      while (this.idx < this.steps.length && this.steps[this.idx].t <= t) {
        try { this.steps[this.idx].fn(); } catch (e) { console.warn('step failed', e.message); }
        this.idx++;
      }
    },
    selectionPreview(p) {
      if (p <= 0) { forcedPreview = null; return; }
      const b = selA.map((a, i) => a + (selB[i] - a) * Math.min(1, p));
      forcedPreview = { pointA: { x: selA[0], y: selA[1], z: selA[2] }, cursor: { x: Math.round(b[0]), y: Math.round(b[1]), z: Math.round(b[2]) }, micro: false };
    },
    assemble() {
      const ctl = g.controller;
      this.entBefore = new Set(g.contraptionManager.contraptions);
      const sel = { domain: 'selection', micro: false };
      ctl.performBasicAction({ ...sel, action: 'corner-a', point: { x: selA[0], y: selA[1], z: selA[2] } });
      ctl.performBasicAction({ ...sel, action: 'corner-b', point: { x: selB[0], y: selB[1], z: selB[2] } });
      if (ctl.contraptions && ctl.contraptions.selectionBoxConfirmed !== true) ctl.contraptions.selectionBoxConfirmed = true;
      const result = ctl.assembleSelection(undefined, {});
      forcedPreview = false;
      this.ent = result && typeof result === 'object' ? result : null;
      return { result: typeof result, ent: !!this.ent };
    },
    resolveEnt() {
      if (this.ent) return this.ent;
      if (g.controller.bulkEditJob) return null;
      this.ent = g.contraptionManager.contraptions.find(c => !this.entBefore.has(c)) || null;
      if (this.ent) {
        // The scripted camera sweeps the screen-centre pick ray across the hull;
        // keep the hover outline off so it doesn't flash over the shot.
        const e = this.ent;
        if (e.setHighlighted) { const o = e.setHighlighted.bind(e); o(false); e.setHighlighted = () => o(false); }
        if (e.setFocusHighlight) { e.clearFocusHighlight?.(); e.setFocusHighlight = () => {}; }
      }
      return this.ent;
    },
  };
  window.__c07 = S;
  return { steps: S.steps.length, selA, selB };
}
