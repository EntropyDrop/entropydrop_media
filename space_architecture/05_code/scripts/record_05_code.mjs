// Usage: node 05_code/scripts/record_05_code.mjs [all|editor|vehicle|propeller|paver|radar] [--probe]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from '../../07_practical_showcase/scripts/harness.mjs';
import { buildPhysicsBlueprints, buildPropellerBlades } from '../../04_physics_entity/scripts/nature_physics_models.mjs';
import { buildCodeModels } from './nature_code_models.mjs';
import { installCodeShots } from './nature_code_shots.mjs';

const fps = 30;
const width = 1920;
const height = 1080;
const clips = {
  editor: { seconds: 8.0, samples: [3.4, 5.0, 7.1], still: 7.4, label: 'script_editor' },
  vehicle: { seconds: 11.7, samples: [0.85, 4.7, 8.6, 10.7], still: 10.8, label: 'rover_hatch' },
  propeller: { seconds: 11.2, samples: [0.70, 2.8, 3.75, 4.75, 5.4, 6.5, 8.25, 10.0], still: 5.85, label: 'aircraft_takeoff' },
  paver: { seconds: 14.6, samples: [2.25, 4.8, 6.45, 12.5, 14.0], still: 3.85, label: 'road_paver' },
  radar: { seconds: 5.5, samples: [0.35, 2.2, 3.65, 4.82, 5.2], still: 4.72, label: 'radar_gate' },
};
const args = process.argv.slice(2);
const requested = args.find(arg => !arg.startsWith('--')) || 'all';
const probe = args.includes('--probe');
if (requested !== 'all' && !Object.hasOwn(clips, requested)) throw new Error(`Unknown clip: ${requested}`);
const root = process.env.SPACE_CODE_OUTPUT || fileURLToPath(new URL('../', import.meta.url));
const footage = path.join(root, 'footage');
const stills = path.join(root, 'exports', 'stills');
const probes = path.join(root, 'probes');
await Promise.all([footage, stills, probes].map(dir => fs.mkdir(dir, { recursive: true })));

for (const [name, meta] of Object.entries(clips)) {
  if (requested !== 'all' && requested !== name) continue;
  const { browser, page } = await launchSpace('nature', '1');
  try {
    await setupBaseScene(page);
    const profile = await page.evaluate(() => {
      const { g } = window.__rec;
      g.uiStore.setLightingQuality('ultra', false);
      g.uiStore.setEmissiveBloomQuality('medium');
      return {
        world: new URL(location.href).searchParams.get('world'),
        lighting: g.sceneRenderer.getLightingQuality(),
        bloom: g.sceneRenderer.getEmissiveBloomQuality(),
      };
    });
    if (profile.world !== 'nature' || profile.lighting !== 'ultra' || profile.bloom !== 'medium') {
      throw new Error(`Unexpected renderer settings: ${JSON.stringify(profile)}`);
    }
    console.log(name, profile);
    await page.waitForFunction(() => window.__rec.g.world.getTerrainAoiLoadProgress().ready);
    await page.evaluate(`
      window.__physicsBlueprints = ${buildPhysicsBlueprints.toString()};
      window.__propellerBlades = ${buildPropellerBlades.toString()};
      window.__buildCodeModels = ${buildCodeModels.toString()};
    `);
    await page.evaluate(installCodeShots);
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await installFixedTimeCapture(page);
    const built = await page.evaluate(name => window.__codeShots.begin(name), name);
    console.log(name, 'loaded', built);
    if (name === 'editor') await page.waitForFunction(() => window.__codeShots.configureEditor());
    await page.evaluate(async name => {
      for (let i = 0; i < 16; i++) await window.__codeShots.frame(name, 0, true);
    }, name);
    await captureClip(page, cdp, name, meta);
  } finally {
    await browser.close();
  }
}

