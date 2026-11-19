import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from '/Users/ha/.npm/_npx/c691da254a52985f/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const ROOT = '/Volumes/zxf/entropydrop_media/space_architecture/07_practical_showcase';
const SCRATCH = '/tmp/c07';
fs.mkdirSync(SCRATCH, { recursive: true });
const mode = process.argv[2] || 'probe';

export async function launchSpace(world = 'nature', devLod = '1') {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--window-size=1920,1080'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', err => console.log('PAGEERR:', err.message));
  await page.goto(`http://localhost:5173/space/app/?dev_offline=1&world=${world}&dev_lod=${devLod}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.evaluate(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/src/entry.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/src/entry.ts';
    document.body.appendChild(s);
  });

  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const info = await page.evaluate(() => {
      const g = window.game;
      return {
        hasGame: !!g,
        aoi: g?.world?.getTerrainAoiLoadProgress?.(),
        surface: window.offlineSurfaceStatus,
        gateHidden: document.getElementById('space-entry-gate')?.hidden,
      };
    });
    if (i % 5 === 0) console.log(`[${world}] t=${i + 1}s`, JSON.stringify(info));
    if (info.hasGame && info.gateHidden && info.aoi?.ready && info.surface?.complete) {
      break;
    }
  }
  return { browser, page };
}

export async function setupBaseScene(page) {
  return page.evaluate(async () => {
    const g = window.game;
    const Vec3 = g.playerPhysics.position.constructor;
    const { encodeInventoryResource } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/engine/src/storage/InventoryProtobuf.ts');
    const { parseInventoryImport } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/src/engine/inventory/InventoryImport.ts');
    const { createChinook } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/tools/nature-chinook/model.ts');
    const { createTank, createCourse } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/tools/nature-tank/model.ts');
    const { createNatureOrb } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/tools/nature-orb/model.ts');

    g.uiStore.startGame(false);
    g.uiStore.setLightingQuality('ultra', false);
    g.uiStore.setShadowsEnabled(true, false);
    g.uiStore.setResolutionScale(1, false);
    g.uiStore.setRenderDistance(16, false);
    g.uiStore.setDistantSurfaceEnabled(true, false);
    for (const [k, v] of Object.entries({
      subdivisionSizePx2: 1,
      renderDistanceChunks: 2048,
      dataBudgetMiB: 1024,
      geometryBudgetMiB: 512,
      torusBackfaceCulling: false,
    })) {
      g.uiStore.setDistantSurfaceSetting(k, v, false);
    }

    g.controller.setPerspective('first_person', false);
    const render = g.sceneRenderer;
    const origAvatarVis = render.setPlayerAvatarVisible.bind(render);
    origAvatarVis(false, false);
    render.setPlayerAvatarVisible = () => origAvatarVis(false, false);
    render.renderer.toneMappingExposure = 1.15;
    if (render.sunLight?.shadow) {
      const sh = render.sunLight.shadow;
      sh.camera.left = sh.camera.bottom = -120;
      sh.camera.right = sh.camera.top = 120;
      sh.camera.updateProjectionMatrix();
      sh.needsUpdate = true;
    }

    const style = document.createElement('style');
    style.textContent = `
      html, body { cursor: none !important; overflow: hidden !important; }
      .entity-nameplate, #dev-render-diagnostics, #dev-frame-profiler {
        display: none !important; opacity: 0 !important; pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    const canvas = g.sceneRenderer.renderer.domElement;
    let cur = canvas;
    while (cur && cur !== document.body) {
      if (cur.parentElement) {
        for (const sib of cur.parentElement.children) {
          if (sib !== cur && sib.tagName !== 'STYLE' && sib.tagName !== 'SCRIPT') {
            sib.style.display = 'none';
          }
        }
      }
      cur = cur.parentElement;
    }

    g.controller.setFov(50);
    let fixedCam = null;
    window.__spaceCamHook = null;
    const origUpdateCam = g.controller.updateCameraPosition.bind(g.controller);
    g.controller.updateCameraPosition = () => {
      if (window.__spaceCamHook) window.__spaceCamHook();
      if (fixedCam) {
        g.controller.camera.position.set(...fixedCam.pos);
        g.controller.camera.up.set(0, 1, 0);
        g.controller.camera.lookAt(...fixedCam.target);
        g.controller.camera.updateMatrixWorld();
      } else {
        origUpdateCam();
      }
    };
    const pose = (pos, target) => {
      fixedCam = { pos, target };
      g.playerPhysics.isFlying = true;
      g.playerPhysics.position.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.previousPosition.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.renderSimulationPosition.set(pos[0], pos[1], pos[2]);
      g.playerPhysics.velocity.set(0, 0, 0);
    };

    const cam = (pos, target) => { fixedCam = { pos, target }; };

    const spawnModel = async (model, pos, yaw = 0) => {
      const parsed = parseInventoryImport(encodeInventoryResource('entity', model), 'entity');
      if (!parsed.ok) throw new Error(parsed.error);
      const ent = g.contraptionManager.buildFromSlot(parsed.item, new Vec3(...pos), null, false);
      ent.quaternion.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
      ent.syncBodyFromTransform?.();
      await ent.scriptRuntimeClient.ready();
      ent.enableAllNodeScripts();
      return ent;
    };

    const groundY = (x, z) => {
      for (let y = 320; y >= -40; y--) {
        if (g.world.getBlock(Math.floor(x), y, Math.floor(z))) return y + 1;
      }
      return 20;
    };

    const setBlockSafe = (x, y, z, color, materialId = 0) => {
      g.world.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), 1, true, color, materialId);
    };

    const qEuler = (rx, ry, rz) => {
      const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
      const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
      const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
      return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
      ];
    };

    const spawnChinookAt = async (pos, yaw = 0.55, speed = 5.5) => {
      const m = createChinook();
      const r = m.root;
      r.name = 'Space Flyer';
      r.body = { type: 'kinematic', mass: 8000, useGravity: false, collisionEnabled: false };
      r.blocks = r.blocks.map(b => ({
        ...b,
        materialId: [0x234b58, 0x91b4bc].includes(b.color) ? 61 : b.materialId,
      }));
      r.decorations = r.decorations || [];
      for (const side of [-1, 1]) {
        r.decorations.push({
          id: `wing_${side}`,
          position: [side * 2.1, 0.3, 3.6],
          scale: [2.4, 0.14, 1.05],
          rotation: qEuler(0.14, side * 0.16, side * 0.24),
          color: 0x3b4852,
          materialId: 0,
        });
        r.decorations.push({
          id: `thruster_${side}`,
          position: [side * 1.15, -0.35, 7.6],
          scale: [0.65, 0.55, 0.22],
          color: 0x38bdf8,
          materialId: 1,
        });
      }
      for (const c of r.children) {
        c.script = `self.setLocalSpin([0, 1, 0], ${c.id === 'aft_rotor' ? -80 : 80});`;
      }
      r.script = `
        const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
        self.state.setNumber("t", t);
        if (!self.state.getBoolean("init")) {
          self.state.setBoolean("init", true);
          self.state.setNumber("x0", ctx.position[0]);
          self.state.setNumber("y0", ctx.position[1]);
          self.state.setNumber("z0", ctx.position[2]);
          self.state.setNumber("yaw0", ctx.rotation[1]);
        }
        const x0: f64 = self.state.getNumber("x0");
        const y0: f64 = self.state.getNumber("y0");
        const z0: f64 = self.state.getNumber("z0");
        const yaw: f64 = self.state.getNumber("yaw0");
        const lift: f64 = ${speed} * t;
        self.setLocalPosition([x0 - Math.sin(yaw) * lift, y0 + Math.sin(t * 1.2) * 0.4, z0 - Math.cos(yaw) * lift]);
        self.setLocalEuler([-0.04, yaw, Math.sin(t * 0.8) * 0.04]);
      `;
      return spawnModel(m, pos, yaw);
    };

    window.__rec = {
      g, Vec3, pose, cam, spawnModel, groundY, setBlockSafe, qEuler, spawnChinookAt,
      createChinook, createTank, createCourse, createNatureOrb,
    };
    return g.playerPhysics.position.toArray();
  });
}

