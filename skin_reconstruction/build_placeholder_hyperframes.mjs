#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.dirname(fileURLToPath(import.meta.url));
const mediaRoot = path.resolve(project, '..');
const scriptPath = path.join(mediaRoot, 'skin-reconstruction.en.youtube-script.md');
const metadataPath = path.join(mediaRoot, 'assets', 'skin_reconstruction', 'metadata.json');
const manifestPath = path.join(project, 'assets', 'placeholder-manifest.json');
const outputPath = path.join(project, 'index.html');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const seconds = stamp => {
  const [minutes, secs] = stamp.split(':').map(Number);
  return minutes * 60 + secs;
};
const fmt = value => Number(value).toFixed(3);
const script = fs.readFileSync(scriptPath, 'utf8');

// Parse continuous 12 chapters from script
const chapterPattern = /^### VO (\d+) \| ([^|]+) \| ([^|]+) \| (.+)\n([\s\S]*?)(?=^### VO |^## |(?![\s\S]))/gm;
const chapters = [];
for (const match of script.matchAll(chapterPattern)) {
  const range = match[2].trim().split('-');
  const text = match[5].match(/```text\n([\s\S]*?)\n```/)?.[1]?.trim();
  if (!text) throw new Error('Missing voiceover text for VO ' + match[1]);
  chapters.push({
    index: Number(match[1]), start: seconds(range[0]), end: seconds(range[1]),
    slug: match[3].trim(), title: match[4].trim(), text,
  });
}
if (chapters.length !== 11 || chapters[0].start !== 0 || chapters.at(-1).end !== 500) {
  throw new Error('Expected 11 continuous chapters ending at 8:20 (500s), got ' + chapters.length);
}
chapters.forEach((chapter, index) => {
  if (chapter.index !== index + 1 || chapter.start !== (chapters[index - 1]?.end ?? 0)) {
    throw new Error('Chapter timeline is not continuous at VO ' + chapter.index);
  }
});
const getChapter = (slug) => {
  const c = chapters.find(ch => ch.slug === slug);
  if (!c) throw new Error('Missing chapter with slug: ' + slug);
  return c;
};

// Load community showcase items from metadata.json
let communityItems = [];
if (fs.existsSync(metadataPath)) {
  try {
    communityItems = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse metadata.json:', err.message);
  }
}
if (!communityItems.length) {
  // Fallback: scan assets/skin_reconstruction for skin_*.png and *.jpg
  const dir = path.join(mediaRoot, 'assets', 'skin_reconstruction');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    const skins = files.filter(f => f.startsWith('skin_') && f.endsWith('.png')).sort();
    const jpgs = files.filter(f => f.endsWith('.jpg')).sort();
    communityItems = skins.map(skin => {
      const shortId = skin.replace('skin_', '').replace('.png', '');
      const matchJpg = jpgs.find(j => j.startsWith(shortId)) || `${shortId}.jpg`;
      return {
        shortId,
        fullId: matchJpg.replace('.jpg', ''),
        skinFile: skin,
        jpgFile: matchJpg,
        creator: { username: 'Community Creator' },
        modelVersion: 'SKING_DDJ',
      };
    });
  }
}

console.log(`Loaded ${communityItems.length} community showcase items.`);

