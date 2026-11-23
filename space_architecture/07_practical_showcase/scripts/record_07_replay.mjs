import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { launchSpace, setupBaseScene, installFixedTimeCapture } from './harness.mjs';
import { buildPhysicsBlueprints, buildPropellerBlades } from '../../04_physics_entity/scripts/nature_physics_models.mjs';
import { buildFlightAircraft } from './aircraft_07.mjs';

const root = process.env.SPACE_C07_OUTPUT || fileURLToPath(new URL('../', import.meta.url));
const benchmark = JSON.parse(await fs.readFile(path.join(root, 'footage', '07_rapier_replay.json'), 'utf8'));
const requested = process.argv[2] || 'fleet';
const probe = process.argv.includes('--probe');
const fps = 30, width = 1920, height = 1080;
assert.ok(['fleet', 'contact'].includes(requested));
const contact = benchmark.eventTimes
  .sort((a, b) => Math.abs(a.pair - 18) - Math.abs(b.pair - 18) || a.tick - b.tick)[0];
assert.ok(contact, 'Cannot label a collision replay without a recorded engine contact');
const seconds = Number(process.env.SPACE_C07_SHOT_SECONDS || (requested === 'fleet' ? 11 : 17));
assert.ok(seconds >= 8 && seconds <= 17);
const begin = requested === 'fleet' ? 0 : Math.max(0, contact.tick / 20 - 3);
const speed = requested === 'fleet' ? 1 : 0.62;

async function installReplay({ modelBuilder, baseAircraft, blades, trace, players, view, pair }) {
  const torus = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/engine/src/torus/TorusWorld.ts');
  const rec = window.__rec;
  const { g } = rec;
  return rec.spawnModel(modelBuilder(rec.qEuler, baseAircraft, blades), [5412, 132, 844]).then(source => {
    source.setPhysicsSimulationEnabled(false);
    source.rootGroup.removeFromParent();
    // The benchmark takes place in open air. Hide the finite near-terrain
    // window so the edges of its streamed chunk patch never enter the shot.
    g.world.worldGroup.visible = false;
    const propellerName = 'chapter-07-propeller';
    source.getEntityNode('hub').group.name = propellerName;
    const fleet = Array.from({ length: players }, () => {
      const craft = source.rootGroup.clone(true);
      g.sceneRenderer.scene.add(craft);
      return craft;
    });
    const propellers = fleet.map(craft => craft.getObjectByName(propellerName));
    if (!propellers.every(Boolean)) throw new Error('A replay aircraft has no propeller');
    const spinAxis = new rec.Vec3(1, 0, 0);
    const heading = new rec.Vec3();
    let cameraAzimuth;
    const rotation = source.quaternion.clone();
    const { lighting, bloom } = {
      lighting: g.sceneRenderer.getLightingQuality(),
      bloom: g.sceneRenderer.getEmissiveBloomQuality(),
    };
    if (lighting !== 'ultra' || bloom !== 'medium') throw new Error('Wrong replay renderer settings');
    g.controller.getCursorHighlight = () => null;
    const draw = g.sceneRenderer.render.bind(g.sceneRenderer);
    g.sceneRenderer.render = (...args) => {
      if (g.sceneRenderer.playerFirstPersonHand) g.sceneRenderer.playerFirstPersonHand.visible = false;
      return draw(...args);
    };
    window.drawReplayFrame = async (seconds, clipTime) => {
      const point = Math.max(0,Math.min(trace.length - 1,seconds * 20 - 1));
      const i = Math.floor(point), fraction = point - i;
      const a = trace[i], b = trace[Math.min(i + 1, trace.length - 1)];
      const first = a.poses, second = b.poses;
      await rec.stepAndRender(0, () => {
        for (let p = 0; p < players; p++) {
          const offset = p * 10;
          fleet[p].position.fromArray(first, offset).lerp(rotationPosition(second, offset), fraction);
          rotation.fromArray(second, offset + 3);
          fleet[p].quaternion.fromArray(first, offset + 3).slerp(rotation, fraction);
          const phaseIndex = p * 14 + 13;
          const phase = a.propellers[phaseIndex] + fraction * (b.propellers[phaseIndex] - a.propellers[phaseIndex]);
          propellers[p].quaternion.setFromAxisAngle(spinAxis, phase);
        }
        if (view === 'fleet') {
          const camera = [5350 + clipTime * 10, 420, 1605];
          const subject = [5412 + clipTime * 4, 142, 978];
          const logicalCamera = new rec.Vec3(...camera);
          torus.setTorusViewCorrection(logicalCamera);
          const direction = torus.bendPointForView(...subject).sub(torus.bendPoint(...camera));
          torus.bendFrameQuaternion(...camera, rotation).invert();
          rec.cam(camera, direction.applyQuaternion(rotation).add(logicalCamera).toArray());
        } else {
          const firstPlane = fleet[pair * 2].position;
          const secondPlane = fleet[pair * 2 + 1].position;
          const center = firstPlane.clone().lerp(secondPlane, 0.5);
          if (cameraAzimuth === undefined) {
            heading.copy(spinAxis).applyQuaternion(fleet[pair * 2].quaternion);
            cameraAzimuth = Math.atan2(heading.z, heading.x) + 0.65;
          }
          const angle = cameraAzimuth + clipTime * 0.13;
          const distance = 39;
          rec.cam([center.x + Math.cos(angle) * distance,
            center.y + 14, center.z + Math.sin(angle) * distance],
            [center.x, center.y + 0.75, center.z]);
        }
      });
    };
    const translation = source.position.clone();
    const rotationPosition = (values, offset) => translation.fromArray(values, offset);
    return fleet.length;
  });
}

