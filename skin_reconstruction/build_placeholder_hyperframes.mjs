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
if (chapters.length !== 12 || chapters[0].start !== 0 || chapters.at(-1).end !== 500) {
  throw new Error('Expected 12 continuous chapters ending at 8:20 (500s), got ' + chapters.length);
}
chapters.forEach((chapter, index) => {
  if (chapter.index !== index + 1 || chapter.start !== (chapters[index - 1]?.end ?? 0)) {
    throw new Error('Chapter timeline is not continuous at VO ' + chapter.index);
  }
});

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
      '" data-media-start="0" data-volume="0" muted playsinline preload="auto"></video>';
  }
  return '<div class="asset-placeholder ' + esc(extraClass) + '" data-asset-key="' + esc(key) + '">' +
    '<div class="placeholder-grid"></div><span class="placeholder-chip">DEMO RECORDING</span>' +
    '<strong>' + esc(label) + '</strong><code>' + esc(key) + '</code>' +
    '<small>Target: ' + esc(item.suggested || 'add src in assets/placeholder-manifest.json') + '</small></div>';
}

// Scene 1: Hook (0:00 - 0:20)
function hookScene() {
  return '<section id="scene-1" class="scene clip" data-start="0.000" data-duration="20.000" data-track-index="1">' +
    '<div class="hook-hero">' +
    '<div class="hook-kicker"><span class="kicker-dot"></span>ANOTHER OPEN-SOURCE MODEL</div>' +
    '<h1 class="hook-title">Turn Any Character Image<br>into a Minecraft Skin</h1>' +
    '<p class="hook-subtitle">Deep learning pipeline for high-fidelity character to Minecraft skin reconstruction</p>' +
    '<div class="hook-agenda">' +
    '<div class="agenda-card">' +
    '<div class="agenda-tag">PART 01</div>' +
    '<div class="agenda-title">Community Showcase</div>' +
    '<div class="agenda-desc">Diverse art styles &amp; character identity</div>' +
    '</div>' +
    '<div class="agenda-arrow"><i>→</i></div>' +
    '<div class="agenda-card">' +
    '<div class="agenda-tag">PART 02</div>' +
    '<div class="agenda-title">Live Demo</div>' +
    '<div class="agenda-desc">Online upload, generation &amp; 3D inspection</div>' +
    '</div>' +
    '<div class="agenda-arrow"><i>→</i></div>' +
    '<div class="agenda-card">' +
    '<div class="agenda-tag">PART 03</div>' +
    '<div class="agenda-title">Two-Stage Pipeline</div>' +
    '<div class="agenda-desc">DDJ attribution &amp; reconstruction principle</div>' +
    '</div>' +
    '</div>' +
    '<div class="hook-links">' +
    '<div class="link-item"><span class="link-badge">WEB</span><span class="link-text">entropydrop.com/skin/generate</span></div>' +
    '<div class="link-item"><span class="link-badge">CODE</span><span class="link-text">github.com/EntropyDrop/SkingToolkit</span></div>' +
    '<div class="link-item"><span class="link-badge">WEIGHTS</span><span class="link-text">huggingface.co/EntropyDrop/Sking</span></div>' +
    '</div>' +
    '</div>' +
    '</section>';
}

