#!/usr/bin/env python3
"""Create a chronological hard-cut photo sequence using the configured hold time."""
import json
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

from build_assembly import ffmpeg, sha256, synthesize

ROOT = Path(__file__).resolve().parent


def capture_time(path):
    with Image.open(path) as image:
        exif = image.getexif()
        camera = exif.get_ifd(34665) if 34665 in exif else {}
        date = camera.get(36867) or exif.get(306)
        subsecond = str(camera.get(37521, "0"))
    if not date:
        raise ValueError(f"Missing capture date: {path.name}")
    stamp = datetime.strptime(str(date), "%Y:%m:%d %H:%M:%S")
    stamp = stamp.replace(microsecond=int(subsecond.ljust(6, "0")[:6]))
    return stamp


def main():
    edit_path = ROOT / "stickers-edit.json"
    edit = json.loads(edit_path.read_text())
    fps = edit["fps"]
    hold = round(edit["secondsPerImage"] * fps)
    if abs(hold / fps - edit["secondsPerImage"]) > 1e-8 or edit["transition"] != "cut":
        raise ValueError("Photo timing must use whole frames and hard cuts.")
    originals = [p for p in (ROOT / edit["sourceDirectory"]).iterdir()
                 if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    ordered = sorted(((capture_time(p), p) for p in originals), key=lambda pair: (pair[0], pair[1].name))
    if not ordered:
        raise ValueError("No sticker photos found")
    photos = ROOT / "assets/stickers/photos"
    photos.mkdir(parents=True, exist_ok=True)
    work = ROOT / "renders/stickers-work"
    work.mkdir(parents=True, exist_ok=True)
    entries = []
    for index, (captured, original) in enumerate(ordered):
        target = photos / f"{index+1:03}.jpg"
        with Image.open(original) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1440, 1080), Image.Resampling.LANCZOS)
            # Keep the entire photograph and its aspect ratio, without camera moves.
            canvas = Image.new("RGB", (1440, 1080), "#ecefeb")
            canvas.paste(image, ((1440-image.width)//2, (1080-image.height)//2))
            canvas.save(target, quality=97, subsampling=0)
        entries.append({"source": str(original.relative_to(ROOT)), "source_sha256": sha256(original),
                        "captured_at_local": captured.isoformat(timespec="milliseconds"),
                        "image": str(target.relative_to(ROOT)), "start": index*hold/fps,
                        "duration": hold/fps, "frames": hold})
    frame_count = len(entries)*hold
    duration = frame_count/fps
    ffmpeg("-framerate", f"{fps}/{hold}", "-start_number", 1,
           "-i", photos / "%03d.jpg", "-vf", f"fps={fps},format=yuv420p,setsar=1",
           "-frames:v", frame_count, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", 18,
           "-g", hold, "-keyint_min", hold, "-sc_threshold", 0,
           "-movflags", "+faststart", ROOT / edit["video"])
    assembly_path = ROOT / edit["assemblyManifest"]
    assembly = json.loads(assembly_path.read_text())
    # Generate one continuous score so the original assembly beat accents stay
    # fixed and its ending fade moves to the end of the photo sequence.
    music_duration = assembly["duration"] + duration
    synthesize(ROOT / edit["music"], music_duration, assembly["bpm"], assembly["beat_accents"], work)
    manifest = {"fps": fps, "imageCount": len(entries), "secondsPerImage": hold/fps,
                "frames": frame_count, "duration": duration, "transition": "cut",
                "sort": "EXIF DateTimeOriginal and SubSecTimeOriginal, then filename",
                "edit_sha256": sha256(edit_path), "video": edit["video"],
                "video_sha256": sha256(ROOT / edit["video"]), "photos": entries,
                "assembly_manifest_sha256": sha256(assembly_path),
                "music": edit["music"], "music_sha256": sha256(ROOT / edit["music"]),
                "musicDuration": music_duration}
    (ROOT / "assets/stickers/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    ffmpeg("-i", ROOT / edit["video"], "-ss", assembly["duration"], "-i", ROOT / edit["music"],
           "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
           "-t", duration, "-movflags", "+faststart", ROOT / "renders/sticker-installation.mp4")
    print(f"Built {len(entries)} photos × {hold} frames = {frame_count} frames / {duration}s; hard cuts only.")


if __name__ == "__main__":
    main()
