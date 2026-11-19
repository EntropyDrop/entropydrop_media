// Footage recorder for chapter 06_runtime (运行机制：计算在哪里发生).
// Offline dev Space; multiplayer authority is simulated by setting the same entity
// fields the online sync layer sets (serverManaged / serverExecutorName / lease / hosting),
// so the real nameplate, entity menu, toast and Hosted Entities HUD render the states.
// The paver is moved deterministically from clip time, so separately recorded
// player views (A, B, C) show the same machine at the same place.
// Usage: node scripts/record_06_runtime.mjs <probe|a|b|host> [--probe]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from '/Users/ha/.npm/_npx/c691da254a52985f/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const ROOT = '/Volumes/zxf/entropydrop_media/space_architecture/06_runtime';
const SCRATCH = '/tmp/m06';
fs.mkdirSync(SCRATCH, { recursive: true });
const clipArg = process.argv[2] || 'probe';
const PROBE = process.argv.includes('--probe') || clipArg === 'probe';
const SPACE_SRC = '/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space';
const FPS = 30;

async function launchSpace({ world = 'nature', width = 1920, height = 1080, dsf = 1 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    defaultViewport: { width, height, deviceScaleFactor: dsf },
    userDataDir: path.join(SCRATCH, 'chrome-profile'),
    args: ['--no-sandbox', `--window-size=${width},${height + 90}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dsf });
  page.on('pageerror', err => console.log('PAGEERR:', err.message));
  page.on('console', msg => { const t = msg.text(); if (/\[06rec\]/.test(t)) console.log('CONSOLE:', t.slice(0, 600)); });
  await page.goto(`http://localhost:5173/space/app/?dev_offline=1&world=${world}&dev_lod=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((src) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${src}/client/src/entry.css`;
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.type = 'module';
    s.src = `${src}/client/src/entry.ts`;
    document.body.appendChild(s);
  }, SPACE_SRC);
  for (let i = 0; i < 70; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const info = await page.evaluate(() => {
      const g = window.game;
      return { hasGame: !!g, aoi: g?.world?.getTerrainAoiLoadProgress?.()?.ready, surface: window.offlineSurfaceStatus?.complete,
        gateHidden: document.getElementById('space-entry-gate')?.hidden };
    });
    if (i % 5 === 0) console.log(`[${world}] t=${i + 1}s`, JSON.stringify(info));
    if (info.hasGame && info.gateHidden && info.aoi && info.surface) break;
  }
  return { browser, page };
}

