import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from '../../07_practical_showcase/scripts/harness.mjs';
import { installVilla } from './villa_scene.mjs';

const chapter = fileURLToPath(new URL('../', import.meta.url));
const probeOnly = process.argv.includes('--probe');
const output = process.env.SPACE_VILLA_OUTPUT || chapter;
const assets = path.join(output, 'assets/space');
const footage = path.join(output, 'footage');
const fps = 30;
const width = 1920;
const height = 1080;
const shots = {
  coarse: [16.1, '02_villa_coarse'],
  transform: [10.1, '02_villa_transform'],
  anchor: [6, '02_villa_anchor'],
  open: [7.5, '02_villa_open'],
  collision: [6, '02_villa_collision'],
};

function installCameras() {
  const rec = window.__rec;
  const villa = window.__villa;
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  const lerp = (a, b, progress) => a.map((v, i) => v + progress * (b[i] - v));
  const paths = {
    coarse: [[22, 13, 29], [29, 26, 43], [-6, -1, 2], [-5, 2.3, 1], 16.1],
    detail: [[-13.9, 2.6, 12.2], [-13.9, 2.6, 12.2], [-9.25, 2.3, 4.6], [-9.25, 2.3, 4.6], 1],
    stepped: [[-13.2, 12, 11.25], [-13.2, 12, 11.25], [-12.1, 10.4, 4.85], [-12.1, 10.4, 4.85], 1],
    transform: [[-17.75, 13.25, 22], [-14.5, 13.8, 19], [-8.1, 8.75, 3], [-8.45, 8.7, 3], 10.1],
    anchor: [[-19.25, 12, 20.5], [-19, 11.15, 18.5], [-10, 7.6, 3], [-10.5, 7.7, 3], 6],
    open: [[26, 11, 25], [22, 9, 28], [-7, 3.75, 2], [-6.2, 3.85, 2], 7.5],
    collision: [[-18.5, 11.8, 13.5], [-17.5, 11.15, 12.5], [-12.5, 10.65, 4.6], [-12.6, 10.55, 4.5], 6],
  };
  const moveCamera = (shot, t) => {
    const [p0, p1, a0, a1, duration] = paths[shot];
    const k = ease(t / duration);
    rec.cam(villa.at(...lerp(p0, p1, k)), villa.at(...lerp(a0, a1, k)));
  };
  let lastRoofStep = -1;
  let collision = null;
  window.__villaFilm = {
    moveCamera,
    frame(shot, t) {
      moveCamera(shot, t);
      if (shot === 'coarse') villa.coarseAt(clamp((t - 1.05) / 7.2));
      if (shot === 'transform') {
        const transform = Math.min(48, Math.round(48 * ease((t - 3.4) / 4.75)));
        if (lastRoofStep !== transform) {
          villa.roof(transform / 48);
          lastRoofStep = transform;
        }
      }
    },
    async drop() { collision = await villa.spawnCollisionProbe(); },
    collisionPosition() {
      return { pos: collision.probe.position.toArray(), boxes: collision.roofCollisionBoxes };
    },
  };
}

