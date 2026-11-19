#!/usr/bin/env python3
"""Generate the isometric 1 m block-grid SVG and inline it into index.html between ISO markers."""
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
S = 64
C30 = math.cos(math.pi / 6)
OX, OY = 430, 210


def P(x, y, z):
    return (OX + (x - y) * S * C30, OY + (x + y) * S * 0.5 - z * S)


def pts(*ps):
    return " ".join(f"{a:.1f},{b:.1f}" for a, b in ps)


def cube(x, y, z, top, left, right, stroke="rgba(0,0,0,0.55)"):
    t = [P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)]
    l = [P(x, y + 1, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x, y + 1, z)]
    r = [P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x + 1, y, z)]
    return (
        f'<polygon points="{pts(*t)}" fill="{top}" stroke="{stroke}" stroke-width="1.5"/>'
        f'<polygon points="{pts(*l)}" fill="{left}" stroke="{stroke}" stroke-width="1.5"/>'
        f'<polygon points="{pts(*r)}" fill="{right}" stroke="{stroke}" stroke-width="1.5"/>'
    )


GRASS = ("#6fae4a", "#4b7a33", "#3e6a2b")
STONE = ("#a3a3a3", "#7a7a7a", "#666666")
WOOD = ("#b8874f", "#8a6136", "#77522c")

CARVE = (4, 4, 1)
ATTACH = (1, 4, 1)
FUNC = (5, 1, 1)
house = [(2, 1, 1), (3, 1, 1), (2, 2, 1), (2, 1, 2)]

items = []
for x in range(7):
    for y in range(7):
        items.append((x, y, 0, "floor"))
for c in house:
    items.append((*c, "house"))
items.append((*ATTACH, "attach"))
items.append((*FUNC, "func"))
items.append((*CARVE, "carve"))
items.sort(key=lambda c: (c[0] + c[1] + c[2], c[2]))

out = []
for x, y, z, kind in items:
    if kind == "floor":
        out.append(cube(x, y, z, *GRASS))
    elif kind == "house":
        out.append(cube(x, y, z, *STONE))
    elif kind == "attach":
        out.append(f'<g id="iso-attach-block">{cube(x, y, z, *WOOD)}</g>')
    elif kind == "func":
        g = cube(x, y, z, "#9b2c2c", "#6e1f1f", "#5a1919")
        cx, cy = P(x + 0.5, y + 0.5, z + 1)
        g += f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="16" ry="9" fill="#ff4b3b"/>'
        # redstone dust trail on floor
        for i in range(1, 4):
            ax, ay = P(x + 0.5, y + 0.5 + i, 1)
            g += f'<ellipse cx="{ax:.1f}" cy="{ay:.1f}" rx="9" ry="5" fill="#d42a1e" opacity="0.9"/>'
        out.append(f'<g id="iso-func-block">{g}</g>')
    elif kind == "carve":
        # block subdivided into 4x4x4 parts with a notch removed
        n = 4
        sub = []
        for sx in range(n):
            for sy in range(n):
                for sz in range(n):
                    if sz >= 2 and sx >= 2 and sy < 2:
                        continue
                    if sz == 3 and sx < 1:
                        continue
                    sub.append((sx, sy, sz))
        sub.sort(key=lambda c: (c[0] + c[1] + c[2], c[2]))
        g = ""
        for sx, sy, sz in sub:
            bx, by, bz = x + sx / n, y + sy / n, z + sz / n
            t = [P(bx, by, bz + 1 / n), P(bx + 1 / n, by, bz + 1 / n), P(bx + 1 / n, by + 1 / n, bz + 1 / n), P(bx, by + 1 / n, bz + 1 / n)]
            l = [P(bx, by + 1 / n, bz + 1 / n), P(bx + 1 / n, by + 1 / n, bz + 1 / n), P(bx + 1 / n, by + 1 / n, bz), P(bx, by + 1 / n, bz)]
            r = [P(bx + 1 / n, by, bz + 1 / n), P(bx + 1 / n, by + 1 / n, bz + 1 / n), P(bx + 1 / n, by + 1 / n, bz), P(bx + 1 / n, by, bz)]
            g += (
                f'<polygon points="{pts(*t)}" fill="#e2c38c" stroke="#6b5130" stroke-width="0.8"/>'
                f'<polygon points="{pts(*l)}" fill="#b8955e" stroke="#6b5130" stroke-width="0.8"/>'
                f'<polygon points="{pts(*r)}" fill="#a07f4c" stroke="#6b5130" stroke-width="0.8"/>'
            )
        out.append(f'<g id="iso-carve-block">{g}</g>')