async function setupBaseScene(page) {
  return page.evaluate(async (src) => {
    const g = window.game;
    const Vec3 = g.playerPhysics.position.constructor;
    const { encodeInventoryResource } = await import(`${src}/engine/src/storage/InventoryProtobuf.ts`);
    const { parseInventoryImport } = await import(`${src}/client/src/engine/inventory/InventoryImport.ts`);
    g.uiStore.startGame(false);
    g.uiStore.setLightingQuality('ultra', false);
    g.uiStore.setShadowsEnabled(true, false);
    g.uiStore.setResolutionScale(1, false);
    g.uiStore.setRenderDistance(16, false);
    g.uiStore.setDistantSurfaceEnabled(true, false);
    g.controller.setPerspective('first_person', false);
    const render = g.sceneRenderer;
    const origAvatarVis = render.setPlayerAvatarVisible.bind(render);
    origAvatarVis(false, false);
    render.setPlayerAvatarVisible = () => origAvatarVis(false, false);
    render.renderer.toneMappingExposure = 1.15;
    const origLinks = render.setComponentHierarchyLinks?.bind(render);
    if (origLinks) render.setComponentHierarchyLinks = () => origLinks(null);
    if (render.sunLight?.shadow) {
      const sh = render.sunLight.shadow;
      sh.camera.left = sh.camera.bottom = -120;
      sh.camera.right = sh.camera.top = 120;
      sh.camera.updateProjectionMatrix();
      sh.needsUpdate = true;
    }
    g.controller.setFov(55);
    let fixedCam = null;
    window.__spaceCamHook = null;
    const origUpdateCam = g.controller.updateCameraPosition.bind(g.controller);
    g.controller.updateCameraPosition = () => {
      if (window.__spaceCamHook) window.__spaceCamHook();
      if (fixedCam) {
        g.controller.camera.position.set(...fixedCam.pos);
        g.controller.camera.up.set(0, 1, 0);
        g.controller.camera.lookAt(...fixedCam.target);
        g.controller.camera.updateMatrixWorld();
      } else origUpdateCam();
    };
    const pose = (pos, target) => {
      fixedCam = { pos, target };
      g.playerPhysics.isFlying = true;
      g.playerPhysics.position.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.previousPosition.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.renderSimulationPosition.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.velocity.set(0, 0, 0);
    };
    const spawnModel = async (model, pos, yaw = 0) => {
      const parsed = parseInventoryImport(encodeInventoryResource('entity', model), 'entity');
      if (!parsed.ok) throw new Error(parsed.error);
      const ent = g.contraptionManager.buildFromSlot(parsed.item, new Vec3(...pos), null, false);
      ent.quaternion.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
      ent.syncBodyFromTransform?.();
      await ent.scriptRuntimeClient?.ready?.();
      ent.stopAllNodeScripts?.();
      return ent;
    };
    const groundY = (x, z) => {
      for (let y = 180; y >= -20; y--) if (g.world.getBlock(Math.floor(x), y, Math.floor(z))) return y + 1;
      return 20;
    };
    window.__rec = { g, Vec3, pose, spawnModel, groundY };
    return g.playerPhysics.position.toArray();
  }, SPACE_SRC);
}

// Clean capture: no cursor, no dev overlays, no hotbar/chat; keep nameplates, toasts,
// entity menu and (for the hosting clip) the Hosted Entities section.
async function installUiStyle(page, { keepHud = false } = {}) {
  await page.evaluate((keepHud) => {
    const style = document.createElement('style');
    const keep = ['#entity-nameplates', '#toast', '#entity-context-menu-layer', ...(keepHud ? ['.hud-top .hud-card'] : [])];
    style.textContent = `
      html, body { cursor: none !important; overflow: hidden !important; }
      body * { visibility: hidden !important; }
      canvas, ${keep.map(k => `${k}, ${k} *`).join(', ')} { visibility: visible !important; }
      #crosshair, #dev-render-diagnostics, #dev-frame-profiler { display: none !important; }
      .hud-top .hud-card .hud-metrics, .hud-top .hud-card details { display: none !important; }
      /* never show hosting billing or core details */
      #hud-hosted-entities .hud-hosting-capacity, #hud-hosted-entities .hud-hosting-row-actions,
      #hud-hosted-entities .hud-entity-meta ~ .hud-entity-meta,
      #hud-hosted-entities .hud-entity-meta span + span, .entity-hosting-confirm { display: none !important; }
      #toast { font-size: 17px; }
      #entity-context-menu-layer button[aria-label="Disassemble entity"] { display: none !important; }
    `;
    document.head.appendChild(style);
    window.__keepHud = keepHud;
  }, keepHud);
}

async function installFixedTimeCapture(page) {
  await page.evaluate(() => {
    const rec = window.__rec;
    const g = rec.g;
    const savedAnimate = g.animate;
    let frozen = false;
    let frameDelta = 0;
    g.animate = () => { frozen = true; };
    g.clock.getDelta = () => { g.clock.elapsedTime += frameDelta; return frameDelta; };
    rec.stepAndRender = async (dt, cameraCb) => {
      while (!frozen) await new Promise(r => requestAnimationFrame(r));
      frozen = false;
      window.__spaceCamHook = cameraCb || null;
      frameDelta = dt;
      savedAnimate();
      window.__spaceCamHook = null;
      await g.sceneRenderer.renderer.backend.device.queue.onSubmittedWorkDone();
      await new Promise(r => requestAnimationFrame(r));
    };
  });
}

