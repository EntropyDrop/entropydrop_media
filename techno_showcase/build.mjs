import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const edit = JSON.parse(fs.readFileSync(path.join(root, 'assembly-edit.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/assembly/manifest.json'), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
if (manifest.edit_sha256 !== hash('assembly-edit.json')) throw new Error('Run npm run render to rebuild the edited footage.');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timing = (start, duration, track) => `data-start="${start}" data-duration="${duration}" data-track-index="${track}"`;
const total = manifest.duration;
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>${esc(edit.title)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><style>${fs.readFileSync(path.join(root, 'template.css'), 'utf8')}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${manifest.showcase.photos.map((photo, i) => `<img id="showcase-${i + 1}" class="clip showcase-photo" src="${esc(photo.image)}" alt="Techno figure ${i + 1}" ${timing(photo.start, photo.duration, 10 + i)}>`).join('\n')}
<video id="installation" class="clip footage" src="${manifest.video}" ${timing(manifest.montage_start, manifest.montage_duration, 0)} data-media-start="0" data-volume="0" muted playsinline preload="auto"></video>
<img id="ending" class="clip ending" src="assets/graphics/ending.png" alt="Finished Techno figure in a front three-quarter standing pose" ${timing(manifest.ending.start, manifest.ending.duration, 2)}>
<audio id="music" class="clip music" src="${manifest.music}" ${timing(0, total, 3)} data-media-start="0" data-volume="1" preload="auto"></audio>
</div><script>
const tl = gsap.timeline({paused:true});
document.querySelectorAll('.clip').forEach(element => {
  const start = Number(element.dataset.start);
  const end = start + Number(element.dataset.duration);
  tl.set(element, {visibility:'hidden'}, 0);
  tl.set(element, {visibility:'visible'}, start);
  tl.set(element, {visibility:'hidden'}, end);
});
window.__timelines = window.__timelines || {};
window.__timelines.main = tl;
</script></body></html>\n`;
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'meta.json'), JSON.stringify({id:'techno-showcase', name:edit.title,
  duration:total, fps:manifest.fps, width:1920, height:1080, shots:manifest.shots.length,
  showcaseImages:manifest.showcase.imageCount, showcaseDuration:manifest.showcase.duration, narration:null}, null, 2)+'\n');
fs.writeFileSync(path.join(root, 'timeline.json'), JSON.stringify(manifest, null, 2)+'\n');
const stamp = seconds => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
fs.writeFileSync(path.join(root, 'captions.en.srt'), manifest.shots.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(s.start+s.duration)}\n${s.label}\n`).join('\n'));
console.log(`Built Hyperframes preview: ${total}s / ${manifest.shots.length} shots.`);
