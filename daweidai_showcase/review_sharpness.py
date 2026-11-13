#!/usr/bin/env python3
"""Compare identically timed pixels from the original and enhanced exports."""
import json
import subprocess

from PIL import Image, ImageDraw, ImageFont

from build_video import ROOT, ffmpeg, sha256
from check_media import audio_hash

BACKUP = ROOT / "renders/revisions/before-sharpness-v1"


def frame_hash(path, time):
    return subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", str(time), "-i", str(path),
        "-map", "0:v:0", "-frames:v", "1", "-pix_fmt", "yuv420p",
        "-c:v", "rawvideo", "-f", "hash", "-hash", "sha256", "-"
    ], text=True).strip()


def main():
    folder = ROOT / "review/sharpness"
    folder.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 17)
    report = {}
    for variant in ("landscape", "portrait"):
        current = json.loads((ROOT / f"renders/{variant}-manifest.json").read_text())
        previous = json.loads((BACKUP / f"{variant}-manifest.json").read_text())
        assert current["enhancement"]["id"] == "sharpness-v1"
        before = BACKUP / f"daweidai-showcase-{variant}.mp4"
        after = ROOT / current["render"]
        assert sha256(before) == previous["render_sha256"]
        assert sha256(after) == current["render_sha256"]
        tail_frames = sum(shot["frames"] for shot in current["scenes"] if shot.get("type") == "turntable")
        assert current["frames"] == previous["frames"] + tail_frames
        assert current["source_sha256"] == previous["source_sha256"]
        same_audio = audio_hash(before) == audio_hash(after)
        if not tail_frames:
            assert current["music"] == previous["music"] and same_audio
        retouched = []
        for old, new in zip(previous["scenes"], current["scenes"]):
            allowed = {"render_image", "render_image_sha256"} if "image" in old else set()
            assert all(new[key] == value for key, value in old.items() if key not in allowed)
            if "image" in old:
                if new["render_image_sha256"] != old["render_image_sha256"]:
                    assert new.get(f"{variant}Image") == new["render_image"]
                    retouched.append(new["id"])
                else:
                    time = old["start"] + old["duration"] / 2
                    assert frame_hash(before, time) == frame_hash(after, time), old["id"]
        # Use 1:1 export pixels; a resized contact sheet would hide sharpening halos.
        sheet = Image.new("RGB", (1000, 1100), "#eeeeee")
        draw = ImageDraw.Draw(sheet)
        for row, shot_id in enumerate(("10_torso_side", "22_finished")):
            shot = next(s for s in current["scenes"] if s["id"] == shot_id)
            time = shot["start"] + shot["duration"] / 2
            cx, cy = (1020, 450) if variant == "landscape" else (540, 830)
            if shot_id == "22_finished":
                cy = 500 if variant == "landscape" else 900
            for col, (label, source) in enumerate((("Before", before), ("After", after))):
                path = folder / f"{variant}-{shot_id}-{label.lower()}-export.png"
                ffmpeg("-ss", time, "-i", source, "-frames:v", 1, "-threads", 1, path)
                with Image.open(path) as picture:
                    sheet.paste(picture.crop((cx - 250, cy - 250, cx + 250, cy + 250)),
                                (col * 500, row * 550 + 45))
                draw.text((col * 500 + 10, row * 550 + 12),
                          f"{label} | {shot_id}", fill="black", font=font)
        comparison = folder / f"{variant}-before-after.png"
        sheet.save(comparison)
        report[variant] = dict(before_sha256=previous["render_sha256"],
                               after_sha256=current["render_sha256"],
                               frames=current["frames"],
                               audio_unchanged=same_audio, photos_pixel_identical=not retouched,
                               retouched_photo_ids=retouched,
                               appended_frames=tail_frames,
                               comparison=str(comparison.relative_to(ROOT)))
        print(f"PASS {variant}: original shots matched, {len(retouched)} color-retouched photo scenes; {comparison}", flush=True)
    (folder / "verification.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
