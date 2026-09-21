#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CDP } from './lib/cdp.mjs';
import { frameAt, getJobs, getOptions, loopSample, usage } from './lib/options.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(projectRoot, '../../entropydrop_frontend');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function ensureDependencies() {
  const modules = path.join(frontendRoot, 'node_modules');
  if (!fs.existsSync(modules)) throw new Error('Install frontend dependencies first: cd ' + frontendRoot + ' && npm install');
  const link = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(link)) {
    // Reuse the exact packages used by MCModal, without another install.
    if (fs.lstatSync(link, { throwIfNoEntry: false })) throw new Error('Invalid node_modules link: ' + link);
    fs.symlinkSync(path.relative(projectRoot, modules), link, 'dir');
  }
  return createRequire(path.join(projectRoot, 'package.json'));
}

function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to its executable path.');
  return found;
}

async function waitUntil(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await pause(100);
  }
  throw new Error('Timed out waiting for ' + label);
}

async function startChrome(profile, options) {
  const child = spawn(chromePath(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--window-size=' + options.width + ',' + options.height,
    '--force-device-scale-factor=1', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let launchError;
  let stderr = '';
  child.on('error', error => { launchError = error; });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    const port = await waitUntil(() => {
      if (launchError) throw launchError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('Chrome exited before startup: ' + stderr);
      const activePort = path.join(profile, 'DevToolsActivePort');
      if (!fs.existsSync(activePort)) return null;
      return Number(fs.readFileSync(activePort, 'utf8').split('\n')[0]) || null;
    }, 'Chrome startup', 15000);
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = tabs.find(tab => tab.type === 'page');
    if (!page) throw new Error('Chrome did not create a render page');
    const cdp = await CDP.connect(page.webSocketDebuggerUrl);
    return { child, cdp };
  } catch (error) {
    await stopProcess(child);
    throw error;
  }
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, pause(3000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, pause(1000)]);
  }
}

function encoder(output, options, executable) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(options.fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-an', '-frames:v', String(options.frameCount),
  ];
  if (options.format === 'mp4') {
    args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  } else {
    args.push('-c:v', 'libvpx-vp9', '-lossless', '1', '-auto-alt-ref', '0',
      '-row-mt', '1', '-cpu-used', '4',
      '-pix_fmt', options.background === 'transparent' ? 'yuva420p' : 'yuv420p');
  }
  args.push(output);
  const child = spawn(executable, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  // Errors are also propagated through each stdin write.
  child.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg failed (' + code + '): ' + stderr));
    });
  });
  done.catch(() => {}); // It may exit before the browser finishes a frame.
  return { child, done };
}