// Placeholder manifest for website recording and other static assets
function initialManifest() {
  return {
    instructions: [
      'Fill src with a path relative to skin_reconstruction/index.html, then run npm run build.',
    ],
    assets: {
      'website.upload': { src: '', type: 'video', label: 'Website recording · Upload', suggested: 'assets/website/01_upload.mp4' },
      'website.generate': { src: '', type: 'video', label: 'Website recording · Generate', suggested: 'assets/website/02_generate.mp4' },
      'website.preview': { src: '', type: 'video', label: 'Website recording · Preview & Download', suggested: 'assets/website/03_preview_download.mp4' },
      'technical.pipeline': { src: '', type: 'image', label: 'Reference → Views → Skin → 3D', suggested: 'assets/technical/pipeline.png' },
      'technical.layers': { src: '', type: 'video', label: 'Base and outer layer turn', suggested: 'assets/technical/layers.mp4' },
      'ddj.videos_2025': { src: 'assets/ddj_2025_videos.png', type: 'image', label: 'DDJ 2025 Nanobanana video demonstration', suggested: 'assets/ddj_2025_videos.png' },
      'ddj.prompt_2025': { src: 'assets/ddj_2025_prompt.png', type: 'image', label: 'DDJ 2025 Prompt template and dual-layer layout', suggested: 'assets/ddj_2025_prompt.png' },
    },
  };
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
if (!fs.existsSync(manifestPath)) {
  fs.writeFileSync(manifestPath, JSON.stringify(initialManifest(), null, 2) + '\n');
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const assets = manifest.assets || {};

let assetSequence = 0;
function asset(key, timing, extraClass = '') {
  const item = assets[key] || {};
  const label = item.label || key;
  const identity = 'asset-' + String(++assetSequence).padStart(3, '0');
  if (item.src) {
    const common = 'id="' + identity + '" class="asset-media clip ' + esc(extraClass) +
      '" data-asset-key="' + esc(key) + '" data-start="' + fmt(timing.start) +
      '" data-duration="' + fmt(timing.duration) + '" data-track-index="' + (120 + assetSequence) + '"';
    if (item.type === 'image') {
      return '<img ' + common + ' src="' + esc(item.src) + '" alt="' + esc(label) + '">';
    }
    return '<video ' + common + ' src="' + esc(item.src) +
      '" data-media-start="0" data-volume="0" muted playsinline preload="auto" loop></video>';
  }
  return '<div class="asset-placeholder ' + esc(extraClass) + '" data-asset-key="' + esc(key) + '">' +
    '<div class="placeholder-grid"></div><span class="placeholder-chip">DEMO RECORDING</span>' +
    '<strong>' + esc(label) + '</strong><code>' + esc(key) + '</code>' +
    '<small>Target: ' + esc(item.suggested || 'add src in assets/placeholder-manifest.json') + '</small></div>';
}

function renderShowcaseCard(item, itemStart, slotDuration, trackIndex, idPrefix = 'case') {
  const refPath = `assets/skin_reconstruction/${item.jpgFile}`;
  const videoPath = `assets/skin_reconstruction/skin_${item.shortId}__walk360.webm`;
  const username = item.creator?.username || 'Community Creator';
  const localAvatarRel = `assets/skin_reconstruction/avatars/${item.shortId}.jpg`;
  const localAvatarPath = path.join(mediaRoot, localAvatarRel);
  const hasLocalAvatar = fs.existsSync(localAvatarPath);
  const shortId = item.shortId;

  const avatarHtml = hasLocalAvatar
    ? `<img src="${localAvatarRel}" alt="${esc(username)}" class="creator-avatar">`
    : `<div class="creator-avatar-placeholder">${esc(username.charAt(0).toUpperCase())}</div>`;

  return `<article id="${idPrefix}-${shortId}" class="showcase-card" data-card-start="${fmt(itemStart)}" data-card-duration="${fmt(slotDuration)}">
    <div class="showcase-grid">
      <div class="showcase-pane ref-pane">
        <div class="pane-tag">
          <span class="tag-title">ORIGINAL REFERENCE</span>
          <span class="tag-sub">Character Input</span>
        </div>
        <div class="pane-media">
          <img id="ref-img-${idPrefix}-${shortId}" src="${esc(refPath)}" alt="${esc(username)} reference" class="ref-img">
        </div>
      </div>
      <div class="showcase-divider">
        <div class="divider-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      </div>
      <div class="showcase-pane video-pane">
        <div class="pane-tag">
          <span class="tag-title">3D SKIN</span>
        </div>
        <div class="pane-media transparent-stage">
          <video id="walk-vid-${idPrefix}-${shortId}" src="${esc(videoPath)}" data-start="${fmt(itemStart)}" data-duration="${fmt(slotDuration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackIndex}" muted playsinline preload="auto" loop class="walk-video clip"></video>
          <div class="creator-tag-bottom-right">
            ${avatarHtml}
            <div class="creator-details">
              <span class="creator-role">CREATOR</span>
              <strong class="creator-name">${esc(username)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

function renderCompareCard(comp, trackOffset) {
  const refPath = `assets/skin_reconstruction/${comp.refImage}`;
  const oldVideoPath = `assets/skin_reconstruction/${comp.oldVideo}`;
  const newVideoPath = `assets/skin_reconstruction/${comp.newVideo}`;
  const username = comp.username;
  const localAvatarRel = `assets/skin_reconstruction/avatars/${comp.shortId}.jpg`;
  const localAvatarPath = path.join(mediaRoot, localAvatarRel);
  const hasLocalAvatar = fs.existsSync(localAvatarPath);
  const shortId = comp.shortId;

  const avatarHtml = hasLocalAvatar
    ? `<img src="${localAvatarRel}" alt="${esc(username)}" class="creator-avatar">`
    : `<div class="creator-avatar-placeholder">${esc(username.charAt(0).toUpperCase())}</div>`;

  return `<article id="compare-case-${shortId}" class="compare-card" data-card-start="${fmt(comp.start)}" data-card-duration="${fmt(comp.duration)}">
    <div class="compare-grid">
      <div class="compare-pane ref-pane">
        <div class="pane-tag">
          <span class="tag-title">ORIGINAL REFERENCE</span>
          <span class="tag-sub">Character Input</span>
        </div>
        <div class="pane-media">
          <img id="ref-img-compare-${shortId}" src="${esc(refPath)}" alt="${esc(username)} reference" class="ref-img">
          <div class="creator-tag-bottom-right">
            ${avatarHtml}
            <div class="creator-details">
              <span class="creator-role">CREATOR</span>
              <strong class="creator-name">${esc(username)}</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="showcase-divider">
        <div class="divider-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      </div>
      <div class="compare-pane video-pane">
        <div class="pane-tag">
          <span class="tag-title">PREVIOUS MODEL</span>
          <span class="tag-sub status-old">sking_v73</span>
        </div>
        <div class="pane-media transparent-stage">
          <video id="walk-vid-old-${shortId}" src="${esc(oldVideoPath)}" data-start="${fmt(comp.start)}" data-duration="${fmt(comp.duration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackOffset}" muted playsinline preload="auto" loop class="walk-video clip"></video>
          <div class="compare-badge-pill old">
            <span>Previous Baseline</span>
          </div>
        </div>
      </div>
      <div class="showcase-divider">
        <div class="divider-icon vs-icon">VS</div>
      </div>
      <div class="compare-pane video-pane compare-new-pane">
        <div class="pane-tag">
          <span class="tag-title">NEW ARCHITECTURE</span>
          <span class="tag-sub status-new">SKING_DDJ Series</span>
        </div>
        <div class="pane-media transparent-stage">
          <video id="walk-vid-new-${shortId}" src="${esc(newVideoPath)}" data-start="${fmt(comp.start)}" data-duration="${fmt(comp.duration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackOffset + 1}" muted playsinline preload="auto" loop class="walk-video clip"></video>
          <div class="compare-badge-pill new">
            <span>✨ New Model</span>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

// Scene 1: Hook (0:00 - 0:20) — Direct Community Showcase
function hookScene() {
  const hookStart = 0;
  const hookEnd = 20;
  const totalDuration = hookEnd - hookStart;
  const hookJpgs = [
    'KBD3Z6CDL9GXBUJD.jpg',
    'RHK5KXG6KJ7DNABF.jpg',
    'P8NBZUTBW6C63CWS.jpg'
  ];
  const hookItems = hookJpgs.map(jpg => communityItems.find(item => item.jpgFile === jpg)).filter(Boolean);
  const itemCount = hookItems.length || 1;
  const slotDuration = totalDuration / itemCount;

  const cards = hookItems.map((item, index) => {
    const itemStart = hookStart + index * slotDuration;
    return renderShowcaseCard(item, itemStart, slotDuration, 30 + index, 'hook-case');
  }).join('');

  return `<section id="scene-1" class="scene clip" data-track-index="1">
    <div class="scene-head">
      <div>
        <span class="kicker">EntropyDrop</span>
        <h2>ANOTHER OPEN-SOURCE MODEL: IMAGE <em>→</em> MINECRAFT SKIN</h2>
      </div>
      <div class="scene-note">EntropyDrop Community Creations</div>
    </div>
    <div class="showcase-stage">
      ${cards}
    </div>
  </section>`;
}

// Scene 2: VO 02 Comparison (0:20 - 1:00, 40s total)
function compareScene(chapter) {
  const compareStart = chapter.start;
  const compareEnd = chapter.end;
  const totalDuration = compareEnd - compareStart;
  const slotDuration = totalDuration / 2;

  const compareItems = [
    {
      shortId: '6XF2JYHW',
      fullId: '6XF2JYHW9UDKX8YU',
      refImage: '6XF2JYHW9UDKX8YU.jpg',
      oldVideo: 'skin_G6F23DKN__walk360.webm',
      newVideo: 'skin_6XF2JYHW__walk360.webm',
      username: 'Junaidk Hossain',
      start: compareStart,
      duration: slotDuration,
    },
    {
      shortId: '4PJLKJGP',
      fullId: '4PJLKJGPDNEUSKPE',
      refImage: '4PJLKJGPDNEUSKPE.jpg',
      oldVideo: 'skin_NSXZMKCF__walk360.webm',
      newVideo: 'skin_4PJLKJGP__walk360.webm',
      username: 'LoL FF',
      start: compareStart + slotDuration,
      duration: slotDuration,
    },
  ];

  const cards = compareItems.map((item, index) => {
    return renderCompareCard(item, 40 + index * 2);
  }).join('');

  return `<section id="scene-2" class="scene clip" data-track-index="2">
    <div class="scene-head">
      <div>
        <span class="kicker">Why Build Another One? · Model Comparison</span>
        <h2>PREVIOUS BASELINE <em>VS</em> NEW ARCHITECTURE</h2>
      </div>
      <div class="scene-note">EntropyDrop Model Evolution</div>
    </div>
    <div class="compare-stage">
      ${cards}
    </div>
  </section>`;
}

// Scene 3: Community Showcase (1:00 - 3:30, 150 seconds total)
function showcaseScene() {
  const showcaseStart = 60;
  const showcaseEnd = 210;
  const totalDuration = showcaseEnd - showcaseStart;
  const compareShortIds = new Set(['6XF2JYHW', '4PJLKJGP']);
  const hookShortIds = new Set(['KBD3Z6CD', 'RHK5KXG6', 'P8NBZUTB']);
  const showcaseItems = communityItems.filter(item => !compareShortIds.has(item.shortId) && !hookShortIds.has(item.shortId));
  const itemCount = showcaseItems.length || 1;
  const slotDuration = totalDuration / itemCount;

  const cards = showcaseItems.map((item, index) => {
    const itemStart = showcaseStart + index * slotDuration;
    return renderShowcaseCard(item, itemStart, slotDuration, 50 + (index % 10), 'case');
  }).join('');

  return `<section id="scene-3" class="scene clip" data-track-index="3">
    <div class="scene-head">
      <div>
        <span class="kicker">EntropyDrop</span>
        <h2>ANOTHER OPEN-SOURCE MODEL: IMAGE <em>→</em> MINECRAFT SKIN</h2>
      </div>
      <div class="scene-note">EntropyDrop Community Creations</div>
    </div>
    <div class="showcase-stage">
      ${cards}
    </div>
  </section>`;
}

// Act 2: Scene CTA: Try It Online (VO 06 | 210s - 220s, 10s)
function tryItOnlineScene(chapter) {
  const duration = chapter.end - chapter.start;
  const videoSrc = 'assets/website/skin_P8NBZUTB_uprock_var2_slim_aligned_xneg3_y22.webm';
  return `<section id="scene-cta" class="scene">
    <div class="scene-inner">
      <div class="cta-card">
        <div class="cta-left">
          <h2>Free online Minecraft skin generator</h2>
          <p class="subtitle">Use it online, or train and deploy the open-source model locally.</p>
          <div class="cta-url">entropydrop.com</div>
        </div>
        <div class="mock-browser">
          <div class="browser-bar">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="url-bar">entropydrop.com</div>
          </div>
          <div class="website-video-slot">
            <div class="video-slot-screen">
              <video id="cta-demo-video" class="cta-demo-video clip" src="${esc(videoSrc)}" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-track-index="33" data-media-start="0" data-volume="0" muted playsinline preload="auto" loop></video>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// Act 2: Scene 6: Website Walkthrough & 3D Viewer (VO 07 | 220s - 290s, 70s Fullscreen)
function webUploadScene(chapter) {
  const duration = chapter.end - chapter.start;
  const videoSrc = assets['website.upload']?.src || 'assets/website/vo06_website_upload.webm';
  return `<section id="scene-6" class="scene scene-fullscreen clip" data-track-index="6">
    <div class="fullscreen-video-frame">
      <video id="vo06-fullscreen-video" class="fullscreen-video" src="${esc(videoSrc)}" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-source-duration="62.800" data-media-start="0" data-volume="0" muted playsinline preload="auto" loop></video>
    </div>
  </section>`;
}

// Act 2: Scene 7: 3D Viewer Display Modes (VO 07 | 250s - 290s)
function webViewerModesScene(chapter) {
  const duration = chapter.end - chapter.start;
  return `<section id="scene-7" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-track-index="7">
    <div class="scene-head">
      <div>
        <span class="kicker">3D Viewer Inspection · Step 02</span>
        <h2>Three Display Modes: Voxel, Plane &amp; Cute</h2>
      </div>
      <div class="step-number">STEP 02</div>
    </div>
    <div class="browser-shell">
      <div class="browser-top">
        <i></i><i></i><i></i><span>entropydrop.com/skin/generate · 3D Viewer</span>
      </div>
      <div class="browser-body">
        <aside>
          <b>DISPLAY MODES</b>
          <span>🧊 Voxel (3D Volume)</span>
          <span>🟩 Plane (Classic Box)</span>
          <span>🧸 Cute (Chibi Scale)</span>
          <span>🔄 360° Orbit View</span>
        </aside>
        <main>
          <div class="viewer-mode-bar">
            <div class="mode-tab active"><span>🧊</span> VOXEL MODE</div>
            <div class="mode-tab"><span>🟩</span> PLANE MODE</div>
            <div class="mode-tab"><span>🧸</span> CUTE MODE</div>
          </div>
          ${asset('website.generate', { start: chapter.start, duration }, 'browser-asset')}
        </main>
        <div class="instruction-card">
          <span>02</span>
          <h3>Inspect Display Modes</h3>
          <p>Once generated, inspect the skin in three distinct real-time display modes:</p>
          <div class="card-sub-list">
            <div class="card-sub-item active">
              <div class="card-sub-header">
                <span class="card-sub-title">🧊 Voxel Mode</span>
                <span class="card-sub-badge green">3D VOLUME</span>
              </div>
              <span class="card-sub-desc">Extrudes every pixel into 3D volume, giving the skin tangible physical depth.</span>
            </div>
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">🟩 Plane Mode</span>
                <span class="card-sub-badge">CLASSIC</span>
              </div>
              <span class="card-sub-desc">Classic flat Minecraft box look, displaying standard planar texture mapping.</span>
            </div>
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">🧸 Cute Mode</span>
                <span class="card-sub-badge amber">CHIBI SCALE</span>
              </div>
              <span class="card-sub-desc">Transforms the character into adorable chibi head-to-body proportions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// Act 2: Scene 8: 3D Viewer Animations and Download (VO 08 | 290s - 330s)
function webViewerActionsScene(chapter) {
  const duration = chapter.end - chapter.start;
  return `<section id="scene-8" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-track-index="8">
    <div class="scene-head">
      <div>
        <span class="kicker">3D Viewer Inspection · Step 03</span>
        <h2>Animations: Idle, Walk, Dance &amp; Download</h2>
      </div>
      <div class="step-number">STEP 03</div>
    </div>
    <div class="browser-shell">
      <div class="browser-top">
        <i></i><i></i><i></i><span>entropydrop.com/skin/generate · 3D Viewer</span>
      </div>
      <div class="browser-body">
        <aside>
          <b>ANIMATIONS</b>
          <span>⏸ Idle Pose</span>
          <span>🚶 Walk Cycle</span>
          <span>💃 Dance Routine</span>
          <b>⬇ DOWNLOAD PNG</b>
        </aside>
        <main>
          <div class="viewer-action-dock">
            <div class="dock-btn"><span>⏸</span> IDLE</div>
            <div class="dock-btn active"><span>🚶</span> WALK</div>
            <div class="dock-btn"><span>💃</span> DANCE</div>
            <div class="dock-btn download-btn"><span>⬇</span> DOWNLOAD PNG</div>
          </div>
          ${asset('website.preview', { start: chapter.start, duration }, 'browser-asset')}
        </main>
        <div class="instruction-card">
          <span>03</span>
          <h3>Animations &amp; Export</h3>
          <p>Test three dynamic animation types to verify joint articulation before downloading:</p>
          <div class="card-sub-list">
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">⏸ Idle Pose</span>
                <span class="card-sub-badge">STATIC</span>
              </div>
              <span class="card-sub-desc">Calm standing pose to inspect micro-details, hair layers, and textures.</span>
            </div>
            <div class="card-sub-item active">
              <div class="card-sub-header">
                <span class="card-sub-title">🚶 Walk Cycle</span>
                <span class="card-sub-badge green">MOTION</span>
              </div>
              <span class="card-sub-desc">Natural locomotion testing clothing dynamics and limb movement continuity.</span>
            </div>
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">💃 Dance Routine</span>
                <span class="card-sub-badge amber">EXPRESSIVE</span>
              </div>
              <span class="card-sub-desc">Brings the character to life with fun moves, ensuring zero texture distortion.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// Act 3: How the Pipeline Works (Scene 9 | 330s - 375s)
function ddjScene(chapter) {
  const ddjVideoImg = assets['ddj.videos_2025']?.src || 'assets/ddj_2025_videos.png';
  const ddjPromptImg = assets['ddj.prompt_2025']?.src || 'assets/ddj_2025_prompt.png';

  return `<section id="scene-9" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="9">
    <div class="scene-head">
      <div>
        <span class="kicker">Two-Stage Architecture</span>
        <h2>How the Pipeline Works</h2>
      </div>
      <div class="scene-note">Crediting DDJ's Pioneering Concept</div>
    </div>
    <div class="ddj-timeline-stage">
      <div class="ddj-card">
        <div class="milestone-badge">LATE 2025 · DEMO</div>
        <h3>Banana Image Model Demo</h3>
        <div class="ddj-media-preview ddj-media-video">
          <img src="${esc(ddjVideoImg)}" alt="DDJ 2025 Nanobanana Video Demonstration">
        </div>
        <div class="ddj-meta">
          <span>Author: <b>DDJ (氪鸡)</b></span>
          <span>Date: <b>2025-11-23</b></span>
        </div>
        <p>DDJ demonstrated using the Banana image model to assist Minecraft skin creation, proving the potential of image-guided generation and prompt design.</p>
        <div class="milestone-tag">Prompt Framework Origin</div>
      </div>
      <div class="timeline-arrow"><i>→</i></div>
      <div class="ddj-card">
        <div class="milestone-badge">STAGE 1 · VIEWS</div>
        <h3>Fixed Views Prompt</h3>
        <div class="ddj-media-preview ddj-media-prompt">
          <img src="${esc(ddjPromptImg)}" alt="DDJ 2025 Prompt Template and Layout Guide">
        </div>
        <div class="ddj-meta">
          <span>Post: <b>Bilibili Dynamic</b></span>
          <span>Date: <b>2025-12-01</b></span>
        </div>
        <p>Adapted from DDJ's research: specialized prompt templates guide the image model to produce consistent Minecraft front and back views without geometry distortion.</p>
        <div class="milestone-tag">Auxiliary Vision Model</div>
      </div>
      <div class="timeline-arrow"><i>→</i></div>
      <div class="ddj-card active">
        <div class="milestone-badge">STAGE 2 · TOOLKIT</div>
        <h3>Redesigned UV Reconstruction</h3>
        <div class="ddj-media-preview ddj-media-reconstruction">
          <img src="assets/skingen_layers.png" alt="SkingToolkit Dual-Layer Reconstruction">
        </div>
        <div class="ddj-meta">
          <span>Engine: <b>SkingToolkit</b></span>
          <span>Pipeline: <b>Dense UV Parser</b></span>
        </div>
        <p>EntropyDrop redesigned the full geometric reconstruction pipeline and open-sourced SkingToolkit to turn fixed views into playable 64×64 skins.</p>
        <div class="milestone-tag tag-green">Open-Source Release</div>
      </div>
    </div>
    <div class="attribution-banner">
      <b>NAMED IN HONOR OF DDJ</b>
      <span>Prompt framework adapted from DDJ's public research · Complete reconstruction pipeline redesigned &amp; open-sourced by EntropyDrop</span>
    </div>
  </section>`;
}

// Act 3: Stage One (Scene 10 | 375s - 405s)
function stageOneScene(chapter) {
  return `<section id="scene-10" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="10">
    <div class="scene-head">
      <div>
        <span class="kicker">Two-Stage Pipeline · Stage 01</span>
        <h2>Stage One: Fixed Front and Back Views</h2>
      </div>
      <div class="scene-note">Camera, Pose &amp; Layout Normalization</div>
    </div>
    <div class="stage-one-layout">
      <div class="stage-card">
        <span class="step-badge">STEP 1.1</span>
        <h3>Reference + Fixed Examples</h3>
        <p>The character reference is paired with Minecraft template images sharing fixed camera angles, Steve/Alex mesh poses, and standard view layouts.</p>
        <div class="tag-status tag-open">Open Workflow Components</div>
      </div>
      <div class="stage-flow-arrow"><i>→</i></div>
      <div class="stage-card">
        <span class="step-badge">STEP 1.2</span>
        <h3>Carefully Designed Prompts</h3>
        <p>Specialized prompt templates constrain the vision model to keep the fixed format stable, preserving character identity without hallucinating unwanted details.</p>
        <div class="tag-status tag-closed">Auxiliary Vision Model</div>
      </div>
      <div class="stage-flow-arrow"><i>→</i></div>
      <div class="stage-card">
        <span class="step-badge">STEP 1.3</span>
        <h3>Normalized Format Output</h3>
        <p>Outputs standardized Minecraft front and back views ready for silhouette extraction, Dense UV parsing, and 3D reconstruction.</p>
        <div class="tag-status tag-neutral">Standardized Views</div>
      </div>
    </div>
  </section>`;
}

// Act 3: Stage Two (Scene 11 | 405s - 450s)
function stageTwoScene(chapter) {
  return `<section id="scene-11" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="11">
    <div class="scene-head">
      <div>
        <span class="kicker">Two-Stage Pipeline · Stage 02</span>
        <h2>Stage Two: Reconstruct the Skin</h2>
      </div>
      <div class="scene-note">Open-Source SkingToolkit Reconstruction</div>
    </div>
    <div class="stage-two-layout">
      <div class="pipeline-diagram-five">
        <div>
          <b>STEP 01</b>
          <strong>SILHOUETTE EXTRACTION</strong>
          <span>Isolates character foreground and aligns mesh silhouette geometry</span>
        </div>
        <i>→</i>
        <div class="active-step">
          <b>STEP 02</b>
          <strong>DENSE UV PARSER</strong>
          <span>Routes pixels across 72 cuboid faces: inner base &amp; outer volume layers</span>
        </div>
        <i>→</i>
        <div>
          <b>STEP 03</b>
          <strong>TOPOLOGICAL INPAINTING</strong>
          <span>Predicts occluded surfaces: inner arms, legs, armpits, and underside</span>
        </div>
        <i>→</i>
        <div>
          <b>STEP 04</b>
          <strong>HEAD DECODER</strong>
          <span>Resolves multi-face seams for complex 3D hairstyles and accessories</span>
        </div>
        <i>→</i>
        <div class="active-step">
          <b>STEP 05</b>
          <strong>64×64 SKIN PNG</strong>
          <span>Material refitting and color refinement to generate game-ready PNG</span>
        </div>
      </div>
      <div class="layers-callout">
        <div class="layer-pill inner">
          <b>72 Cuboid Faces &amp; Dual Layer</b>
          Standard 64×64 texture mapped onto 12 cuboids (6 base body + 6 outer volume).
        </div>
        <div class="layer-pill outer">
          <b>Topological Limb Inpainting</b>
          Fills hidden inner-limb surfaces never directly visible in 2D views.
        </div>
        <div class="layer-pill check">
          <b>Head Decoder &amp; Seam Healing</b>
          Cross-face continuous UV reconstruction eliminating hair wrapping artifacts.
        </div>
      </div>
    </div>
  </section>`;
}

// Act 4: Future Outlook & Closing (Scene 12 | 450s - 500s)
function futureScene(chapter) {
  return `<section id="scene-12" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="12">
    <div class="scene-head">
      <div>
        <span class="kicker">Roadmap &amp; Community</span>
        <h2>What Comes Next: Reducing Dependencies</h2>
      </div>
      <div class="scene-note">Open-Source Roadmap &amp; Channel Updates</div>
    </div>
    <div class="future-grid">
      <div class="future-card">
        <span class="card-num">01</span>
        <h3>Closed-Source Bottlenecks</h3>
        <p>The vision model cannot guarantee a valid fixed format every time, causing occasional failures; diversity for complex hair and head accessories is also limited.</p>
        <div class="milestone-tag tag-closed">Current Bottleneck</div>
      </div>
      <div class="future-card">
        <span class="card-num">02</span>
        <h3>Screened Dataset Triples</h3>
        <p>Collecting reviewed (Character → Views → Skin) dataset triples to train native end-to-end open-source models and remove closed-source dependencies.</p>
        <div class="milestone-tag tag-green">Open-Source Direction</div>
      </div>
      <div class="future-card">
        <span class="card-num">03</span>
        <h3>Subscribe for Future Models</h3>
        <p>More open-source generative models, pipelines, and datasets are coming. Subscribe to the channel to get future model releases and tutorials!</p>
        <div class="milestone-tag tag-green">Channel Subscription</div>
      </div>
    </div>
    <div class="closing-banner">
      <div class="subscribe-banner-box">
        <div class="subscribe-banner-left">
          <span class="subscribe-icon">🔔</span>
          <div class="subscribe-banner-texts">
            <h4>Subscribe to the Channel for More Models</h4>
            <p>Stay tuned for upcoming open-source generative AI models, architecture deep-dives &amp; SkingToolkit updates.</p>
          </div>
        </div>
        <a class="closing-link-pill primary" href="https://youtube.com/@EntropyDrop">
          <span class="link-label">YOUTUBE</span>
          <strong>SUBSCRIBE &rarr;</strong>
        </a>
      </div>
      <div class="closing-links-row">
        <a class="closing-link-pill primary" href="https://entropydrop.com/skin/generate">
          <span class="link-label">ONLINE DEMO</span>
          <strong>entropydrop.com/skin/generate</strong>
        </a>
        <a class="closing-link-pill" href="https://github.com/EntropyDrop/SkingToolkit">
          <span class="link-label">GITHUB CODE</span>
          <strong>github.com/EntropyDrop/SkingToolkit</strong>
        </a>
        <a class="closing-link-pill" href="https://huggingface.co/EntropyDrop/Sking">
          <span class="link-label">HUGGING FACE</span>
          <strong>huggingface.co/EntropyDrop/Sking</strong>
        </a>
      </div>
    </div>
  </section>`;
}

// Subtitles generation
function subtitleChunks(text) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let index = 0; index < words.length;) {
    let end = Math.min(words.length, index + 13);
    if (end < words.length) {
      for (let cursor = end; cursor > index + 6; cursor--) {
        if (/[,.?!;:]$/.test(words[cursor - 1])) { end = cursor; break; }
      }
    }
    chunks.push(words.slice(index, end).join(' '));
    index = end;
  }
  return chunks;
}

let subtitleId = 0;
const subtitles = chapters.flatMap(chapter => {
  const chunks = subtitleChunks(chapter.text);
  const counts = chunks.map(value => value.split(/\s+/).length);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const slot = chapter.end - chapter.start;
  const spoken = Math.min(slot - 1.5, total / 2.2);
  let wordsBefore = 0;
  return chunks.map((value, index) => {
    const start = chapter.start + .45 + spoken * wordsBefore / total;
    const duration = spoken * counts[index] / total;
    wordsBefore += counts[index];
    subtitleId++;
    return '<div id="sub-' + String(subtitleId).padStart(3, '0') + '" class="subtitle-line clip" data-start="' +
      fmt(start) + '" data-duration="' + fmt(Math.max(.1, duration - .003)) + '" data-track-index="' +
      (80 + chapter.index) + '"><span>' + esc(value) + '</span></div>';
  });
}).join('');

const scenes = [
  hookScene(),
  compareScene(getChapter('why_another_model')),
  showcaseScene(),
  tryItOnlineScene(getChapter('try_it_online')),
  webUploadScene(getChapter('website_walkthrough')),
  ddjScene(getChapter('how_pipeline_works')),
  stageOneScene(getChapter('stage_one')),
  stageTwoScene(getChapter('stage_two')),
  futureScene(getChapter('future_outlook')),
].join('\n');

const css = fs.readFileSync(path.join(project, 'template.css'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>Another Open-Source Model: Image to Minecraft Skin</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"><\/script>
  <style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="500.000" data-width="1920" data-height="1080">
  ${scenes}
  ${subtitles}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
const root = document.getElementById('root');
const total = Number(root.dataset.duration);
const at = node => Number(node.dataset.start);
const length = node => Number(node.dataset.duration);
function reveal(selector, start, duration, animate = true) {
  tl.set(selector, { visibility: 'visible', opacity: animate ? 0 : 1, y: animate ? 22 : 0 }, start);
  if (animate) tl.to(selector, { y: 0, opacity: 1, duration: .42, ease: 'power2.out' }, start + .05);
  tl.to(selector, { opacity: 0, duration: .35, ease: 'power2.in' }, start + duration - .35);
  tl.set(selector, { visibility: 'hidden' }, start + duration);
}
reveal('#scene-1', 0, 20, false);
reveal('#scene-2', 20, 40, false);
reveal('#scene-3', 60, 150, false);
reveal('#scene-cta', 210, 10, false);
tl.from('#scene-cta .cta-card', { scale: 0.97, opacity: 0, duration: 0.6, ease: 'power3.out' }, 210.1);
reveal('#scene-6', 220, 110, false);
document.querySelectorAll('.showcase-card, .compare-card').forEach(node => {
  const start = Number(node.dataset.cardStart);
  const dur = Number(node.dataset.cardDuration);
  reveal('#' + node.id, start, dur, true);
});
document.querySelectorAll('.scene.clip:not(#scene-1):not(#scene-2):not(#scene-3):not(#scene-6)').forEach(node => reveal('#' + node.id, at(node), length(node)));
document.querySelectorAll('.timed-card').forEach(node => reveal('#' + node.id, at(node), length(node), true));
document.querySelectorAll('.asset-media').forEach(node => reveal('#' + node.id, at(node), length(node), false));
document.querySelectorAll('.subtitle-line').forEach(node => {
  tl.set('#' + node.id, { visibility: 'visible', opacity: 1 }, at(node));
  tl.set('#' + node.id, { visibility: 'hidden', opacity: 0 }, at(node) + length(node));
});
window.__timelines.main = tl;
// Seamless action video looping & timeline sync
const walkVideos = document.querySelectorAll('video.walk-video');

walkVideos.forEach(v => {
  const origPause = v.pause.bind(v);
  const origPlay = v.play.bind(v);
  v._origPause = origPause;
  v._origPlay = origPlay;

  v.loop = true;
  v.muted = true;
  v.playsInline = true;

  // Protect active playback window from premature pause by preview runtime
  v.pause = function() {
    const isPlaying = window.__player ? window.__player.isPlaying() : false;
    const time = window.__player ? window.__player.getTime() : (window.__timelines && window.__timelines.main ? window.__timelines.main.time() : 0);
    const start = Number(this.dataset.start);
    const dur = Number(this.dataset.duration);
    if (isPlaying && time >= start && time < start + dur) {
      return; // Ignore premature pause while card is playing
    }
    return origPause();
  };
});

function syncVideoPlaybackState(seekToTime = null) {
  const isPlaying = window.__player ? window.__player.isPlaying() : false;
  const t = seekToTime !== null 
    ? seekToTime 
    : (window.__player ? window.__player.getTime() : (window.__timelines && window.__timelines.main ? window.__timelines.main.time() : 0));

  walkVideos.forEach(vid => {
    const start = Number(vid.dataset.start);
    const dur = Number(vid.dataset.duration);
    if (!Number.isFinite(start) || !Number.isFinite(dur)) return;
    const inWindow = t >= start && t < start + dur;

    if (inWindow) {
      const cycle = Number(vid.dataset.sourceDuration) || 8.0;
      const targetTime = cycle > 0 ? (t - start) % cycle : 0;

      if (!isPlaying) {
        // Paused / scrubbing: align frame exactly and keep paused
        if (Math.abs(vid.currentTime - targetTime) > 0.05) {
          try { vid.currentTime = targetTime; } catch (e) {}
        }
        vid._origPause();
      } else {
        // Playing: if paused (e.g. sought directly into late window > 28s), resume at correct loop offset
        if (vid.paused) {
          try { vid.currentTime = targetTime; } catch (e) {}
          vid._origPlay().catch(() => {});
        }
      }
    } else {
      // Out of active card window: ensure paused
      if (!vid.paused) {
        vid._origPause();
      }
    }
  });
}

// Supervisory sync to handle direct seeking into windows and boundary transitions
setInterval(() => {
  syncVideoPlaybackState();
}, 100);

const previewParam = new URLSearchParams(window.location.search).get('time');
if (previewParam !== null) {
  const previewTime = Number(previewParam);
  if (Number.isFinite(previewTime)) {
    tl.seek(Math.max(0, Math.min(total, previewTime)), false);
    syncVideoPlaybackState(previewTime);
  }
}
<\/script>
</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log('Built ' + outputPath);
console.log('  chapters: ' + chapters.length + ', showcase items: ' + communityItems.length + ', subtitles: ' + subtitleId + ', duration: 500s');
