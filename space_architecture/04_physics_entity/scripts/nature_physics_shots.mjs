// Installed by the recorder inside the localhost Space client.
export function installPhysicsShots() {
  const rec = window.__rec;
  const { g } = rec;
  const world = g.world;
  const ctl = g.controller;
  const manager = g.contraptionManager;
  const renderer = g.sceneRenderer;
  const { rover, plane, hubColor } = window.__physicsBlueprints(rec.qEuler);
  const chassis = [5361, 23, 819];
  const roadOrigin = [5370, 23, 819];
  const parking = [5367, 21, 850];
  const flightPad = [5410, 20, 845];
  const asphalt = [0x565e60, 0x595f60, 0x5d6364, 0x606566, 0x575e61];
  const stone = 0x4a5556;
  const amber = 0xd4a45b;
  const edge = 0xd0c8ab;
  const plus = (a, b) => a.map((v, i) => v + b[i]);
  const minus = (a, b) => a.map((v, i) => v - b[i]);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, t) => {
    const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const rounded = a => a.map(v => +v.toFixed(5));
  const q = (x, y, z) => rec.qEuler(x, y, z);
  const point = ([x, y, z]) => ({ x, y, z });
  const atRoad = (x, y, z) => plus(roadOrigin, [x, y, z]);
  const layerShade = (x, z) => asphalt[((x * 19 + z * 31) % asphalt.length + asphalt.length) % asphalt.length];
  const write = (x, y, z, tint, material = 0) => world.setBlock(x, y, z, 1, true, tint, material);
  let decoIndex = 0;
  function attach(origin, anchor, center, scale, color, materialId = 0, rotation = q(0, 0, 0)) {
    const [x, y, z] = plus(origin, anchor);
    const position = center.map((v, i) => v - anchor[i] - 0.5);
    world.setTerrainDecoration({ id: `c04-${decoIndex++}`, x, y, z, position, scale, color, materialId, rotation });
  }
  function grade(x, designY, z, tint) {
    const ground = rec.groundY(x, z);
    for (let y = designY; y < ground; y++) world.setBlock(x, y, z, 0, true);
    for (let y = Math.min(designY - 1, ground); y < designY - 1; y++) write(x, y, z, stone);
    write(x, designY - 1, z, tint);
  }

  // A cut-in test road with a microvoxel contact surface, asphalt runout,
  // and two separate level bays for component editing and airframe work.
  const rise = 5;
  const rampA = 3;
  const rampB = 20;
  const rampBase = x => Math.ceil((x + 1 - rampA) * rise / (rampB - rampA) + 0.52);
  for (let x = -13; x < 46; x++) for (let z = -2; z < 9; z++) {
    const isRamp = x >= rampA && x < rampB;
    const start = x < rampA;
    const depth = isRamp ? rampBase(x) : start ? 0 : rise;
    const [wx, wy, wz] = atRoad(x, -depth, z);
    const tint = z === -2 || z === 8 ? 0x707570 : layerShade(x, z);
    grade(wx, wy, wz, tint);
  }
  let rampContactCells = 0;
  for (let mx = rampA * 8; mx < rampB * 8; mx++) {
    const x = Math.floor(mx / 8);
    const surface = -(mx / 8 + 0.0625 - rampA) * rise / (rampB - rampA);
    const top = Math.round(surface * 8) + roadOrigin[1] * 8;
    const bottom = (roadOrigin[1] - rampBase(x)) * 8;
    for (let mz = -16; mz < 72; mz++) for (let y = bottom; y < top; y++) {
      const paintLine = y === top - 1 && (mz === -12 || mz === 67);
      const tint = paintLine ? edge : layerShade(x, Math.floor(mz / 8));
      if (world.setMicroBlock(roadOrigin[0] * 8 + mx, y, roadOrigin[2] * 8 + mz, tint)) rampContactCells++;
    }
  }
  for (const [a, b, top] of [[-13, rampA, 0], [rampB, 46, -rise]]) {
    for (let x = a + 0.5; x < b; x += 1.75) {
      for (const z of [-1.45, 8.44]) {
        attach(roadOrigin, [Math.floor(x), top - 1, Math.floor(z)], [x, top + 0.018, z],
          [Math.min(1.76, (x - a) * 2, (b - x) * 2), 0.035, 0.13], edge);
      }
    }
  }
  for (const x of [-10, 0, 23, 35, 43]) for (const z of [-1.5, 8.5]) {
    const top = x < rampA ? 0 : -rise;
    const anchor = [x, top - 1, Math.floor(z)];
    attach(roadOrigin, anchor, [x + 0.27, top + 0.23, z], [0.19, 0.46, 0.24], 0x353e41);
    attach(roadOrigin, anchor, [x + 0.27, top + 0.43, z], [0.195, 0.092, 0.22], amber, 1);
  }
  // Orientation cues on the level landing, outside the wheel track.
  for (let x = 22; x < 30; x++) {
    for (const z of [-1.1, 8.0]) {
      attach(roadOrigin, [x, -rise - 1, Math.floor(z)], [x + 0.48, -rise + 0.024, z],
        [0.48, 0.036, 0.49], amber, 0, q(0, 0.36, 0));
    }
  }

  function bay(origin, a, b, c, d) {
    for (let x = a; x < b; x++) for (let z = c; z < d; z++) {
      grade(...plus(origin, [x, 0, z]), x === a || z === c || x === b - 1 || z === d - 1 ? 0x767a72 : layerShade(x, z));
    }
    for (const z of [c + 1, d - 1.25]) {
      const length = (b - a - 2) / 2;
      for (const x of [a + 1 + length / 2, b - 1 - length / 2]) {
        attach(origin, [Math.floor(x), -1, Math.floor(z)], [x, 0.017, z], [length, 0.034, 0.147], edge);
      }
    }
  }
  bay(parking, -5, 16, -4, 11);
  bay(flightPad, -13, 14, -12, 12);
  for (const x of [-10, 10]) for (const z of [-10, 10]) {
    attach(flightPad, [x, -1, z], [x, 0.14, z], [0.34, 0.28, 0.34], stone);
    attach(flightPad, [x, -1, z], [x, 0.30, z], [0.22, 0.055, 0.22], 0x8adee0, 1);
  }
  for (const x of [-5.6, -3.8, -2, -0.2, 1.6, 3.4, 5.2]) {
    attach(flightPad, [Math.floor(x), -1, 0], [x, 0.018, 0], [1.08, 0.035, 0.17], edge);
  }

  // Paint the rover in real terrain, including its recoverable decoration
  // voxels. One hidden standard cell is the anchor for the trim and glazing.
  for (const b of rover.blocks) {
    if (!b.size) {
      write(...plus(chassis, [b.dx, b.dy, b.dz]), b.color, b.materialId);
      continue;
    }
    const index = plus(chassis, [b.dx, b.dy, b.dz]).map((v, i) => v * 8 + [b.mx, b.my, b.mz][i]);
    if (!world.setMicroBlock(...index, b.color, b.part, b.materialId)) {
      throw new Error(`Terrain rejected rover voxel ${JSON.stringify(b)}`);
    }
  }
  for (const d of rover.decorations) attach(chassis, [6, 2, 3], d.position, d.scale, d.color, d.materialId, d.rotation);
  const a = chassis;
  const b = plus(chassis, [10, 6, 6]);
  const assemblyAnchor = plus(chassis, [6, 2, 3]);
  if (rampContactCells < 24000) throw new Error(`Incomplete microvoxel ramp: ${rampContactCells} cells`);

  let linked = null;
  let shotTime = 0;
  let shot = 'ab';
  let forcedPreview = null;
  let actualPreview = ctl.boxSelectionPreview ?? null;
  Object.defineProperty(ctl, 'boxSelectionPreview', {
    configurable: true,
    get: () => forcedPreview === false ? null : forcedPreview ?? actualPreview,
    set: v => { actualPreview = v; },
  });
  ctl.activeTool = 'selector';
  ctl.updateComponentHierarchyLinks = () => renderer.setComponentHierarchyLinks(
    linked, linked?.rootComponentId, { animateChildren: true, seconds: shotTime },
  );
  if (renderer.cursorMesh) Object.defineProperty(renderer.cursorMesh, 'visible', { get: () => false, set: () => {} });
  const suppressHover = e => {
    if (e.setHighlighted) {
      e.setHighlighted(false);
      e.setHighlighted = () => {};
    }
    if (e.setFocusHighlight) {
      e.clearFocusHighlight?.();
      e.setFocusHighlight = () => {};
    }
  };
  const tracks = { ab: [], c: [], d: [] };
  const st = {};
  const initialCenter = plus(chassis, [5.42, 2.7, 3.5]);
  const gravity = Math.abs(g.contraptionPhysics?.gravity?.y ?? -18);

  function setDriveForces(e) {
    const body = e.getRigidBody(e.rootComponentId);
    body.linearDamping = 0.997;
    body.angularDamping = 0.965;
    const nativeUpdate = e.update.bind(e);
    e.update = (...args) => {
      const result = nativeUpdate(...args);
      if (shot !== 'ab') return result;
      const t = shotTime;
      const id = e.rootComponentId;
      const m = body.mass;
      if (t >= 5.05 && t < 9.4 && body.position.x < roadOrigin[0] + 9) {
        e.applyNodeBodyForce(id, [m * Math.max(0, 13.0 - Math.max(0, body.velocity.x) * 0.26), 0, 0]);
      }
      const landing = body.position.x > roadOrigin[0] + rampB + 1.5;
      if (t >= 7.6 && t < 11.5 && landing) {
        e.applyNodeBodyForce(id, [-body.velocity.x * m * 0.92, 0, -body.velocity.z * m * 1.10]);
      }
      if (t >= 11.5) {
        if (!st.liftOrigin) st.liftOrigin = body.position.clone();
        const k = sm(11.50, 13.15, t);
        const aim = st.liftOrigin.y + 2.35 * k;
        const lift = Math.max(0, gravity + 6.2 * (aim - body.position.y) - 3.3 * body.velocity.y);
        e.applyNodeBodyForce(id, [-m * body.velocity.x * 2.4, m * lift, -m * body.velocity.z * 2.4]);
        const phase = (t - 11.5) * 5.2;
        const roll = Math.sin(phase) * 9.1 * k - body.angularVelocity.x * 4.5;
        const pitch = Math.cos(phase * 0.84) * 12.0 * k - body.angularVelocity.z * 5.0;
        e.applyNodeBodyTorque(id, [m * roll, -m * body.angularVelocity.y * 4.0, m * pitch]);
      }
      return result;
    };
  }

  function actionAB(t) {
    if (t >= 1.37 && t < 2.48) {
      forcedPreview = { pointA: point(a), cursor: point(lerp(a, b, sm(1.37, 2.48, t)).map(Math.round)), micro: false };
    }
    if (t >= 2.48 && !st.selected) {
      st.selected = true;
      forcedPreview = null;
      ctl.performBasicAction({ domain: 'selection', action: 'corner-a', point: point(a), micro: false });
      ctl.performBasicAction({ domain: 'selection', action: 'corner-b', point: point(b), micro: false });
      manager.selectionBoxConfirmed = true;
    }
    if (t >= 4.43 && !st.assembleRequested) {
      st.assembleRequested = true;
      forcedPreview = false;
      const e = manager.assembleSelection();
      if (!e) throw new Error('The native selection could not be assembled');
      st.rover = e;
      if (e.blocks.length !== rover.blocks.length || world.getBlock(...assemblyAnchor) ||
          manager.lastAssemblyDecorations.placed !== rover.decorations.length) {
        throw new Error(`Assembly geometry mismatch: voxels ${e.blocks.length}/${rover.blocks.length}; transfer ${JSON.stringify(manager.lastAssemblyDecorations)}`);
      }
      st.startPivot = e.position.clone();
      suppressHover(e);
      e.setBodyType('dynamic');
      e.setNodeBodyMaterial(e.rootComponentId, { friction: 0.18, restitution: 0.04 });
      e.enableAllNodeScripts();
      setDriveForces(e);
      tracks.ab.push({ t, ev: 'assemble', blockCount: e.blocks.length, decorations: rover.decorations.length });
    }
  }

  function byPart(e, label, tint) {
    const parent = e.rootComponentId;
    const matches = b => b.part === label || (tint != null && b.color === tint);
    const key = b => [b.localX, b.localY, b.localZ].map(v => Math.floor(v + 1e-6)).join(',');
    const all = e.blocks.filter(b => (b.entityId || e.rootComponentId) === parent);
    const wanted = all.filter(matches);
    const cells = new Set(wanted.map(key));
    if (!wanted.length || all.some(b => !matches(b) && cells.has(key(b)))) {
      throw new Error(`Part ${label} does not occupy its own selectable cells`);
    }
    return { cells, count: wanted.length };
  }

  function split(e, part, picked) {
    const root = e.rootComponentId;
    manager.childSelection = { contraption: e, parentId: root, mode: 'single', cells: picked.cells };
    const result = manager.createChildFromSelection(part);
    if (!result?.child || result.child.id !== part
        || e.blocks.filter(b => b.entityId === part).length !== picked.count) {
      throw new Error(`Selector did not create ${part} from ${picked.count} voxels`);
    }
    e.setGlueSelection(root, new Set());
    return result.child;
  }

  const edits = [
    ['wheel_fl', 1.0], ['wheel_rl', 1.9], ['wheel_fr', 2.8], ['wheel_rr', 3.7], ['hatch', 4.7], ['turret', 5.8],
  ];
  const wheels = edits.slice(0, 4).map(([id]) => id);
  function prepareC() {
    const e = st.rover;
    if (!e) throw new Error('The rover must be assembled before the component shot');
    e.stopAllNodeScripts();
    e.setBodyType('kinematic');
    e.position.copy(st.startPivot).add(new rec.Vec3(...minus(parking, chassis)));
    e.quaternion.identity();
    e.syncAllBodyTransforms();
    e.syncKinematicBodies(0);
    st.parked = plus(parking, [5.42, 2.7, 3.5]);
    st.parts = edits.map(([id, time]) => ({ id, time, selection: byPart(e, id), shown: false, done: false }));
  }

  function actionC(t) {
    const e = st.rover;
    const id = e.rootComponentId;
    for (const part of st.parts) {
      if (!part.shown && t >= part.time - 0.56) {
        part.shown = true;
        e.setGlueSelection(id, part.selection.cells);
        tracks.c.push({ t, ev: 'highlight', id: part.id });
      }
      if (!part.done && t >= part.time) {
        part.done = true;
        split(e, part.id, part.selection);
        if (part.id === 'hatch') {
          const pivot = e.setComponentPivot('hatch', [3.21, 4.21, 3.5]);
          if (!pivot.ok) throw new Error('The hatch hinge pivot could not be set');
        }
        tracks.c.push({ t, ev: 'split', id: part.id, voxels: part.selection.count });
      }
    }
    if (!st.links && t >= 6.9) {
      st.links = true;
      linked = e;
      tracks.c.push({ t, ev: 'links' });
    }
    if (!st.componentMotion && t >= 8.4) {
      st.componentMotion = true;
      for (const w of wheels) e.setNodeScript(w, 'self.setLocalSpin([0, 0, 1], -42);');
      e.setNodeScript('turret', `
        const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
        self.state.setNumber("t", t);
        self.setLocalEuler([0, Math.sin(t * 0.88) * 0.76, 0]);
      `);
      e.setNodeScript('hatch', `
        const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
        self.state.setNumber("t", t);
        self.setLocalEuler([0, 0, (1.0 - Math.cos(Math.min(1.0, t / 1.15) * Math.PI)) * 0.50]);
      `);
      e.enableAllNodeScripts();
      tracks.c.push({ t, ev: 'relative-motion' });
    }
  }

  async function prepareD() {
    linked = null;
    const e = await rec.spawnModel(plane, flightPad, 0);
    e.stopAllNodeScripts();
    suppressHover(e);
    st.aircraft = e;
    st.hubPart = byPart(e, 'hub', hubColor);
    st.airframePosition = e.position.toArray();
    st.hubLocal = [6.375, 2.28, 0];
    const rootGroup = e.getEntityNode(e.rootComponentId).group;
    const authoredPivot = e.getEntityNode(e.rootComponentId).pivotLocal;
    st.hubWorld = rootGroup.localToWorld(new rec.Vec3(...st.hubLocal).sub(authoredPivot)).toArray();
    st.airframeCenter = rootGroup.localToWorld(new rec.Vec3(-0.45, 2.3, 0).sub(authoredPivot)).toArray();
    st.flightBlades = window.__physicsPropellerBlades(q, st.hubLocal);
    st.nBlades = 0;
    st.planeScriptStarted = false;
  }

  function actionD(t) {
    const e = st.aircraft;
    if (!st.hubHighlighted && t >= 0.55) {
      st.hubHighlighted = true;
      e.setGlueSelection(e.rootComponentId, st.hubPart.cells);
    }
    if (!st.hubSplit && t >= 1.3) {
      st.hubSplit = true;
      split(e, 'hub', st.hubPart);
      const pivot = e.setComponentPivot('hub', st.hubLocal);
      if (!pivot.ok) throw new Error('The propeller shaft pivot could not be set');
      linked = e;
      tracks.d.push({ t, ev: 'split', id: 'hub', voxels: st.hubPart.count });
    }
    const bladeTimes = [3.0, 3.6, 4.2, 4.8];
    while (st.nBlades < bladeTimes.length && t >= bladeTimes[st.nBlades]) {
      st.nBlades++;
      if (!e.setComponentDecorations('hub', st.flightBlades.slice(0, st.nBlades).flat())) {
        throw new Error('The blade decorations could not be added to the hub');
      }
      tracks.d.push({ t, ev: 'blade', count: st.nBlades });
    }
    if (!st.planeScriptStarted && t >= 6.2) {
      st.planeScriptStarted = true;
      linked = null;
      e.setNodeScript('hub', `
        const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
        self.state.setNumber("t", t);
        self.setLocalSpin([1, 0, 0], 28.0 + Math.min(100.0, t * 81.0));
      `);
      e.enableAllNodeScripts();
      tracks.d.push({ t, ev: 'spin' });
    }
  }

  function camera(name, t) {
    let pos;
    let target;
    if (name === 'ab') {
      const e = st.rover;
      let center = e ? e.rootGroup.position.toArray() : initialCenter;
      if (t < 5.45) {
        center = initialCenter;
        const k = sm(0, 4.4, t);
        pos = plus(center, lerp([11.0, 6.05, 18.8], [9.1, 6.8, 15.9], k));
        target = plus(center, lerp([-2.8, -0.65, 0.10], [-2.72, -0.32, 0.22], k));
      } else if (t < 10.65) {
        const k = sm(5.45, 10.65, t);
        pos = plus(center, lerp([9.0, 5.9, 17.6], [7.0, 5.0, 14.9], k));
        target = plus(center, [0.05, -0.75, 1.95]);
      } else {
        const k = sm(10.65, 16.6, t);
        const takeoff = st.liftOrigin ? st.liftOrigin.y : center[1];
        const rise = Math.max(0, (center[1] - takeoff) * 0.45);
        pos = plus(center, lerp([10.6, 5.6 - rise, 17.5], [12.8, 5.0 - rise, 14.0], k));
        target = plus(center, [-3.45, -0.18, 0.67]);
      }
      if (e) {
        const cam = ctl.camera;
        cam.position.set(...pos);
        cam.up.set(0, 1, 0);
        cam.lookAt(...target);
        cam.updateMatrixWorld();
        e.rootGroup.updateMatrixWorld(true);
        const rb = e.getRigidBody(e.rootComponentId);
        const v = e.rootGroup.localToWorld(rb.centerOfMassLocal.clone()).project(cam);
        const sample = { t: +t.toFixed(4), x: +((v.x + 1) * 960).toFixed(1), y: +((1 - v.y) * 540).toFixed(1),
          thrust: t >= 11.5 ? 1 : 0, pos: rounded(e.rootGroup.position.toArray()),
          q: rounded(e.rootGroup.quaternion.toArray()), speed: +rb.velocity.length().toFixed(3) };
        if (tracks.ab.at(-1)?.t === sample.t) tracks.ab[tracks.ab.length - 1] = sample;
        else tracks.ab.push(sample);
      }
    } else if (name === 'c') {
      const center = st.parked;
      // The first two wheels are on the visible side. Reverse angles reveal
      // the far-side selections; the full model is framed again for the links.
      if (t < 2.23) {
        pos = plus(center, lerp([9.2, 4.45, 14.7], [6.3, 4.65, 13.85], sm(0, 2.23, t)));
      } else if (t < 4.08) {
        pos = plus(center, lerp([9.2, 5.1, -15.1], [7.65, 5.3, -14.4], sm(2.23, 4.08, t)));
      } else if (t < 6.85) {
        pos = plus(center, lerp([-5.3, 6.5, 13.8], [-4.6, 6.9, 13.24], sm(4.08, 6.85, t)));
      } else {
        pos = plus(center, lerp([8.6, 6.4, 15.0], [7.15, 6.05, 14.55], sm(6.85, 14.8, t)));
      }
      target = plus(center, t < 2.23 ? [-1.50, -0.16, 0.26] :
        t < 4.08 ? [-0.62, -0.05, -1.03] : t < 6.85 ? [-0.82, 0.38, -0.26] : [0.09, 0.01, 0.03]);
    } else {
      const hub = st.hubWorld;
      if (t < 2.66) {
        pos = plus(hub, lerp([8.7, 3.9, 14.05], [7.38, 3.35, 11.1], sm(0, 2.66, t)));
        target = plus(hub, [-2.65, 0.18, -0.32]);
      } else if (t < 7.6) {
        pos = plus(hub, lerp([8.5, 3.2, 8.1], [8.15, 2.88, 7.90], sm(2.66, 7.6, t)));
        target = plus(hub, [-1.62, 0.18, 0.06]);
      } else {
        pos = plus(hub, lerp([8.15, 2.88, 7.90], [12.0, 4.8, 15.4], sm(7.6, 11.9, t)));
        target = lerp(plus(hub, [-1.62, 0.18, 0.06]), st.airframeCenter, sm(7.6, 11.9, t));
      }
    }
    rec.pose(pos, target);
  }

  function samples(name, t) {
    if (name === 'c' && st.componentMotion && Math.round(t * 30) % 30 === 0) {
      tracks.c.push({ t, poses: Object.fromEntries(edits.map(([id]) => [id,
        rounded(st.rover.getEntityNode(id).localQuaternion.toArray())])) });
    } else if (name === 'd' && st.planeScriptStarted && Math.round(t * 30) % 15 === 0) {
      tracks.d.push({ t, airframe: rounded(st.aircraft.position.toArray()),
        rotor: rounded(st.aircraft.getEntityNode('hub').localQuaternion.toArray()) });
    }
  }
  camera('ab', 0);
  window.__physicsShots = {
    async begin(name) {
      shot = name;
      shotTime = 0;
      if (name === 'c') prepareC();
      if (name === 'd') await prepareD();
      camera(name, 0);
    },
    async frame(name, t) {
      shotTime = t;
      if (name === 'ab') actionAB(t);
      else if (name === 'c') actionC(t);
      else actionD(t);
      await rec.stepAndRender(1 / 30, () => camera(name, t));
      samples(name, t);
    },
    tracks,
  };
  return { roverVoxels: rover.blocks.length, chassisDecorations: rover.decorations.length, airframeVoxels: plane.root.blocks.length, rampContactCells, gravity };
}
