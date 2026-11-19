// Each shot is staged in an independent offline Nature session. Only the
// camera and controller input are directed here. Motion runs in entity scripts.
export function installCodeShots() {
  const rec = window.__rec;
  const { g, Vec3 } = rec;
  const manager = g.contraptionManager;
  const world = g.world;
  const ctl = g.controller;
  const hierarchy = g.sceneRenderer.setComponentHierarchyLinks.bind(g.sceneRenderer);
  hierarchy(null);
  g.sceneRenderer.setComponentHierarchyLinks = () => hierarchy(null);
  const models = window.__buildCodeModels(rec.qEuler, window.__physicsBlueprints(rec.qEuler, { tagAircraftWheels: true }), window.__propellerBlades);
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const smooth = (from, to, t) => {
    const u = Math.max(0, Math.min(1, (t - from) / (to - from)));
    return u * u * (3 - 2 * u);
  };
  const palette = [0x565c5c, 0x575e60, 0x596161, 0x5b6160, 0x595f5e];
  const asphalt = (x, z) => palette[((x * 23 + z * 31) % palette.length + palette.length) % palette.length];
  const out = [];
  const scene = {};
  const roverScript = `// Field Service Rover · root component
const seated: bool = !ctx.driver.isNull;
const throttle: f64 = seated && ctx.input.down("KeyW") ? 1.0 : 0.0;
const steer: f64 = seated && ctx.input.down("KeyA") ? 1.0 : 0.0;
self.applyThrust([throttle * 9500.0, 0.0, 0.0]);
self.applyTorque([0.0, steer * 16800.0, 0.0]);

// Stabilize the chassis at tire height while applying the driven force.
const v = ctx.velocity;
const h: f64 = self.state.getNumber("rideHeight", ctx.position[1]);
self.state.setNumber("rideHeight", h);
self.applyForce([-v[0] * 940.0,
  ctx.mass * (Math.min(5.0, Math.max(-5.0, (h - ctx.position[1]) * 7.0)) - v[1] * 5.0),
  -v[2] * 940.0]);
const a = ctx.rotation;
const w = ctx.angularVelocity;
self.applyTorque([
  ctx.mass * (-a[0] * 35.0 - w[0] * 24.0),
  ctx.mass * (-a[1] * 8.0 - w[1] * 14.0),
  ctx.mass * (-a[2] * 35.0 - w[2] * 24.0)
]);
const rpm: f64 = Math.hypot(v[0], v[2]) * 8.49;
const wheels: string[] = ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"];
for (let i = 0; i < wheels.length; i++) {
  const wheel = self.child(wheels[i]);
  if (wheel) wheel.setLocalSpin([0.0, 0.0, 1.0], -rpm);
}

const click = ctx.clickedBlock;
if (!click.isNull && click.getString("nodeId") == "hatch") {
  self.state.setBoolean("open", !self.state.getBoolean("open"));
}
const target: f64 = self.state.getBoolean("open") ? -1.35 : 0.0;
let angle: f64 = self.state.getNumber("angle");
angle += (target - angle) * Math.min(1.0, ctx.deltaTime * 4.5);
self.state.setNumber("angle", angle);
const hatch = self.child("hatch");
if (hatch) hatch.setLocalEuler([0.0, 0.0, angle]);
`;
  const flightScript = (runwayX, wheelHeight) => `// Utility aircraft · root component
const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
self.state.setNumber("t", t);
const spool: f64 = Math.min(1.0, t * 0.5);
const hub = self.child("hub");
if (hub) hub.setLocalSpin([1.0, 0.0, 0.0], 24.0 + spool * 116.0);

const v = ctx.velocity;
const angle = ctx.rotation;
const rate = ctx.angularVelocity;
const speed: f64 = Math.max(0.0, v[0]);
const run: f64 = ctx.position[0] - ${runwayX}.0;
const rotate: bool = (run >= 23.0 && speed >= 12.5) || self.state.getBoolean("rotate");
self.state.setBoolean("rotate", rotate);

const power: f64 = Math.min(1.0, Math.max(0.0, (t - 1.85) * 1.45));
const thrust: f64 = ctx.mass * power * 22.0;
self.applyThrust([thrust, 0.0, 0.0]);

// Wing lift grows with airspeed and angle of attack.
const gravity: f64 = -ctx.gravity[1];
const pressure: f64 = (speed / 14.5) * (speed / 14.5);
const wing: f64 = Math.min(1.33, pressure * (0.42 + 4.9 * Math.max(0.0, angle[2])));
const lift: f64 = Math.max(0.0, gravity * wing - Math.max(0.0, v[1]) * 1.65);
self.applyForce([0.0, ctx.mass * lift, 0.0]);

// Unilateral runway support at the landing gear. As the tail wheel unloads,
// this reaches zero and the rigid body is supported by wing lift alone.
const tailContact: f64 = ${wheelHeight} + Math.max(0.0, 6.44 * Math.sin(angle[2]));
const supported: bool = ctx.position[1] <= tailContact + 0.045;
const reaction: f64 = supported ? Math.max(0.0, gravity - lift + (tailContact - ctx.position[1]) * 95.0 - v[1] * 11.0) : 0.0;
self.applyForce([0.0, ctx.mass * reaction, 0.0]);
self.state.setBoolean("gearContact", supported && reaction > 0.02);

const wheelSpeed: f64 = supported ? speed : self.state.getNumber("wheelSpeed") * 0.95;
self.state.setNumber("wheelSpeed", wheelSpeed);
const mainRpm: f64 = -wheelSpeed * 60.0 / (Math.PI * 1.08);
const tailRpm: f64 = -wheelSpeed * 60.0 / (Math.PI * 0.54);
const left = self.child("main_wheel_l");
const right = self.child("main_wheel_r");
const tail = self.child("tailwheel");
if (left) left.setLocalSpin([0.0, 0.0, 1.0], mainRpm);
if (right) right.setLocalSpin([0.0, 0.0, 1.0], mainRpm);
if (tail) tail.setLocalSpin([0.0, 0.0, 1.0], tailRpm);

const pitch: f64 = rotate ? 0.155 : 0.0;
self.applyTorque([
  ctx.mass * (-angle[0] * 88.0 - rate[0] * 36.0),
  ctx.mass * (-angle[1] * 78.0 - rate[1] * 35.0),
  ctx.mass * ((pitch - angle[2]) * 420.0 - rate[2] * 84.0)
]);
`;
  const approachScript = `
const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
self.state.setNumber("t", t);
const distance: f64 = t * 4.7;
const anchor = self.state.get("anchor");
if (anchor.isNull) self.state.setVector("anchor", ctx.position);
const start = self.state.get("anchor").asVector();
self.setLocalPosition([start[0] + distance, start[1], start[2]]);
const ids: string[] = ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"];
for (let i = 0; i < ids.length; i++) {
  const wheel = self.child(ids[i]);
  if (wheel) wheel.setLocalSpin([0.0, 0.0, 1.0], -39.9);
}
`;

  function grade(x, y, z, color) {
    const ground = rec.groundY(x, z);
    for (let h = y; h < ground; h++) world.setBlock(x, h, z, 0, true);
    for (let h = Math.min(ground, y - 1); h < y - 1; h++) rec.setBlockSafe(x, h, z, 0x58615b);
    rec.setBlockSafe(x, y - 1, z, color);
  }

  function line(id, position, scale, color, materialId = 0) {
    const [x, y, z] = [Math.floor(position[0]), Math.floor(position[1]) - 1, Math.floor(position[2])];
    world.setTerrainDecoration({
      id: `c05-${id}`, x, y, z, position: position.map((v, i) => v - [x, y, z][i] - 0.5),
      scale, color, materialId, rotation: rec.qEuler(0, 0, 0),
    });
  }

  function blendShoulder(x, z, y, steps, distance) {
    const natural = rec.groundY(x, z);
    const terrace = Math.round(y + (natural - y) * distance / (steps + 1));
    if (terrace !== natural) grade(x, terrace, z, distance < 2 ? 0x777b65 : 0x68734e);
  }

  function roadway(x0, x1, y, z, width, runway = false) {
    for (let x = x0; x < x1; x++) for (let dz = -width; dz < width; dz++) {
      grade(x, y, z + dz, Math.abs(dz + 0.5) > width - 1 ? 0x7b8179 : asphalt(x, z + dz));
    }
    for (let x = x0; x < x1; x++) for (const sign of [-1, 1]) for (let d = 1; d <= 5; d++) {
      blendShoulder(x, z + (sign < 0 ? -width - d : width - 1 + d), y, 5, d);
    }
    for (let x = x0 + 2; x < x1 - 1; x += 2) {
      for (const side of [-1, 1]) {
        line(`road-edge-${x}-${side}`, [x, y + 0.013, z + side * (width - 0.72)], [1.99, 0.026, 0.115], 0xd7cfb7);
        if (x % 8 === 0) {
          line(`edge-light-base-${x}-${side}`, [x, y + 0.10, z + side * (width - 0.34)], [0.24, 0.19, 0.24], 0x354044);
          line(`edge-light-${x}-${side}`, [x, y + 0.217, z + side * (width - 0.34)], [0.16, 0.055, 0.16],
            runway ? 0x88d3da : 0xe1af62, 1);
        }
      }
      if (runway && x % 6 === 0) {
        line(`run-center-${x}`, [x, y + 0.013, z], [2.1, 0.026, 0.175], 0xddd6c4);
      }
    }
    if (runway) {
      for (let i = -4; i <= 4; i++) {
        if (i) line(`threshold-${i}`, [x0 + 8, y + 0.016, z + i * 1.4], [3.12, 0.031, 0.42], 0xdcd3bc);
      }
    }
  }

  async function spawnOnGrid(model, origin) {
    const e = await rec.spawnModel(model, origin);
    // The import spawns around the geometric centre. These authored roots
    // have a zero pivot, so their ground marks use the exact scene origin.
    e.position.set(...origin);
    e.syncAllBodyTransforms();
    e.setPhysicsSimulationEnabled(e.isPhysicsSimulationEnabled());
    return e;
  }

  async function prepareFlight() {
    const [x, y, z] = [5410, 20, 845];
    const wheelHeight = y + 0.018;
    roadway(x - 14, x + 104, y, z, 10, true);
    const model = models.aircraft(flightScript(x, wheelHeight));
    scene.entity = await spawnOnGrid(model, [x, wheelHeight, z]);
    scene.project = model.root.blocks.length + model.root.children.reduce((n, node) => n + node.blocks.length, 0);
  }

  async function prepareRover(editor) {
    const [x, y, z] = [5365, 21, 850];
    roadway(x - 8, x + (editor ? 26 : 61), y, z, 7);
    const model = models.rover(editor ? '' : roverScript, true);
    scene.entity = await spawnOnGrid(model, [x, y + 0.026, z - 3.5]);
    scene.project = model.root.blocks.length + model.root.children.reduce((n, p) => n + p.blocks.length, 0);
  }

  async function preparePaver() {
    const [x, y, z] = [5364, 20, 827];
    const level = wx => wx < x + 16 ? y : y + 1;
    // Grade only the survey strip. The script raises and surfaces each row
    // behind the screed; the shoulders and the surrounding hills stay visible.
    for (let wx = x - 10; wx <= x + 45; wx++) for (let dz = -4; dz <= 4; dz++) {
      grade(wx, level(wx), z + dz, (wx + dz) % 3 === 0 ? 0x9a9472 : 0x91886d);
    }
    for (let wx = x - 10; wx <= x + 45; wx++) for (const sign of [-1, 1]) for (let d = 1; d <= 4; d++) {
      blendShoulder(wx, z + sign * (4 + d), level(wx), 4, d);
    }
    const script = `
const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
self.state.setNumber("t", t);
const x: f64 = ${x + 0.5} + t * 2.35;
const z: f64 = ${z + 0.5};
const ray: f64[] = [0.0, -1.0, 0.0];
const front = ctx.world.raycast([x + 2.70, ${y + 14}.0, z], ray, 32.0);
const back = ctx.world.raycast([x - 2.70, ${y + 14}.0, z], ray, 32.0);
let ground: f64 = self.state.getNumber("ground", ${y}.0);
let pitch: f64 = self.state.getNumber("pitch");
if (!front.isNull && !back.isNull) {
  const f: f64 = front.get("position").at(1).asNumber() + 1.0;
  const b: f64 = back.get("position").at(1).asNumber() + 1.0;
  ground += ((f + b) * 0.5 - ground) * 0.14;
  pitch += (Math.atan2(f - b, 5.4) - pitch) * 0.14;
  self.state.setNumber("ground", ground);
  self.state.setNumber("pitch", pitch);
}
self.setLocalPosition([x, ground + 0.025, z]);
self.setLocalEuler([0.0, 0.0, pitch]);

const column: i32 = <i32>Math.floor(x - 4.75);
if (column > <i32>self.state.getNumber("laid", 0.0)) {
  self.state.setNumber("laid", <f64>column);
  for (let lane: i32 = -3; lane <= 3; lane++) {
    const col = ctx.world.raycast([<f64>column + 0.5, ${y + 14}.0, z + <f64>lane], [0.0, -1.0, 0.0], 32.0);
    if (col.isNull) continue;
    const surface: f64 = col.get("position").at(1).asNumber();
    const edge: bool = lane == -3 || lane == 3;
    const mark: bool = lane == 0 && column % 5 < 2;
    const stone: f64 = mark ? 0xd8b56a : (edge ? 0x808981 : 0x4c5556);
    ctx.world.voxels.paint([<f64>column, surface, Math.floor(z) + <f64>lane], Value.object().setNumber("color", stone));
  }
}
`;
    scene.entity = await spawnOnGrid(models.paver(script), [x + 0.5, y, z + 0.5]);
    scene.road = { x, y, z, level };
  }

  async function prepareRadar() {
    const [x, y, z] = [5384, 21, 852];
    roadway(x - 47, x + 31, y, z, 6);
    for (let wx = x - 9; wx <= x + 3; wx++) for (let dz = -13; dz <= -6; dz++) {
      grade(wx, y, z + dz, wx % 4 === 0 ? 0x7d8985 : 0x78837e);
    }
    for (let wx = x - 7; wx <= x + 2; wx++) {
      line(`court-${wx}`, [wx, y + 0.013, z - 12.2], [0.99, 0.026, 0.125], 0xcfbd91);
    }
    scene.messages = [];
    const provider = manager.runtimeContextProvider;
    // Offline mode routes the normal script command straight into the receiving
    // entity's native inbox. The receiver still handles the message in its own script.
    manager.setRuntimeContextProvider(() => ({
      ...provider?.(),
      messages: {
        send: (sourceId, targetId, type, payload, encoding) => {
          const target = manager.contraptions.find(e => e.publicId === targetId || e.publicId === `ent_${targetId}`);
          const messageId = `preview-${scene.messages.length + 1}`;
          const packet = { messageId, sourceId, targetId: target?.publicId, type, payload, encoding };
          const ok = Boolean(target?.enqueueEntityMessage(packet));
          scene.messages.push({ ...packet, ok, t: scene.time });
          return ok ? { ok, deliveryStatus: 'routed', messageId } : { ok, reason: 'target_unavailable' };
        },
      },
    }));
    const gateScript = `
const inbox = ctx.messages.received;
for (let i = 0; i < inbox.length; i++) {
  const message = inbox.at(i);
  if (message.getString("type") == "gate.open") {
    self.state.setBoolean("open", true);
  }
}
let k: f64 = self.state.getNumber("travel");
if (self.state.getBoolean("open")) k = Math.min(1.0, k + ctx.deltaTime * 0.88);
self.state.setNumber("travel", k);
const slide: f64 = k * k * (3.0 - 2.0 * k) * 5.12;
const left = self.child("left");
const right = self.child("right");
if (left) left.setLocalPosition([0.0, 0.0, -slide]);
if (right) right.setLocalPosition([0.0, 0.0, slide]);
`;
    scene.gate = await spawnOnGrid(models.gate(gateScript), [x, y, z]);
    const roverPos = [x - 27.0, y + 0.02, z - 3.5];
    scene.rover = await spawnOnGrid(models.rover(approachScript, false), roverPos);
    const radarScript = `
const antenna = self.child("dish");
if (antenna) antenna.setLocalSpin([0.0, 1.0, 0.0], 13.0);
if (!self.state.getBoolean("sent")) {
  const nearby = ctx.world.entities(ctx.position, 15.0);
  for (let i = 0; i < nearby.length; i++) {
    const e = nearby.at(i);
    if (e.getString("id") != "${scene.rover.publicId}") continue;
    ctx.messages.send("${scene.gate.publicId.replace(/^ent_/, '')}", "gate.open", e.getString("id"));
    self.state.setBoolean("sent", true);
    break;
  }
}
`;
    scene.radar = await spawnOnGrid(models.radar(radarScript), [x - 2.0, y, z - 8.9]);
    scene.origin = [x, y, z];
    scene.entity = scene.rover;
  }

  function configureEditor() {
    const ui = g.uiStore;
    ui.openCodeEditor(scene.entity);
    ui.setScriptDraft(roverScript.split('\n').slice(0, 7).join('\n'));
    const modal = document.querySelector('#code-editor-modal');
    if (modal) {
      for (let el = modal; el && el !== document.body; el = el.parentElement) {
        if (el.style.display === 'none') el.style.removeProperty('display');
      }
    }
    return Boolean(modal && modal.offsetWidth > 0);
  }

  const prepare = { editor: () => prepareRover(true), vehicle: () => prepareRover(false),
    propeller: prepareFlight, paver: preparePaver, radar: prepareRadar };

  function center(e, position) {
    const node = e.getEntityNode(e.rootComponentId);
    return node.group.localToWorld(new Vec3(...position).sub(node.pivotLocal)).toArray();
  }

  function pose(name, t) {
    const e = scene.entity;
    if (name === 'editor') {
      const c = center(e, [5.8, 2.6, 3.5]);
      rec.cam(add(c, [12.8, 6.1, 15.9]), c);
    } else if (name === 'vehicle') {
      const b = smooth(6.3, 9.72, t);
      const first = center(e, [5.9, 2.59, 3.5]);
      const last = center(e, [3.25, 3.5, 3.52]);
      const target = first.map((v, i) => v + (last[i] - v) * b);
      const view = [11.8 - b * 19.2, 5.7 + b * 1.1, 16.5 - b * 4.2];
      rec.cam(add(target, view), add(target, [0, -1.12, 0]));
    } else if (name === 'propeller') {
      const roll = smooth(1.35, 4.9, t);
      const climb = smooth(5.6, 9.3, t);
      const c = center(e, [2.2 - roll * 2.7, 2.45, 0]);
      rec.cam(add(c, [13.5 - roll * 7.8 - climb * 5.0, 4.32 + roll * 1.04 - climb * 2.85, 11.2 + roll * 7.8 + climb * 1.1]),
        add(c, [-0.3, -0.86 + climb * 0.56, 0]));
    } else if (name === 'paver') {
      const c = center(e, [0, 1.22, 0]);
      const turn = smooth(1.36, 7.8, t);
      rec.cam(add(c, [10.5 - turn * 22.0, 6.4 + turn * 2.7, 13.2 + turn * 1.9]),
        add(c, [0.2 - turn * 4.75, -0.63, 0.0]));
    } else {
      const c = scene.origin;
      const sweep = smooth(0, 6, t);
      rec.cam(add(c, [-31.4 + sweep * 7.5, 14.5 - sweep * 1.15, -24.2 - sweep * 0.65]),
        add(c, [-7.2 + sweep * 4.10, 4.08, -2.6]));
    }
  }

  function drive(t) {
    const e = scene.entity;
    if (!scene.seated && t >= 1.40) {
      scene.seated = true;
      ctl.hoveredContraption = e;
      ctl.hoveredContraptionHit = { contraption: e, point: e.getSeatWorldPosition(e.rootComponentId, 0) };
      ctl.drivingSession.toggleDriveVehicle();
      ctl.hoveredContraptionHit = null;
      ctl.hoveredContraption = null;
    }
    if (t >= 3.9 && t < 9.20) ctl.entityInputDown.add('KeyW');
    else ctl.entityInputDown.delete('KeyW');
    if (t >= 4.65 && t < 5.46) ctl.entityInputDown.add('KeyA');
    else ctl.entityInputDown.delete('KeyA');
    if (!scene.clicked && t >= 9.48) {
      const point = center(e, [3.56, 4.53, 3.48]);
      scene.clicked = e.enqueueClickedBlock({
        eventId: 'c05-hatch', entityId: e.publicId, playerId: 'local', nodeId: 'hatch',
        kind: 'decoration', position: [3.56, 4.53, 3.48], size: null,
        decorationId: 'raised-grip', point, localPoint: [3.56, 4.53, 3.48],
      });
    }
  }

  const round = v => Array.isArray(v) ? v.map(round) : +v.toFixed(4);
  function track(name, t) {
    const e = scene.entity;
    const node = id => e.getEntityNode(id);
    const root = { t: round(t), pos: round(e.rootGroup.position.toArray()), q: round(e.rootGroup.quaternion.toArray()),
      speed: round(e.velocity.length()), status: e.scriptStatus, error: e.scriptError,
      nodeErrors: [...e.nodeScriptErrors.entries()] };
    if (name === 'propeller') {
      root.rotor = round(node('hub').group.quaternion.toArray());
      root.wheel = round(node('main_wheel_r').group.quaternion.toArray());
      root.forwardSpeed = round(e.velocity.x);
      root.pitch = round(2 * Math.atan2(root.q[2], root.q[3]));
      const state = e.getSerializableComponentStates()[e.rootComponentId];
      root.rotate = Boolean(state?.rotate);
      root.gearContact = Boolean(state?.gearContact);
    }
    if (name === 'vehicle') {
      root.wheel = round(node('wheel_fl').group.quaternion.toArray());
      root.hatch = round(node('hatch').group.quaternion.toArray());
      root.seated = ctl.isDriving;
      root.clicked = scene.clicked;
    }
    if (name === 'paver') {
      const { x, z, level } = scene.road;
      root.paved = Array.from({ length: 32 }, (_, i) => x + i - 5).filter(wx =>
        world.getBlockColor(wx, level(wx) - 1, z + 1) === 0x4c5556).length;
    }
    if (name === 'radar') {
      root.gate = round(scene.gate.getEntityNode('left').group.position.z);
      root.dish = round(scene.radar.getEntityNode('dish').group.quaternion.toArray());
      root.messages = scene.messages.slice();
      root.peers = [scene.radar, scene.gate].map(peer => ({ status: peer.scriptStatus, error: peer.scriptError,
        nodeErrors: [...peer.nodeScriptErrors.entries()] }));
    }
    out.push(root);
  }

  window.__codeShots = {
    async begin(name) {
      await prepare[name]();
      const entities = name === 'radar' ? [scene.gate, scene.radar, scene.rover] : [scene.entity];
      await Promise.all(entities.map(e => e.scriptRuntimeClient.ready()));
      await new Promise((resolve, reject) => {
        const deadline = performance.now() + 20000;
        const check = () => {
          const failed = entities.find(e => e.scriptStatus === 'error');
          if (failed) reject(new Error(failed.scriptError || JSON.stringify([...failed.nodeScriptErrors.entries()])));
          else if (name === 'editor' || entities.every(e => e.scriptStatus === 'running')) resolve();
          else if (performance.now() > deadline) reject(new Error('Entity scripts did not finish compiling'));
          else setTimeout(check, 25);
        };
        check();
      });
      return { entity: scene.entity.publicId, voxels: scene.project, position: scene.entity.position.toArray() };
    },
    configureEditor,
    async frame(name, t, warmup = false) {
      scene.time = t;
      if (name === 'vehicle') drive(t);
      if (name === 'editor' && !warmup && [3.15, 4.25, 6.1].some(mark => Math.abs(t - mark) <= 1 / 60)) {
        const lines = roverScript.split('\n');
        const n = t < 3.5 ? 12 : t < 5 ? 21 : lines.length;
        g.uiStore.setScriptDraft(lines.slice(0, n).join('\n'));
      }
      await rec.stepAndRender(warmup ? 0 : 1 / 30, () => pose(name, t));
      if (!warmup && (Math.round(t * 30) % 15 === 0)) track(name, t);
    },
    out,
  };
}
