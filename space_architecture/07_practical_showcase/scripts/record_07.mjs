// Records chapter 07 footage from the Space dev frontend.
//   node scripts/record_07.mjs A   -> footage/07_player_a.mp4 + footage/07_poses.json + footage/07_stats.json
//   node scripts/record_07.mjs B   -> footage/07_player_b.mp4 (second client replaying A's aircraft poses)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from './harness.mjs';
import { sceneInit, FLIGHT_SCRIPT } from './scene.mjs';

const ROOT = '/Volumes/zxf/entropydrop_media/space_architecture/07_practical_showcase';
const FOOT = path.join(ROOT, 'footage');
const mode = process.argv[2] || 'A';
const FPS = 30;
const A_END = 28.7;
const B_START = 24.0, B_END = 28.7;
const limit = process.argv[3] ? Number(process.argv[3]) : null;

// Entity-local decorations (origin = assembled bounding-box center, +z = nose).
function aircraftDecorations() {
  const q = (rx, ry, rz) => {
    const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2), cy = Math.cos(ry / 2), sy = Math.sin(ry / 2), cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
    return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];
  };
  const hull = 0xd9dee3, dark = 0x2b3640, acc = 0x3b4852, cyan = 0x38bdf8, green = 0x4ade80, orange = 0xf59e0b;
  const groups = [];
  for (const s of [-1, 1]) groups.push([{ id: `wing_${s < 0 ? 'l' : 'r'}`, position: [s * 4.25, -1.05, -0.4], scale: [5.2, 0.22, 2.9], rotation: q(0, s * 0.22, s * 0.1), color: hull, materialId: 0 }]);
  for (const s of [-1, 1]) groups.push([{ id: `wingstripe_${s < 0 ? 'l' : 'r'}`, position: [s * 4.4, -0.92, 0.75], scale: [4.6, 0.06, 0.32], rotation: q(0, s * 0.22, s * 0.1), color: orange, materialId: 1 }]);
  for (const s of [-1, 1]) groups.push([{ id: `winglet_${s < 0 ? 'l' : 'r'}`, position: [s * 6.75, -0.45, -1.15], scale: [0.16, 1.2, 1.4], rotation: q(0, 0, -s * 0.2), color: acc, materialId: 0 }]);
  groups.push([
    { id: 'armor_l', position: [-1.58, -1.0, -0.2], scale: [0.14, 0.9, 8.6], color: acc, materialId: 0 },
    { id: 'armor_r', position: [1.58, -1.0, -0.2], scale: [0.14, 0.9, 8.6], color: acc, materialId: 0 },
  ]);
  groups.push([{ id: 'spine', position: [0, 0.1, -1.4], scale: [1.4, 0.18, 6.0], color: acc, materialId: 0 }]);
  groups.push([{ id: 'nose', position: [0, -1.35, 6.05], scale: [2.2, 0.62, 1.1], rotation: q(0.18, 0, 0), color: hull, materialId: 0 }]);
  for (const s of [-1, 1]) groups.push([{ id: `canard_${s < 0 ? 'l' : 'r'}`, position: [s * 2.25, -0.75, 3.3], scale: [1.9, 0.14, 0.9], rotation: q(0, s * 0.35, s * 0.08), color: acc, materialId: 0 }]);
  for (const s of [-1, 1]) groups.push([{ id: `pod_${s < 0 ? 'l' : 'r'}`, position: [s * 2.15, -1.25, -3.9], scale: [1.0, 1.0, 2.6], color: dark, materialId: 0 }]);
  groups.push([
    { id: 'exhaust_l', position: [-2.15, -1.25, -5.25], scale: [0.72, 0.72, 0.16], color: cyan, materialId: 1 },
    { id: 'exhaust_r', position: [2.15, -1.25, -5.25], scale: [0.72, 0.72, 0.16], color: cyan, materialId: 1 },
  ]);
  groups.push([{ id: 'exhaust_c', position: [0, -1.5, -5.6], scale: [1.1, 0.5, 0.14], color: green, materialId: 1 }]);
  for (const s of [-1, 1]) groups.push([{ id: `fin_${s < 0 ? 'l' : 'r'}`, position: [s * 0.95, 1.05, -4.55], scale: [0.14, 1.7, 1.5], rotation: q(-0.25, 0, s * 0.38), color: hull, materialId: 0 }]);
  groups.push([{ id: 'beacon', position: [0, 2.15, -4.9], scale: [0.3, 0.3, 0.3], color: orange, materialId: 1 }]);
  // Authored around the pivot (bounding-box center); decoration space is block-local
  // (selection min corner), which sits at pivot - (3.5, 2, 5.5).
  for (const grp of groups) for (const d of grp) d.position = [d.position[0] + 3.5, d.position[1] + 2, d.position[2] + 5.5];
  return groups;
}

