#!/usr/bin/env python3
"""Verify both exports, exact scene timing, source provenance and music."""
import hashlib
import json
import subprocess
import wave

from build_video import EDIT, ROOT, framing, image_source, probe, sha256
from build_soundtrack import SCORE_ID, TEMPO_RATIO, score_dependencies
from portrait_edit import CONFIG as PORTRAIT_EDIT, resolve_edit


def audio_hash(path):
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
                                    "-c:a", "copy", "-f", "adts", "-"])
    return hashlib.sha256(data).hexdigest()


def frame_hash(path, time):
    return subprocess.check_output(["ffmpeg", "-v", "error", "-ss", str(time), "-i", str(path),
                                    "-map", "0:v:0", "-frames:v", "1", "-f", "hash", "-hash", "sha256", "-"])


def main():
    base = json.loads(EDIT.read_text())
    source_hash = sha256(ROOT / base["source"])
    for variant, size in base["formats"].items():
        edit = resolve_edit(base, variant)
        expected_frames = sum(round(shot["duration"] * edit["fps"]) for shot in edit["shots"])
        expected_duration = expected_frames / edit["fps"]
        manifest = json.loads((ROOT / f"renders/{variant}-manifest.json").read_text())
        if variant == 'portrait':
            assert manifest['portrait_edit_sha256'] == sha256(PORTRAIT_EDIT)
            assert expected_duration == 59 and expected_frames == 1770
        assert manifest["edit_sha256"] == sha256(EDIT), "Stale edit"
        assert manifest["source_sha256"] == source_hash, "Source changed"
        assert manifest["frames"] == expected_frames and manifest["duration"] == expected_duration
        assert len(manifest["scenes"]) == len(edit["shots"])
        cursor = 0
        for scene, shot in zip(manifest["scenes"], edit["shots"]):
            assert all(scene[key] == value for key, value in shot.items()), f"Changed scene: {shot['id']}"
            assert scene["start"] == cursor / edit["fps"]
            assert scene["frames"] == round(shot["duration"] * edit["fps"])
            assert scene["framing"] == framing(edit, shot, variant)
            if "image" in shot:
                assert scene["render_image"] == str(image_source(shot, variant).relative_to(ROOT))
                assert scene["render_image_sha256"] == sha256(image_source(shot, variant))
                assert scene["original_image_sha256"] == sha256(ROOT / shot["image"])
            cursor += scene["frames"]
        assert cursor == expected_frames
        first, last = manifest["scenes"][0], manifest["scenes"][-1]
        photos = [scene for scene in manifest["scenes"] if "image" in scene and scene["start"] >= edit["photoEndingStart"]]
        assert len(photos) == (3 if variant == 'portrait' else 6)
        assert photos[0]["start"] == edit["photoEndingStart"] == (52 if variant == 'portrait' else 75)
        assert all("image" in scene for scene in manifest["scenes"] if scene["start"] >= edit["photoEndingStart"])
        assert sum(scene["duration"] for scene in photos) == expected_duration - edit["photoEndingStart"]
        assert first["image"] == last["image"]
        assert first["render_image_sha256"] == last["render_image_sha256"]
        assert first["original_image_sha256"] == last["original_image_sha256"]
        assert first["duration"] == 2
        assert all(first["framing"][key] == last["framing"][key] for key in ("width", "height", "y"))
        assert {x for _, x in first["framing"]["x"]} == {x for _, x in last["framing"]["x"]}
        ai = json.loads((ROOT / "showcase-ai.json").read_text())
        for image in ai["images"]:
            assert image["source_sha256"] == sha256(ROOT / image["source"])
            assert image["expanded_sha256"] == sha256(ROOT / image["expanded"])
        music = manifest["music"]
        starts = {shot["id"]: shot["start"] for shot in manifest["scenes"]}
        assert music["sections"] == {name: starts[shot_id] for name, shot_id in edit["music"].items()}
        assert music["bpm"] == edit["bpm"] and music["duration"] == expected_duration
        assert music["events"] == [{"time": shot["start"]} for shot in manifest["scenes"][1:-1]]
        assert all(abs(event["time"] * edit["bpm"] / 60 - round(event["time"] * edit["bpm"] / 60)) < 1e-8
                   for event in music["events"])
        assert music["generator_sha256"] == sha256(ROOT / ('portrait_edit.py' if variant == 'portrait' else 'build_soundtrack.py'))
        assert music["wave_sha256"] == sha256(ROOT / music["wave"])
        assert music["encoded_sha256"] == sha256(ROOT / music["encoded"])
        assert music["composition_sha256"] == sha256(ROOT / music["composition"])
        composition = json.loads((ROOT / music["composition"]).read_text())
        assert composition["duration"] == expected_duration
        if variant == 'portrait':
            assert composition['id'] == music['id'] == SCORE_ID+'-portrait-59s'
            assert composition['retained_measures'] == [[1,4],[17,35]]
            assert composition['final_chord_start'] == 56
            assert composition['source_ranges'] == json.loads(PORTRAIT_EDIT.read_text())['music']['sourceRanges']
            assert composition['source_wave_sha256'] == sha256(ROOT/composition['source_wave'])
            assert composition['source_composition_sha256'] == sha256(ROOT/composition['source_composition'])
            assert composition['tempo_factor'] == (55-composition['crossfade_seconds'])/56
        else:
            assert composition['id'] == music['id'] == SCORE_ID
            assert composition['arrangement_bpm'] == music['arrangement_bpm'] == edit['bpm']*TEMPO_RATIO
            assert composition['dependencies'] == music['dependencies'] == score_dependencies()
            assert composition['score_measures'] == 35 and composition['source_note_count'] == 549
            assert len(composition['notes_and_hits']) == 549 and composition['final_chord_start'] == 85
        with wave.open(str(ROOT / music["wave"]), "rb") as score:
            assert (score.getframerate(), score.getnchannels()) == (48000, 2)
            assert score.getnframes() == round(expected_duration * 48000)
        path = ROOT / manifest["render"]
        assert manifest["render_sha256"] == sha256(path)
        metadata = probe(path)
        video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        audio = next(stream for stream in metadata["streams"] if stream["codec_type"] == "audio")
        assert video["codec_name"] == "h264" and video["pix_fmt"] == "yuv420p"
        assert (video["width"], video["height"]) == (size["width"], size["height"])
        assert video["r_frame_rate"] == f"{edit['fps']}/1" and int(video["nb_frames"]) == expected_frames
        assert video["color_space"] == video["color_transfer"] == video["color_primaries"] == "bt709"
        assert video["color_range"] == "tv"
        assert abs(float(video["start_time"])) < .03 and abs(float(audio["start_time"])) < .03
        assert abs(float(audio["duration"]) - expected_duration) < .06
        assert abs(float(metadata["format"]["duration"]) - expected_duration) < .06
        assert audio["codec_name"] == "aac" and audio["sample_rate"] == "48000" and audio["channels"] == 2
        encoded_hash = audio_hash(path)
        assert encoded_hash == audio_hash(ROOT / music["encoded"]), "Wrong soundtrack"
        subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"], check=True)
        print(f"Verified {variant}: {size['width']} × {size['height']} / {expected_duration}s / {expected_frames} frames", flush=True)
    print('Both exports verified: 88-second landscape and 59-second portrait, with matching per-format music.')


if __name__ == "__main__":
    main()
