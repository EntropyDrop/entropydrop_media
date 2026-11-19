import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from '/Users/ha/.npm/_npx/c691da254a52985f/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const ROOT = '/Volumes/zxf/entropydrop_media/space_architecture/02_modeling';
const SCRATCH = '/tmp/space_rec';
fs.mkdirSync(SCRATCH, { recursive: true });
const mode = process.argv[2] || 'probe';

async function launchSpace(world = 'aether-archipelago', devLod = '1') {
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
    if (i % 4 === 0) console.log(`[${world}] t=${i + 1}s`, JSON.stringify(info));
    if (info.hasGame && info.gateHidden && info.aoi?.ready && info.surface?.complete) {
      break;
    }
  }
  return { browser, page };
}

async function setupCinema(page) {
  return page.evaluate(async () => {
    const g = window.game;
    const Vec3 = g.playerPhysics.position.constructor;
    const { encodeInventoryResource } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/engine/src/storage/InventoryProtobuf.ts');
    const { parseInventoryImport } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/src/engine/inventory/InventoryImport.ts');
    const { createChinook } = await import('/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/client/tools/nature-chinook/model.ts');

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

    // Hide player avatar and first-person held tool cleanly
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

    // Hide HUD / debug overlays, keep canvas and all its ancestors untouched
    const style = document.createElement('style');
    style.id = 'rec-hide-ui';
    style.textContent = `
      html, body { cursor: none !important; overflow: hidden !important; }
      .entity-nameplate,
      #dev-render-diagnostics,
      #dev-frame-profiler { display: none !important; opacity: 0 !important; pointer-events: none !important; }
    `;
    document.head.appendChild(style);
    // Walk ancestors of canvas cleanly to hide non-ancestor sibling overlays (HUD bars, crosshair, buttons)
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

    const spawnPos = g.playerPhysics.position.toArray();
    const spawnYaw = g.controller.yaw;

    // Build custom high-detail Chinook with glowing accents & translucent cockpit
    const buildSpaceFlyer = () => {
      const m = createChinook();
      const r = m.root;
      r.name = 'Space Transport';
      r.body = { type: 'kinematic', mass: 8000, useGravity: false, collisionEnabled: false };
      r.blocks = r.blocks.map(b => ({
        ...b,
        materialId: [0x234b58, 0x91b4bc].includes(b.color) ? 87 : b.materialId,
      }));
      r.decorations = r.decorations || [];
      const normQ = (q) => {
        const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
        return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
      };
      // Glowing nav/thruster strips + sleek angled intake spoilers (rotatable decoration voxels)
      for (const side of [-1, 1]) {
        r.decorations.push({ id: `winglet_${side}`, position: [side * 1.9, 0.35, 3.8], scale: [1.6, 0.14, 0.85], rotation: normQ([0.12, 0, side * 0.25, 0.96]), color: 0x3b4852, materialId: 0 });
        r.decorations.push({ id: `nav_${side}`, position: [side * 2.4, 0.45, 3.8], scale: [0.18, 0.12, 0.45], color: side < 0 ? 0xff4b4b : 0x3bf0c5, materialId: 1 });
        r.decorations.push({ id: `nose_light_${side}`, position: [side * 0.75, -0.55, -7.8], scale: [0.28, 0.14, 0.14], color: 0xe6f8ff, materialId: 1 });
      }
      for (const c of r.children) {
        c.script = `self.setLocalSpin([0, 1, 0], ${c.id === 'aft_rotor' ? -80 : 80});`;
      }
      // Subtle forward hover cruise along heading in autonomous mode
      r.script = `
        const t: f64 = self.state.getNumber("t") + ctx.deltaTime;
        self.state.setNumber("t", t);
        const speed: f64 = 5.5;
        const yaw: f64 = self.state.getNumber("yaw0", ctx.rotation[1]);
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
        const y: f64 = y0 + Math.sin(t * 1.3) * 0.45;
        const roll: f64 = Math.sin(t * 0.9) * 0.045;
        const pitch: f64 = -0.045 + Math.cos(t * 0.7) * 0.015;
        self.setLocalPosition([x0 - Math.sin(yaw) * speed * t, y, z0 - Math.cos(yaw) * speed * t]);
        self.setLocalEuler([pitch, yaw, roll]);
      `;
      return m;
    };

    // Exact camera pose hook: runs INSIDE g.controller.updateCameraPosition() right AFTER
    // contraptionManager.beginRenderInterpolation(alpha), so camera and aircraft track the
    // exact same 30 Hz smooth interpolated pose (never the 20 Hz stepped physics boundary).
    g.controller.setFov(50);
    let fixedCam = null;
    window.__spaceCamHook = null;
    const origUpdateCam = g.controller.updateCameraPosition.bind(g.controller);
    g.controller.updateCameraPosition = () => {
      if (window.__spaceCamHook) {
        window.__spaceCamHook();
      }
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

    const spawnFlyer = async (pos, yaw = 0.6) => {
      const model = buildSpaceFlyer();
      const parsed = parseInventoryImport(encodeInventoryResource('entity', model), 'entity');
      if (!parsed.ok) throw new Error(parsed.error);
      const ent = g.contraptionManager.buildFromSlot(parsed.item, new Vec3(...pos), null, false);
      ent.quaternion.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
      ent.syncBodyFromTransform?.();
      await ent.scriptRuntimeClient.ready();
      ent.enableAllNodeScripts();
      window.__spaceEnt = ent;
      return ent.position.toArray();
    };

    const waitSurfaceClear = (x, z) => {
      let topY = 0;
      for (let y = 180; y >= -30; y--) {
        if (g.world.getBlock(Math.floor(x), y, Math.floor(z))) {
          topY = y + 1;
          break;
        }
      }
      return topY;
    };

    // Sample heights around spawn to find dramatic cliff/island vista
    const heights = [];
    for (let dx = -48; dx <= 48; dx += 16) {
      for (let dz = -48; dz <= 48; dz += 16) {
        const x = Math.round(spawnPos[0] + dx);
        const z = Math.round(spawnPos[2] + dz);
        heights.push([x, waitSurfaceClear(x, z), z]);
      }
    }

    window.__spaceRec = { g, pose, spawnFlyer, canvasWidth: canvas.width, canvasHeight: canvas.height };
    return {
      spawnPos,
      spawnYaw,
      canvas: [canvas.width, canvas.height],
      heights: heights.filter(h => h[1] > 0).slice(0, 12),
    };
  });
}

async function installFixedTimeCapture(page) {
  await page.evaluate(() => {
    const rec = window.__spaceRec;
    const g = rec.g;
    const origGetDelta = g.clock.getDelta.bind(g.clock);
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
    rec.origGetDelta = origGetDelta;
  });
}

async function recordClip({ world, flyerPos, flyerYaw, durationSec, outMp4, camFnName, noFlyer = false }) {
  const { browser, page } = await launchSpace(world, '1');
  try {
    const meta = await setupCinema(page);
    console.log('Setup meta:', JSON.stringify(meta));
    // Pick clear altitude just above surrounding islands/buildings (ignoring high initial free-fall spawn Y)
    const maxTerrainY = Math.max(40, ...(meta.heights.map(h => h[1])));
    const startPos = flyerPos || [meta.spawnPos[0] - 20, maxTerrainY + 12, meta.spawnPos[2] - 20];
    if (noFlyer) {
      await page.evaluate((p) => { window.__spaceEnt = { rootGroup: { position: { toArray: () => p } }, position: { toArray: () => p } }; }, startPos);
    } else {
      await page.evaluate(async (p, y) => {
        await window.__spaceRec.spawnFlyer(p, y);
      }, startPos, flyerYaw ?? 0.55);
    }

    // Wait a moment for chunks/shadows/rotors to settle
    await new Promise(r => setTimeout(r, 1500));

    if (mode.startsWith('probe')) {
      await page.evaluate((modeName) => {
        const ent = window.__spaceEnt;
        const p = ent.position.toArray();
        if (modeName === 'terrain') {
          window.__spaceRec.pose([p[0] + 16 * Math.sin(0.9 + Math.PI), p[1] - 6, p[2] + 16 * Math.cos(0.9 + Math.PI)], [p[0], p[1] - 14, p[2]]);
        } else if (modeName === 'overview') {
          window.__spaceRec.pose([p[0] + 110 * Math.sin(0.4), p[1] + 95, p[2] + 110 * Math.cos(0.4)], [p[0], p[1] - 60, p[2]]);
        } else if (modeName === 'chase') {
          window.__spaceRec.pose([p[0] - 14, p[1] + 5.5, p[2] - 15], [p[0], p[1] + 0.5, p[2]]);
        } else {
          window.__spaceRec.pose([p[0] + 16, p[1] + 7, p[2] - 16], [p[0], p[1], p[2]]);
        }
      }, camFnName);
      await new Promise(r => setTimeout(r, 600));
      const shotPath = path.join(SCRATCH, `probe_${world}.png`);
      await page.screenshot({ path: shotPath });
      console.log('Saved probe screenshot:', shotPath);
      return;
    }

    // Record exact fixed-time frames via CDP Page.captureScreenshot piped to ffmpeg
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
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (let f = 0; f < totalFrames; f++) {
      await page.evaluate(async (frameIdx, total, camMode) => {
        const dt = 1 / 30;
        await window.__spaceRec.stepAndRender(dt, () => {
          const ent = window.__spaceEnt;
          // Read rootGroup.position AFTER beginRenderInterpolation(alpha) for zero-jitter lock
          const p = ent.rootGroup.position.toArray();
          const t = frameIdx / 30;
          if (camMode === 'terrain') {
            // Crane from near the ground up and back: terrain grid close-up -> wide continuous streaming
            const u = Math.min(1, t / 14);
            const e = u * u * (3 - 2 * u);
            const ang = 0.9 + Math.PI + t * 0.035;
            const dist = 16 + e * 120;
            window.__spaceRec.pose(
              [p[0] + Math.sin(ang) * dist, p[1] - 6 + e * 70, p[2] + Math.cos(ang) * dist],
              [p[0], p[1] - 14 - e * 20, p[2]]
            );
          } else if (camMode === 'overview') {
            // Slow high crane-up orbit over the world: terrain as a field of chunks
            const ang = 0.4 + (t / 16) * 0.6;
            const dist = 110 + t * 2.5;
            window.__spaceRec.pose(
              [p[0] + Math.sin(ang) * dist, p[1] + 95 + t * 2.0, p[2] + Math.cos(ang) * dist],
              [p[0], p[1] - 60, p[2]]
            );
          } else if (camMode === 'aether_cruise') {
            // Sweeping 3/4 front-side hero chase: places Chinook cleanly on right-center while castle & islands fill left/center
            const ang = -2.35 + (t / 18) * 0.75;
            const dist = 25.5 - Math.sin((t / 18) * Math.PI) * 3.0;
            window.__spaceRec.pose(
              [p[0] + Math.sin(ang) * dist, p[1] + 6.8 + Math.sin(t * 0.4) * 1.1, p[2] + Math.cos(ang) * dist],
              [p[0] - 2.8, p[1] + 0.4, p[2] - 1.5]
            );
          } else {
            // Hero orbital glide over Copper Metropolis skyline with Chinook centered nicely between banner & bottom cards
            const ang = -2.1 + (t / 16) * 0.95;
            const dist = 24.5;
            window.__spaceRec.pose(
              [p[0] + Math.sin(ang) * dist, p[1] + 6.5, p[2] + Math.cos(ang) * dist],
              [p[0], p[1] - 0.4, p[2]]
            );
          }
        });
      }, f, totalFrames, camFnName);

      const { data } = await client.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 95,
        clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 },
      });
      const buf = Buffer.from(data, 'base64');
      if (!ff.stdin.write(buf)) {
        await new Promise(res => ff.stdin.once('drain', res));
      }
      if ((f + 1) % 60 === 0 || f === totalFrames - 1) {
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

if (mode === 'probe-terrain' || mode === 'record-terrain') {
  await recordClip({
    world: process.argv[3] || 'aether-archipelago',
    durationSec: 16,
    outMp4: path.join(ROOT, 'footage/02_terrain_crane.mp4'),
    camFnName: 'terrain',
    noFlyer: true,
  });
}