function startEncoder(outMp4) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const tmpMp4 = outMp4 + '.pending.mp4';
  const ff = spawn('ffmpeg', ['-y', '-v', 'warning', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
    '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), '-g', '15', '-keyint_min', '15',
    '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', tmpMp4],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  return {
    async write(buf) { if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res)); },
    async finish() {
      ff.stdin.end();
      await new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
      fs.renameSync(tmpMp4, outMp4);
      console.log('Recorded clip:', outMp4);
    },
  };
}

// ---------------------------------------------------------------- paver

function paverModel() {
  const blocks = [];
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) blocks.push({ dx: x, dy: 0, dz: z, color: (z === -2 || z === 2) ? 0x2c3a42 : 0xf2a93b });
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) blocks.push({ dx: x, dy: 1, dz: z, color: 0xf2a93b });
  blocks.push({ dx: 0, dy: 2, dz: 1, color: 0x7dd3fc, materialId: 87 }, { dx: 0, dy: 2, dz: 0, color: 0xd8dee4 });
  blocks.push({ dx: -1, dy: 2, dz: 0, color: 0x3b4852 }, { dx: 1, dy: 2, dz: 0, color: 0x3b4852 });
  for (let x = -2; x <= 2; x++) blocks.push({ dx: x, dy: -1, dz: 3, color: 0x2c3a42 });
  for (const x of [-2, 2]) blocks.push({ dx: x, dy: 1, dz: -2, color: 0x4ade80, materialId: 1 });
  const seen = new Map();
  for (const b of blocks) seen.set(`${b.dx},${b.dy},${b.dz}`, b);
  return {
    type: 'space-entity', version: 8,
    root: {
      id: 'paver', name: 'Paver', pivot: [0, 0, 0],
      body: { type: 'kinematic', mass: 2000, useGravity: false, collisionEnabled: false },
      blocks: [...seen.values()],
      decorations: [
        { id: 'probe_beam', position: [0, -2.2, -3.0], scale: [0.18, 3.4, 0.18], color: 0x38bdf8, materialId: 1 },
        { id: 'probe_head', position: [0, -0.4, -3.0], scale: [0.6, 0.4, 0.6], color: 0x3b4852, materialId: 0 },
      ],
      children: [], seats: [],
    },
  };
}

// Authority timeline for the S2 split screen, in clip time (scene starts at 35.6 s in the chapter).
// Each segment: who executes, whether the paver advances.
const S2 = {
  duration: 38.8,
  segments: [
    { t: 0.0, state: 'stopped' },
    { t: 2.6, state: 'run', executor: 'Player A' },            // 38.2 A starts first
    { t: 23.6, state: 'stopped' },                               // 59.2 A stops manually
    { t: 27.0, state: 'run', executor: 'Player B' },             // 62.6 B restarts first
    { t: 32.3, state: 'waiting' },                               // 67.9 B leaves, lease runs out
    { t: 35.0, state: 'run', executor: 'Player A' },             // 70.6 A's browser claims it
  ],
  events: {
    a: [{ t: 2.6, toast: 'start' }, { t: 23.6, toast: 'stop' }],
    b: [{ t: 17.8, menu: true }, { t: 19.4, menuClose: true, toast: 'occupied' }, { t: 27.0, toast: 'start' }],
  },
};
const HOST = {
  duration: 16.4,
  runOffset: 0,  // filled in from S2 total run time so the road continues
  segments: [
    { t: 0.0, state: 'run', executor: 'Player A' },
    { t: 2.6, state: 'hosted' },                                  // 76.9 hosting takes effect
  ],
  events: { c: [{ t: 0.4, menu: true }, { t: 2.3, menuClose: true }, { t: 3.4, hud: true }, { t: 5.2, menu: true }, { t: 7.4, menuClose: true }] },
};

