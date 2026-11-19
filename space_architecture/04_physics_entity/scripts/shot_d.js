// Shot D: split the nose hub, add propeller blades as decorations one by one, then spin it with a script.
// Run right after shot C in the same world.
const g = window.game; const cm = g.contraptionManager; const e = window.__ent; const root = e.rootComponentId;
const all = [...e.getEntityCollisionCellKeys(root)].map(k => k.split(',').map(Number));
const hubCells = new Set(all.filter(([x]) => x === 15).map(a => a.join(',')));
const Cn = [15.5, 2.5, 3.5];
const q = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const decos = [{ id: 'spinner', color: 0xfbbf24, position: [Cn[0] + 0.65, Cn[1], Cn[2]], scale: [0.45, 0.55, 0.55] }];
const blades = [];
for (let i = 0; i < 4; i++) {
  const a = i * Math.PI / 2, r = 1.3;
  const n = mul(q([1, 0, 0], a), q([0, 1, 0], 0.35)); const L = Math.hypot(...n);
  blades.push({ id: 'blade' + i, color: 0xe8e4da, position: [Cn[0] + 0.6, Cn[1] + Math.cos(a) * r, Cn[2] + Math.sin(a) * r], scale: [0.14, 1.9, 0.55], rotation: n.map(v => v / L) });
}
const T_HL = 0.6, T_SPLIT = 1.3, T_BLADES = [3.0, 3.6, 4.2, 4.8], T_SPIN = 6.2;
const st = { stop: false, hl: false, split: false, nb: 0, spin: false };
const P = e.position.clone();
const C = [P.x + 4.2, P.y + 0.2, P.z];
window.__shot = {
  frame(t) {
    if (!st.stop) { st.stop = true; e.stopAllNodeScripts(); window.__links = null; }
    if (!st.hl && t >= T_HL) { st.hl = true; e.setGlueSelection(root, hubCells); window.__track.push({ t, ev: 'hl', id: 'hub' }); }
    if (!st.split && t >= T_SPLIT) {
      st.split = true;
      cm.childSelection = { contraption: e, parentId: root, mode: 'single', cells: hubCells };
      cm.createChildFromSelection('hub');
      e.setGlueSelection?.(root, new Set());
      window.__links = { entity: e, nodeId: root };
      window.__track.push({ t, ev: 'split', id: 'hub' });
    }
    while (st.nb < 4 && t >= T_BLADES[st.nb]) {
      st.nb++;
      e.setComponentDecorations('hub', decos.concat(blades.slice(0, st.nb)));
      window.__track.push({ t, ev: 'blade', n: st.nb });
    }
    if (!st.spin && t >= T_SPIN) {
      st.spin = true; window.__links = null;
      e.setNodeScript('hub', 'self.setLocalSpin([1, 0, 0], 70);');
      e.setBodyType('kinematic');
      e.enableAllNodeScripts();
      window.__track.push({ t, ev: 'spin' });
    }
  },
  cam(t) {
    const ang = 1.05 + t * 0.03;
    const dist = 13 - Math.min(t, 6) * 0.35;
    window.__rec.pose([C[0] + Math.sin(ang) * dist, C[1] + 3.6, C[2] + Math.cos(ang) * dist], C);
  },
};
return hubCells.size;
