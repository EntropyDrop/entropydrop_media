// Assemble the selected vehicle off-camera, let it settle on the pad, then freeze it for editing.
const g = window.game; const cm = g.contraptionManager; const rec = window.__rec;
const n0 = cm.contraptions.length;
g.controller.assembleSelection();
for (let i = 0; i < 120 && cm.contraptions.length === n0; i++) await rec.advance(1);
const e = cm.contraptions[cm.contraptions.length - 1];
window.__ent = e;
e.setBodyType('dynamic');
e.enableAllNodeScripts();
await rec.advance(60);
e.stopAllNodeScripts();
await rec.advance(5);
return { n: cm.contraptions.length, pos: e.position.toArray(), edit: e.canEditInternalSelection?.(), type: e.bodyType };
