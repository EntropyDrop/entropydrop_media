#!/usr/bin/env python3
"""Check the rendered media, source provenance, framing and timing."""
import argparse
import json
import subprocess
import wave

from build_video import ROOT, EDIT, enhancement, framing, probe, sha256, timeline, validate_scenes
from edit_timeline import resolve_edit


def audio_hash(path):
    return subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
        "-c:a", "copy", "-f", "hash", "-hash", "sha256", "-"
    ], text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=("landscape", "portrait"))
    args = parser.parse_args()
    base = json.loads(EDIT.read_text())
    source = ROOT / base["source"]
    source_hash = sha256(source)
    source_duration = float(probe(source)["format"]["duration"])
    for variant in ([args.format] if args.format else base["formats"]):
        edit = resolve_edit(base, variant)
        scenes, duration, frames = timeline(edit)
        validate_scenes(edit, scenes, source_duration)
        manifest = json.loads((ROOT / f"renders/{variant}-manifest.json").read_text())
        output = ROOT / manifest["render"]
        target = edit["formats"][variant]
        assert manifest["source_sha256"] == source_hash, "Source changed"
        assert manifest["edit_sha256"] == sha256(EDIT), "Edit changed after rendering"
        assert manifest["render_sha256"] == sha256(output), "Export changed"
        assert (manifest["duration"], manifest["frames"]) == (duration, frames)
        assert len(manifest["scenes"]) == len(scenes)
        assert manifest.get("enhancement") == edit.get("enhancement"), "Enhancement config changed"
        if "photo_color_manifest_sha256" in manifest:
            color_manifest = ROOT / "photo-color-match.json"
            assert manifest["photo_color_manifest_sha256"] == sha256(color_manifest)
            colors = json.loads(color_manifest.read_text())
            assert colors["reference"]["sha256"] == sha256(ROOT / colors["reference"]["image"])
            for photo in colors["photos"]:
                assert photo["source_sha256"] == sha256(ROOT / photo["source"])
                assert photo["sha256"] == sha256(ROOT / photo["image"])
        turntable = [shot for shot in scenes if shot.get("type") == "turntable"]
        if turntable:
            assert len(turntable) == 1 and scenes[-1]["id"] == turntable[0]["id"]
            saved = manifest["turntable"]
            settings = json.loads((ROOT / "turntable-edit.json").read_text())
            assert saved["signature"]["config"] == settings
            assert saved["signature"]["source_sha256"] == sha256(ROOT / settings["source"])
            assert saved["signature"]["generator_sha256"] == sha256(ROOT / "build_turntable.py")
            assert saved["duration"] == turntable[0]["duration"] == 8
            assert saved["targetDegreesPerSecond"] == 45
            clip = saved["formats"][variant]
            assert clip["sha256"] == sha256(ROOT / clip["path"])
            assert clip["frames"] == 240
            for frame in clip["framing"]:
                x, y, w, h = frame["bbox"]
                assert 0 <= x <= clip["width"] - w and 0 <= y <= clip["height"] - h
                assert max(abs(error) for error in frame["centerError"]) < 12
        for shot, saved in zip(scenes, manifest["scenes"]):
            assert all(saved[key] == value for key, value in shot.items()), shot["id"]
            assert saved["framing"] == framing(edit, shot, variant), shot["id"]
            assert saved.get("enhancement") == enhancement(edit, shot, variant), shot["id"]
            if "image" in shot:
                assert saved["original_image_sha256"] == sha256(ROOT / shot["image"])
                assert saved["render_image_sha256"] == sha256(ROOT / saved["render_image"])
            if shot.get("comparison"):
                assert saved["comparison_image_sha256"] == sha256(ROOT / shot["comparison"]["image"])
                assert saved["comparison_generator_sha256"] == sha256(ROOT / "opening_comparison.py")
        metadata = probe(output)
        video = next(s for s in metadata["streams"] if s["codec_type"] == "video")
        audio = next(s for s in metadata["streams"] if s["codec_type"] == "audio")
        assert (video["width"], video["height"]) == (target["width"], target["height"])
        assert video["codec_name"] == "h264" and video["pix_fmt"] == "yuv420p"
        assert video["avg_frame_rate"] == "30/1" and int(video["nb_frames"]) == frames
        assert video["sample_aspect_ratio"] == "1:1" and video["color_space"] == "bt709"
        assert abs(float(video["duration"]) - duration) < 1 / edit["fps"]
        assert float(video["start_time"]) == 0 and float(audio["start_time"]) == 0
        assert audio["codec_name"] == "aac" and int(audio["sample_rate"]) == 48000
        assert audio["channels"] == 2 and abs(float(audio["duration"]) - duration) < .05
        music = manifest["music"]
        assert music["generator_sha256"] == sha256(ROOT / "build_soundtrack.py")
        assert music["wave_sha256"] == sha256(ROOT / music["wave"])
        assert music["encoded_sha256"] == sha256(ROOT / music["encoded"])
        assert audio_hash(output) == audio_hash(ROOT / music["encoded"]), "Wrong soundtrack"
        with wave.open(str(ROOT / music["wave"]), "rb") as sound:
            assert sound.getnframes() == round(duration * 48000)
            assert sound.getnchannels() == 2 and sound.getframerate() == 48000
        subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-err_detect", "explode",
                        "-i", str(output), "-map", "0:v:0", "-map", "0:a:0",
                        "-f", "null", "-"], check=True)
        print(f"PASS {variant}: {target['width']} × {target['height']} / "
              f"{duration:g}s / {frames} frames; source, framing, music and full decode verified", flush=True)


if __name__ == "__main__":
    main()
