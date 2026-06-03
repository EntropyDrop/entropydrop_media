#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './ensure_node_modules_link.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const invocationCwd = process.cwd();
const publicDir = path.join(projectRoot, 'public');
const generatedDir = path.join(publicDir, 'generated');
const outputsDir = path.join(projectRoot, 'outputs');
const fbxDir = path.join(publicDir, 'fbx');

const dances = fs.readdirSync(fbxDir)
  .filter((file) => file.toLowerCase().endsWith('.fbx'))
  .sort((a, b) => a.localeCompare(b));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'help' || key === 'list-dances' || key === 'transparent' || key === 'spin' || key === 'walk') {
      args[key] = true;
      continue;
    }
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

function usage() {
  return `Usage:
  npm run render -- --skin /path/to/skin.png --dance "Breakdance 1990" --out outputs/dance.mp4
  node /path/to/skin_dance_video/render_skin_dance_video.mjs --skin ./skin.png --walk --out ./walk.webm --format webm

Options:
  --skin <path>          Minecraft skin PNG/SVG. Local files are copied into public/generated.
  --dance <name|file>    Dance name or FBX filename. Use --list-dances to see choices.
  --walk                 Use the built-in walking animation instead of an FBX dance.
  --out <path>           Output path. Defaults to outputs/<skin>__<dance>.mp4.
  --duration <seconds>   Recording duration. Default: 6.
  --fps <number>         Frame rate. Default: 30.
  --width <px>           Canvas width. Default: 1080.
  --height <px>          Canvas height. Default: 1920.
  --mode <voxel|plane>   Minecraft overlay render mode. Default: voxel.
  --background <color>   CSS color or "transparent". Default: #12151f.
  --format <mp4|webm|both> Output format. Default: inferred from --out, otherwise mp4.
  --yaw <degrees>        Character yaw. Default: -18.
  --scale <number>       Character scale. Default: 1.
  --cam-y <number>       Camera height (Y position). Default: 24.
  --spin                 Slowly rotate the character while dancing.
  --warmup <ms>          Wait before recording starts. Default: 1500.
`;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function resolveInvocationPath(input) {
  const expanded = input === '~'
    ? os.homedir()
    : input.startsWith('~/')
      ? path.join(os.homedir(), input.slice(2))
      : input;
  return path.isAbsolute(expanded) ? expanded : path.resolve(invocationCwd, expanded);
}

function normalizeDance(input) {
  const wanted = input || 'Breakdance 1990';
  const wantedLower = wanted.toLowerCase().replace(/\.fbx$/, '');
  const match = dances.find((file) => {
    const lower = file.toLowerCase();
    return lower === wanted.toLowerCase() || lower.replace(/\.fbx$/, '') === wantedLower;
  });
  if (!match) {
    throw new Error(`Unknown dance "${wanted}". Available: ${dances.map((file) => file.replace(/\.fbx$/, '')).join(', ')}`);
  }
  return match;
}

function copySkinToPublic(skinPath) {
  if (!skinPath) {
    return '/generated/placeholder_skin.svg';
  }
  if (/^https?:\/\//i.test(skinPath) || skinPath.startsWith('/generated/')) {
    return skinPath;
  }
  const resolved = resolveInvocationPath(skinPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Skin file not found: ${resolved}`);
  }
  fs.mkdirSync(generatedDir, { recursive: true });
  const ext = path.extname(resolved) || '.png';
  const name = `${slug(path.basename(resolved, ext))}-${Date.now()}${ext}`;
  const dest = path.join(generatedDir, name);
  fs.copyFileSync(resolved, dest);
  return `/generated/${name}`;
}

function getChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the executable path.');
  return found;
}

function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function startUploadServer(token, targetPath) {
  let server;
  const sockets = new Set();
  const done = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Connection', 'close');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method !== 'POST' || url.pathname !== '/upload' || url.searchParams.get('token') !== token) {
        res.writeHead(404);
        res.end('not found');
        return;
      }

      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('error', reject);
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        if ((req.headers['content-type'] || '').includes('application/json')) {
          reject(new Error(body.toString('utf8')));
          res.writeHead(500);
          res.end('error');
          return;
        }
        fs.writeFileSync(targetPath, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        resolve();
      });
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.on('error', reject);
  });

  return new Promise((resolve, reject) => {
    const handleListenError = (err) => reject(err);
    server.once('error', handleListenError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleListenError);
      resolve({
        server,
        sockets,
        port: server.address().port,
        done,
      });
    });
  });
}

function closeUploadServer(upload) {
  if (!upload?.server) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1000);
    upload.server.close(() => {
      clearTimeout(timeout);
      resolve();
    });
    if (typeof upload.server.closeIdleConnections === 'function') {
      upload.server.closeIdleConnections();
    }
    if (typeof upload.server.closeAllConnections === 'function') {
      upload.server.closeAllConnections();
    }
    for (const socket of upload.sockets || []) {
      socket.destroy();
    }
  });
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function isProcessDone(child) {
  return !child || child.exitCode !== null || child.signalCode !== null;
}

function waitForProcessExit(child, timeoutMs = 3000) {
  if (isProcessDone(child)) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function terminateProcess(child, timeoutMs = 3000) {
  if (isProcessDone(child)) return;
  child.kill('SIGTERM');
  await waitForProcessExit(child, timeoutMs);
  if (isProcessDone(child)) return;
  child.kill('SIGKILL');
  await waitForProcessExit(child, 1000);
}

async function rmWithRetry(targetPath, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === attempts - 1) {
        console.warn(`Could not remove temporary directory ${targetPath}: ${err.message}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args['list-dances']) {
    console.log(dances.map((file) => file.replace(/\.fbx$/, '')).join('\n'));
    return;
  }

  fs.mkdirSync(outputsDir, { recursive: true });
  const useWalk = Boolean(args.walk);
  const danceFile = useWalk ? null : normalizeDance(args.dance);
  const skinUrl = copySkinToPublic(args.skin);
  const duration = Number(args.duration || 6);
  const fps = Number(args.fps || 30);
  const width = Number(args.width || 1080);
  const height = Number(args.height || 1920);
  const warmup = Number(args.warmup || 1500);
  const mode = args.mode === 'plane' ? 'plane' : 'voxel';
  const background = args.transparent ? 'transparent' : (args.background || '#12151f');
  const yaw = Number(args.yaw || -18);
  const scale = Number(args.scale || 1);
  const camY = Number(args['cam-y'] || args.camY || args.cam_y || 24);
  const actionLabel = useWalk ? 'walk' : slug(danceFile);
  const inferredOut = path.join(outputsDir, `${slug(path.basename(args.skin || 'placeholder'))}__${actionLabel}.mp4`);
  const outPath = args.out ? resolveInvocationPath(args.out) : inferredOut;
  const format = args.format || (outPath.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4');
  const webmPath = format === 'webm'
    ? outPath
    : path.join(path.dirname(outPath), `${path.basename(outPath, path.extname(outPath))}.webm`);
  fs.mkdirSync(path.dirname(webmPath), { recursive: true });

  const token = Math.random().toString(36).slice(2);
  const upload = await startUploadServer(token, webmPath);
  const vitePort = Number(args.port || 5178);
  const viteBin = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const vite = spawnProcess(viteBin, ['--host', '127.0.0.1', '--port', String(vitePort)]);
  vite.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  vite.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

  let chrome;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skin-dance-chrome-'));

  try {
    await waitForHttp(`http://127.0.0.1:${vitePort}`, 15000);
    const params = new URLSearchParams({
      skin: skinUrl,
      action: useWalk ? 'walking' : 'dance',
      dance: danceFile ? `/fbx/${danceFile}` : '',
      duration: String(duration),
      fps: String(fps),
      width: String(width),
      height: String(height),
      warmup: String(warmup),
      mode,
      background,
      yaw: String(yaw),
      scale: String(scale),
      'cam-y': String(camY),
      record: '1',
      upload: `http://127.0.0.1:${upload.port}/upload?token=${token}`,
    });
    if (args.spin) params.set('spin', '1');
    if (args.transparent) params.set('transparent', '1');

    const url = `http://127.0.0.1:${vitePort}/?${params.toString()}`;
    const chromeArgs = [
      '--headless=new',
      '--no-first-run',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profileDir}`,
      `--window-size=${width},${height}`,
      '--force-device-scale-factor=1',
      url,
    ];

    console.log(`Recording ${duration}s @ ${fps}fps: ${useWalk ? 'walking' : path.basename(danceFile)} with ${skinUrl}`);
    chrome = spawnProcess(getChromePath(), chromeArgs);
    chrome.stderr.on('data', (chunk) => process.stderr.write(`[chrome] ${chunk}`));

    const timeoutMs = warmup + duration * 1000 + 30000;
    await Promise.race([
      upload.done,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms waiting for browser upload`)), timeoutMs)),
    ]);

    if (format === 'mp4' || format === 'both') {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await run('ffmpeg', [
        '-y',
        '-i', webmPath,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outPath,
      ]);
    }

    if (format === 'mp4' && webmPath !== outPath && args.keepWebm !== '1') {
      fs.unlinkSync(webmPath);
    }

    const finalPaths = [];
    if (format === 'webm' || format === 'both') finalPaths.push(webmPath);
    if (format === 'mp4' || format === 'both') finalPaths.push(outPath);
    console.log(`Done:\n${finalPaths.map((file) => `  ${pathToFileURL(file).href}`).join('\n')}`);
  } finally {
    await closeUploadServer(upload);
    await terminateProcess(chrome);
    await terminateProcess(vite);
    await rmWithRetry(profileDir);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