// Runs in-page every frame. `t` is composition time in seconds.
function choreoInit(cfg) {
  const rec = window.__rec, g = rec.g, S = window.__c07;
  const A = S.A;
  const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const entPos = () => S.ent ? S.ent.position.toArray() : A(1.5, 2, 0.5);
  // [t0, t1, camFrom, camTo, targetFrom, targetTo] in site-local coords; functions resolve live.
  const shotsA = [
    [0.0, 2.45, [-2, 16, 46], [2, 12, 34], [-2, 1, 0], [-1, 1, 0]],
    [2.45, 5.55, [20, 13, 26], [8, 8, 17], [-3, 0, 0], [-4, 1, -1]],
    [5.55, 7.45, [-8, 3.4, 12.5], [-12.5, 2.9, 8.5], [-11.5, 2, 3], [-12, 2, 3]],
    [7.45, 9.72, [-2, 10, 15], [-19, 12, 11], [-11.5, 5.5, -1], [-11.5, 5.5, -1]],
    [9.72, 11.1, [-0.5, 4.5, 9.5], [1.5, 4.0, 5.5], [-8, 2.2, -0.5], [-8, 2.2, -1]],
    [11.1, 12.95, [5, 6, 9], [6.5, 4, 5], [10.5, 2.2, -3.5], [10.5, 2.0, -3.5]],
    [12.95, 15.85, [11, 9, 13], [8, 10, 14], [1, 0.5, 0], [1, 0.5, 0]],
    [15.85, 19.5, [9, 5, 8], [-5, 6.5, 10], [1, 0, 0.5], [1, 0, 0.5]],
    [19.5, 21.9, [-4, 6.5, 11], [8, 4, 10], [1, 0.5, 0.5], [1, 0.8, 1.5]],
    [21.9, 23.35, [8, 4, 10], [10, 6, 17], 'ent', 'ent'],
    [23.35, 99, 'chase', 'chase', 'entAhead', 'entAhead'],
  ];
  const resolve = (v, t) => {
    if (Array.isArray(v)) return A(...v);
    const p = entPos();
    if (v === 'ent') return p;
    if (v === 'entAhead') return [p[0], p[1] - 0.5, p[2] + 14];
    if (v === 'chase') return [p[0] - 6.5, p[1] + 3.2, p[2] - 13];
    return p;
  };
  S.camAt = (t) => {
    const sh = shotsA.find(s => t >= s[0] && t < s[1]) || shotsA[shotsA.length - 1];
    const k = ss((t - sh[0]) / (sh[1] - sh[0]));
    const kc = sh[1] > 50 ? 0 : k;
    const pos = lerp3(resolve(sh[2], t), resolve(sh[3], t), kc);
    const tgt = lerp3(resolve(sh[4], t), resolve(sh[5], t), kc);
    rec.cam(pos, tgt);
  };
  S.decoGroups = cfg.decoGroups;
  S.decoApplied = 0;
  S.flags = {};
  S.frameA = (f) => {
    const t = f / cfg.fps;
    S.apply(t);
    const r = g.sceneRenderer;
    if (t >= 12.96 && t < 14.25) S.selectionPreview((t - 12.96) / 0.9);
    if (t >= 14.25 && !S.flags.assembled) { S.flags.assembled = true; S.assembleInfo = S.assemble(); }
    if (S.flags.assembled) S.resolveEnt();
    if (S.ent && t >= 15.9) {
      const n = Math.min(S.decoGroups.length, Math.floor((t - 15.9) / (3.3 / S.decoGroups.length)) + 1);
      if (n > S.decoApplied) {
        S.decoApplied = n;
        const list = S.decoGroups.slice(0, n).flat();
        S.ent.setComponentDecorations(S.ent.rootComponentId, list);
        S.stats.entityDecorations = list.length;
      }
    }
    if (S.ent && t >= 19.6 && !S.flags.script) {
      S.flags.script = true;
      S.ent.setComponentSeats(S.ent.rootComponentId, [{ position: [0, 0.2, 2.6] }]);
      S.ent.setScript(cfg.script);
      S.ent.enableAllNodeScripts();
      S.stats.scriptLines = cfg.script.split('\n').length;
    }
    if (S.ent && t >= 20.4 && !S.flags.mounted) {
      S.flags.mounted = true;
      const seatPos = S.ent.getSeatWorldPosition(S.ent.rootComponentId, 0);
      g.controller.hoveredContraption = S.ent;
      g.controller.hoveredContraptionHit = { contraption: S.ent, point: seatPos };
      g.controller.toggleDriveVehicle();
      S.mountedOk = !!(g.controller.isDriving ?? g.controller.drivingSession?.isDriving);
    }
    if (t >= 21.1) g.controller.recordEntityKeyDown('KeyW');
    S.camAt(t);
  };
  S.logPose = (f) => {
    if (!S.ent) return null;
    return { f, p: S.ent.position.toArray(), q: S.ent.quaternion.toArray() };
  };
  return true;
}