function runTimeAt(timeline, t) {
  let run = timeline.runOffset || 0;
  const segs = timeline.segments;
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i].t;
    const b = i + 1 < segs.length ? segs[i + 1].t : Infinity;
    if (t <= a) break;
    if (segs[i].state === 'run' || segs[i].state === 'hosted') run += Math.min(t, b) - a;
  }
  return run;
}
function segAt(timeline, t) {
  let cur = timeline.segments[0];
  for (const s of timeline.segments) if (t >= s.t) cur = s;
  return cur;
}
HOST.runOffset = runTimeAt(S2, S2.duration);

// ---------------------------------------------------------------- page-side helpers

async function installPaver(page) {
  return page.evaluate(async (model) => {
    const rec = window.__rec;
    const g = rec.g;
    const sp = g.playerPhysics.position;
    const sx = Math.round(sp.x), sz = Math.round(sp.z);
    // a long +x lane with gentle relief so ground following is visible but smooth
    let best = null;
    for (let oz = -40; oz <= 40; oz += 4) for (let ox = -40; ox <= 20; ox += 6) {
      const hs = [];
      for (let dx = -6; dx <= 84; dx += 2) {
        let h = 0; for (let dz = -2; dz <= 2; dz++) h = Math.max(h, rec.groundY(sx + ox + dx, sz + oz + dz));
        hs.push(h);
      }
      const steps = hs.slice(1).map((h, i) => Math.abs(h - hs[i]));
      const relief = Math.max(...hs) - Math.min(...hs);
      const maxStep = Math.max(...steps);
      const score = (maxStep <= 1 ? 10 : -maxStep * 4) - Math.abs(relief - 4);
      if (!best || score > best.score) best = { x: sx + ox, z: sz + oz, y: hs[3], relief, maxStep, score };
    }
    const ent = await rec.spawnModel(model, [best.x + 0.5, best.y + 1.3, best.z + 0.5], -Math.PI / 2);
    ent.serverManaged = true;
    ent.serverCanControl = false;
    ent.serverCanEdit = false;
    ent.serverExecutesLocally = false;
    ent.serverDesiredRunState = 'stopped';
    window.__paver = ent;
    window.__lane = best;
    window.__paverGround = best.y;
    window.__paved = -1e9;
    console.log('[06rec] lane', JSON.stringify(best), 'entity', ent.id, ent.publicId);
    return { lane: best, id: ent.id, publicId: ent.publicId };
  }, paverModel());
}

