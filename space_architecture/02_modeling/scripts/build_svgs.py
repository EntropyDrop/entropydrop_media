#!/usr/bin/env python3
"""Generate the 02_modeling diagrams and inline them into index.html between
<!--NAME--> ... <!--/NAME--> markers (MICRO, SLOPE_A, SLOPE_B, CHUNK)."""
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COS30, SIN30 = math.cos(math.pi / 6), 0.5


def iso(x, y, z, s, cx, cy):
    return (cx + (x - z) * COS30 * s, cy + (x + z) * SIN30 * s - y * s)


def pts(seq):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in seq)


def micro_svg():
    n, s, cx, cy = 8, 40, 380, 300
    P = lambda x, y, z: iso(x, y, z, s, cx, cy)
    out = ['<svg id="micro-svg" viewBox="0 0 760 720" xmlns="http://www.w3.org/2000/svg">']
    faces = [
        ("top", [P(0, n, 0), P(n, n, 0), P(n, n, n), P(0, n, n)], "#7a8d6a"),
        ("left", [P(0, n, n), P(n, n, n), P(n, 0, n), P(0, 0, n)], "#4b5a42"),
        ("right", [P(n, n, 0), P(n, n, n), P(n, 0, n), P(n, 0, 0)], "#5f7053"),
    ]
    out.append('<g id="micro-block">')
    for name, poly, fill in faces:
        out.append(f'<polygon points="{pts(poly)}" fill="{fill}" stroke="#0b0f0c" stroke-width="3"/>')
    out.append("</g>")
    # 8x8 grid on each visible face
    out.append('<g id="micro-grid" stroke="rgba(56,189,248,0.85)" stroke-width="1.6" opacity="0">')
    for i in range(1, n):
        for a, b in [
            (P(i, n, 0), P(i, n, n)), (P(0, n, i), P(n, n, i)),   # top
            (P(i, n, n), P(i, 0, n)), (P(0, i, n), P(n, i, n)),   # left (z = n)
            (P(n, n, i), P(n, 0, i)), (P(n, i, 0), P(n, i, n)),   # right (x = n)
        ]:
            out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>')
    out.append("</g>")
    # one popped-out micro voxel above the front corner
    ox, oy, oz = n - 1, n + 1.6, n - 1
    Q = lambda x, y, z: P(ox + x, oy + y, oz + z)
    out.append('<g id="micro-cell" opacity="0">')
    out.append(f'<polygon points="{pts([Q(0,1,0),Q(1,1,0),Q(1,1,1),Q(0,1,1)])}" fill="#fde68a" stroke="#0b0f0c" stroke-width="2"/>')
    out.append(f'<polygon points="{pts([Q(0,1,1),Q(1,1,1),Q(1,0,1),Q(0,0,1)])}" fill="#d9a21b" stroke="#0b0f0c" stroke-width="2"/>')
    out.append(f'<polygon points="{pts([Q(1,1,0),Q(1,1,1),Q(1,0,1),Q(1,0,0)])}" fill="#fbbf24" stroke="#0b0f0c" stroke-width="2"/>')
    a, b = Q(1, 0.5, 1), P(n - 0.5, n, n - 0.5)
    out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5 5"/>')
    t = Q(1, 0.5, 0)
    out.append(f'<text x="{t[0]+34:.1f}" y="{t[1]+8:.1f}" fill="#fde68a" font-size="34">12.5 cm</text>')
    out.append("</g>")
    # 1 m dimension along the bottom-right edge
    a, b = P(n, 0, 0), P(n, 0, n)
    off = 26
    out.append('<g id="micro-dim" opacity="0">')
    out.append(f'<line x1="{a[0]+off:.1f}" y1="{a[1]+off*0.58:.1f}" x2="{b[0]+off:.1f}" y2="{b[1]+off*0.58:.1f}" stroke="#ffffff" stroke-width="3"/>')
    mx, my = (a[0] + b[0]) / 2 + off + 24, (a[1] + b[1]) / 2 + off * 0.58 + 34
    out.append(f'<text x="{mx:.1f}" y="{my:.1f}" fill="#ffffff" font-size="34">1 m</text>')
    c = P(0, 0, n)
    out.append(f'<text x="{c[0]+10:.1f}" y="{c[1]+56:.1f}" fill="#7dd3fc" font-size="30" text-anchor="middle">每边 8 等分</text>')
    out.append("</g>")
    out.append("</svg>")
    return "\n".join(out)