// Scene 2: Community Showcase (0:20 - 3:30, 190 seconds total)
function showcaseScene() {
  const showcaseStart = 20;
  const showcaseEnd = 210;
  const totalDuration = showcaseEnd - showcaseStart;
  const itemCount = communityItems.length || 1;
  const slotDuration = totalDuration / itemCount;

  const cards = communityItems.map((item, index) => {
    const itemStart = showcaseStart + index * slotDuration;
    const refPath = `assets/skin_reconstruction/${item.jpgFile}`;
    const videoPath = `assets/skin_reconstruction/skin_${item.shortId}__walk360.webm`;
    const username = item.creator?.username || 'Community Creator';
    const localAvatarRel = `assets/skin_reconstruction/avatars/${item.shortId}.jpg`;
    const localAvatarPath = path.join(mediaRoot, localAvatarRel);
    const hasLocalAvatar = fs.existsSync(localAvatarPath);
    const model = item.modelVersion || 'SKING_DDJ';
    const shortId = item.shortId;

    const avatarHtml = hasLocalAvatar
      ? `<img src="${localAvatarRel}" alt="${esc(username)}" class="creator-avatar">`
      : `<div class="creator-avatar-placeholder">${esc(username.charAt(0).toUpperCase())}</div>`;

    return `<article id="case-${shortId}" class="showcase-card" data-card-start="${fmt(itemStart)}" data-card-duration="${fmt(slotDuration)}">
      <div class="showcase-grid">
        <div class="showcase-pane ref-pane">
          <div class="pane-tag">
            <span class="tag-title">ORIGINAL REFERENCE</span>
            <span class="tag-sub">Character Input</span>
          </div>
          <div class="pane-media">
            <img id="ref-img-${shortId}" src="${esc(refPath)}" alt="${esc(username)} reference" class="ref-img">
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
            <video id="walk-vid-${shortId}" src="${esc(videoPath)}" data-start="${fmt(itemStart)}" data-duration="${fmt(slotDuration)}" data-media-start="0" data-volume="0" data-track-index="${90 + index}" muted playsinline preload="auto" loop class="walk-video clip"></video>
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
  }).join('');

  return `<section id="scene-2" class="scene" data-track-index="2">
    <div class="scene-head">
      <div>
        <span class="kicker">Community Showcase · Results in Motion</span>
        <h2>From Character Reference to 3D Minecraft Skin</h2>
      </div>
      <div class="scene-note">EntropyDrop Community Creations</div>
    </div>
    <div class="showcase-stage">
      ${cards}
    </div>
  </section>`;
}

// Act 2: Scene 6: Upload Reference & Model (VO 06 | 210s - 250s)
function webUploadScene(chapter) {
  const duration = chapter.end - chapter.start;
  return `<section id="scene-6" class="scene clip" data-start="${fmt(chapter.start)}" data-duration="${fmt(duration)}" data-track-index="6">
    <div class="scene-head">
      <div>
        <span class="kicker">Website Walkthrough · Step 01</span>
        <h2>Upload Reference &amp; Generate Skin</h2>
      </div>
      <div class="step-number">STEP 01</div>
    </div>
    <div class="browser-shell">
      <div class="browser-top">
        <i></i><i></i><i></i><span>entropydrop.com/skin/generate</span>
      </div>
      <div class="browser-body">
        <aside>
          <b>IMAGE MODE</b>
          <span>Upload Reference</span>
          <span>Model: SKING DDJ</span>
          <span>Free Access Windows</span>
          <span>Generate Now</span>
        </aside>
        <main>
          ${asset('website.upload', { start: chapter.start, duration }, 'browser-asset')}
        </main>
        <div class="instruction-card">
          <span>01</span>
          <h3>Upload &amp; Generate</h3>
          <p>Open <code>entropydrop.com</code>, sign in, upload your character reference, select <strong>SKING DDJ</strong>, and click Generate.</p>
          <div class="card-sub-list">
            <div class="card-sub-item active">
              <div class="card-sub-header">
                <span class="card-sub-title">Model: SKING DDJ</span>
                <span class="card-sub-badge green">ACTIVE</span>
              </div>
              <span class="card-sub-desc">Specialized character-to-skin deep learning reconstruction model.</span>
            </div>
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">Cloud Hosted Service</span>
                <span class="card-sub-badge amber">PERIODIC FREE</span>
              </div>
              <span class="card-sub-desc">High GPU costs prevent 24/7 free access; free windows open periodically.</span>
            </div>
            <div class="card-sub-item">
              <div class="card-sub-header">
                <span class="card-sub-title">Local Deployment</span>
                <span class="card-sub-badge green">100% FREE &amp; OPEN</span>
              </div>
              <span class="card-sub-desc">Pipeline and weights are fully open source for unlimited free local running.</span>
            </div>
          </div>
        </div>
      </div>
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
        <div class="milestone-badge">LATE 2025 · CONCEPT</div>
        <h3>Banana Image Model Demo</h3>
        <p>DDJ demonstrated using the Banana image model to assist Minecraft skin creation, proving the potential of image-guided generation and prompt design.</p>
        <div class="milestone-tag">Prompt Framework Origin</div>
      </div>
      <div class="timeline-arrow"><i>→</i></div>
      <div class="ddj-card">
        <div class="milestone-badge">STAGE 1 · VIEWS</div>
        <h3>Fixed Views Generation</h3>
        <p>Adapted from DDJ's research: specialized prompt templates guide the image model to produce consistent Minecraft front and back views without geometry distortion.</p>
        <div class="milestone-tag">Auxiliary Vision Model</div>
      </div>
      <div class="timeline-arrow"><i>→</i></div>
      <div class="ddj-card active">
        <div class="milestone-badge">STAGE 2 · TOOLKIT</div>
        <h3>Redesigned UV Reconstruction</h3>
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
        <div class="tag-status tag-open">Open-Source Pipeline Code</div>
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
  showcaseScene(),
  webUploadScene(chapters[5]),
  webViewerModesScene(chapters[6]),
  webViewerActionsScene(chapters[7]),
  ddjScene(chapters[8]),
  stageOneScene(chapters[9]),
  stageTwoScene(chapters[10]),
  futureScene(chapters[11]),
].join('\n');

const css = fs.readFileSync(path.join(project, 'template.css'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>AI Minecraft Skins — Open-Source Reconstruction</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"><\/script>
  <style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="500.000" data-width="1920" data-height="1080">
  <div class="top-rule"></div>
  ${scenes}
  ${subtitles}
  <div class="progress"><i></i></div>
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
reveal('#scene-2', 20, 190, false);
document.querySelectorAll('.showcase-card').forEach(node => {
  const start = Number(node.dataset.cardStart);
  const dur = Number(node.dataset.cardDuration);
  reveal('#' + node.id, start, dur, true);
});
document.querySelectorAll('.scene.clip:not(#scene-1):not(#scene-2)').forEach(node => reveal('#' + node.id, at(node), length(node)));
document.querySelectorAll('.timed-card').forEach(node => reveal('#' + node.id, at(node), length(node), true));
document.querySelectorAll('.asset-media').forEach(node => reveal('#' + node.id, at(node), length(node), false));
document.querySelectorAll('.subtitle-line').forEach(node => {
  tl.set('#' + node.id, { visibility: 'visible', opacity: 1 }, at(node));
  tl.set('#' + node.id, { visibility: 'hidden', opacity: 0 }, at(node) + length(node));
});
tl.to('.progress i', { width: '100%', duration: total, ease: 'none' }, 0);
window.__timelines.main = tl;
const previewParam = new URLSearchParams(window.location.search).get('time');
if (previewParam !== null) {
  const previewTime = Number(previewParam);
  if (Number.isFinite(previewTime)) tl.seek(Math.max(0, Math.min(total, previewTime)), false);
}
<\/script>
</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log('Built ' + outputPath);
console.log('  chapters: ' + chapters.length + ', showcase items: ' + communityItems.length + ', subtitles: ' + subtitleId + ', duration: 500s');