await Promise.all([fs.mkdir(assets, { recursive: true }), fs.mkdir(footage, { recursive: true })]);
const { browser, page } = await launchSpace('aether-archipelago', '1');
try {
  await setupBaseScene(page);
  await page.evaluate(installVilla);
  await page.evaluate(installCameras);
  await page.evaluate(async () => {
    const rec = window.__rec;
    const villa = window.__villa;
    rec.pose(villa.at(22, 13, 29), villa.at(-6, -1, 2));
    await new Promise(requestAnimationFrame);
  });
  await page.waitForFunction(() => window.__rec.g.world.getTerrainAoiLoadProgress().ready, { timeout: 30000 });
  await page.evaluate(() => window.__villa.prepareSite());
  await installFixedTimeCapture(page);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  async function frame(shot, t) {
    await page.evaluate(async (name, time, dt) => {
      window.__villaFilm.frame(name, time);
      await window.__rec.stepAndRender(dt);
    }, shot, t, 1 / fps);
  }

  async function settle(shot, t = 0, n = 30) {
    await page.evaluate(async (name, time, frames) => {
      window.__villaFilm.frame(name, time);
      for (let f = 0; f < frames; f++) await window.__rec.stepAndRender(0);
    }, shot, t, n);
  }

  async function still(shot, name, t = 0) {
    await settle(shot, t);
    await page.screenshot({ path: path.join(assets, `${name}.png`) });
    console.log('Captured', name);
  }

  async function film(shot) {
    const [duration, name] = shots[shot];
    const pending = path.join(footage, `${name}.pending.mp4`);
    const total = Math.round(duration * fps);
    const encoder = spawn('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p',
      '-g', '15', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart', pending,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = once(encoder, 'close');
    const pipeFailure = once(encoder.stdin, 'error').then(([error]) => error);
    const collisionHeights = [];
    try {
      for (let i = 0; i < total; i++) {
        await frame(shot, i / fps);
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg', quality: 96, fromSurface: true,
          clip: { x: 0, y: 0, width, height, scale: 1 },
        });
        if (!encoder.stdin.write(Buffer.from(data, 'base64'))) {
          const result = await Promise.race([once(encoder.stdin, 'drain'), pipeFailure]);
          if (result instanceof Error) throw result;
        }
        if ((i + 1) % 90 === 0 || i === total - 1) console.log(`${name} ${i + 1}/${total}`);
        if (shot === 'collision' && (i === 0 || (i + 1) % fps === 0)) {
          const sample = await page.evaluate(() => window.__villaFilm.collisionPosition());
          collisionHeights.push(sample.pos[1]);
          console.log('Collision probe', i, sample);
        }
      }
      encoder.stdin.end();
      const [code] = await finished;
      if (code !== 0) throw new Error(`ffmpeg exited with status ${code}`);
      const { streams: [video] } = JSON.parse(execFileSync('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames', '-of', 'json', pending,
      ], { encoding: 'utf8' }));
      if (video.width !== width || video.height !== height || Number(video.nb_frames) !== total) {
        throw new Error(`Unexpected capture dimensions or frame count: ${JSON.stringify(video)}`);
      }
      if (shot === 'collision') {
        const end = collisionHeights.at(-1);
        const eaveFloor = await page.evaluate(() => window.__villa.at(0, 9, 0)[1]);
        if (collisionHeights[0] - end < 1 || end < eaveFloor || Math.abs(end - collisionHeights.at(-2)) > 0.25) {
          throw new Error(`The probe must drop and settle on the eave. Height samples: ${collisionHeights.join(', ')}`);
        }
      }
      await fs.rename(pending, path.join(footage, `${name}.mp4`));
    } catch (error) {
      encoder.kill();
      await finished.catch(() => {});
      await fs.rm(pending, { force: true });
      throw error;
    }
  }

  await settle('coarse');
  if (probeOnly) {
    await still('coarse', 'villa_coarse', 9.5);
  } else {
    await film('coarse');
  }
  await page.evaluate(() => {
    window.__villa.coarseAt(1);
    window.__villa.details();
    window.__villa.steppedRoof();
  });
  await still('detail', 'villa_detail');
  await still('stepped', 'villa_stepped_eave');
  await page.evaluate(() => {
    window.__villa.removeSteppedRoof();
    window.__villa.markRoofAnchor(true);
  });
  await settle('transform');
  if (probeOnly) {
    await still('transform', 'villa_transform', 9.8);
    await still('anchor', 'villa_anchor', 3);
  } else {
    await film('transform');
    await film('anchor');
  }
  await page.evaluate(() => window.__villa.markRoofAnchor(false));
  await still('open', 'villa_wide', 3);
  if (!probeOnly) await film('open');
  await settle('collision');
  await page.evaluate(() => window.__villaFilm.drop());
  if (probeOnly) {
    for (let i = 0; i < 90; i++) {
      await frame('collision', i / fps);
      if ([0, 16, 40, 89].includes(i)) {
        console.log('Collision probe', i, await page.evaluate(() => window.__villaFilm.collisionPosition()));
        await page.screenshot({ path: path.join(assets, `villa_collision_${i}.png`) });
      }
    }
  } else {
    await film('collision');
  }
  console.log('Villa geometry', await page.evaluate(() => window.__villa.counts));
} finally {
  await browser.close();
}
