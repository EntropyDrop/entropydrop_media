// Box-select the vehicle in terrain (world selection) and show it.
const r = window.__rec; const g = r.g; const S = window.__scene; const cm = g.contraptionManager;
cm.clearSelection();
cm.setCornerA({ x: S.VX - 3, y: S.T, z: S.VZ });
cm.setCornerB({ x: S.VX + 12, y: S.T + 4, z: S.VZ + 6 });
g.controller.setActiveTool?.(window.__SELECTOR ?? g.controller.activeTool);
return { valid: cm.hasValidSelection(), count: cm.getSelectionBlockCount(), bounds: cm.getSelectionBounds(), tool: g.controller.activeTool };
