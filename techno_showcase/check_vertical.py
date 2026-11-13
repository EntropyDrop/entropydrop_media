#!/usr/bin/env python3
"""Verify the shortened portrait edit, bookend image and regenerated score."""
import hashlib
import json
import subprocess
import wave
from pathlib import Path

from build_video import probe, sha256
from build_vertical import portrait_shots, shot_framing

ROOT = Path(__file__).resolve().parent


def audio_hash(path):
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
                                    "-c:a", "copy", "-f", "adts", "-"])
    return hashlib.sha256(data).hexdigest()


def main():
    manifest = json.loads((ROOT / "renders/douyin-manifest.json").read_text())
    horizontal = json.loads((ROOT / "assets/assembly/manifest.json").read_text())
    config = json.loads((ROOT / "douyin-edit.json").read_text())
    video = ROOT / manifest["render"]
    assert manifest["edit_sha256"] == sha256(ROOT / "douyin-edit.json"), "Stale portrait framing"
    assert manifest["source_edit_sha256"] == sha256(ROOT / "assembly-edit.json"), "Stale source timing"
    assert manifest["horizontal_render_sha256"] == sha256(ROOT / horizontal["render"])
    assert manifest["render_sha256"] == sha256(video)
    photos = horizontal["showcase"]["photos"][:config["openingPhotoCount"]]
    opening_frames = sum(photo["frames"] for photo in photos)
    selected = portrait_shots(config, horizontal)
    expected_frames = opening_frames + sum(shot['frames'] for shot in selected) + round(config['endingDuration'] * manifest['fps'])
    assert expected_frames == 1770 and config['duration'] == 59
    assert manifest["frames"] == expected_frames
    assert manifest["duration"] == expected_frames / manifest["fps"]
    assert len(manifest["scenes"]) == len(photos) + len(selected) + 1
    for scene, photo in zip(manifest["scenes"], photos):
        assert scene["image"] == photo["image"] and scene["frames"] == photo["frames"]
    assembly = manifest["scenes"][len(photos):-1]
    assert assembly[0]["start"] == opening_frames / manifest["fps"]
    assert assembly[0]["original_start"] == horizontal["montage_start"]
    for scene, shot in zip(assembly, selected):
        assert scene["id"] == shot["id"] and scene["frames"] == shot["frames"]
        assert scene["inPoint"] == shot["in"] and scene["outPoint"] == shot["out"]
        assert scene["original_start"] == shot["start"]
        crop, focus = shot_framing(config, shot)
        assert scene['crop'] == crop and scene['focus'] == focus
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
    music = manifest["music"]
    assert music["bpm"] == config["musicBpm"]
    assert music["ending_start"] == last["start"]
    assert music["events"] == [{"time": scene["start"]} for scene in manifest["scenes"][1:-1]]
    assert all(abs(event["time"] * music["bpm"] / 60 - round(event["time"] * music["bpm"] / 60)) < 1e-8
               for event in music["events"])
    assert music["generator_sha256"] == sha256(ROOT / "build_soundtrack.py")
    assert music["wave_sha256"] == sha256(ROOT / music["wave"])
    assert music["encoded_sha256"] == sha256(ROOT / music["encoded"])
    with wave.open(str(ROOT / music["wave"]), "rb") as score:
        assert score.getframerate() == 48000 and score.getnchannels() == 2
        assert score.getnframes() == round(manifest["duration"] * 48000)
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
    assert audio_hash(video) == audio_hash(ROOT / music["encoded"]), "Export does not contain the new score"
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], check=True)
    print(f"Verified Douyin: 1080 × 1920 / {manifest['duration']}s / {manifest['frames']} frames / regenerated score")


if __name__ == "__main__":
    main()