function choreoInitB(cfg) {
  const rec = window.__rec, g = rec.g, S = window.__c07;
  S.apply(99);
  S.frameB = (f) => {
    const t = f / cfg.fps;
    const pose = cfg.poses[f] || cfg.poses[cfg.poses.length - 1];
    if (S.ent && pose) {
      S.ent.position.set(...pose.p);
      S.ent.quaternion.set(...pose.q);
      S.ent.syncBodyFromTransform?.();
    }
    // Player B stands on a neighbouring island south-east and turns their head to follow the flyer.
    const eye = cfg.eye;
    const p = S.ent ? S.ent.position.toArray() : S.A(1, 3, 20);
    const look = [p[0] * 0.85 + eye[0] * 0.15, p[1] * 0.85 + eye[1] * 0.15, p[2] * 0.85 + eye[2] * 0.15];
    rec.cam(eye, look);
  };
  return true;
}

async function encoder(outMp4) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const tmp = outMp4 + '.pending.mp4';
  const ff = spawn('ffmpeg', ['-y', '-v', 'warning', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), '-g', '15', '-keyint_min', '15', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  return {
    async write(buf) { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); },
    async close() {
      ff.stdin.end();
      await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
      fs.renameSync(tmp, outMp4);
    },
  };
}

async function run() {
  const { browser, page } = await launchSpace('aether-archipelago', '1');
  page.on('console', m => { const t = m.text(); if (/step failed|error/i.test(t)) console.log('CONSOLE', t.slice(0, 200)); });
  try {
    await setupBaseScene(page);
    await page.evaluate(`(${sceneInit.toString()})()`);
    const site = await page.evaluate(() => { const S = window.__c07; window.__rec.pose(S.A(1, 3, 2), S.A(1, 1, 8)); return S.O; });
    let f0, f1, frameFn;
    if (mode === 'A') {
      await page.evaluate(`(${choreoInit.toString()})(${JSON.stringify({ fps: FPS, script: FLIGHT_SCRIPT, decoGroups: aircraftDecorations() })})`);
      f0 = 0; f1 = Math.round(A_END * FPS);
      frameFn = 'frameA';
    } else {
      const poses = JSON.parse(fs.readFileSync(path.join(FOOT, '07_poses.json'), 'utf8'));
      const byFrame = []; for (const p of poses) byFrame[p.f] = p;
      const eye = process.env.B_EYE ? JSON.parse(process.env.B_EYE) : [site[0] + 22, site[1] + 6, site[2] + 70];
      // Build the same aircraft locally: assemble the skeleton, apply all decorations, no script (poses replayed).
      await page.evaluate(`(${choreoInitB.toString()})(${JSON.stringify({ fps: FPS, poses: byFrame, eye })})`);
      await page.evaluate(() => window.__c07.assemble());
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); if (await page.evaluate(() => !!window.__c07.resolveEnt())) break; }
      await page.evaluate((groups) => { const S = window.__c07; S.ent.setComponentDecorations(S.ent.rootComponentId, groups.flat()); }, aircraftDecorations());
      await page.evaluate((e) => window.__rec.pose(e, [e[0] - 20, e[1], e[2] - 60]), eye);
      f0 = Math.round(B_START * FPS); f1 = Math.round(B_END * FPS);
      frameFn = 'frameB';
    }
    await new Promise(r => setTimeout(r, 2500));
    await installFixedTimeCapture(page);
    if (limit) f1 = Math.min(f1, f0 + limit);
    const out = path.join(FOOT, mode === 'A' ? '07_player_a.mp4' : '07_player_b.mp4');
    const enc = await encoder(out);
    const client = await page.createCDPSession();
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const poses = [];
    for (let f = f0; f < f1; f++) {
      const pose = await page.evaluate(async (f, fn) => {
        const S = window.__c07;
        await window.__rec.stepAndRender(1 / 30, () => S[fn](f));
        return S.logPose ? S.logPose(f) : null;
      }, f, frameFn);
      if (pose) poses.push(pose);
      const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
      await enc.write(Buffer.from(data, 'base64'));
      if ((f + 1) % 60 === 0) console.log(`[${mode}] frame ${f + 1}/${f1}`);
    }
    await enc.close();
    if (mode === 'A') {
      fs.writeFileSync(path.join(FOOT, '07_poses.json'), JSON.stringify(poses));
      const info = await page.evaluate(() => { const S = window.__c07; return { stats: S.stats, assembleInfo: S.assembleInfo, mountedOk: S.mountedOk, entBlocks: S.ent?.blocks?.length, entDecorations: S.ent?.getDecorationCount?.() }; });
      fs.writeFileSync(path.join(FOOT, '07_stats.json'), JSON.stringify(info, null, 2));
      console.log(JSON.stringify(info));
    }
    console.log('wrote', out);
  } finally { await browser.close(); }
}
await run();
