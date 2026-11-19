"""Builds assets/sfx/clack.wav (matches Space's synthesised assembly clack) and assets/com_track.js
(centre-of-mass screen positions from footage/04_ab_assemble_physics.track.json)."""
import json, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000

def sweep(kind, f0, f1, t0, t1, gain, total):
    n0, n1 = int(t0 * SR), int(t1 * SR)
    t = np.arange(n1 - n0) / SR
    dur = t1 - t0
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'square':
        w = np.sign(np.sin(ph))
    else:
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    env = np.exp(-t / (dur / 4)) * np.minimum(1, t / 0.003)
    out = np.zeros(total)
    out[n0:n1] = w * env * gain
    return out

total = int(0.3 * SR)
sig = sweep('square', 140, 50, 0, 0.15, 0.4, total) + sweep('triangle', 1200, 400, 0.06, 0.22, 0.3, total)
sig = np.clip(sig * 0.9, -1, 1)
pcm = (sig * 32767).astype('<i2')
with wave.open(str(ROOT / 'assets/sfx/clack.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

track = json.loads((ROOT / 'footage/04_ab_assemble_physics.track.json').read_text())
pts = [[round(p['t'], 3), p['x'], p['y'], p['thrust']] for p in track if 'x' in p]
(ROOT / 'assets/com_track.js').write_text('window.__COM_TRACK = ' + json.dumps(pts, separators=(',', ':')) + ';\n')
print('clack', len(pcm) / SR, 's; track pts', len(pts), 'first', pts[0], 'last', pts[-1])