// Runs in page each frame: place paver by run time, pave behind it, apply authority state.
function pageFrame(st) {
  const rec = window.__rec, g = rec.g, ent = window.__paver, lane = window.__lane;
  const speed = 1.6;
  const x = lane.x + 0.5 + st.run * speed;
  const z = lane.z + 0.5;
  let gnd = -1e9;
  for (let dx = 0; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) gnd = Math.max(gnd, rec.groundY(x + dx, z + dz));
  window.__paverGround += (gnd - window.__paverGround) * (st.dtRun > 0 ? 0.12 : 0);
  ent.position.set(x, window.__paverGround + 0.3, z);
  ent.quaternion.set(0, Math.sin(-Math.PI / 4), 0, Math.cos(-Math.PI / 4));
  ent.syncBodyFromTransform?.();
  ent.rootGroup?.position?.set?.(x, window.__paverGround + 0.3, z);
  // pave each crossed metre just behind the machine
  const cx = Math.floor(x - 2.0);
  for (let c = Math.max(window.__paved + 1, Math.floor(lane.x - 2)); c <= cx; c++) {
    for (let dz = -2; dz <= 2; dz++) {
      const top = rec.groundY(c, z + dz) - 1;
      const edge = dz === -2 || dz === 2;
      const mid = dz === 0 && (((c % 3) + 3) % 3 !== 0);
      g.world.setBlock(c, top, Math.floor(z) + dz, 1, true, mid ? 0xfbbf24 : (edge ? 0x9aa5ad : 0x3a4148), mid ? 1 : 0);
    }
    window.__paved = c;
  }
  // authority state -> the same fields the online sync layer maintains
  const now = Date.now();
  ent.serverExecutionMode = st.state === 'hosted' ? 'hosted' : 'browser';
  ent.serverHostingEnabled = st.state === 'hosted';
  ent.serverDesiredRunState = st.state === 'stopped' ? 'stopped' : 'running';
  ent.serverExecutorName = st.state === 'run' ? st.executor : null;
  ent.serverExecutionLeaseExpiresAt = st.state === 'run' ? new Date(now + 8000).toISOString() : new Date(now - 1000).toISOString();
  ent.serverExecutesLocally = false;
  ent.serverCanControl = st.canControl;
  ent.serverCanEdit = st.canControl;
  ent.serverCanManageHosting = true;
  if (st.toast) g.uiStore.showToast(st.toast.text, st.toast.tone ? { tone: st.toast.tone } : undefined);
  if (st.menu) {
    const r = g.sceneRenderer.renderer.domElement.getBoundingClientRect();
    g.uiStore.showEntityContextMenu(ent, { x: r.width * st.menu.x, y: r.height * st.menu.y });
  }
  if (st.menuClose) g.uiStore.closeEntityContextMenu(true);
  if (st.hud) {
    g.uiStore.patch({ hosting: { ...(g.uiStore.getSnapshot().hosting || {}), enabled: true, worker_available: true,
      capacity: { available: 3, total: 4 },
      items: [{ entity_id: String(ent.publicId || ent.id), name: 'Paver', state: 'running', enabled: true, core_id: null,
        remaining_ms: 3600000, budget_remaining_credits: 1, can_manage: true }] } });
    const btn = document.querySelector('#hud-hosted-entities .hud-hosting-toggle');
    if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
  }
  g.uiStore.refresh();
}

// ---------------------------------------------------------------- record

async function recordView({ name, timeline, viewer, camera, width, height, dsf, keepHud = false }) {
  const outMp4 = path.join(ROOT, `footage/06_runtime_${name}.mp4`);
  const { browser, page } = await launchSpace({ width, height, dsf });
  try {
    await setupBaseScene(page);
    await installUiStyle(page, { keepHud });
    const meta = await installPaver(page);
    console.log(`[${name}] setup`, JSON.stringify(meta));
    console.log(`[${name}] layout`, JSON.stringify(await page.evaluate(() => {
      const c = window.game?.renderer?.domElement || document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, cw: c.width, ch: c.height, r: [r.x, r.y, r.width, r.height], parent: c.parentElement?.id || c.parentElement?.className, bodyH: document.body.getBoundingClientRect().height };
    })));
    // pre-pave the road laid before this clip (HOST continues from S2)
    await page.evaluate(pageFrame, { run: timeline.runOffset || 0, dtRun: 0, state: 'stopped', canControl: false });
    await new Promise(r => setTimeout(r, 2500));
    await installFixedTimeCapture(page);
    const total = Math.round(timeline.duration * FPS);
    const evs = (timeline.events[viewer] || []).map(e => ({ ...e, f: Math.round(e.t * FPS) }));
    const entityNo = meta.id;
    const toastText = {
      start: { text: `Entity #${entityNo} started` },
      stop: { text: `Entity #${entityNo} stopped (state reset)` },
      occupied: { text: 'This entity is occupied by another endpoint', tone: 'warning' },
    };
    const probeSet = new Set([0.08, 0.3, 0.48, 0.52, 0.66, 0.75, 0.86, 0.97].map(u => Math.round(u * total)));
    const enc = PROBE ? null : startEncoder(outMp4);
    const client = await page.createCDPSession();
    // headful window chrome can shrink the visible area; lock the emulated viewport like 05_code does
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: false });
    await new Promise(r => setTimeout(r, 800));
    let prevRun = timeline.runOffset || 0;
    for (let f = 0; f < total; f++) {
      const t = f / FPS;
      const seg = segAt(timeline, t);
      const run = runTimeAt(timeline, t);
      const viewerName = viewer === 'a' ? 'Player A' : viewer === 'b' ? 'Player B' : 'Player C';
      const st = { run, dtRun: run - prevRun, state: seg.state, executor: seg.executor,
        canControl: seg.state === 'stopped' || seg.state === 'waiting' || seg.state === 'hosted' || seg.executor === viewerName };
      prevRun = run;
      for (const e of evs) if (e.f === f) {
        if (e.toast) st.toast = toastText[e.toast];
        if (e.menu) st.menu = camera.menuAt || { x: 0.5, y: 0.42 };
        if (e.menuClose) st.menuClose = true;
        if (e.hud) st.hud = true;
      }
      await page.evaluate(pageFrame, st);
      await page.evaluate(async (frameIdx, totalF, camSrc) => {
        const cam = eval(`(${camSrc})`);
        await window.__rec.stepAndRender(1 / 30, () => {
          const p = window.__paver.position.toArray();
          const c = cam(frameIdx / 30, p, frameIdx / totalF);
          window.__rec.pose(c[0], c[1]);
          const ctl = window.__rec.g.controller;
          ctl.hoveredContraption = null;
          if (ctl.hoveredContraptionHit) ctl.hoveredContraptionHit = null;
        });
      }, f, total, camera.fn.toString());
      if (PROBE) {
        if (!probeSet.has(f)) continue;
        const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, clip: { x: 0, y: 0, width, height, scale: 1 } });
        const p = path.join(SCRATCH, `probe_${name}_${String(f).padStart(4, '0')}.jpg`);
        fs.writeFileSync(p, Buffer.from(data, 'base64'));
        console.log(`[${name}] probe ${f} ${seg.state}`, p);
        continue;
      }
      const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, clip: { x: 0, y: 0, width, height, scale: 1 } });
      await enc.write(Buffer.from(data, 'base64'));
      if ((f + 1) % 150 === 0 || f === total - 1) console.log(`[${name}] frame ${f + 1}/${total}`);
    }
    if (enc) await enc.finish();
  } finally {
    await browser.close();
  }
}

