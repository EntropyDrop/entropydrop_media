#!/usr/bin/env python3
"""Verify frame counts, audio coverage, hashes and complete video decoding."""
import json
import subprocess
from pathlib import Path

from build_video import probe, sha256

ROOT = Path(__file__).resolve().parent


def main():
    manifest = json.loads((ROOT / "assets/assembly/manifest.json").read_text())
    showcase = manifest["showcase"]
    next_frame = 0
    for photo in showcase["photos"]:
        assert sha256(ROOT / photo["source"]) == photo["source_sha256"]
        assert sha256(ROOT / photo["image"]) == photo["image_sha256"]
        if photo["preparation"] == "original-byte-copy":
            assert photo["source_sha256"] == photo["image_sha256"]
        else:
            assert photo["preparation"] in ("ai-background-outpaint", "user-selected-image")
            assert abs(photo["imageDimensions"][0] / photo["imageDimensions"][1] - 16 / 9) < .01
        assert photo["startFrame"] == next_frame
        next_frame += photo["frames"]
    assert next_frame == showcase["frames"] and showcase["imageCount"] == len(showcase["photos"])
    assert manifest["montage_start"] == showcase["duration"]
    assert manifest["shots"][0]["start"] == manifest["montage_start"]
    assert manifest["ending"]["start"] == manifest["montage_start"] + manifest["montage_duration"]
    assert manifest["opening_label_duration"] == 0
    assert showcase["fit"] == manifest["ending"]["fit"] == "cover", "Images should fill the frame"
    assert sha256(ROOT / manifest["ending"]["image"]) == manifest["ending"]["image_sha256"]
    assert sha256(ROOT / manifest["ending"]["rendered_image"]) == manifest["ending"]["rendered_image_sha256"]
    assert sha256(ROOT / "assembly-edit.json") == manifest["edit_sha256"], "Stale edit"
    for file_key, hash_key in (("video", "video_sha256"), ("music", "music_sha256"), ("render", "render_sha256")):
        assert sha256(ROOT / manifest[file_key]) == manifest[hash_key], f"Stale {file_key}"
    for path, frames in ((manifest["video"], manifest["montage_frames"]), (manifest["render"], manifest["frames"])):
        metadata = probe(ROOT / path)
        stream = metadata["streams"][0]
        assert int(stream["nb_frames"]) == frames, f"Wrong frame count: {path}"
        assert stream["r_frame_rate"] == "30/1", f"Wrong frame rate: {path}"
        assert (stream["width"], stream["height"]) == (1920, 1080)
        assert stream["color_space"] == stream["color_transfer"] == stream["color_primaries"] == "bt709"
        assert stream["color_range"] == "tv"
        assert abs(float(metadata["format"]["duration"]) - frames / 30) < .06
    audio = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0",
                                              "-show_entries", "stream=duration,sample_rate,channels,start_time",
                                              "-of", "json", str(ROOT / manifest["render"])]))["streams"][0]
    assert abs(float(audio["duration"]) - manifest["duration"]) < .06, "Audio does not cover the edit"
    assert abs(float(audio["start_time"])) < .03, "Audio has a start offset"
    assert audio["sample_rate"] == "48000" and audio["channels"] == 2
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(ROOT / manifest["render"]),
                    "-f", "null", "-"], check=True)
    print(f"Verified {manifest['duration']}s, {manifest['frames']} frames, 1080p/30, stereo audio and full decode.")


if __name__ == "__main__":
    main()
