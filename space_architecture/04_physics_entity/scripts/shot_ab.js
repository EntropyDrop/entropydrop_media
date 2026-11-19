// Shot AB: world selection -> assemble -> slide down ramp -> upward thrust wobble.
// Requires snip_setup + snip_build + snip_select applied in a fresh world.
const g = window.game; const cm = g.contraptionManager; const S = window.__scene;
const GRAV = Math.abs(g.contraptionPhysics?.gravity?.y || 18);
const T_ASM = 4.2, T_PUSH = 5.0, T_PUSH_END = 6.2, T_THRUST = 11.5, T_THRUST_END = 15.5;
const st = { e: null, camT: null, camP: null };
const center = [S.VX + 4.5, S.T + 2, S.VZ + 3.5];
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
window.__thrustOn = false;

function hook(e) {
  e.__origUpdate = e.update;
  e.update = function (...a) {
    const r = e.__origUpdate.apply(this, a);
    const t = window.__shotT;
    const id = e.rootComponentId;
    const m = e.getNodeBodyMass(id);
    if (t >= T_PUSH && t < T_PUSH_END) e.applyNodeBodyForce(id, [m * 9, 0, 0]);
    if (t >= T_THRUST && t < T_THRUST_END) {
      const k = Math.min(1, (t - T_THRUST) / 0.5);
      const lift = (t - T_THRUST) < 1.0 ? 1.22 : 0.985;
      e.applyNodeBodyForce(id, [0, m * GRAV * lift * k, 0]);
      const w = 2 * Math.PI * 0.7 * (t - T_THRUST);
      const A = m * 120 * k;
      e.applyNodeBodyTorque(id, [A * Math.sin(w), 0, A * Math.cos(w * 1.3) * 1.4]);
    }
    return r;
  };
}

window.__shot = {
  frame(t) {
    window.__shotT = t;
    if (!st.asm && t >= T_ASM) {
      st.asm = true; st.n0 = cm.contraptions.length;
      g.controller.assembleSelection();
    }
    if (st.asm && !st.e && cm.contraptions.length > st.n0) {
      const e = cm.contraptions[cm.contraptions.length - 1];
      st.e = e; window.__ent = e;
      e.setBodyType('dynamic');
      e.setNodeBodyMaterial(e.rootComponentId, { friction: 0.1, restitution: 0.05 });
      e.getRigidBody(e.rootComponentId).linearDamping = 0.995;
      e.enableAllNodeScripts();
      hook(e);
      window.__track.push({ t, ev: 'assemble' });
    }
    window.__thrustOn = t >= T_THRUST && t < T_THRUST_END;
  },
  cam(t) {
    const e = st.e;
    const p = e ? e.rootGroup.position.toArray() : center;
    const tgt = e ? [p[0] + 1.5, p[1] - 0.6, p[2]] : [center[0] + 1.5, center[1] - 0.6, center[2]];
    st.camT = st.camT ? lerp(st.camT, tgt, 0.08) : tgt;
    const ang = 0.15 + Math.min(t, 16) * 0.025;
    const dist = 23 - Math.min(t, 4) * 0.5 + Math.max(0, Math.min(t - 6, 6)) * 0.5;
    const cp = [st.camT[0] + Math.sin(ang) * dist, st.camT[1] + 7.2, st.camT[2] + Math.cos(ang) * dist];
    st.camP = st.camP ? lerp(st.camP, cp, 0.1) : cp;
    window.__rec.pose(st.camP, st.camT);
  },
  afterCam(t) {
    const e = st.e; if (!e) return;
    const cam = g.controller.camera;
    cam.updateMatrixWorld();
    const body = e.getRigidBody(e.rootComponentId);
    e.rootGroup.updateMatrixWorld(true);
    const com = e.rootGroup.localToWorld(body.centerOfMassLocal.clone());
    const v = com.clone().project(cam);
    const q = e.rootGroup.quaternion;
    window.__track.push({ t: +t.toFixed(4), x: +((v.x + 1) / 2 * 1920).toFixed(1), y: +((1 - v.y) / 2 * 1080).toFixed(1),
      thrust: window.__thrustOn ? 1 : 0, q: [q.x, q.y, q.z, q.w].map(n => +n.toFixed(4)) });
  },
};
return 'ok';