// Cameras: (t, paverPos, u) -> [camPos, target]
const camA = (t, p, u) => {
  // player A walks behind the machine it started
  const ang = 2.45 + u * 0.3;
  return [[p[0] + Math.cos(ang) * 19, p[1] + 8.5, p[2] + Math.sin(ang) * 19], [p[0] + 1.5, p[1] + 2.6, p[2]]];
};
const camB = (t, p, u) => {
  // player B stands across the lane and turns to follow the machine; leaves at 32.3 s
  const base = window.__lane;
  const bx = base.x + 18 + Math.min(t, 32.3) * 0.75, bz = base.z - 20;
  const leave = Math.max(0, t - 32.3);
  return [[bx - leave * 3, p[1] + 7 + leave * 1.2, bz - leave * 5], [p[0], p[1] + 2.4, p[2]]];
};
const camC = (t, p, u) => {
  const ang = -0.9 + u * 1.0;
  const r = 20 + u * 6;
  return [[p[0] + Math.cos(ang) * r, p[1] + 9 + u * 3, p[2] + Math.sin(ang) * r], [p[0] - 1, p[1] + 2.4, p[2]]];
};

const half = { width: 960, height: 540, dsf: 2 };
const runners = {
  a: () => recordView({ name: 'view_a', timeline: S2, viewer: 'a', camera: { fn: camA, menuAt: { x: 0.5, y: 0.4 } }, ...half }),
  b: () => recordView({ name: 'view_b', timeline: S2, viewer: 'b', camera: { fn: camB, menuAt: { x: 0.5, y: 0.36 } }, ...half }),
  host: () => recordView({ name: 'hosted', timeline: HOST, viewer: 'c', camera: { fn: camC, menuAt: { x: 0.52, y: 0.4 } }, width: 1280, height: 720, dsf: 1.5, keepHud: true }),
};
runners.probe = runners.a;
if (!runners[clipArg]) throw new Error(`unknown clip ${clipArg}`);
await runners[clipArg]();
