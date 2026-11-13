#!/usr/bin/env python3
"""Keep the originals locally and make browser-friendly, real-time 30 fps proxies."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

PROJECT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", type=Path, default=Path.home() / "Downloads")
parser.add_argument("--force", action="store_true", help="Reconvert the retained originals")
parser.add_argument("--only", help="Comma-separated source filenames to convert, e.g. 3dp1.mov")
args = parser.parse_args()
config = json.loads((PROJECT / "project.json").read_text())
known_sources = {clip["source"] for clip in config["clips"]}
selected = set(args.only.split(",")) if args.only else known_sources
if selected - known_sources:
    parser.error(f"Unknown sources: {', '.join(sorted(selected - known_sources))}")
(PROJECT / "sources").mkdir(exist_ok=True)
(PROJECT / "assets").mkdir(exist_ok=True)
manifest = []
for clip in config["clips"]:
    original = PROJECT / "sources" / clip["source"]
    output = PROJECT / clip["src"]
    if not original.exists():
        shutil.copy2(args.source_dir / clip["source"], original)
    crop = {edge: 0 for edge in ("left", "top", "right", "bottom")}
    configured_crop = clip.get("cropPixels", {})
    if not isinstance(configured_crop, dict) or set(configured_crop) - set(crop):
        raise ValueError("cropPixels must specify left, top, right, or bottom")
    crop.update(configured_crop)
    if any(not isinstance(value, int) or value < 0 for value in crop.values()):
        raise ValueError("Crop values must be nonnegative integers")
    filters = [f"fps={config['fps']}", "scale=1920:-2:flags=lanczos"]
    if any(crop.values()):
        # Measure the edge trim at the same 1920-pixel scale as the existing
        # proxy, allowing the wider right window border to be removed separately.
        filters.append(f"crop=iw-{crop['left']+crop['right']}:ih-{crop['top']+crop['bottom']}:{crop['left']}:{crop['top']}:exact=1")
    filters.append("setsar=1")
    if clip["source"] in selected and (args.force or not output.exists()):
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(original),
            "-map", "0:v:0", "-an", "-vf", ",".join(filters),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-g", str(config["fps"]), "-keyint_min", str(config["fps"]), "-sc_threshold", "0",
            "-movflags", "+faststart", str(output),
        ], check=True)
    metadata = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type,r_frame_rate",
        "-of", "json", str(original)
    ]))
    digest = hashlib.sha256()
    with original.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    manifest.append({"original": f"sources/{clip['source']}", "proxy": clip["src"],
                     "sha256": digest.hexdigest(),
                     "crop_pixels_at_1920_width": crop,
                     "metadata": metadata})
    print(f"Ready: {clip['src']}", flush=True)
(PROJECT / "assets" / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n")