async function renderJob(cdp, baseUrl, skinRoute, job, options, ffmpeg) {
  const params = new URLSearchParams({
    skin: skinRoute, mode: options.mode, background: options.background,
    yaw: String(options.yaw), scale: String(options.scale),
    'cam-y': String(options.camY), 'target-y': String(options.targetY),
  });
  await cdp.send('Page.navigate', { url: baseUrl + '/?' + params });
  await waitUntil(async () => {
    let status;
    try {
      status = await cdp.evaluate('({error: window.__skinWalkError, skin: window.__skinWalkVideo?.skin})');
    } catch (error) {
      if (/context.*destroyed|Cannot find context|target navigated/i.test(error.message)) return false;
      throw error;
    }
    if (status?.error) throw new Error(status.error);
    return status?.skin === skinRoute;
  }, 'skin texture and renderer');
  const validColor = await cdp.evaluate('CSS.supports("color", ' + JSON.stringify(options.background) + ')');
  if (!validColor) throw new Error('Invalid background color: ' + options.background);

  // Wait for Stage's centering/light state to commit, then warm up at the
  // selected starting gait phase instead of a different neutral pose.
  await cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const start = frameAt(0, options);
  await cdp.evaluate('window.__skinWalkVideo.renderFrame(' + start.time + ', ' + start.turn + ')');

  fs.mkdirSync(path.dirname(job.output), { recursive: true });
  const temporary = path.join(path.dirname(job.output),
    '.' + path.basename(job.output) + '.' + randomUUID() + '.tmp.' + options.format);
  const encoding = encoder(temporary, options, ffmpeg);
  try {
    let firstPng;
    for (let index = 0; index < options.frameCount; index++) {
      const frame = frameAt(index, options);
      const result = await cdp.evaluate('window.__skinWalkVideo.renderFrame(' + frame.time + ', ' + frame.turn + ')');
      if (!result?.png || Math.abs(result.clockTime - frame.time) > 1e-9 ||
          Math.abs(result.yaw - (options.yaw + frame.turn)) > 1e-9) {
        throw new Error('Renderer returned an invalid frame at index ' + index);
      }
      if (index === 0) firstPng = result.png;
      if (encoding.child.exitCode !== null) {
        await encoding.done;
        throw new Error('Encoder stopped before all frames were written');
      }
      await new Promise((resolve, reject) => {
        encoding.child.stdin.write(Buffer.from(result.png, 'base64'), error => error ? reject(error) : resolve());
      });
      if ((index + 1) % Math.max(1, options.fps) === 0 || index === options.frameCount - 1) {
        process.stdout.write('\r  Frames ' + (index + 1) + '/' + options.frameCount);
      }
    }
    // The virtual endpoint is intentionally not encoded. Check the actual
    // renderer (including contact shadows), not just the timing calculation.
    const end = loopSample(1, options);
    const closure = await cdp.evaluate('window.__skinWalkVideo.renderFrame(' + end.time + ', ' + end.turn + ')');
    if (closure?.png !== firstPng) throw new Error('Rendered loop endpoint does not match its starting frame');
    encoding.child.stdin.end();
    await encoding.done;
    fs.renameSync(temporary, job.output);
    process.stdout.write('\n');
    console.log('  Saved: ' + job.output + ' (loop endpoint verified)');
  } finally {
    await stopProcess(encoding.child);
    fs.rmSync(temporary, { force: true });
  }
}

async function main() {
  const options = getOptions(process.argv.slice(2));
  if (options.help) { console.log(usage); return; }
  const jobs = getJobs(options, process.cwd(), path.join(projectRoot, 'outputs'));
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
  const probe = spawnSync(ffmpeg, ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) throw new Error('ffmpeg not found. Install ffmpeg or set FFMPEG_BIN.');
  chromePath(); // Fail before opening any server if Chrome is absent.
  const require = ensureDependencies();
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  let server;
  let chrome;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'skin-walk-chrome-'));
  try {
    server = await createServer({
      root: projectRoot,
      configFile: path.join(projectRoot, 'vite.config.ts'),
      server: { host: '127.0.0.1', port: 0, open: false },
      logLevel: 'error',
      plugins: [{
        name: 'local-skin-input',
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            const match = new URL(req.url || '/', 'http://localhost').pathname.match(/^\/__skin\/(\d+)\.png$/);
            const job = match && jobs[Number(match[1])];
            if (!job) { next(); return; }
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            res.end(job.bytes);
          });
        },
      }],
    });
    await server.listen();
    const port = server.httpServer.address().port;
    const baseUrl = 'http://127.0.0.1:' + port;
    chrome = await startChrome(profile, options);
    await chrome.cdp.send('Page.enable');
    await chrome.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: options.width, height: options.height, deviceScaleFactor: 1, mobile: false,
    });
    console.log('Walk 360: ' + jobs.length + ' skin(s), ' + options.duration + 's, ' +
      options.fps + 'fps, ' + options.width + 'x' + options.height + ', ' + options.mode +
      ', ' + options.walkCycles + ' gait cycles, phase ' + options.walkPhase + ' degrees');
    for (let index = 0; index < jobs.length; index++) {
      console.log('[' + (index + 1) + '/' + jobs.length + '] ' + jobs[index].skin);
      await renderJob(chrome.cdp, baseUrl, '/__skin/' + index + '.png', jobs[index], options, ffmpeg);
    }
  } finally {
    chrome?.cdp.close();
    await stopProcess(chrome?.child);
    await server?.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