const { browser, page } = await launchSpace('nature', '1');
try {
  await setupBaseScene(page);
  await page.evaluate(() => {
    const { g } = window.__rec;
    g.uiStore.setLightingQuality('ultra', false);
    g.uiStore.setEmissiveBloomQuality('medium');
  });
  // Use the same chapter 04 blueprint to replay the measured per-pilot poses.
  await page.evaluate(`
    window.__buildChapter04Aircraft = ${buildPhysicsBlueprints.toString()};
    window.__buildChapter04Blades = ${buildPropellerBlades.toString()};
    window.__buildChapter07Aircraft = ${buildFlightAircraft.toString()};
  `);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await installFixedTimeCapture(page);
  const count = await page.evaluate(`(${installReplay.toString()})({
    modelBuilder: window.__buildChapter07Aircraft,
    baseAircraft: window.__buildChapter04Aircraft,
    blades: window.__buildChapter04Blades,
    trace: ${JSON.stringify(benchmark.trace.slice(0,Math.ceil((begin+seconds*speed+1)*20)))},
    players: ${benchmark.summary.players}, view: ${JSON.stringify(requested)}, pair: ${contact.pair}
  })`);
  assert.equal(count, benchmark.summary.players);
  for (let i = 0; i < 15; i++) await page.evaluate(t => window.drawReplayFrame(t, 0), begin);
  const footage = path.join(root, 'footage');
  await fs.mkdir(footage, { recursive: true });
  const filename = path.join(footage, `07_${requested}.mp4`);
  const pending = filename + '.part.mp4';
  const encoder = probe ? null : spawn('ffmpeg', [
    '-y','-hide_banner','-v','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','pipe:0',
    '-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709','-c:v','libx264','-preset','fast','-crf','17',
    '-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',pending,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = encoder && once(encoder, 'close');
  const frames = probe ? [0, 120, 210] : Array.from({ length: seconds * fps }, (_, i) => i);
  for (const f of frames) {
    await page.evaluate((t, elapsed) => window.drawReplayFrame(t, elapsed), begin + (f / fps) * speed, f / fps);
    const { data } = await cdp.send('Page.captureScreenshot', { format:'jpeg', quality:95, fromSurface:true,
      clip:{x:0,y:0,width,height,scale:1} });
    const image = Buffer.from(data, 'base64');
    if (probe || f === 120) await fs.writeFile(path.join(footage, `07_${requested}_${f}.jpg`), image);
    if (encoder) await new Promise((resolve, reject) =>
      encoder.stdin.write(image, error => error ? reject(error) : resolve()));
    if ((f + 1) % 120 === 0) console.log(requested, f + 1, '/', seconds * fps);
  }
  if (encoder) {
    encoder.stdin.end();
    assert.equal((await finished)[0], 0);
    await fs.rename(pending,filename);
  }
  console.log(requested, 'benchmark contact', contact, 'first trace second',begin);
} finally {
  await browser.close();
}
