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
import { fileURLToPath } from 'node:url';
import { buildCodeModels } from '../../05_code/scripts/nature_code_models.mjs';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from '../../07_practical_showcase/scripts/harness.mjs';

const ROOT = process.env.SPACE_RUNTIME_OUTPUT || fileURLToPath(new URL('../', import.meta.url));
const SCRATCH = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'space-runtime-record-'));
const clipArg = process.argv[2] || 'probe';
const PROBE = process.argv.includes('--probe') || clipArg === 'probe';
const FPS = 30;

// Clean capture: no cursor, no dev overlays, no hotbar/chat; keep nameplates, toasts,
// entity menu and (for the hosting clip) the Hosted Entities section.
async function installUiStyle(page, { keepHud = false } = {}) {
  await page.evaluate((keepHud) => {
    const { g } = window.__rec;
    const render = g.sceneRenderer;
    const canvas = render.renderer.domElement;
    canvas.classList.add('runtime-recording-canvas');
    const style = document.createElement('style');
    const keep = ['#entity-nameplates', '#toast', '#entity-context-menu-layer', ...(keepHud ? ['.hud-top .hud-card'] : [])];
    // The shared harness hides the game UI during cinematic recording.
    // Restore just the ancestors needed by the authority and hosting overlays.
    for (const selector of keep) for (const element of document.querySelectorAll(selector)) {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.style.display === 'none') parent.style.removeProperty('display');
      }
    }
    const draw = render.render.bind(render);
    render.render = (...args) => {
      if (render.playerFirstPersonHand) render.playerFirstPersonHand.visible = false;
      return draw(...args);
    };
    g.controller.getCursorHighlight = () => null;
    style.textContent = `
      html, body { cursor: none !important; overflow: hidden !important; }
      body * { visibility: hidden !important; }
      canvas:not(.runtime-recording-canvas) { display: none !important; }
      .runtime-recording-canvas, ${keep.map(k => `${k}, ${k} *`).join(', ')} { visibility: visible !important; }
      #crosshair, #dev-render-diagnostics, #dev-frame-profiler { display: none !important; }
      .hud-top .hud-card .hud-metrics, .hud-top .hud-card details { display: none !important; }
      /* never show hosting billing or core details */
      #hud-hosted-entities .hud-hosting-capacity, #hud-hosted-entities .hud-hosting-row-actions,
      #hud-hosted-entities .hud-entity-meta ~ .hud-entity-meta,
      #hud-hosted-entities .hud-entity-meta span + span, .entity-hosting-confirm { display: none !important; }
      #toast { font-size: 22px; }
      #entity-nameplates .entity-nameplate:not([style*="display: none"]) {
        display: flex !important;
        opacity: 1 !important;
        padding: 7px 10px;
        font-size: 20px;
      }
      #entity-nameplates .entity-nameplate-executor,
      #entity-nameplates .entity-run-status { font-size: 16px; line-height: 18px; }
      #entity-context-menu-layer .selector-context-details { display: none !important; }
      #entity-context-menu-layer button[aria-label="Disassemble entity"] { display: none !important; }
    `;
    document.head.appendChild(style);
    window.__keepHud = keepHud;
  }, keepHud);
}

