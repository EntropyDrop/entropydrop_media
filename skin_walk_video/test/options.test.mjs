import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { frameAt, getJobs, getOptions, loopSample, readSkin, WALK_PERIOD } from '../lib/options.mjs';

test('loop advances uniformly through the seam without repeating the first frame', () => {
  const options = getOptions(['--skin', 'skin.png']);
  assert.equal(options.mode, 'plane');
  assert.equal(options.frameCount, 240);
  assert.equal(options.duration, 8);
  assert.equal(options.walkCycles, 6);
  assert.equal(options.walkPhase, 90);
  assert.deepEqual(frameAt(0, options), { time: WALK_PERIOD / 4, turn: 0 });
  const step = 360 / options.frameCount;
  for (let index = 1; index < options.frameCount; index++) {
    assert.ok(Math.abs(frameAt(index, options).turn - frameAt(index - 1, options).turn - step) < 1e-10);
  }
  assert.equal(frameAt(239, options).turn, 358.5);
  assert.equal(360 - frameAt(239, options).turn, step);
  assert.equal(loopSample(1, options).time, frameAt(0, options).time);
  assert.equal(loopSample(1, options).turn, 360);
  assert.throws(() => frameAt(240, options), /out of range/);
});

test('rounded durations use integral gait cycles for different frame rates', () => {
  for (const fps of [24, 30, 60]) {
    const options = getOptions(['--skin', 'skin.png', '--duration', '2.13', '--fps', String(fps)]);
    assert.equal(options.frameCount, Math.round(2.13 * fps));
    assert.equal(options.duration, options.frameCount / fps);
    assert.equal(loopSample(1, options).time, frameAt(0, options).time);
    assert.equal(Math.sin(loopSample(1, options).time * 5), Math.sin(frameAt(0, options).time * 5));
    assert.ok(Math.abs(360 - frameAt(options.frameCount - 1, options).turn - 360 / options.frameCount) < 1e-10);
  }
});

test('default clip contains six full strides, including the wraparound stride', () => {
  const options = getOptions(['--skin', 'skin.png']);
  const swing = Array.from({ length: options.frameCount }, (_, index) => Math.sin(frameAt(index, options).time * 5));
  const peaks = swing.filter((value, index) => value > swing[(index + swing.length - 1) % swing.length] &&
    value > swing[(index + 1) % swing.length]).length;
  const troughs = swing.filter((value, index) => value < swing[(index + swing.length - 1) % swing.length] &&
    value < swing[(index + 1) % swing.length]).length;
  assert.equal(peaks, 6);
  assert.equal(troughs, 6);
});

test('limb pose and velocity remain continuous across the loop for a custom phase', () => {
  const options = getOptions(['--skin', 'skin.png', '--walk-cycles', '9', '--walk-phase', '37']);
  const epsilon = 1e-7;
  const swing = progress => Math.sin(loopSample(progress, options).time * 5) * .8;
  for (const progress of [0, .25, .99, 1, 1.01, 2]) {
    const expected = Math.sin((37 / 360 + 9 * progress) * 2 * Math.PI) * .8;
    assert.ok(Math.abs(swing(progress) - expected) < 1e-12);
  }
  const leftVelocity = (swing(1) - swing(1 - epsilon)) / epsilon;
  const rightVelocity = (swing(1 + epsilon) - swing(1)) / epsilon;
  assert.ok(Math.abs(leftVelocity - rightVelocity) < .001);
  assert.equal(loopSample(2, options).time, loopSample(0, options).time);
  assert.equal(getOptions(['--skin', 'skin.png', '--walk-phase', '-90']).walkPhase, 270);
  assert.equal(getOptions(['--skin', 'skin.png', '--walk-phase', '450']).walkPhase, 90);
});

test('bad options fail before rendering', () => {
  for (const args of [
    [], ['--skin', 'a.png', '--skin-dir', '.'], ['--skin', 'a.png', '--fps', 'NaN'],
    ['--skin', 'a.png', '--width', '101'], ['--skin', 'a.png', '--fps', '1.5'],
    ['--skin', 'a.png', '--mode', 'invalid'], ['--skin', 'a.png', '--wat'],
    ['--skin', 'a.png', '--format', 'mp4', '--background', 'transparent'],
    ['--skin', 'a.png', '--format', 'webm', '--out', 'a.mp4'],
    ['--skin', 'a.png', '--fps', '1', '--duration', '.1'],
    ['--skin', 'a.png', '--walk-cycles', '0'], ['--skin', 'a.png', '--walk-cycles', '1.5'],
    ['--skin', 'a.png', '--walk-phase', 'NaN'],
  ]) assert.throws(() => getOptions(args));
  assert.equal(getOptions(['--help']).help, true);
  assert.equal(getOptions(['--skin', 'a.png']).scale, 0.82);
  assert.equal(getOptions(['--skin', 'a.png']).camY, 18);
  assert.equal(getOptions(['--skin', 'a.png']).targetY, -0.75);
  assert.equal(getOptions(['--skin', 'a.png', '--out', 'a.webm', '--background', 'transparent']).format, 'webm');
});

test('batch resolves invocation paths, sorts PNGs, and protects existing outputs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-options-'));
  try {
    // Input fixture from this repository is a real 64x64 RGBA Minecraft skin.
    const skin = new URL('../../assets/parser_pred_uv_simple_inpainting.png', import.meta.url);
    fs.mkdirSync(path.join(directory, 'skins'));
    fs.copyFileSync(skin, path.join(directory, 'skins', 'b.png'));
    fs.copyFileSync(skin, path.join(directory, 'skins', 'a.PNG'));
    fs.writeFileSync(path.join(directory, 'skins', 'notes.txt'), 'ignored');
    const options = getOptions(['--skin-dir', 'skins', '--out-dir', 'clips']);
    const jobs = getJobs(options, directory, 'unused');
    assert.deepEqual(jobs.map(job => path.basename(job.skin)), ['a.PNG', 'b.png']);
    assert.equal(jobs[0].output, path.join(directory, 'clips', 'a__walk360.webm'));
    fs.mkdirSync(path.join(directory, 'clips'));
    fs.writeFileSync(jobs[0].output, 'existing video');
    assert.throws(() => getJobs(options, directory, 'unused'), /already exists/);
    assert.equal(getJobs({ ...options, overwrite: true }, directory, 'unused').length, 2);
    fs.writeFileSync(path.join(directory, 'invalid.png'), 'not a png');
    assert.throws(() => readSkin(path.join(directory, 'invalid.png')), /Not a PNG/);
    const wrongSize = Buffer.from(jobs[0].bytes);
    wrongSize.writeUInt32BE(128, 16);
    fs.writeFileSync(path.join(directory, 'wrong.png'), wrongSize);
    assert.throws(() => readSkin(path.join(directory, 'wrong.png')), /64x64/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
