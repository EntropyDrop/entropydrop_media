import { parseArgs } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

// The shared MC.tsx Walk uses sin(clock.getElapsedTime() * 10 * 0.5).
export const WALK_PERIOD = 2 * Math.PI / 5;

export const usage = [
  'Usage:',
  '  node render_skin_walk_video.mjs --skin /path/to/skin.png --out /path/to/walk360.mp4',
  '  node render_skin_walk_video.mjs --skin-dir /path/to/skins --out-dir /path/to/clips',
  '',
  'Options:',
  '  --skin <file>          64x64 Minecraft PNG skin (Steve/Alex detected by frontend).',
  '  --skin-dir <dir>       Batch all PNG skins in one directory, sorted by filename.',
  '  --out <file>           Single output. Default: outputs/<skin>__walk360.webm.',
  '  --out-dir <dir>        Batch output directory. Default: outputs/.',
  '  --duration <seconds>   Default: 8. One seamless 360-degree loop.',
  '  --fps <integer>        Default: 30. Fixed frame sampling; no real-time recording.',
  '  --width <pixels>       Default: 1080.',
  '  --height <pixels>      Default: 1080.',
  '  --mode <plane|voxel|cute> Default: plane (MCModal default).',
  '  --background <color>   Default: transparent with webm, #1a1a1a with mp4.',
  '  --format <mp4|webm>    Default: webm (transparent). Inferred from --out if specified.',
  '  --yaw <degrees>        Initial character rotation. Default: 0 (MCModal view).',
  '  --walk-cycles <integer> Complete gait cycles per video; auto-selected near the website speed.',
  '  --walk-phase <degrees> Initial gait phase. Default: 90 (mid-stride).',
  '  --scale <number>       Character scale. Default: 0.82 (balanced canvas padding).',
  '  --cam-y <number>       Camera height. Default: 18 (reduced pitch angle).',
  '  --target-y <number>    Camera look-at height. Default: -0.75 (vertically centered).',
  '  --overwrite           Replace existing output files.',
  '  --help                Show help.',
  '',
  'Requires Node.js 22+, frontend/node_modules, Chrome/Chromium, and ffmpeg.',
  'Set CHROME_BIN or FFMPEG_BIN to override the executable paths.',
].join('\n');

function number(value, fallback, name, min, max, integer = false) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw new Error('--' + name + ' must be ' + (integer ? 'an integer' : 'a number') + ' from ' + min + ' to ' + max);
  }
  return result;
}