# Attached free-transform model: a rotated slab hovering on top of ATTACH block
ax, ay, az = ATTACH
slab3d = [(-0.15, 0.2, 1.05), (1.25, -0.1, 1.55), (1.25, 0.25, 1.75), (-0.15, 0.55, 1.25)]
slab = [P(ax + a, ay + b, az + c) for a, b, c in slab3d]
slab_side = [slab[3], slab[2], (slab[2][0], slab[2][1] + 10), (slab[3][0], slab[3][1] + 10)]
anchor = P(ax + 0.5, ay + 0.5, az + 1)
attach_model = (
    f'<g id="iso-attach-model">'
    f'<line x1="{anchor[0]:.1f}" y1="{anchor[1]:.1f}" x2="{(slab[0][0]+slab[2][0])/2:.1f}" y2="{(slab[0][1]+slab[2][1])/2:.1f}" stroke="#7dd3fc" stroke-width="2" stroke-dasharray="5 4"/>'
    f'<polygon points="{pts(*slab_side)}" fill="#3a7da0"/>'
    f'<polygon points="{pts(*slab)}" fill="#7dd3fc" stroke="#0c4a6e" stroke-width="1.5"/>'
    f"</g>"
)
out.append(attach_model)

# Amber 1 m grid overlay on the floor top faces
grid = []
for i in range(8):
    a, b = P(i, 0, 1), P(i, 7, 1)
    grid.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>')
    a, b = P(0, i, 1), P(7, i, 1)
    grid.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>')
grid_svg = f'<g id="iso-grid" stroke="#fbbf24" stroke-width="2.5" opacity="0">{"".join(grid)}</g>'

# 1 m dimension tag on a front floor edge
d0, d1 = P(6, 7, 0), P(7, 7, 0)
dim = (
    f'<g id="iso-dim" opacity="0">'
    f'<line x1="{d0[0]:.1f}" y1="{d0[1]+18:.1f}" x2="{d1[0]:.1f}" y2="{d1[1]+18:.1f}" stroke="#fbbf24" stroke-width="3"/>'
    f'<text x="{(d0[0]+d1[0])/2+6:.1f}" y="{(d0[1]+d1[1])/2+56:.1f}" fill="#fde68a" font-family="ui-monospace, Menlo, monospace" font-weight="700" font-size="28">1 m</text>'
    f"</g>"
)


def ring(id_, block, h=1.0, extra=None):
    x, y, z = block
    poly = [P(x, y, z + h), P(x + 1, y, z + h), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z), P(x, y + 1, z + h)]
    if extra:
        poly = extra
    return f'<polygon id="{id_}" points="{pts(*poly)}" fill="none" stroke="#fbbf24" stroke-width="5" stroke-linejoin="round" opacity="0" style="filter: drop-shadow(0 0 8px rgba(251,191,36,0.9))"/>'


ax0, ay0, az0 = ATTACH
attach_ring = [P(ax0 - 0.2, ay0 - 0.15, az0 + 1.85), P(ax0 + 1.35, ay0 - 0.15, az0 + 1.85), P(ax0 + 1.0, ay0, az0), P(ax0 + 1, ay0 + 1, az0), P(ax0, ay0 + 1, az0), P(ax0 - 0.2, ay0 + 0.7, az0 + 1.2)]
rings = ring("iso-ring-carve", CARVE) + ring("iso-ring-attach", ATTACH, extra=attach_ring) + ring("iso-ring-func", FUNC)


def label(id_, block, text, dx, dy, color):
    x, y, z = block
    cx, cy = P(x + 0.5, y + 0.5, z + 1)
    tx, ty = cx + dx, cy + dy
    w = 24 * len(text) + 28
    return (
        f'<g id="{id_}" opacity="0">'
        f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="{color}" stroke-width="2"/>'
        f'<rect x="{tx - w/2:.1f}" y="{ty - 24:.1f}" width="{w}" height="44" fill="rgba(0,0,0,0.86)" stroke="{color}" stroke-width="2"/>'
        f'<text x="{tx:.1f}" y="{ty + 8:.1f}" text-anchor="middle" fill="#fff" font-family="Fusion-Pixel-Zh-Hans, sans-serif" font-size="24">{text}</text>'
        f"</g>"
    )


labels = (
    label("iso-lab-carve", CARVE, "切分在方块内部", 150, 40, "#7dd3fc")
    + label("iso-lab-attach", ATTACH, "附着在方块上", -110, -130, "#7dd3fc")
    + label("iso-lab-func", FUNC, "功能方块", 140, -70, "#4ade80")
)

svg = (
    '<svg id="iso-svg" viewBox="0 0 860 720" width="860" height="720" xmlns="http://www.w3.org/2000/svg">'
    + "".join(out)
    + grid_svg
    + dim
    + rings
    + labels
    + "</svg>"
)

html_path = ROOT / "index.html"
html = html_path.read_text()
html = re.sub(r"<!--ISO-->[\s\S]*?<!--/ISO-->", lambda _m: f"<!--ISO-->{svg}<!--/ISO-->", html)
html_path.write_text(html)
print("inlined iso svg", len(svg))