function startEncoder(outMp4, holdFrames) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const tmpMp4 = outMp4 + '.pending.mp4';
  const ff = spawn('ffmpeg', ['-y', '-v', 'warning', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
    '-vf', `scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop=${holdFrames}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), '-g', '15', '-keyint_min', '15',
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

const qEuler = (x, y, z) => {
  const sx = Math.sin(x / 2), sy = Math.sin(y / 2), sz = Math.sin(z / 2);
  const cx = Math.cos(x / 2), cy = Math.cos(y / 2), cz = Math.cos(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
};
const paverModel = buildCodeModels(qEuler).paver('');
const PAVER_SPEED = 1.6;

// Authority timeline for the S2 split screen, relative to the start of the footage.
// Each segment: who executes, whether the paver advances.
const S2 = {
  duration: 836 / FPS,
  segments: [
    { t: 0, state: 'stopped' },
    { t: 78 / FPS, state: 'run', executor: 'Player A' },
    { t: 568 / FPS, state: 'stopped' },
    { t: 627 / FPS, state: 'run', executor: 'Player B' },
    { t: 699 / FPS, state: 'waiting' },
    { t: 780 / FPS, state: 'run', executor: 'Player A' },
  ],
  events: {
    a: [{ t: 78 / FPS, toast: 'start' }, { t: 568 / FPS, toast: 'stop' }],
    b: [{ t: 627 / FPS, toast: 'start' }],
  },
};
const HOST = {
  duration: 276 / FPS,
  runOffset: 0,
  segments: [
    { t: 0, state: 'run', executor: 'Player A' },
    { t: 2.6, state: 'hosted' },
  ],
  events: { c: [{ t: 0.4, menu: true }, { t: 2.3, menuClose: true }, { t: 3.4, hud: true }] },
};

// Integrate an eased speed curve inside each uninterrupted movement segment.
const isMoving = segment => segment?.state === 'run' || segment?.state === 'hosted';
function rampDistance(seconds, duration) {
  if (!duration || seconds >= duration) return seconds - duration / 2;
  const u = seconds / duration;
  return duration * u ** 3 * (1 - u / 2);
}

function runTimeAt(timeline, t) {
  let run = timeline.runOffset || 0;
  const segments = timeline.segments;
  for (const [i, segment] of segments.entries()) {
    if (t <= segment.t) break;
    if (!isMoving(segment)) continue;

    const next = segments[i + 1];
    const duration = (next?.t ?? timeline.duration) - segment.t;
    const elapsed = Math.min(t - segment.t, duration);
    const easing = Math.min(0.45, duration / 2);
    const acceleration = i > 0 && !isMoving(segments[i - 1]) ? easing : 0;
    const braking = next && !isMoving(next) ? easing : 0;
    run += rampDistance(elapsed, acceleration);
    if (braking && duration - elapsed < braking) {
      const brakingTime = elapsed - (duration - braking);
      run -= rampDistance(brakingTime, braking);
    }
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
  // Same survey lane as chapter 05, extended to cover the handoff and hosting.
  const lane = { x: 5364, y: 20, z: 827 };
  await page.evaluate(({ x, y, z }) => window.__rec.cam([x + 12, y + 12, z + 17], [x, y + 2, z]), lane);
  await page.waitForFunction(() => {
    const { g, groundY } = window.__rec;
    return g.world.getTerrainAoiLoadProgress().ready && groundY(5364, 827) > 0
      && g.world.getBlock(5364, groundY(5364, 827) - 1, 827);
  }, { timeout: 30000 });
  return page.evaluate(async ({ model, lane }) => {
    const { g, spawnModel, groundY } = window.__rec;
    const totalLength = 96;
    const initialGround = [0, 16, 36, 60].map(dx => [-12, 0, 12].map(dz => groundY(lane.x + dx, lane.z + dz)));
    const centerHeights = initialGround.map(row => row[1]).sort((a,b) => a-b);
    lane.y = Math.round((centerHeights[1]+centerHeights[2])/2);

    function grade(x, y, z, color) {
      const ground = groundY(x, z);
      for (let h = y; h < ground; h++) g.world.setBlock(x, h, z, 0, true);
      for (let h = Math.min(ground, y - 1); h < y - 1; h++) g.world.setBlock(x, h, z, 1, true, 0x58615b);
      g.world.setBlock(x, y - 1, z, 1, true, color);
    }
    for (let x = lane.x - 20; x <= lane.x + totalLength; x++) {
      for (let dz = -4; dz <= 4; dz++) {
        grade(x, lane.y, lane.z + dz, (x + dz) % 3 ? 0x91886d : 0x9a9472);
      }
      for (const sign of [-1, 1]) for (let d = 1; d <= 4; d++) {
        const z = lane.z + sign * (4 + d);
        const natural = groundY(x, z);
        const shoulder = Math.round(lane.y + (natural - lane.y) * d / 5);
        if (shoulder !== natural) grade(x, shoulder, z, d < 2 ? 0x777b65 : 0x68734e);
      }
    }
    const ent = await spawnModel(model, [lane.x + 0.5, lane.y + 0.025, lane.z + 0.5]);
    ent.position.set(lane.x + 0.5, lane.y + 0.025, lane.z + 0.5);
    ent.syncAllBodyTransforms();
    ent.setPhysicsSimulationEnabled(ent.isPhysicsSimulationEnabled());
    ent.serverManaged = true;
    ent.serverExecutesLocally = false;
    window.__paver = ent;
    window.__lane = lane;
    window.__paved = lane.x - 17;
    return { lane, initialGround, id: ent.id, publicId: ent.publicId, model: model.root.name, decorations: model.root.decorations.length };
  }, { model: paverModel, lane });
}

// Deterministic poses and laid road for the offline replay of authority states.
function pageFrame(st) {
  const { g } = window.__rec;
  const ent = window.__paver;
  const lane = window.__lane;
  const x = lane.x + 0.5 + st.run * st.speed;
  const z = lane.z + 0.5;
  ent.position.set(x, lane.y + 0.025, z);
  // The capture has already evaluated the exact pose for this frame.
  ent.previousPosition.copy(ent.position);
  ent.previousQuaternion.copy(ent.quaternion);
  ent.updateTransform();
  const column = Math.floor(x - 4.75);
  for (let c = window.__paved + 1; c <= column; c++) {
    for (let dz = -3; dz <= 3; dz++) {
      const color = dz === 0 && c % 5 < 2 ? 0xd8b56a : Math.abs(dz) === 3 ? 0x808981 : 0x4c5556;
      g.world.setBlock(c, lane.y - 1, lane.z + dz, 1, true, color);
    }
  }
  window.__paved = column;
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
      items: [{ entity_id: String(ent.publicId || ent.id), name: ent.name || 'Survey & Paving Machine', state: 'running', enabled: true, core_id: null,
        remaining_ms: 3600000, budget_remaining_credits: 1, can_manage: true }] } });
    const btn = document.querySelector('#hud-hosted-entities .hud-hosting-toggle');
    if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
  }
  g.uiStore.refresh();
}

// ---------------------------------------------------------------- record

async function recordView({ name, timeline, viewer, camera, width, height, dsf, keepHud = false }) {
  const outMp4 = path.join(ROOT, `footage/06_runtime_${name}.mp4`);
  const { browser, page } = await launchSpace('nature', '1');
  try {
    await setupBaseScene(page);
    const profile = await page.evaluate(() => {
      const { g } = window.__rec;
      g.uiStore.setEmissiveBloomQuality('medium');
      return {
        world: new URL(location.href).searchParams.get('world'),
        lighting: g.sceneRenderer.getLightingQuality(),
        bloom: g.sceneRenderer.getEmissiveBloomQuality(),
      };
    });
    if (profile.world !== 'nature' || profile.lighting !== 'ultra' || profile.bloom !== 'medium') {
      throw new Error(`Unexpected capture profile: ${JSON.stringify(profile)}`);
    }
    console.log(`[${name}] profile`, JSON.stringify(profile));
    const meta = await installPaver(page);
    console.log(`[${name}] setup`, JSON.stringify(meta));
    console.log(`[${name}] layout`, JSON.stringify(await page.evaluate(() => {
      const c = window.__rec.g.sceneRenderer.renderer.domElement;
      const r = c.getBoundingClientRect();
      return { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, cw: c.width, ch: c.height, r: [r.x, r.y, r.width, r.height], parent: c.parentElement?.id || c.parentElement?.className, bodyH: document.body.getBoundingClientRect().height };
    })));
    // pre-pave the road laid before this clip (HOST continues from S2)
    await page.evaluate(pageFrame, { run: timeline.runOffset || 0, speed: PAVER_SPEED, state: 'stopped', canControl: false });
    await new Promise(r => setTimeout(r, 2500));
    await installUiStyle(page, { keepHud });
    await installFixedTimeCapture(page);
    const total = Math.round(timeline.duration * FPS);
    const evs = (timeline.events[viewer] || []).map(e => ({ ...e, f: Math.round(e.t * FPS) }));
    const entityNo = meta.id;
    const toastText = {
      start: { text: `Entity #${entityNo} started` },
      stop: { text: `Entity #${entityNo} stopped (state reset)` },
    };
    const probeFractions = process.env.SPACE_RUNTIME_FAST_PROBE ? (name === 'hosted' ? [0.07, 0.38] : [0.005, 0.08]) : [0.08, 0.3, 0.48, 0.52, 0.66, 0.75, 0.86, 0.97];
    const probeSet = new Set(probeFractions.map(u => Math.round(u * total)));
    // Hold Player B's last view once the departure overlay has appeared.
    const departure = timeline.segments.find(segment => segment.state === 'waiting');
    const holdFrames = viewer === 'b' && departure
      ? total - Math.ceil((departure.t + 0.55) * FPS)
      : 0;
    const captureFrames = PROBE ? Math.max(...probeSet) + 1 : total - holdFrames;
    const enc = PROBE ? null : startEncoder(outMp4, holdFrames);
    const client = await page.createCDPSession();
    // headful window chrome can shrink the visible area; lock the emulated viewport like 05_code does
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: false });
    await new Promise(r => setTimeout(r, 800));
    for (let f = 0; f < captureFrames; f++) {
      const t = f / FPS;
      const seg = segAt(timeline, t);
      const run = runTimeAt(timeline, t);
      const viewerName = viewer === 'a' ? 'Player A' : viewer === 'b' ? 'Player B' : 'Player C';
      const st = { run, speed: PAVER_SPEED, state: seg.state, executor: seg.executor,
        canControl: seg.state === 'stopped' || seg.state === 'waiting' || seg.state === 'hosted' || seg.executor === viewerName };
      for (const e of evs) if (e.f === f) {
        if (e.toast) st.toast = toastText[e.toast];
        if (e.menu) st.menu = camera.menuAt;
        if (e.menuClose) st.menuClose = true;
        if (e.hud) st.hud = true;
      }
      await page.evaluate(pageFrame, st);
      await page.evaluate(async (frameIdx, totalF, camSrc) => {
        const cam = eval(`(${camSrc})`);
        // This local replay advances from the capture frame index.
        // Draw the staged pose without an independent simulation tick.
        await window.__rec.stepAndRender(0, () => {
          const p = window.__paver.position.toArray();
          const c = cam(frameIdx / 30, p, frameIdx / totalF);
          window.__rec.cam(c[0], c[1]);
          const ctl = window.__rec.g.controller;
          ctl.hoveredContraption = null;
          if (ctl.hoveredContraptionHit) ctl.hoveredContraptionHit = null;
        });
      }, f, total, camera.fn.toString());
      if (PROBE) {
        if (!probeSet.has(f)) continue;
        const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
        const p = path.join(SCRATCH, `probe_${name}_${String(f).padStart(4, '0')}.jpg`);
        fs.writeFileSync(p, Buffer.from(data, 'base64'));
        console.log(`[${name}] probe ${f} ${seg.state}`, p);
        continue;
      }
      const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
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
  const angle = 2.30 + 0.27 * u;
  return [[p[0] + Math.cos(angle) * 16, p[1] + 6.8, p[2] + Math.sin(angle) * 16],
    [p[0] - 1, p[1] + 1.45, p[2]]];
};
const camB = (t, p, u) => {
  const angle = -0.81 - 0.33 * u;
  const elapsed = Math.max(0, t - 699 / 30);
  const uLeave = Math.min(elapsed / 0.5, 1);
  const leave = 0.5 * uLeave ** 3 * (1 - uLeave / 2) + Math.max(0, elapsed - 0.5);
  const distance = 17 + leave * 1.8;
  return [[p[0] + Math.cos(angle) * distance, p[1] + 5.4 + leave * 0.45, p[2] + Math.sin(angle) * distance],
    [p[0] + 0.6, p[1] + 1.65, p[2]]];
};
const camC = (t, p, u) => {
  const angle = -1.1 - u * 1.11;
  const r = 15 + u * 4.5;
  return [[p[0] + Math.cos(angle) * r, p[1] + 5.8 + u * 2.5, p[2] + Math.sin(angle) * r],
    [p[0] - u * 3.8, p[1] + 1.25, p[2]]];
};

const viewport = { width: 1920, height: 1080, dsf: 1 };
const runners = {
  a: () => recordView({ name: 'view_a', timeline: S2, viewer: 'a', camera: { fn: camA }, ...viewport }),
  b: () => recordView({ name: 'view_b', timeline: S2, viewer: 'b', camera: { fn: camB }, ...viewport }),
  host: () => recordView({ name: 'hosted', timeline: HOST, viewer: 'c', camera: { fn: camC, menuAt: { x: 0.73, y: 0.32 } }, ...viewport, keepHud: true }),
};
runners.probe = runners.a;
if (!runners[clipArg]) throw new Error(`unknown clip ${clipArg}`);
await runners[clipArg]();
