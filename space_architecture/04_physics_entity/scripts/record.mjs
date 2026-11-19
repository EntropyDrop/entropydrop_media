// Fixed-time recorder attached to the harness browser.
//   node scripts/record.mjs <shot.js> <seconds> <out.mp4>
// shot.js runs once in the page and must define window.__shot = { frame(t, f), cam(t) }.
// frame() runs before each 1/30 s step; cam() runs inside the camera hook.
// Anything pushed to window.__track is saved next to the mp4 as <out>.track.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { connect } from './harness.mjs';

const [shotFile, secs, outMp4] = process.argv.slice(2);
const FPS = 30;
const { page } = await connect();
page.on('console', m => { if (m.type() === 'log') console.log('PAGE:', m.text()); });
page.on('pageerror', err => console.log('PAGEERR:', err.message));
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

await page.evaluate(() => {
  const rec = window.__rec;
  if (rec.stepAndRender) return;
  const g = rec.g;
  const savedAnimate = g.animate;
  let frozen = false;
  let frameDelta = 0;
  g.animate = () => { frozen = true; };
  g.clock.getDelta = () => { g.clock.elapsedTime += frameDelta; return frameDelta; };
  rec.stepAndRender = async (dt, camCb) => {
    while (!frozen) await new Promise(r => requestAnimationFrame(r));
    frozen = false;
    window.__spaceCamHook = camCb || null;
    frameDelta = dt;
    savedAnimate();
    window.__spaceCamHook = null;
    await g.sceneRenderer.renderer.backend.device.queue.onSubmittedWorkDone();
    await new Promise(r => requestAnimationFrame(r));
  };
  // Run fixed steps without capturing (lets physics settle deterministically).
  rec.advance = async (n) => { for (let i = 0; i < n; i++) await rec.stepAndRender(1 / 30); };
});

const shotBody = fs.readFileSync(shotFile, 'utf8');
await page.evaluate(`(async () => { window.__track = []; ${shotBody}\n })()`);

const total = Math.round(Number(secs) * FPS);
const tmp = outMp4 + '.pending.mp4';
fs.mkdirSync(path.dirname(outMp4), { recursive: true });
const ff = spawn('ffmpeg', ['-y', '-v', 'warning', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), '-g', '15', '-keyint_min', '15',
  '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
const client = await page.createCDPSession();
await client.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

for (let f = 0; f < total; f++) {
  await page.evaluate(async (f) => {
    const t = f / 30;
    const s = window.__shot;
    await s.frame?.(t, f);
    await window.__rec.stepAndRender(1 / 30, () => { s.cam?.(t, f); s.afterCam?.(t, f); });
  }, f);
  const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if ((f + 1) % 60 === 0 || f === total - 1) console.log(`[${path.basename(outMp4)}] ${f + 1}/${total}`);
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
fs.renameSync(tmp, outMp4);
const track = await page.evaluate(() => window.__track);
if (track?.length) fs.writeFileSync(outMp4.replace(/\.mp4$/, '.track.json'), JSON.stringify(track));
console.log('DONE', outMp4, total, 'frames');
process.exit(0);
