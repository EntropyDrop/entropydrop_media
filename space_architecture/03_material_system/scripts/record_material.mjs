import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from '../../07_practical_showcase/scripts/harness.mjs';
import { installMaterialFilm } from './material_models.mjs';

const mode = process.argv[2] || 'probe';
const chapter = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.SPACE_MATERIAL_OUTPUT || chapter;
const clips = { lab: 19.8, apps: 7.0 };
const stillTimes = { lab: [1, 4.35, 6.5, 10.75, 13.5, 14.8, 18.8], apps: [0.85, 2.2, 3.35, 5.1] };
const width = 1920;
const height = 1080;
const fps = 30;

if (!['probe', 'all', 'lab', 'apps'].includes(mode)) throw new Error('Expected probe, all, lab, or apps.');

const { browser, page } = await launchSpace('nature', '1');
try {
  await setupBaseScene(page);
  const profile = await page.evaluate(() => {
    const game = window.__rec.g;
    game.uiStore.setLightingQuality('ultra', false);
    game.uiStore.setEmissiveBloomQuality('medium');
    return {
      map: new URLSearchParams(location.search).get('world'),
      lighting: game.sceneRenderer.getLightingQuality(),
      bloom: game.sceneRenderer.getEmissiveBloomQuality(),
    };
  });
  if (profile.map !== 'nature' || profile.lighting !== 'ultra' || profile.bloom !== 'medium') {
    throw new Error(`Unexpected recording profile: ${JSON.stringify(profile)}`);
  }
  console.log('Rendering profile', profile);
  await page.waitForFunction(() => window.__rec.g.world.getTerrainAoiLoadProgress().ready);
  console.log('Built models', await page.evaluate(installMaterialFilm));
  const client = await page.createCDPSession();
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await installFixedTimeCapture(page);

  async function step(name, time, settle = 1) {
    return page.evaluate(async (name, time, settle, fps) => {
      window.__materialFilm.frame(name, time);
      for (let i = 0; i < settle; i++) await window.__rec.stepAndRender(1 / fps);
    }, name, time, settle, fps);
  }

  await step('lab', 0, 35);

  if (mode === 'probe') {
    const probes = path.join(output, 'probes');
    await fs.mkdir(probes, { recursive: true });
    for (const [name, times] of Object.entries(stillTimes)) {
      for (const time of times) {
        await step(name, time, 14);
        const file = path.join(probes, `${name}-${time}.png`);
        await page.screenshot({ path: file });
        console.log(file);
      }
    }
  } else {
    const footage = path.join(output, 'footage');
    await fs.mkdir(footage, { recursive: true });
    for (const [name, seconds] of Object.entries(clips)) {
      if (mode !== 'all' && mode !== name) continue;
      const total = Math.round(seconds * fps);
      const base = path.join(footage, `03_material_${name}`);
      const pending = `${base}.pending.mp4`;
      await step(name, 0, 18);
      const ff = spawn('ffmpeg', [
        '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
        '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '15',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', pending,
      ], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = once(ff, 'close');
      const pipeError = once(ff.stdin, 'error').then(([error]) => error);
      try {
        for (let frame = 0; frame < total; frame++) {
          await step(name, frame / fps);
          const { data } = await client.send('Page.captureScreenshot', {
            format: 'jpeg', quality: 96, fromSurface: true,
            clip: { x: 0, y: 0, width, height, scale: 1 },
          });
          if (!ff.stdin.write(Buffer.from(data, 'base64'))) {
            const error = await Promise.race([once(ff.stdin, 'drain'), pipeError]);
            if (error instanceof Error) throw error;
          }
          if ((frame + 1) % 90 === 0 || frame + 1 === total) console.log(name, frame + 1, '/', total);
        }
        ff.stdin.end();
        const [code] = await done;
        if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
        const { streams: [video] } = JSON.parse(execFileSync('ffprobe', [
          '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames',
          '-of', 'json', pending,
        ], { encoding: 'utf8' }));
        if (video.width !== width || video.height !== height || Number(video.nb_frames) !== total) {
          throw new Error(`Incorrect recording dimensions or duration: ${JSON.stringify(video)}`);
        }
        await fs.rename(pending, `${base}.mp4`);
      } catch (error) {
        ff.kill();
        await done.catch(() => {});
        await fs.rm(pending, { force: true });
        throw error;
      }
    }
  }
} finally {
  await browser.close();
}