export function getOptions(argv) {
  const numericOptions = new Set(['duration', 'fps', 'width', 'height', 'yaw', 'scale', 'cam-y', 'target-y', 'walk-cycles', 'walk-phase']);
  const normalized = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (numericOptions.has(arg.slice(2)) && /^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(argv[index + 1] || '')) {
      normalized.push(arg + '=' + argv[++index]);
    } else normalized.push(arg);
  }
  const { values } = parseArgs({
    args: normalized,
    options: Object.fromEntries([
      'skin', 'skin-dir', 'out', 'out-dir', 'duration', 'fps', 'width', 'height',
      'mode', 'background', 'format', 'yaw', 'scale', 'cam-y', 'target-y', 'walk-cycles', 'walk-phase',
    ].map(name => [name, { type: 'string' }]).concat([
      ['help', { type: 'boolean' }], ['overwrite', { type: 'boolean' }],
    ])),
    strict: true,
    allowPositionals: false,
  });
  if (values.help) return { help: true };
  if (Boolean(values.skin) === Boolean(values['skin-dir'])) {
    throw new Error('Supply exactly one of --skin or --skin-dir');
  }
  if (values.skin && values['out-dir']) throw new Error('Use --out for a single skin');
  const format = values.format || (values.out?.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm');
  if (!['mp4', 'webm'].includes(format)) throw new Error('--format must be mp4 or webm');
  if (values.out && path.extname(values.out).toLowerCase() !== '.' + format) {
    throw new Error('--out extension must match --format');
  }
  const defaultBackground = format === 'webm' ? 'transparent' : '#1a1a1a';
  const background = values.background || defaultBackground;
  if (background === 'transparent' && format !== 'webm') {
    throw new Error('Transparent video requires --format webm (or --out ending in .webm)');
  }
  const mode = values.mode || 'plane';
  if (!['plane', 'voxel', 'cute'].includes(mode)) throw new Error('--mode must be plane, voxel, or cute');
  const fps = number(values.fps, 30, 'fps', 1, 120, true);
  const duration = number(values.duration, 8, 'duration', 0.1, 3600);
  const frameCount = Math.round(duration * fps);
  if (frameCount < 2) throw new Error('Duration and fps must produce at least two frames');
  const width = number(values.width, 1080, 'width', 2, 8192, true);
  const height = number(values.height, 1080, 'height', 2, 8192, true);
  if (width % 2 || height % 2) throw new Error('Width and height must be even for video encoding');
  const actualDuration = frameCount / fps;
  const walkCycles = number(values['walk-cycles'], Math.max(1, Math.round(actualDuration / WALK_PERIOD)),
    'walk-cycles', 1, 10000, true);
  const phase = number(values['walk-phase'], 90, 'walk-phase', -36000, 36000);
  return {
    help: false, skin: values.skin, skinDir: values['skin-dir'], out: values.out, outDir: values['out-dir'],
    duration: actualDuration, requestedDuration: duration, fps, frameCount, width, height, format, background, mode,
    walkCycles, walkPhase: ((phase % 360) + 360) % 360,
    yaw: number(values.yaw, 0, 'yaw', -36000, 36000),
    scale: number(values.scale, 0.82, 'scale', 0.05, 5),
    camY: number(values['cam-y'], 18, 'cam-y', -1000, 1000),
    targetY: number(values['target-y'], -0.75, 'target-y', -1000, 1000),
    overwrite: Boolean(values.overwrite),
  };
}

export function loopSample(progress, options) {
  if (!Number.isFinite(progress) || progress < 0) throw new Error('Loop progress must be nonnegative');
  const gait = progress * options.walkCycles;
  // Wrap the clock through one native gait period. Walk depends only on its
  // phase, so integral loop boundaries reproduce the exact starting pose.
  return {
    time: (options.walkPhase / 360 + (gait - Math.floor(gait))) * WALK_PERIOD,
    turn: 360 * progress,
  };
}

export function frameAt(index, options) {
  if (!Number.isInteger(index) || index < 0 || index >= options.frameCount) {
    throw new Error('Frame index out of range');
  }
  // Sample [0, 1), not [0, 1]: the first frame of the next playback supplies
  // the 360-degree endpoint without a duplicate frame or a pause.
  return loopSample(index / options.frameCount, options);
}

export function readSkin(filename) {
  const bytes = fs.readFileSync(filename);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Not a PNG skin: ' + filename);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 64 || height !== 64) {
    throw new Error('Skin must be 64x64, got ' + width + 'x' + height + ': ' + filename);
  }
  return bytes;
}

export function getJobs(options, cwd, defaultOutputs) {
  const skins = options.skin
    ? [path.resolve(cwd, options.skin)]
    : fs.readdirSync(path.resolve(cwd, options.skinDir), { withFileTypes: true })
      .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
      .map(entry => path.resolve(cwd, options.skinDir, entry.name))
      .sort((a, b) => a.localeCompare(b, 'en'));
  if (!skins.length) throw new Error('No PNG skins found');
  const jobs = skins.map(skin => ({
    skin,
    bytes: readSkin(skin),
    output: options.out
      ? path.resolve(cwd, options.out)
      : path.join(options.outDir ? path.resolve(cwd, options.outDir) : defaultOutputs,
        path.basename(skin, path.extname(skin)) + '__walk360.' + options.format),
  }));
  const paths = new Set();
  for (const job of jobs) {
    if (paths.has(job.output)) throw new Error('Two skins would write the same output: ' + job.output);
    paths.add(job.output);
    if (fs.existsSync(job.output) && !options.overwrite) {
      throw new Error('Output already exists; use --overwrite to replace it: ' + job.output);
    }
  }
  return jobs;
}
