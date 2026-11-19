// Persistent Space browser for iterating on 04 footage.
//   node scripts/harness.mjs launch [world]   -> keeps Chrome alive, writes ws endpoint
//   node scripts/harness.mjs eval file.js [shot.png]  -> runs file body (async fn) in page
import fs from 'node:fs';
import puppeteer from '/Users/ha/.npm/_npx/c691da254a52985f/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const WS_FILE = '/tmp/p04/ws.txt';
const SPACE = '/Users/ha/Documents/entropydrop_website/entropydrop_space';
const [cmd, arg1, arg2] = process.argv.slice(2);

export async function launchSpace(world = 'nature') {
  fs.mkdirSync('/tmp/p04/chrome', { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    userDataDir: '/tmp/p04/chrome',
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--window-size=1920,1080', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', err => console.log('PAGEERR:', err.message));
  await page.goto(`http://localhost:5173/space/app/?dev_offline=1&world=${world}&dev_lod=1`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.evaluate((SPACE) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/@fs${SPACE}/client/src/entry.css`;
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.type = 'module';
    s.src = `/@fs${SPACE}/client/src/entry.ts`;
    document.body.appendChild(s);
  }, SPACE);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const info = await page.evaluate(() => {
      const g = window.game;
      return {
        hasGame: !!g,
        aoi: g?.world?.getTerrainAoiLoadProgress?.()?.ready,
        surface: window.offlineSurfaceStatus?.complete,
        gate: document.getElementById('space-entry-gate')?.hidden,
      };
    });
    if (i % 5 === 0) console.log(`t=${i}s`, JSON.stringify(info));
    if (info.hasGame && info.gate && info.aoi && info.surface) break;
  }
  return { browser, page };
}

export async function connect() {
  const browser = await puppeteer.connect({ browserWSEndpoint: fs.readFileSync(WS_FILE, 'utf8').trim(), defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('/space/app')) || pages[0];
  return { browser, page };
}

if (cmd === 'launch') {
  const { browser } = await launchSpace(arg1 || 'nature');
  fs.writeFileSync(WS_FILE, browser.wsEndpoint());
  console.log('READY', browser.wsEndpoint());
  await new Promise(() => {});
} else if (cmd === 'eval') {
  const { browser, page } = await connect();
  page.on('console', m => { if (m.type() === 'log') console.log('PAGE:', m.text()); });
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const body = fs.readFileSync(arg1, 'utf8');
  try {
    const res = await page.evaluate(`(async () => { ${body}\n })()`);
    console.log(JSON.stringify(res, null, 1)?.slice(0, 4000));
  } catch (e) {
    console.log('EVAL ERROR:', e.message.slice(0, 2000));
  }
  if (arg2) {
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: arg2 });
    console.log('shot', arg2);
  }
  browser.disconnect();
}
