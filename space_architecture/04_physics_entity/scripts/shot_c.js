// Shot C: split wheels / hatch / turret into child components, show the tree links, then relative motion.
// Requires snip_prep_cd (assembled, settled, scripts stopped).
const g = window.game; const cm = g.contraptionManager; const e = window.__ent; const root = e.rootComponentId;
const all = [...e.getEntityCollisionCellKeys(root)].map(k => k.split(',').map(Number));
const pick = f => new Set(all.filter(([x, y, z]) => f(x, y, z)).map(a => a.join(',')));
const parts = [
  ['wheel_fl', 1.0, pick((x, y, z) => x >= 11 && x <= 13 && y <= 2 && z === 6)],
  ['wheel_rl', 1.9, pick((x, y, z) => x >= 4 && x <= 6 && y <= 2 && z === 6)],
  ['wheel_fr', 2.8, pick((x, y, z) => x >= 11 && x <= 13 && y <= 2 && z === 0)],
  ['wheel_rr', 3.7, pick((x, y, z) => x >= 4 && x <= 6 && y <= 2 && z === 0)],
  ['hatch', 4.7, pick((x, y, z) => x >= 10 && x <= 11 && y === 4 && z >= 2 && z <= 4)],
  ['turret', 5.8, pick((x, y, z) => x <= 6 && y >= 3)],
];
const HL = 0.55, T_LINKS = 6.9, T_MOVE = 8.4;
const st = { hl: new Set(), done: new Set(), links: false, move: false, hatchStop: false };
const P = e.position.clone();
const C = [P.x + 1.2, P.y + 0.6, P.z];
window.__shot = {
  frame(t) {
    for (const [id, t0, cells] of parts) {
      if (!st.hl.has(id) && t >= t0 - HL) { st.hl.add(id); e.setGlueSelection(root, cells); window.__track.push({ t, ev: 'hl', id }); }
      if (!st.done.has(id) && t >= t0) {
        st.done.add(id);
        cm.childSelection = { contraption: e, parentId: root, mode: 'single', cells };
        cm.createChildFromSelection(id);
        e.setGlueSelection?.(root, new Set());
        window.__track.push({ t, ev: 'split', id });
      }
    }
    if (!st.links && t >= T_LINKS) { st.links = true; window.__links = { entity: e, nodeId: root }; window.__track.push({ t, ev: 'links' }); }
    if (!st.move && t >= T_MOVE) {
      st.move = true;
      for (const w of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) e.setNodeScript(w, 'self.setLocalSpin([0, 0, 1], -45);');
      e.setNodeScript('turret', 'self.setLocalSpin([0, 1, 0], 9);');
      e.setNodeScript('hatch', 'self.setLocalSpin([0, 0, 1], 22);');
      e.setBodyType('kinematic');
      e.enableAllNodeScripts();
      window.__track.push({ t, ev: 'move' });
    }
    if (st.move && !st.hatchStop && t >= T_MOVE + 0.9) { st.hatchStop = true; e.setNodeScript('hatch', 'self.setLocalSpin([0, 0, 1], 0);'); }
  },
  cam(t) {
    const ang = 0.55 + t * 0.045;
    const dist = 17.5 - Math.min(t, 7) * 0.25;
    window.__rec.pose([C[0] + Math.sin(ang) * dist, C[1] + 7.5, C[2] + Math.cos(ang) * dist], C);
  },
};
return parts.map(p => [p[0], p[2].size]);