async function captureClip(page, cdp, name, meta) {
  const frameCount = Math.round(meta.seconds * fps);
  const samples = new Set(meta.samples.map(t => Math.round(t * fps)));
  const stillFrame = Math.round(meta.still * fps);
  const base = `05_code_${name}`;
  const pending = path.join(footage, `${base}.pending.mp4`);
  const ffmpeg = probe ? null : spawn('ffmpeg', [
    '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709', '-c:v', 'libx264', '-preset', 'fast',
    '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '15', '-colorspace', 'bt709', '-color_primaries', 'bt709',
    '-color_trc', 'bt709', '-movflags', '+faststart', pending,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = ffmpeg && once(ffmpeg, 'close');
  const png = async target => {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    await fs.writeFile(target, Buffer.from(data, 'base64'));
  };
  try {
    for (let f = 0; f < frameCount; f++) {
      await page.evaluate((name, t) => window.__codeShots.frame(name, t), name, f / fps);
      if (ffmpeg) {
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg', quality: 96, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 },
        });
        await new Promise((resolve, reject) => ffmpeg.stdin.write(Buffer.from(data, 'base64'),
          error => error ? reject(error) : resolve()));
        if (f === stillFrame) await png(path.join(stills, `05_code_game_${meta.label}.png`));
      } else if (samples.has(f)) {
        await png(path.join(probes, `${name}-${String(f).padStart(3, '0')}.png`));
      }
      if ((f + 1) % 120 === 0 || f + 1 === frameCount) console.log(name, f + 1, '/', frameCount);
    }
    const trace = await page.evaluate(() => window.__codeShots.out);
    await fs.writeFile(path.join(probes, `${name}.json`), JSON.stringify(trace, null, 2));
    checkShot(name, trace);
    if (ffmpeg) {
      ffmpeg.stdin.end();
      const [code] = await done;
      if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
      const { streams: [v] } = JSON.parse(execFileSync('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames',
        '-of', 'json', pending,
      ], { encoding: 'utf8' }));
      if (v.width !== width || v.height !== height || Number(v.nb_frames) !== frameCount) {
        throw new Error(`Invalid clip: ${JSON.stringify(v)}`);
      }
      await fs.rename(pending, path.join(footage, `${base}.mp4`));
    }
  } catch (error) {
    if (ffmpeg) {
      ffmpeg.kill();
      await done.catch(() => {});
      await fs.rm(pending, { force: true });
    }
    throw error;
  }
}

function checkShot(name, trace) {
  const [first] = trace;
  const last = trace.at(-1);
  const failure = trace.flatMap(t => [t, ...(t.peers || [])]).find(t =>
    t.status === 'error' || t.error || t.nodeErrors.length || (t.pos && !t.pos.every(Number.isFinite)));
  if (failure) throw new Error(`Runtime failure: ${JSON.stringify(failure)}`);
  if (name === 'editor') return;
  if (name === 'propeller') {
    const stationary = trace.filter(p => p.t <= 1.5);
    const spun = new Set(stationary.map(p => p.rotor.join(','))).size >= 3;
    const parked = stationary.every(p => Math.hypot(...p.pos.map((v, i) => v - first.pos[i])) < 0.24);
    const liftoff = trace.find(p => p.pos[1] - first.pos[1] >= 1.0);
    const runup = trace.filter(p => (!liftoff || p.t < liftoff.t) && p.gearContact && p.forwardSpeed >= 4);
    const rollingWheels = new Set(runup.map(p => p.wheel.join(','))).size;
    const lastOnRunway = runup.at(-1);
    const runDistance = (lastOnRunway?.pos[0] ?? first.pos[0]) - first.pos[0];
    const cut = trace.find(p => p.t === 6.5);
    const riseAtCut = cut.pos[1] - first.pos[1];
    console.log('Flight:', { spun, parked, rollingWheels, runDistance, rotation: cut.rotate,
      pitch: cut.pitch, liftoff: liftoff?.t, riseAtCut, finalX: last.pos[0] - first.pos[0] });
    if (!spun || !parked || rollingWheels < 3 || runDistance < 17 || !liftoff
        || !cut.rotate || cut.pitch < 0.065 || riseAtCut < 1.5 || cut.gearContact) {
      throw new Error('Expected takeoff to follow a visible ground roll and nose-up rotation');
    }
  } else if (name === 'vehicle') {
    const rotations = new Set(trace.map(p => p.wheel.join(','))).size;
    const dx = Math.hypot(last.pos[0] - first.pos[0], last.pos[2] - first.pos[2]);
    console.log('Rover:', { dx, rotations, seated: last.seated, clicked: last.clicked, hatch: last.hatch });
    if (dx < 4 || rotations < 6 || !last.seated || !last.clicked || Math.abs(last.hatch[2]) < 0.4) {
      throw new Error('Rover action incomplete');
    }
  } else if (name === 'paver') {
    console.log('Paved columns:', first.paved, '→', last.paved);
    if (last.paved - first.paved < 20 || last.pos[1] - first.pos[1] < 0.6) throw new Error('Paver action incomplete');
  } else if (name === 'radar') {
    const message = last.messages.find(m => m.type === 'gate.open' && m.ok);
    console.log('Radar:', { message, gateTravel: last.gate });
    if (!message || message.t < 1.0 || message.t > 4.4 || Math.abs(last.gate) < 4.8 || Math.abs(first.gate) > 0.1) {
      throw new Error('Radar action incomplete');
    }
  }
}
