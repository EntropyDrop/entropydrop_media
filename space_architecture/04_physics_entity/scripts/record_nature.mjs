import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from '../../07_practical_showcase/scripts/harness.mjs';
import { buildPhysicsBlueprints, buildPropellerBlades } from './nature_physics_models.mjs';
import { installPhysicsShots } from './nature_physics_shots.mjs';

const mode = process.argv[2] || 'probe';
if (!['probe', 'all'].includes(mode)) throw new Error('Expected probe or all');
const chapter = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.SPACE_PHYSICS_OUTPUT || chapter;
const outDir = path.join(output, mode === 'probe' ? 'probes' : 'footage');
const fps = 30, width = 1920, height = 1080;
const clips = {
  ab: { base: '04_ab_assemble_physics', seconds: 16.5, probes: [0.8, 3.4, 5, 7.1, 8.7, 10.8, 12.2, 13.5, 15.6] },
  c: { base: '04_c_component_tree', seconds: 15.0, probes: [0.78, 2.65, 4.5, 5.6, 7.6, 10.6, 13.8] },
  d: { base: '04_d_propeller', seconds: 12.3, probes: [0.85, 2.1, 4.42, 5.65, 6.5, 9.5, 11.65] },
};
await fs.mkdir(outDir, { recursive: true });
const { browser, page } = await launchSpace('nature', '1');
try {
  await setupBaseScene(page);
  const profile = await page.evaluate(() => {
    const game = window.__rec.g;
    game.uiStore.setLightingQuality('ultra', false);
    game.uiStore.setEmissiveBloomQuality('medium');
    return {
      world: new URLSearchParams(location.search).get('world'),
      lighting: game.sceneRenderer.getLightingQuality(),
      bloom: game.sceneRenderer.getEmissiveBloomQuality(),
    };
  });
  if (profile.world !== 'nature' || profile.lighting !== 'ultra' || profile.bloom !== 'medium') {
    throw new Error(`Unexpected capture settings: ${JSON.stringify(profile)}`);
  }
  console.log('Capture settings:', profile);
  await page.waitForFunction(() => window.__rec.g.world.getTerrainAoiLoadProgress().ready);
  await page.evaluate(`
    window.__physicsBlueprints = ${buildPhysicsBlueprints.toString()};
    window.__physicsPropellerBlades = ${buildPropellerBlades.toString()};
  `);
  console.log('Built model geometry:', await page.evaluate(installPhysicsShots));
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await installFixedTimeCapture(page);
  for (const [name, { base, seconds, probes }] of Object.entries(clips)) {
    await page.evaluate(async name => {
      const s = window.__physicsShots;
      await s.begin(name);
      for (let i = 0; i < 18; i++) await s.frame(name, 0);
    }, name);
    const total = Math.round(seconds * fps);
    const probeFrames = new Set(probes.map(t => Math.round(t * fps)));
    const pending = path.join(outDir, `${base}.pending.mp4`);
    const ff = mode === 'all' ? spawn('ffmpeg', [
      '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '15',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', pending,
    ], { stdio: ['pipe', 'inherit', 'inherit'] }) : null;
    const done = ff && once(ff, 'close');
    const pipeError = ff && once(ff.stdin, 'error').then(([error]) => error);
    try {
      for (let f = 0; f < total; f++) {
        await page.evaluate((name, time) => window.__physicsShots.frame(name, time), name, f / fps);
        if (ff) {
          const { data } = await cdp.send('Page.captureScreenshot', {
            format: 'jpeg', quality: 96, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 },
          });
          if (!ff.stdin.write(Buffer.from(data, 'base64'))) {
            const failure = await Promise.race([once(ff.stdin, 'drain'), pipeError]);
            if (failure instanceof Error) throw failure;
          }
        } else if (probeFrames.has(f)) {
          const target = path.join(outDir, `${name}-${f}.png`);
          await page.screenshot({ path: target });
          console.log(target);
        }
        if ((f + 1) % 120 === 0 || f + 1 === total) console.log(name, f + 1, '/', total);
      }
      const track = await page.evaluate(name => window.__physicsShots.tracks[name], name);
      await fs.writeFile(path.join(outDir, `${base}.track.json`), JSON.stringify(track));
      checkShot(name, track);
      if (ff) {
        ff.stdin.end();
        const [code] = await done;
        if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
        const { streams: [video] } = JSON.parse(execFileSync('ffprobe', [
          '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames',
          '-of', 'json', pending,
        ], { encoding: 'utf8' }));
        if (video.width !== width || video.height !== height || Number(video.nb_frames) !== total) {
          throw new Error(`Unexpected video dimensions or duration: ${JSON.stringify(video)}`);
        }
        await fs.rename(pending, path.join(outDir, `${base}.mp4`));
      }
    } catch (error) {
      if (ff) {
        ff.kill();
        await done.catch(() => {});
        await fs.rm(pending, { force: true });
      }
      throw error;
    }
  }
} finally {
  await browser.close();
}

function checkShot(name, track) {
  if (name === 'ab') {
    const event = track.find(p => p.ev === 'assemble');
    const motion = track.filter(p => p.pos);
    const first = motion[0];
    const landing = motion.filter(p => p.t >= 9 && p.t < 11.5).sort((a, b) => a.pos[1] - b.pos[1])[0];
    const elevated = motion.filter(p => p.t >= 13.4).sort((a, b) => b.pos[1] - a.pos[1])[0];
    const stats = [first, landing, elevated].map(p => p && { t: p.t, pos: p.pos, speed: p.speed });
    console.log('Rigid-body samples:', stats, event);
    if (!event || event.t < 4.43 || event.t > 4.67 || !landing || !elevated
        || landing.pos[0] - first.pos[0] < 15 || first.pos[1] - landing.pos[1] < 3
        || elevated.pos[1] - landing.pos[1] < 1.2) {
      throw new Error('Assembly, ramp descent, or thrust did not complete in the shot');
    }
  } else if (name === 'c') {
    const splits = track.filter(p => p.ev === 'split');
    const poses = track.filter(p => p.poses);
    if (splits.length !== 6 || poses.length < 3 || splits.some(({ id }) => new Set(poses.map(p => p.poses[id].join(','))).size < (id === 'hatch' ? 2 : 3))) {
      throw new Error(`Missing part or relative motion: ${JSON.stringify(track)}`);
    }
    console.log('Selector split six moving components:', splits.map(({ id, voxels }) => [id, voxels]));
  } else {
    const poses = track.filter(p => p.rotor);
    const fixed = new Set(poses.map(p => p.airframe.join(',')));
    const rotating = new Set(poses.map(p => p.rotor.join(',')));
    if (track.filter(p => p.ev === 'blade').length !== 4 || fixed.size !== 1 || rotating.size < 6) {
      throw new Error(`Expected a stationary airframe and a spinning propeller: ${JSON.stringify(track)}`);
    }
    console.log('All four blades installed. Verified stationary airframe and rotating child component.');
  }
}
