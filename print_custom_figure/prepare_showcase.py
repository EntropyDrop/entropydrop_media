#!/usr/bin/env python3
"""Copy original showcase photos unchanged into a frame-exact carousel."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def capture_time(path):
    with Image.open(path) as image:
        exif = image.getexif()
        camera = exif.get_ifd(34665) if 34665 in exif else {}
        date = camera.get(36867) or exif.get(306)
        fraction = str(camera.get(37521, "0"))
    if not date:
        return None
    stamp = datetime.strptime(str(date), "%Y:%m:%d %H:%M:%S")
    return stamp.replace(microsecond=int(fraction.ljust(6, "0")[:6]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "sources/showcase")
    args = parser.parse_args()
    config = json.loads((ROOT / "project.json").read_text())
    selected = config["showcase"].get("photos")
    if selected is not None:
        if not selected or len(set(selected)) != len(selected):
            raise ValueError("Showcase photos must be a nonempty list of unique filenames")
        originals = [args.source_dir / name for name in selected]
        for source in originals:
            if not source.is_file() or source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                raise ValueError(f"Invalid showcase photo: {source}")
        ordered = [(capture_time(p), p) for p in originals]
        order_description = "Explicit project.json showcase.photos order"
    else:
        originals = sorted(p for p in args.source_dir.iterdir()
                           if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
        dated = [(capture_time(p), p) for p in originals]
        if any(captured is None for captured, _ in dated):
            raise ValueError("Photos without capture dates require project.json showcase.photos order")
        ordered = sorted(dated, key=lambda item: (item[0], item[1].name))
        order_description = "EXIF DateTimeOriginal and SubSecTimeOriginal, then filename"
    if not originals:
        raise ValueError("No showcase photos found")
    retained = ROOT / "sources/showcase"
    photos = ROOT / "assets/showcase/photos"
    retained.mkdir(parents=True, exist_ok=True)
    photos.mkdir(parents=True, exist_ok=True)
    fps = config["fps"]
    frames = round(config["showcase"]["duration"] * fps)
    if len(ordered) > frames:
        raise ValueError("More photos than available showcase frames")
    entries = []
    for index, (captured, source) in enumerate(ordered):
        original = retained / source.name
        if source.resolve() != original.resolve():
            shutil.copy2(source, original)
        output = photos / f"{index + 1:03}{original.suffix.lower()}"
        with Image.open(original) as image:
            width, height = image.size
        # Preserve the original pixels, EXIF orientation, and color profile.
        # The browser handles orientation and scales only when composing frames.
        shutil.copy2(original, output)
        source_hash = sha256(original)
        image_hash = sha256(output)
        if source_hash != image_hash:
            raise ValueError(f"Showcase original was altered: {original.name}")
        start = round(index * frames / len(ordered))
        end = round((index + 1) * frames / len(ordered))
        entries.append({"source": str(original.relative_to(ROOT)), "source_sha256": source_hash,
                        "captured_at_local": captured.isoformat(timespec="milliseconds") if captured else None,
                        "image": str(output.relative_to(ROOT)), "image_sha256": image_hash,
                        "width": width, "height": height,
                        "startFrame": start, "frames": end - start,
                        "start": start / fps, "duration": (end - start) / fps})
    manifest = {"fps": fps, "frames": frames, "duration": frames / fps,
                "imageCount": len(entries), "transition": "cut", "imagePreparation": "original-byte-copy",
                "sort": order_description, "photos": entries}
    target = ROOT / config["showcase"]["manifest"]
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {len(entries)} showcase photos over {frames} frames / {frames / fps}s.")


if __name__ == "__main__":
    main()
