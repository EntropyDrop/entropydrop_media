#!/usr/bin/env python3
"""Verify the portrait export, timing, bookend image and unchanged AAC stream."""
import hashlib
import json
import subprocess
from pathlib import Path

from build_video import probe, sha256

ROOT = Path(__file__).resolve().parent


def audio_hash(path):
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
                                    "-c:a", "copy", "-f", "adts", "-"])
    return hashlib.sha256(data).hexdigest()


def main():
    manifest = json.loads((ROOT / "renders/douyin-manifest.json").read_text())
    horizontal = json.loads((ROOT / "assets/assembly/manifest.json").read_text())
    video = ROOT / manifest["render"]
    assert manifest["edit_sha256"] == sha256(ROOT / "douyin-edit.json"), "Stale portrait framing"
    assert manifest["source_edit_sha256"] == sha256(ROOT / "assembly-edit.json"), "Stale source timing"
    assert manifest["horizontal_render_sha256"] == sha256(ROOT / horizontal["render"])
    assert manifest["render_sha256"] == sha256(video)
    assert manifest["frames"] == horizontal["frames"] and manifest["duration"] == horizontal["duration"]
    cursor = 0
    for scene in manifest["scenes"]:
        assert abs(scene["start"] - cursor / manifest["fps"]) < 1e-8
        cursor += scene["frames"]
        if "image" in scene:
            assert sha256(ROOT / scene["image"]) == scene["image_sha256"]
    assert cursor == manifest["frames"]
    first, last = manifest["scenes"][0], manifest["scenes"][-1]
    assert first["image"] == last["image"] == horizontal["ending"]["image"]
    assert first["crop"] == last["crop"] and first["image_sha256"] == last["image_sha256"]
    metadata = probe(video)
    stream = metadata["streams"][0]
    assert (stream["width"], stream["height"]) == (1080, 1920)
    assert stream["r_frame_rate"] == "30/1" and int(stream["nb_frames"]) == manifest["frames"]
    assert stream["color_space"] == stream["color_transfer"] == stream["color_primaries"] == "bt709"
    assert stream["color_range"] == "tv"
    assert abs(float(metadata["format"]["duration"]) - manifest["duration"]) < .06
    audio = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0",
                                              "-show_entries", "stream=duration,start_time,sample_rate,channels",
                                              "-of", "json", str(video)]))["streams"][0]
    assert abs(float(audio["start_time"])) < .03
    assert abs(float(audio["duration"]) - manifest["duration"]) < .06
    assert audio["sample_rate"] == "48000" and audio["channels"] == 2
    assert audio_hash(video) == audio_hash(ROOT / horizontal["render"]), "AAC music was changed"
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], check=True)
    print(f"Verified Douyin: 1080 × 1920 / {manifest['duration']}s / {manifest['frames']} frames / identical AAC audio")


if __name__ == "__main__":
    main()
