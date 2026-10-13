import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const project = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(project, 'project.json'), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex');
const esc = value => String(value).replace(/’/g, "'").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const probe = src => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,r_frame_rate:format=duration', '-of', 'json', path.join(project, src)], { encoding: 'utf8' }));
const frames = seconds => Math.round(seconds * config.fps);
const introFrames = frames(config.showcase.duration);
const introDuration = introFrames / config.fps;
if (!Number.isFinite(config.showcase.duration) || introFrames < 1 || Math.abs(introDuration - config.showcase.duration) > 1e-6) {
  throw new Error('The opening showcase duration must be positive and use whole frames.');
}
if (config.showcase.src) {
  const metadata = probe(config.showcase.src);
  if (Number(metadata.format.duration) < config.showcase.mediaStart + introDuration) throw new Error('Showcase video is shorter than the configured opening duration after mediaStart.');
}
let showcasePhotos = null;
if (config.showcase.manifest) {
  if (config.showcase.src) throw new Error('Choose either a showcase video or a photo carousel.');
  const manifest = JSON.parse(fs.readFileSync(path.join(project, config.showcase.manifest), 'utf8'));
  let nextFrame = 0;
  for (const photo of manifest.photos) {
    if (manifest.imagePreparation === 'original-byte-copy' && photo.source_sha256 !== photo.image_sha256) {
      throw new Error('Showcase image must be an unchanged original. Run npm run showcase.');
    }
    if (photo.startFrame !== nextFrame || !Number.isInteger(photo.frames) || photo.frames < 1 || photo.image_sha256 !== hash(photo.image)) {
      throw new Error('Showcase photos changed or timing is invalid. Run npm run showcase.');
    }
    nextFrame += photo.frames;
  }
  if (manifest.fps !== config.fps || manifest.frames !== introFrames || nextFrame !== introFrames || manifest.imageCount !== manifest.photos.length) {
    throw new Error('Showcase photos must fill the configured opening duration exactly.');
  }
  showcasePhotos = manifest.photos;
}
let cursor = introFrames;
const clips = config.clips.map(clip => {
  const metadata = probe(clip.src);
  const [numerator, denominator] = metadata.streams[0].r_frame_rate.split('/').map(Number);
  if (numerator / denominator !== config.fps) throw new Error(`Run npm run prepare:assets to normalize ${clip.src}.`);
  const count = Number(metadata.streams[0].nb_frames);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid frame count: ${clip.src}`);
  const start = cursor / config.fps;
  const end = (cursor + count) / config.fps;
  const result = { ...clip, start, duration: end - start, frames: count };
  cursor += count;
  return result;
});
const outroStart = cursor / config.fps;
const slicing = { start: clips[1].start, duration: outroStart - clips[1].start };
const walkthroughFrames = cursor + frames(config.outroDuration);
const walkthroughDuration = walkthroughFrames / config.fps;
let assembly = null;
if (config.assembly) {
  const manifest = JSON.parse(fs.readFileSync(path.join(project, config.assembly.manifest), 'utf8'));
  const metadata = probe(manifest.video);
  const [numerator, denominator] = metadata.streams[0].r_frame_rate.split('/').map(Number);
  if (manifest.fps !== config.fps || numerator / denominator !== config.fps || Number(metadata.streams[0].nb_frames) !== manifest.frames || manifest.edit_sha256 !== hash('assembly-edit.json') || manifest.video_sha256 !== hash(manifest.video) || manifest.music_sha256 !== hash(manifest.music)) {
    throw new Error('Assembly edit changed or assets are stale. Run npm run assembly.');
  }
  assembly = { ...manifest, start: walkthroughDuration };
}
const assemblyEndFrames = walkthroughFrames + (assembly?.frames ?? 0);
let stickers = null;
if (config.stickers) {
  if (!assembly) throw new Error('The sticker sequence requires the assembly section.');
  const manifest = JSON.parse(fs.readFileSync(path.join(project, config.stickers.manifest), 'utf8'));
  const metadata = probe(manifest.video);
  const [numerator, denominator] = metadata.streams[0].r_frame_rate.split('/').map(Number);
  if (manifest.fps !== config.fps || numerator / denominator !== config.fps || Number(metadata.streams[0].nb_frames) !== manifest.frames || manifest.edit_sha256 !== hash('stickers-edit.json') || manifest.video_sha256 !== hash(manifest.video) || manifest.music_sha256 !== hash(manifest.music) || manifest.assembly_manifest_sha256 !== hash(config.assembly.manifest)) {
    throw new Error('Sticker sequence or music is stale. Run npm run stickers.');
  }
  stickers = { ...manifest, start: assemblyEndFrames / config.fps };
}
const endingStartFrames = assemblyEndFrames + (stickers?.frames ?? 0);
const ending = config.ending ? { ...config.ending, start: endingStartFrames / config.fps } : null;
const totalFrames = endingStartFrames + frames(ending?.duration ?? 0);
const total = totalFrames / config.fps;
const narrationDuration = total;
let soundtrack = assembly ? { src: stickers?.music ?? assembly.music, start: assembly.start, duration: stickers?.musicDuration ?? assembly.duration } : null;
if (ending && assembly) {
  const score = JSON.parse(fs.readFileSync(path.join(project, 'audios/full_soundtrack_manifest.json'), 'utf8'));
  if (score.assembly_manifest_sha256 !== hash(config.assembly.manifest) || score.stickers_manifest_sha256 !== hash(config.stickers.manifest) || score.sha256 !== hash(score.src) || Math.abs(score.duration - (total - assembly.start)) > .00001 || score.endingDuration !== ending.duration) {
    throw new Error('Closing music is stale. Run npm run soundtrack.');
  }
  soundtrack = { src: score.src, start: assembly.start, duration: score.duration };
}
let captions = config.websiteCaptions.map(caption => ({ text: caption.text, start: clips[0].start + caption.start, duration: (caption.end ?? clips[0].duration) - caption.start }));
clips.slice(1).forEach(clip => captions.push({ text: clip.caption, start: clip.start, duration: clip.duration }));
const audioManifestPath = path.join(project, 'audios/qwen3_tts_manifest.json');
let narration = null;
if (fs.existsSync(audioManifestPath) && !process.argv.includes('--without-narration')) {
  narration = JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'));
  if (narration.narration_sha256 !== hash('narration.json') || narration.combined_audio.sha256 !== hash('audios/voiceover_full.wav') || Math.abs(narration.timeline_duration - narrationDuration) > .00001) {
    throw new Error('Narration changed or is out of date. Run npm run audio before building.');
  }
  const anchors = Object.fromEntries(clips.map(clip => [clip.source, clip.start]));
  anchors.showcase = 0;
  anchors.outro = outroStart;
  anchors.slicing = slicing.start;
  if (ending) anchors.ending = ending.start;
  for (const segment of narration.segments) {
    if (Math.abs(segment.start_seconds - (anchors[segment.anchor] + segment.offset)) > .00001) {
      throw new Error('Narration timing changed. Remove the stale audio manifest, build, then run npm run audio.');
    }
  }
  captions = narration.segments.map(segment => ({ text: segment.text, start: segment.start_seconds, duration: Math.min(segment.maxDuration, segment.duration_seconds + .16) }));
}
if (assembly) captions.push(...assembly.shots.map(shot => ({ text: shot.caption, start: assembly.start + shot.start, duration: shot.duration })));
if (stickers) captions.push({ text: 'Apply the matching skin stickers.', start: stickers.start, duration: stickers.duration });
const screenStart = clips[0].start;
const timing = (start, duration, track) => `data-start="${start}" data-duration="${duration}" data-track-index="${track}"`;
const figure = `<svg class="figure" viewBox="0 0 260 350" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M82 18h96v90H82zM77 120h106v111H77zM23 120h42v121H23zM195 120h42v121h-42zM77 244h46v90H77zM137 244h46v90h-46z"/><path opacity=".3" d="M82 42h96M106 18v90M77 145h106M101 120v111M23 145h42M195 145h42M77 270h46M137 270h46"/></svg>`;
const showcasePanel = showcasePhotos
  ? `<div class="showcase-gallery">${showcasePhotos.map((photo, i) => `<img id="showcase-photo-${i + 1}" class="showcase-photo clip"${i === 0 ? ' data-layout-allow-overflow' : ''} src="${esc(photo.image)}" alt="Custom figures ${i + 1}" ${timing(photo.startFrame / config.fps, photo.frames / config.fps, 120 + i)}>`).join('')}</div>`
  : `<div class="placeholder"><span class="slot-tag">01 / FINISHED FIGURE</span>${figure}<strong>SHOWCASE VIDEO</strong><p>${introDuration}-second placeholder · footage coming soon</p></div>`;
const intro = config.showcase.src
  ? `<section id="intro" class="scene clip" ${timing(0, introDuration, 1)}><div class="showcase-label">${esc(config.title)}</div></section><video id="showcase" class="clip showcase-video" src="${esc(config.showcase.src)}" ${timing(0, introDuration, 0)} data-media-start="${config.showcase.mediaStart}" data-volume="0" muted playsinline preload="auto"></video>`
  : `<section id="intro" class="intro scene clip" ${timing(0, introDuration, 1)}>${showcasePanel}<div class="showcase-label">${esc(config.title)}</div></section>`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080"><title>${esc(config.title)}</title><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><style>${fs.readFileSync(path.join(project, 'template.css'), 'utf8')}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${intro}
<section id="screen-stage" class="screen-stage scene clip" ${timing(screenStart, outroStart - screenStart, 2)}></section>
${clips.map((clip, i) => `<video id="recording-${i + 1}" class="screen-recording clip" src="${esc(clip.src)}" ${timing(clip.start, clip.duration, 10 + i)} data-media-start="0" data-volume="0" muted playsinline preload="auto"></video>`).join('\n')}
<section id="outro" class="outro scene clip" ${timing(outroStart, config.outroDuration, 5)}><span class="bridge-brand">EntropyDrop</span><div class="assembly-copy"><span class="assembly-kicker"><i></i>TIME TO BUILD</span><h2><span>Let's put it</span><strong>together.</strong></h2><div class="assembly-rule"></div></div><img class="assembly-visual" src="assets/assembly/assembly-bridge-still.png" alt="Hands holding the assembled 3D-printed figure"></section>
${assembly ? `<section id="assembly" class="screen-stage scene clip" ${timing(assembly.start, assembly.duration, 6)}></section>
<video id="assembly-recording" class="screen-recording clip" src="${esc(assembly.video)}" ${timing(assembly.start, assembly.duration, 14)} data-media-start="0" data-volume="0" muted playsinline preload="auto"></video>` : ''}
${stickers ? `<section id="stickers" class="screen-stage scene clip" ${timing(stickers.start, stickers.duration, 7)}></section>
${stickers.photos.map((photo, i) => `<img id="sticker-photo-${i + 1}" class="sticker-photo clip" src="${esc(photo.image)}" alt="Skin sticker installation ${i + 1}" ${timing((assemblyEndFrames + i * photo.frames) / config.fps, photo.frames / config.fps, 80 + i)}>`).join('\n')}` : ''}
${ending ? `<section id="ending" class="ending scene clip" ${timing(ending.start, ending.duration, 8)}><img class="ending-photo" src="${esc(ending.image)}" alt="Finished custom figure"><div class="ending-copy"><span class="brand">EntropyDrop</span><h2>YOUR SKIN.<br><em>MADE REAL.</em></h2><div id="ending-cta" class="ending-cta clip" ${timing(ending.start + 3.3, ending.duration - 3.3, 9)}><p>Try it yourself</p><strong>entropydrop.com</strong><span>FREE TOOLS &amp; DOWNLOADS</span></div></div></section>` : ''}
${soundtrack ? `<audio id="assembly-music" class="voiceover-track clip" src="${esc(soundtrack.src)}" ${timing(soundtrack.start, soundtrack.duration, 71)} data-media-start="0" data-volume="1" preload="auto"></audio>` : ''}
<div class="progress"></div>
${narration ? `<audio id="voiceover" class="voiceover-track clip" src="audios/voiceover_full.wav" ${timing(0, narrationDuration, 70)} data-media-start="0" data-volume="1" preload="auto"></audio>` : ''}
</div><script>
const total = ${total};
const tl = gsap.timeline({ paused: true });
document.querySelectorAll('.clip').forEach(element => {
  const start = Number(element.dataset.start);
  const end = start + Number(element.dataset.duration);
  if (start > 0) tl.set(element, { visibility: 'hidden' }, 0);
  tl.set(element, { visibility: 'visible' }, start);
  tl.set(element, { visibility: 'hidden' }, end);
});
${config.showcase.src || showcasePhotos ? '' : `tl.fromTo('.placeholder', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'power2.out' }, .12);
tl.fromTo('#intro .figure', { y: 0 }, { y: -10, duration: 2.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, .2);`}
tl.fromTo('.assembly-copy', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .4, ease: 'power2.out' }, ${outroStart + .06});
tl.fromTo('.assembly-rule', { scaleX: 0 }, { scaleX: 1, duration: .65, ease: 'power3.out' }, ${outroStart + .25});
tl.fromTo('.progress', { scaleX: 0 }, { scaleX: 1, duration: total, ease: 'none' }, 0);
tl.set('.progress', { visibility: 'hidden' }, 0);
tl.set('.progress', { visibility: 'hidden' }, ${screenStart});
${assembly ? `tl.set('.progress', { visibility: 'hidden' }, ${assembly.start});` : ''}
${stickers ? `tl.set('.progress', { visibility: 'hidden' }, ${stickers.start});` : ''}
window.__timelines = window.__timelines || {};
window.__timelines.main = tl;
</script></body></html>\n`;
fs.writeFileSync(path.join(project, 'index.html'), html);
fs.writeFileSync(path.join(project, 'meta.json'), JSON.stringify({ id: 'print-custom-figure', name: config.title, duration: total, fps: config.fps, width: 1920, height: 1080, showcasePending: !config.showcase.src && !showcasePhotos, showcaseImages: showcasePhotos?.length ?? 0, narration: narration ? 'entropydrop / Qwen3-TTS' : null, assemblyDuration: assembly?.duration ?? 0, stickerImages: stickers?.imageCount ?? 0 }, null, 2) + '\n');
fs.writeFileSync(path.join(project, 'timeline.json'), JSON.stringify({ fps: config.fps, totalFrames, duration: total, narrationDuration, walkthroughDuration, showcase: { start: 0, duration: introDuration, src: config.showcase.src || null, photos: showcasePhotos }, clips, slicing, captions, outro: { start: outroStart, duration: config.outroDuration }, assembly, stickers, ending, soundtrack }, null, 2) + '\n');
const stamp = seconds => { const ms = Math.round(seconds * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const subtitles = narration ? captions : [...captions, { start: outroStart, duration: config.outroDuration, text: "Once they're printed, let's put everything together." }];
fs.writeFileSync(path.join(project, 'captions.en.srt'), subtitles.sort((a, b) => a.start - b.start).map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.start + c.duration)}\n${c.text}\n`).join('\n'));
console.log(`Built ${config.title}: ${totalFrames} frames / ${total}s at ${config.fps} fps.`);
