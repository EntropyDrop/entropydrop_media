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
if (chapters.length !== 10 || chapters[0].start !== 0 || chapters.at(-1).end !== 455) {
  throw new Error('Expected 10 continuous chapters ending at 7:35 (455s), got ' + chapters.length);
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

function renderShowcaseCard(item, itemStart, slotDuration, trackIndex, idPrefix = 'case', isFirst = false, isLast = false, transDur = 0.55) {
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

  const videoStart = isFirst ? itemStart : Math.max(0, itemStart - transDur);
  const videoEnd = itemStart + slotDuration;
  const videoDuration = Math.max(0.1, videoEnd - videoStart);

  return `<article id="${idPrefix}-${shortId}" class="showcase-card" data-card-start="${fmt(itemStart)}" data-card-duration="${fmt(slotDuration)}" data-layout-allow-overflow="true">
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
          <video id="walk-vid-${idPrefix}-${shortId}" src="${esc(videoPath)}" data-start="${fmt(videoStart)}" data-duration="${fmt(videoDuration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackIndex}" muted playsinline preload="auto" loop class="walk-video clip"></video>
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

function renderCompareCard(comp, trackOffset, isFirst = false, isLast = false, transDur = 0.55) {
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

  const videoStart = isFirst ? comp.start : Math.max(0, comp.start - transDur);
  const videoEnd = comp.start + comp.duration;
  const videoDuration = Math.max(0.1, videoEnd - videoStart);

  return `<article id="compare-case-${shortId}" class="compare-card" data-card-start="${fmt(comp.start)}" data-card-duration="${fmt(comp.duration)}" data-layout-allow-overflow="true">
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
          <video id="walk-vid-old-${shortId}" src="${esc(oldVideoPath)}" data-start="${fmt(videoStart)}" data-duration="${fmt(videoDuration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackOffset}" muted playsinline preload="auto" loop class="walk-video clip"></video>
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
          <video id="walk-vid-new-${shortId}" src="${esc(newVideoPath)}" data-start="${fmt(videoStart)}" data-duration="${fmt(videoDuration)}" data-media-start="0" data-source-duration="8.000" data-volume="0" data-track-index="${trackOffset + 1}" muted playsinline preload="auto" loop class="walk-video clip"></video>
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
  const transDur = 0.55;

  const cards = hookItems.map((item, index) => {
    const itemStart = hookStart + index * slotDuration;
    const isFirst = index === 0;
    const isLast = index === itemCount - 1;
    return renderShowcaseCard(item, itemStart, slotDuration, 30 + index, 'hook-case', isFirst, isLast, transDur);
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
  const transDur = 0.55;

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
    const isFirst = index === 0;
    const isLast = index === compareItems.length - 1;
    return renderCompareCard(item, 40 + index * 2, isFirst, isLast, transDur);
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
  const transDur = 0.55;

  const cards = showcaseItems.map((item, index) => {
    const itemStart = showcaseStart + index * slotDuration;
    const isFirst = index === 0;
    const isLast = index === itemCount - 1;
    return renderShowcaseCard(item, itemStart, slotDuration, 50 + (index % 10), 'case', isFirst, isLast, transDur);
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
      <video id="vo06-fullscreen-video" class="fullscreen-video" src="${esc(videoSrc)}" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-source-duration="55.733" data-media-start="0" data-volume="0" muted playsinline preload="auto" loop></video>
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

// Act 3: How the Pipeline Works: Stage One (Scene 8 | 330s - 360s)
function stageOneScene(chapter) {
  return `<section id="scene-8" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="8">
    <div class="scene-head">
      <div>
        <span class="kicker">Two-Stage Architecture</span>
        <h2>How the Pipeline Works: Stage 1 Fixed Views Generation</h2>
      </div>
    </div>
    <div class="stage-one-layout">
      <div class="stage-card">
        <div class="stage-card-header">
          <h3>Character Reference</h3>
        </div>
        <div class="stage-card-media ref-media">
          <div class="media-preview-box">
            <img src="assets/input24.png" alt="Character Reference" class="stage-card-img ref-tall-img" />
          </div>
        </div>
      </div>
      <div class="stage-flow-arrow"><i>+</i></div>
      <div class="stage-card">
        <div class="stage-card-header">
          <h3>Fixed Layout Templates</h3>
        </div>
        <div class="stage-card-media templates-media">
          <div class="templates-grid">
            <div class="template-item">
              <img src="assets/template41.png" alt="Template 41" class="stage-card-img tmpl-img" />
            </div>
            <div class="template-item">
              <img src="assets/template42.png" alt="Template 42" class="stage-card-img tmpl-img" />
            </div>
            <div class="template-item">
              <img src="assets/template43.png" alt="Template 43" class="stage-card-img tmpl-img" />
            </div>
          </div>
        </div>
      </div>
      <div class="stage-flow-process">
        <div class="process-node">
          <span class="process-arrow-in">&rarr;</span>
          <div class="process-card">
            <div class="gemini-icon-glow">
              <svg class="gemini-svg" viewBox="0 0 24 24" width="36" height="36">
                <defs>
                  <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#4E75FF"/>
                    <stop offset="50%" stop-color="#9C5BFF"/>
                    <stop offset="100%" stop-color="#FF6B95"/>
                  </linearGradient>
                </defs>
                <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" fill="url(#gemini-grad)"/>
              </svg>
            </div>
            <div class="process-text-group">
              <span class="process-kicker">PROCESSED BY</span>
              <strong class="process-title">Gemini Banana</strong>
            </div>
          </div>
          <span class="process-arrow-out">&rarr;</span>
        </div>
      </div>
      <div class="stage-card stage-card-output">
        <div class="stage-card-header">
          <h3>Normalized Dual Views</h3>
        </div>
        <div class="stage-card-media output-media">
          <div class="media-preview-box">
            <img src="assets/img24_template41_51_52.png" alt="Normalized Dual Views" class="stage-card-img norm-dual-img" />
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// Act 3: Stage Two (Scene 9 | 360s - 405s)
function stageTwoScene(chapter) {
  return `<section id="scene-9" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="9">
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
          <div class="step-card-header">
            <b>STEP 01</b>
            <strong>SILHOUETTE EXTRACTION</strong>
            <span>Isolates character foreground and aligns mesh silhouette geometry</span>
          </div>
          <div class="step-card-media">
            <div class="step-media-box">
              <img src="assets/img24_cutout.png" alt="Silhouette Cutout (img24_cutout.png)" class="step-img cutout-img" />
            </div>
            <span class="step-media-caption">img24_cutout.png · Foreground Cutout</span>
          </div>
        </div>
        <i>→</i>
        <div class="active-step">
          <div class="step-card-header">
            <b>STEP 02</b>
            <strong>DENSE UV PARSER</strong>
            <span>Routes pixels across 72 cuboid faces: inner base &amp; outer volume layers</span>
          </div>
          <div class="step-card-media">
            <div class="step-media-box">
              <img src="assets/img24_routed.png" alt="Semantic Routing (img24_routed.png)" class="step-img routed-img" />
            </div>
            <span class="step-media-caption">img24_routed.png · Semantic Routing</span>
          </div>
        </div>
        <i>→</i>
        <div>
          <div class="step-card-header">
            <b>STEP 03</b>
            <strong>TOPOLOGICAL INPAINTING</strong>
            <span>Predicts occluded surfaces: inner arms, legs, armpits, and underside</span>
          </div>
          <div class="step-card-media">
            <div class="step-media-box">
              <img src="assets/parser_pred_uv_simple_inpainting.png" alt="Inpainted UV (parser_pred_uv_simple_inpainting.png)" class="step-img uv-pixel-img" />
            </div>
            <span class="step-media-caption">Inpainted UV (64×64 Texture)</span>
          </div>
        </div>
        <i>→</i>
        <div>
          <div class="step-card-header">
            <b>STEP 04</b>
            <strong>HEAD DECODER</strong>
            <span>Resolves multi-face seams for complex 3D hairstyles and accessories</span>
          </div>
          <div class="step-card-media">
            <div class="step-media-box">
              <img src="assets/v101_headwear_comparison.png" alt="Headwear Separation (v101_headwear_comparison.png)" class="step-img headwear-img" />
            </div>
            <span class="step-media-caption">Dual-Layer Seam Healing</span>
          </div>
        </div>
        <i>→</i>
        <div class="active-step">
          <div class="step-card-header">
            <b>STEP 05</b>
            <strong>64×64 SKIN PNG</strong>
            <span>Material refitting and color refinement to generate game-ready PNG</span>
          </div>
          <div class="step-card-media">
            <div class="step-media-box">
              <img src="assets/img24_final.png" alt="Final 64x64 Skin (img24_final.png)" class="step-img final-skin-img" />
            </div>
            <span class="step-media-caption">img24_final.png · Game-Ready Skin</span>
          </div>
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

// Brand Logo SVGs for Closing Scene
const HF_LOGO_SVG = `<svg class="pill-brand-icon hf-logo" viewBox="0 0 95 88" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill="#fff" d="M94.25 70.08a8.28 8.28 0 0 1-.43 6.46 10.57 10.57 0 0 1-3 3.6 25.18 25.18 0 0 1-5.7 3.2 65.74 65.74 0 0 1-7.56 2.65 46.67 46.67 0 0 1-11.42 1.68c-5.42.05-10.09-1.23-13.4-4.5a40.4 40.4 0 0 1-10.14.03c-3.34 3.25-7.99 4.52-13.39 4.47a46.82 46.82 0 0 1-11.43-1.68 66.37 66.37 0 0 1-7.55-2.65c-2.28-.98-4.17-2-5.68-3.2a10.5 10.5 0 0 1-3.02-3.6c-.99-2-1.18-4.3-.42-6.46a8.54 8.54 0 0 1-.33-5.63c.25-.95.66-1.83 1.18-2.61a8.67 8.67 0 0 1 2.1-8.47 8.23 8.23 0 0 1 2.82-2.07 41.75 41.75 0 1 1 81.3-.12 8.27 8.27 0 0 1 3.11 2.19 8.7 8.7 0 0 1 2.1 8.47c.52.78.93 1.66 1.18 2.61a8.61 8.61 0 0 1-.32 5.63Z"/>
  <path fill="#FFD21E" d="M47.21 76.5a34.75 34.75 0 1 0 0-69.5 34.75 34.75 0 0 0 0 69.5Z"/>
  <path fill="#FF9D0B" d="M81.96 41.75a34.75 34.75 0 1 0-69.5 0 34.75 34.75 0 0 0 69.5 0Zm-73.5 0a38.75 38.75 0 1 1 77.5 0 38.75 38.75 0 0 1-77.5 0Z"/>
  <path fill="#3A3B45" d="M58.5 32.3c1.28.44 1.78 3.06 3.07 2.38a5 5 0 1 0-6.76-2.07c.61 1.15 2.55-.72 3.7-.32ZM34.95 32.3c-1.28.44-1.79 3.06-3.07 2.38a5 5 0 1 1 6.76-2.07c-.61 1.15-2.56-.72-3.7-.32Z"/>
  <path fill="#FF323D" d="M46.96 56.29c9.83 0 13-8.76 13-13.26 0-2.34-1.57-1.6-4.09-.36-2.33 1.15-5.46 2.74-8.9 2.74-7.19 0-13-6.88-13-2.38s3.16 13.26 13 13.26Z"/>
  <path fill="#3A3B45" fill-rule="evenodd" d="M39.43 54a8.7 8.7 0 0 1 5.3-4.49c.4-.12.81.57 1.24 1.28.4.68.82 1.37 1.24 1.37.45 0 .9-.68 1.33-1.35.45-.7.89-1.38 1.32-1.25a8.61 8.61 0 0 1 5 4.17c3.73-2.94 5.1-7.74 5.1-10.7 0-2.34-1.57-1.6-4.09-.36l-.14.07c-2.31 1.15-5.39 2.67-8.77 2.67s-6.45-1.52-8.77-2.67c-2.6-1.29-4.23-2.1-4.23.29 0 3.05 1.46 8.06 5.47 10.97Z" clip-rule="evenodd"/>
  <path fill="#FF9D0B" d="M70.71 37a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM24.21 37a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM17.52 48c-1.62 0-3.06.66-4.07 1.87a5.97 5.97 0 0 0-1.33 3.76 7.1 7.1 0 0 0-1.94-.3c-1.55 0-2.95.59-3.94 1.66a5.8 5.8 0 0 0-.8 7 5.3 5.3 0 0 0-1.79 2.82c-.24.9-.48 2.8.8 4.74a5.22 5.22 0 0 0-.37 5.02c1.02 2.32 3.57 4.14 8.52 6.1 3.07 1.22 5.89 2 5.91 2.01a44.33 44.33 0 0 0 10.93 1.6c5.86 0 10.05-1.8 12.46-5.34 3.88-5.69 3.33-10.9-1.7-15.92-2.77-2.78-4.62-6.87-5-7.77-.78-2.66-2.84-5.62-6.25-5.62a5.7 5.7 0 0 0-4.6 2.46c-1-1.26-1.98-2.25-2.86-2.82A7.4 7.4 0 0 0 17.52 48Zm0 4c.51 0 1.14.22 1.82.65 2.14 1.36 6.25 8.43 7.76 11.18.5.92 1.37 1.31 2.14 1.31 1.55 0 2.75-1.53.15-3.48-3.92-2.93-2.55-7.72-.68-8.01.08-.02.17-.02.24-.02 1.7 0 2.45 2.93 2.45 2.93s2.2 5.52 5.98 9.3c3.77 3.77 3.97 6.8 1.22 10.83-1.88 2.75-5.47 3.58-9.16 3.58-3.81 0-7.73-.9-9.92-1.46-.11-.03-13.45-3.8-11.76-7 .28-.54.75-.76 1.34-.76 2.38 0 6.7 3.54 8.57 3.54.41 0 .7-.17.83-.6.79-2.85-12.06-4.05-10.98-8.17.2-.73.71-1.02 1.44-1.02 3.14 0 10.2 5.53 11.68 5.53.11 0 .2-.03.24-.1.74-1.2.33-2.04-4.9-5.2-5.21-3.16-8.88-5.06-6.8-7.33.24-.26.58-.38 1-.38 3.17 0 10.66 6.82 10.66 6.82s2.02 2.1 3.25 2.1c.28 0 .52-.1.68-.38.86-1.46-8.06-8.22-8.56-11.01-.34-1.9.24-2.85 1.31-2.85Z"/>
  <path fill="#FFD21E" d="M38.6 76.69c2.75-4.04 2.55-7.07-1.22-10.84-3.78-3.77-5.98-9.3-5.98-9.3s-.82-3.2-2.69-2.9c-1.87.3-3.24 5.08.68 8.01 3.91 2.93-.78 4.92-2.29 2.17-1.5-2.75-5.62-9.82-7.76-11.18-2.13-1.35-3.63-.6-3.13 2.2.5 2.79 9.43 9.55 8.56 11-.87 1.47-3.93-1.71-3.93-1.71s-9.57-8.71-11.66-6.44c-2.08 2.27 1.59 4.17 6.8 7.33 5.23 3.16 5.64 4 4.9 5.2-.75 1.2-12.28-8.53-13.36-4.4-1.08 4.11 11.77 5.3 10.98 8.15-.8 2.85-9.06-5.38-10.74-2.18-1.7 3.21 11.65 6.98 11.76 7.01 4.3 1.12 15.25 3.49 19.08-2.12Z"/>
  <path fill="#FF9D0B" d="M77.4 48c1.62 0 3.07.66 4.07 1.87a5.97 5.97 0 0 1 1.33 3.76 7.1 7.1 0 0 1 1.95-.3c1.55 0 2.95.59 3.94 1.66a5.8 5.8 0 0 1 .8 7 5.3 5.3 0 0 1 1.78 2.82c.24.9.48 2.8-.8 4.74a5.22 5.22 0 0 1 .37 5.02c-1.02 2.32-3.57 4.14-8.51 6.1-3.08 1.22-5.9 2-5.92 2.01a44.33 44.33 0 0 1-10.93 1.6c-5.86 0-10.05-1.8-12.46-5.34-3.88-5.69-3.33-10.9 1.7-15.92 2.78-2.78 4.63-6.87 5.01-7.77.78-2.66 2.83-5.62 6.24-5.62a5.7 5.7 0 0 1 4.6 2.46c1-1.26 1.98-2.25 2.87-2.82A7.4 7.4 0 0 1 77.4 48Zm0 4c-.51 0-1.13.22-1.82.65-2.13 1.36-6.25 8.43-7.76 11.18a2.43 2.43 0 0 1-2.14 1.31c-1.54 0-2.75-1.53-.14-3.48 3.91-2.93 2.54-7.72.67-8.01a1.54 1.54 0 0 0-.24-.02c-1.7 0-2.45 2.93-2.45 2.93s-2.2 5.52-5.97 9.3c-3.78 3.77-3.98 6.8-1.22 10.83 1.87 2.75 5.47 3.58 9.15 3.58 3.82 0 7.73-.9 9.93-1.46.1-.03 13.45-3.8 11.76-7-.29-.54-.75-.76-1.34-.76-2.38 0-6.71 3.54-8.57 3.54-.42 0-.71-.17-.83-.6-.8-2.85 12.05-4.05 10.97-8.17-.19-.73-.7-1.02-1.44-1.02-3.14 0-10.2 5.53-11.68 5.53-.1 0-.19-.03-.23-.1-.74-1.2-.34-2.04 4.88-5.2 5.23-3.16 8.9-5.06 6.8-7.33-.23-.26-.57-.38-.98-.38-3.18 0-10.67 6.82-10.67 6.82s-2.02 2.1-3.24 2.1a.74.74 0 0 1-.68-.38c-.87-1.46 8.05-8.22 8.55-11.01.34-1.9-.24-2.85-1.31-2.85Z"/>
  <path fill="#FFD21E" d="M56.33 76.69c-2.75-4.04-2.56-7.07 1.22-10.84 3.77-3.77 5.97-9.3 5.97-9.3s.82-3.2 2.7-2.9c1.86.3 3.23 5.08-.68 8.01-3.92 2.93.78 4.92 2.28 2.17 1.51-2.75 5.63-9.82 7.76-11.18 2.13-1.35 3.64-.6 3.13 2.2-.5 2.79-9.42 9.55-8.55 11 .86 1.47 3.92-1.71 3.92-1.71s9.58-8.71 11.66-6.44c2.08 2.27-1.58 4.17-6.8 7.33-5.23 3.16-5.63 4-4.9 5.2.75 1.2 12.28-8.53 13.36-4.4 1.08 4.11-11.76 5.3-10.97 8.15.8 2.85 9.05-5.38 10.74-2.18 1.69 3.21-11.65 6.98-11.76 7.01-4.31 1.12-15.26 3.49-19.08-2.12Z"/>
</svg>`;

const GITHUB_LOGO_SVG = `<svg class="pill-brand-icon github-logo" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
</svg>`;

const DEMO_LOGO_SVG = `<svg class="pill-brand-icon demo-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="2" y1="12" x2="22" y2="12"></line>
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
</svg>`;

const YOUTUBE_LOGO_SVG = `<svg class="pill-brand-icon yt-logo" viewBox="0 0 24 24" fill="#ff0000" xmlns="http://www.w3.org/2000/svg">
  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
</svg>`;

// Act 4: Open Source & Technical Details (Scene 10 | 405s - 455s)
function futureScene(chapter) {
  return `<section id="scene-10" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(chapter.end - chapter.start)}" data-track-index="10">
    <div class="scene-head">
      <div>
        <span class="kicker">Hugging Face Hub · Architecture &amp; Weights</span>
        <h2>Open Source &amp; Technical Details</h2>
      </div>
      <div class="scene-note">huggingface.co/EntropyDrop/Sking · Weights, Configs &amp; Code</div>
    </div>
    <div class="future-grid">
      <div class="future-card">
        <span class="card-num">01</span>
        <h3>Hugging Face Model Hub</h3>
        <p>Directly download production model weights (Dense UV Parser, BiRefNet foreground model), pipeline configs, and pinned checksums from our Hugging Face repository.</p>
        <div class="milestone-tag tag-green">huggingface.co/EntropyDrop/Sking</div>
      </div>
      <div class="future-card">
        <span class="card-num">02</span>
        <h3>Architecture &amp; Benchmarks</h3>
        <p>In-depth technical writeups covering orthographic projection constraints, SigLIP2 semantic routing, whole-headwear consistency, and re-rendering ablation logs.</p>
        <div class="milestone-tag tag-green">Technical Paper &amp; Metrics</div>
      </div>
      <div class="future-card">
        <span class="card-num">03</span>
        <h3>Open Code &amp; Web Demo</h3>
        <p>Run the full pipeline locally with open-source SkingToolkit code on GitHub, or create and inspect skins in the free interactive 3D generator on EntropyDrop.</p>
        <div class="milestone-tag tag-green">entropydrop.com/skin/generate</div>
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
        <a class="closing-link-pill youtube" href="https://youtube.com/@EntropyDrop">
          <div class="pill-icon-box">${YOUTUBE_LOGO_SVG}</div>
          <div class="pill-texts">
            <span class="link-label">YOUTUBE</span>
            <strong>SUBSCRIBE &rarr;</strong>
          </div>
        </a>
      </div>
      <div class="closing-links-row">
        <a class="closing-link-pill primary" href="https://entropydrop.com/skin/generate">
          <div class="pill-icon-box">${DEMO_LOGO_SVG}</div>
          <div class="pill-texts">
            <span class="link-label">ONLINE DEMO</span>
            <strong>entropydrop.com/skin/generate</strong>
          </div>
        </a>
        <a class="closing-link-pill github" href="https://github.com/EntropyDrop/SkingToolkit">
          <div class="pill-icon-box">${GITHUB_LOGO_SVG}</div>
          <div class="pill-texts">
            <span class="link-label">GITHUB CODE</span>
            <strong>github.com/EntropyDrop/SkingToolkit</strong>
          </div>
        </a>
        <a class="closing-link-pill huggingface" href="https://huggingface.co/EntropyDrop/Sking">
          <div class="pill-icon-box">${HF_LOGO_SVG}</div>
          <div class="pill-texts">
            <span class="link-label">HUGGING FACE</span>
            <strong>huggingface.co/EntropyDrop/Sking</strong>
          </div>
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
  stageOneScene(getChapter('how_pipeline_works')),
  stageTwoScene(getChapter('stage_two')),
  futureScene(getChapter('technical_details')),
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
<div id="root" data-composition-id="main" data-start="0" data-duration="455.000" data-width="1920" data-height="1080">
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
const TRANSITION_DURATION = 0.55;
document.querySelectorAll('.showcase-stage, .compare-stage').forEach(stage => {
  const cards = Array.from(stage.querySelectorAll('.showcase-card, .compare-card'));
  const count = cards.length;
  cards.forEach((card, index) => {
    const start = Number(card.dataset.cardStart);
    const dur = Number(card.dataset.cardDuration);
    const end = start + dur;
    const isFirst = index === 0;

    // Entrance: slide into the screen from the right side (+1920px -> 0px)
    if (isFirst) {
      tl.set('#' + card.id, { visibility: 'visible', opacity: 1, x: 1920 }, start);
      tl.to('#' + card.id, { x: 0, duration: TRANSITION_DURATION, ease: 'power2.inOut' }, start);
    } else {
      const enterStart = start - TRANSITION_DURATION;
      tl.set('#' + card.id, { visibility: 'visible', opacity: 1, x: 1920 }, enterStart);
      tl.to('#' + card.id, { x: 0, duration: TRANSITION_DURATION, ease: 'power2.inOut' }, enterStart);
    }

    // Exit: slide out of the screen to the left (0px -> -1920px)
    const exitStart = end - TRANSITION_DURATION;
    tl.to('#' + card.id, { x: -1920, duration: TRANSITION_DURATION, ease: 'power2.inOut' }, exitStart);
    tl.set('#' + card.id, { visibility: 'hidden', x: 0 }, end);
  });
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