export async function installFixedTimeCapture(page) {
  await page.evaluate(() => {
    const rec = window.__rec;
    const g = rec.g;
    const savedAnimate = g.animate;
    let frozen = false;
    let frameDelta = 0;
    g.animate = () => { frozen = true; };
    g.clock.getDelta = () => { g.clock.elapsedTime += frameDelta; return frameDelta; };

    rec.stepAndRender = async (dt, cameraCb) => {
      while (!frozen) await new Promise(r => requestAnimationFrame(r));
      frozen = false;
      window.__spaceCamHook = cameraCb || null;
      frameDelta = dt;
      savedAnimate();
      window.__spaceCamHook = null;
      await g.sceneRenderer.renderer.backend.device.queue.onSubmittedWorkDone();
      await new Promise(r => requestAnimationFrame(r));
    };
  });
}

export async function recordWithSetup({ world, outMp4, durationSec, setupFn, frameCb }) {
  const { browser, page } = await launchSpace(world, '1');
  try {
    const spawnPos = await setupBaseScene(page);
    await page.evaluate(setupFn, spawnPos);
    await new Promise(r => setTimeout(r, 1500));

    await installFixedTimeCapture(page);
    const totalFrames = Math.round(durationSec * 30);
    fs.mkdirSync(path.dirname(outMp4), { recursive: true });
    const tmpMp4 = outMp4 + '.pending.mp4';
    const ff = spawn('ffmpeg', [
      '-y', '-v', 'warning',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', '30', '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-r', '30', '-g', '15', '-keyint_min', '15',
      '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart',
      tmpMp4,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });

    const client = await page.createCDPSession();
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
    });

    for (let f = 0; f < totalFrames; f++) {
      await page.evaluate(async (frameIdx, total, cbSrc) => {
        const dt = 1 / 30;
        const cb = eval(`(${cbSrc})`);
        await window.__rec.stepAndRender(dt, () => cb(frameIdx, total));
      }, f, totalFrames, frameCb.toString());

      const { data } = await client.send('Page.captureScreenshot', {
        format: 'jpeg', quality: 95,
        clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 },
      });
      const buf = Buffer.from(data, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res));
      if ((f + 1) % 90 === 0 || f === totalFrames - 1) {
        console.log(`[${path.basename(outMp4)}] frame ${f + 1}/${totalFrames}`);
      }
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
    fs.renameSync(tmpMp4, outMp4);
    console.log('Recorded clean clip:', outMp4);
  } finally {
    await browser.close();
  }
}