def slope_svg(prefix, w_cells=40, h_cells=20, c=22, pad=30):
    W, H = w_cells * c + pad * 2, h_cells * c + pad * 2 + 10
    X = lambda i: pad + i * c
    Y = lambda j: pad + (h_cells - j) * c
    k = h_cells / w_cells
    out = [f'<svg id="{prefix}-svg" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">']
    out.append(f'<rect x="{pad}" y="{pad}" width="{w_cells*c}" height="{h_cells*c}" fill="none" stroke="rgba(255,255,255,0.08)"/>')
    cells, tops = [], []
    for i in range(w_cells):
        top = 0
        for j in range(h_cells):
            if (j + 0.5) < (i + 0.5) * k:
                cells.append((i, j))
                top = j + 1
        tops.append(top)
    out.append(f'<g id="{prefix}-cells">')
    for i in range(w_cells):
        col = [f'<rect x="{X(i)+1}" y="{Y(j+1)+1}" width="{c-2}" height="{c-2}"/>' for (ii, j) in cells if ii == i]
        out.append(f'<g class="col" fill="#5f7053" stroke="#0b0f0c" stroke-width="1">{"".join(col)}</g>')
    out.append("</g>")
    path = [f"M {X(0)} {Y(0)}"]
    for i, t in enumerate(tops):
        path.append(f"L {X(i)} {Y(t)} L {X(i+1)} {Y(t)}")
    out.append(f'<path id="{prefix}-jag" d="{" ".join(path)}" fill="none" stroke="#fbbf24" stroke-width="4" opacity="0"/>')
    out.append(f'<line id="{prefix}-line" x1="{X(0)}" y1="{Y(0)}" x2="{X(w_cells)}" y2="{Y(h_cells)}" stroke="#ffffff" stroke-width="3" stroke-dasharray="10 8" opacity="0"/>')
    ang = -math.degrees(math.atan(k))
    length = math.hypot(w_cells * c, h_cells * c)
    th = c * 0.7
    out.append(
        f'<g id="{prefix}-slab" opacity="0"><rect x="{X(0)}" y="{Y(0)-th}" width="{length:.1f}" height="{th:.1f}" '
        f'fill="rgba(56,189,248,0.85)" stroke="#e0f2fe" stroke-width="2" transform="rotate({ang:.2f} {X(0)} {Y(0)})"/></g>'
    )
    out.append("</svg>")
    return "\n".join(out), len(cells)


def chunk_svg():
    n, c, ox, oy = 16, 22, 30, 30
    out = [f'<svg id="chunk-svg" viewBox="0 0 {n*c+60} {n*c+60}" xmlns="http://www.w3.org/2000/svg">']
    out.append(f'<rect x="{ox}" y="{oy}" width="{n*c}" height="{n*c}" fill="rgba(95,112,83,0.55)"/>')
    for i in range(1, n):
        out.append(f'<line x1="{ox+i*c}" y1="{oy}" x2="{ox+i*c}" y2="{oy+n*c}" stroke="rgba(255,255,255,0.14)"/>')
        out.append(f'<line x1="{ox}" y1="{oy+i*c}" x2="{ox+n*c}" y2="{oy+i*c}" stroke="rgba(255,255,255,0.14)"/>')
    out.append(f'<rect id="chunk-border" x="{ox}" y="{oy}" width="{n*c}" height="{n*c}" fill="none" stroke="#fbbf24" stroke-width="4"/>')
    ax, ay = ox + 6 * c, oy + 9 * c
    out.append(f'<rect id="chunk-anchor" x="{ax}" y="{ay}" width="{c}" height="{c}" fill="#e5e7eb" stroke="#000" stroke-width="2"/>')
    cx, cy = ax + c / 2, ay + c / 2
    out.append(
        f'<g id="chunk-deco" opacity="0"><line x1="{cx}" y1="{cy}" x2="{cx+70}" y2="{cy-62}" stroke="#7dd3fc" stroke-width="2" stroke-dasharray="4 4"/>'
        f'<rect x="{cx+30}" y="{cy-80}" width="120" height="26" fill="rgba(56,189,248,0.9)" stroke="#e0f2fe" stroke-width="2" transform="rotate(-24 {cx+90} {cy-67})"/></g>'
    )
    out.append("</svg>")
    return "\n".join(out)


def inline(html, name, svg):
    pat = re.compile(rf"<!--{name}-->.*?<!--/{name}-->", re.S)
    assert pat.search(html), name
    return pat.sub(lambda _: f"<!--{name}-->\n{svg}\n<!--/{name}-->", html)


if __name__ == "__main__":
    p = ROOT / "index.html"
    html = p.read_text()
    html = inline(html, "MICRO", micro_svg())
    sa, n = slope_svg("sa")
    sb, _ = slope_svg("sb", w_cells=24, h_cells=12, c=26)
    html = inline(html, "SLOPE_A", sa)
    html = inline(html, "SLOPE_B", sb)
    html = inline(html, "CHUNK", chunk_svg())
    p.write_text(html)
    print("cells in slope A section:", n)
