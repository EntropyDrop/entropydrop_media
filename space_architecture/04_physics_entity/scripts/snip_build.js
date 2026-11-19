// Build pad + smooth micro ramp + vehicle out of terrain blocks.
const r = window.__rec; const g = r.g;
const BX = 5372, BZ = 812;              // pad origin (min corner)
let base = 0;
for (let x = BX - 2; x <= BX + 26; x += 2) for (let z = BZ - 2; z <= BZ + 10; z += 2) base = Math.max(base, r.groundY(x, z));
const T = base + 4;                      // pad top surface y (first air layer)
const PAD_LEN = 17, W = 11, RAMP = 14;    // x-extent of pad, z-width, ramp length (along +x)
const pad = (x, z) => ((x + z) % 2 ? 0x59636b : 0x4c555c);
for (let x = BX; x < BX + PAD_LEN; x++) for (let z = BZ; z < BZ + W; z++) {
  for (let y = base - 3; y < T; y++) r.setB(x, y, z, (z === BZ || z === BZ + W - 1) && y === T - 1 ? (x % 2 ? 0xf2a93b : 0x2a2f33) : pad(x, z));
  for (let y = T; y < T + 12; y++) r.clearB(x, y, z);
}
// ramp: surface height drops linearly from 4 m to 0 over RAMP metres (micro steps of 1/8 m)
const D = 8; let micros = 0;
const hAt = (i) => Math.round(4 * (1 - (i + 0.5) / (RAMP * D)) * D);
for (let c = 0; c < RAMP; c++) {
  const wx = BX + PAD_LEN + c;
  const minFull = Math.floor(hAt(c * D + D - 1) / D);
  for (let z = BZ; z < BZ + W; z++) {
    for (let y = base - 3; y < base + minFull; y++) r.setB(wx, y, z, 0x4c555c);
    for (let y = base + minFull; y < base + 10; y++) r.clearB(wx, y, z);
  }
  for (let k = 0; k < D; k++) {
    const i = c * D + k, mx = wx * D + k, hM = hAt(i);
    for (let mz = BZ * D; mz < (BZ + W) * D; mz++) {
      const edge = mz < BZ * D + 4 || mz >= (BZ + W) * D - 4;
      for (let my = (base + minFull) * D; my < base * D + hM; my++) if (g.world.setMicroBlock(mx, my, mz, edge ? 0xf2a93b : 0x6b757c)) micros++;
    }
  }
}
// vehicle on the pad (front = +x, toward the ramp)
const VX = BX + 3, VZ = BZ + 2;
const V = [];
const put = (dx, dy, dz, c, m = 0) => { r.setB(VX + dx, T + dy, VZ + dz, c, m); V.push([dx, dy, dz, c]); };
const BODY = 0x2f8f7e, BODY2 = 0xe8efe9, WHEEL = 0x1d2124, RIM = 0x9aa4aa, HATCH = 0xf28c28, TUR = 0x50606a, GLASS = 0x9fd8f0;
for (const cx of [2, 9]) for (const wz of [0, 6]) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 2; dy++) {
  if (dx !== 0 && dy !== 1) continue;
  put(cx + dx, dy, wz, dx === 0 && dy === 1 ? RIM : WHEEL);
}
for (let dx = 0; dx <= 11; dx++) for (let dz = 1; dz <= 5; dz++) { put(dx, 1, dz, BODY); put(dx, 2, dz, dz === 1 || dz === 5 ? BODY2 : BODY); }
for (let dx = 6; dx <= 10; dx++) for (let dz = 1; dz <= 5; dz++) put(dx, 3, dz, dx === 10 ? GLASS : BODY);
for (let dx = 6; dx <= 10; dx++) for (let dz = 1; dz <= 5; dz++) put(dx, 4, dz, (dx >= 7 && dx <= 8 && dz >= 2 && dz <= 4) ? HATCH : BODY2);
for (let dx = 1; dx <= 3; dx++) for (let dz = 2; dz <= 4; dz++) { put(dx, 3, dz, TUR); if (dx === 2 || dz === 3) put(dx, 4, dz, TUR); }
for (let dx = -3; dx <= 0; dx++) put(dx, 4, 3, 0x3a454c);
put(12, 2, 3, 0xd7dde0); // nose hub
window.__scene = { BX, BZ, T, base, PAD_LEN, W, RAMP, VX, VZ, V };
r.pose([VX + 6 + 15, T + 8, VZ + 3 + 16], [VX + 6, T + 1.5, VZ + 3]);
return { base, T, micros, blocks: V.length };
