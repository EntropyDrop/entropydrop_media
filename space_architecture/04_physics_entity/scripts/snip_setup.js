// Cinema setup: hide HUD, fixed camera hook, helpers on window.__rec
const g = window.game;
if (window.__rec) return 'already';
const Vec3 = g.playerPhysics.position.constructor;
g.uiStore.startGame(false);
g.uiStore.setLightingQuality('ultra', false);
g.uiStore.setShadowsEnabled(true, false);
g.uiStore.setResolutionScale(1, false);
g.uiStore.setRenderDistance(12, false);
g.controller.setPerspective('first_person', false);
const render = g.sceneRenderer;
const origAvatarVis = render.setPlayerAvatarVisible.bind(render);
origAvatarVis(false, false);
render.setPlayerAvatarVisible = () => origAvatarVis(false, false);
render.renderer.toneMappingExposure = 1.15;
if (render.sunLight?.shadow) {
  const sh = render.sunLight.shadow;
  sh.camera.left = sh.camera.bottom = -60;
  sh.camera.right = sh.camera.top = 60;
  sh.camera.updateProjectionMatrix();
  sh.needsUpdate = true;
}
const style = document.createElement('style');
style.textContent = `html, body { cursor: none !important; overflow: hidden !important; }
  .entity-nameplate, #dev-render-diagnostics, #dev-frame-profiler { display: none !important; }`;
document.head.appendChild(style);
const canvas = render.renderer.domElement;
let cur = canvas;
while (cur && cur !== document.body) {
  if (cur.parentElement) for (const sib of cur.parentElement.children) {
    if (sib !== cur && sib.tagName !== 'STYLE' && sib.tagName !== 'SCRIPT') sib.style.display = 'none';
  }
  cur = cur.parentElement;
}
g.controller.setFov(50);
if (render.cursorMesh) Object.defineProperty(render.cursorMesh, 'visible', { get: () => false, set: () => {} });
let fixedCam = null;
window.__spaceCamHook = null;
const origUpdateCam = g.controller.updateCameraPosition.bind(g.controller);
g.controller.updateCameraPosition = () => {
  if (window.__spaceCamHook) window.__spaceCamHook();
  if (fixedCam) {
    const c = g.controller.camera;
    c.position.set(...fixedCam.pos);
    c.up.set(0, 1, 0);
    c.lookAt(...fixedCam.target);
    c.updateMatrixWorld();
  } else origUpdateCam();
};
const pose = (pos, target) => {
  fixedCam = { pos, target };
  const pp = g.playerPhysics;
  pp.isFlying = true;
  pp.position.set(pos[0], pos[1], pos[2]);
  pp.previousPosition.set(pos[0], pos[1], pos[2]);
  pp.renderSimulationPosition.set(pos[0], pos[1], pos[2]);
  pp.velocity.set(0, 0, 0);
};
const groundY = (x, z) => {
  for (let y = 180; y >= -20; y--) if (g.world.getBlock(Math.floor(x), y, Math.floor(z))) return y + 1;
  return 20;
};
const setB = (x, y, z, color, materialId = 0) => g.world.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), 1, true, color, materialId);
const clearB = (x, y, z) => g.world.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), 0, true);
// Hierarchy links: override controller driver so we choose what to show
window.__links = null;
g.controller.updateComponentHierarchyLinks = () => {
  const l = window.__links;
  render.setComponentHierarchyLinks?.(l ? l.entity : null, l?.nodeId, { animateChildren: true });
};
window.__rec = { g, Vec3, pose, groundY, setB, clearB };
return { pos: g.playerPhysics.position.toArray() };
