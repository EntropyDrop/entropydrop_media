#!/usr/bin/env python3
"""Generate timed narration using the same local voice and API as skin_reconstruction."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import wave
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT.parent / "skin_reconstruction"))
from regenerate_audio_whole_clip import DEFAULT_URL, generate, probe, sha256

RATE = 24000


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def write_wav(path, data):
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--only", help="Regenerate comma-separated segment IDs; otherwise reuse matching audio")
    args = parser.parse_args()
    if not args.url:
        parser.error("Configure ENTROPYDROP_TTS_URL or ../local_deployment/tts/config.json")
    plan_path = ROOT / "narration.json"
    plan = json.loads(plan_path.read_text())
    minimum_tempo, maximum_tempo = plan.get("tempoRange", [0.72, 1.25])
    if not 0.5 <= minimum_tempo <= 1 <= maximum_tempo <= 2:
        raise ValueError("Invalid tempoRange")
    timeline = json.loads((ROOT / "timeline.json").read_text())
    narration_duration = timeline.get("narrationDuration", timeline["duration"])
    if (plan["model"], plan["voice"], plan["language"]) != ("qwen3-tts", "entropydrop", "English"):
        raise ValueError("This project uses the existing English entropydrop voice.")
    anchors = {c["source"]: c for c in timeline["clips"]}
    anchors.update(showcase=timeline["showcase"], outro=timeline["outro"])
    if timeline.get("slicing"):
        anchors["slicing"] = timeline["slicing"]
    if timeline.get("ending"):
        anchors["ending"] = timeline["ending"]
    selected = set(args.only.split(",")) if args.only else set()
    if selected - {s["id"] for s in plan["segments"]}:
        raise ValueError("Unknown --only segment ID")
    audios = ROOT / "audios"
    raw_dir = audios / "qwen3_sentence_sources"
    raw_dir.mkdir(parents=True, exist_ok=True)
    previous_end = 0
    # Check all speech windows before contacting the service.
    for segment in plan["segments"]:
        anchor = anchors[segment["anchor"]]
        start = anchor["start"] + segment["offset"]
        end = start + segment["maxDuration"]
        if start < previous_end or end > anchor["start"] + anchor["duration"] + 1e-6:
            raise ValueError(f"Narration window outside its scene: {segment['id']}")
        previous_end = end
    entries = []
    with tempfile.TemporaryDirectory(prefix=".tts-staging-", dir=ROOT) as stage_name:
        stage = Path(stage_name)
        combined = bytearray(round(narration_duration * RATE) * 2)
        for segment in plan["segments"]:
            name = segment["id"]
            seed = segment.get("seed", plan["seed"])
            request = {"text": segment["text"], "seed": seed, "model": plan["model"], "voice": plan["voice"], "language": plan["language"]}
            key = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()
            raw = raw_dir / f"{name}.mp3"
            cache = raw_dir / f"{name}.json"
            cached = json.loads(cache.read_text()) if cache.exists() else {}
            if name in selected or not raw.exists() or cached.get("request_sha256") != key or cached.get("sha256") != sha256(raw):
                print(f"Generating {name}: {segment['text']}", flush=True)
                headers = generate(args.url, segment["text"], seed, stage / f"{name}.mp3")
                os.replace(stage / f"{name}.mp3", raw)
                cached = {"request_sha256": key, "sha256": sha256(raw), **headers}
                cache.write_text(json.dumps(cached, indent=2) + "\n")
            else:
                print(f"Reusing {name}", flush=True)
            # Trim only the edges; internal pauses and every spoken word remain intact.
            trimmed = stage / f"{name}-trim.wav"
            trim = "silenceremove=start_periods=1:start_duration=0.025:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_duration=0.025:start_threshold=-48dB:start_silence=0.10,areverse"
            ffmpeg("-i", raw, "-af", trim, "-ar", RATE, "-ac", 1, "-c:a", "pcm_s16le", trimmed)
            raw_seconds = probe(trimmed)["duration_seconds"]
            words = len(re.findall(r"\b[\w'-]+\b", segment["text"]))
            target = min(segment["maxDuration"] - 0.08, max(1, words * 60 / plan["targetWpm"]))
            tempo = max(minimum_tempo, min(maximum_tempo, raw_seconds / target))
            if raw_seconds / tempo > segment["maxDuration"] - 0.035:
                raise RuntimeError(f"{name} does not fit without rushing; shorten its text or increase its window.")
            processed = stage / f"{name}.wav"
            ffmpeg("-i", trimmed, "-af", f"atempo={tempo:.8f}", "-ar", RATE, "-ac", 1, "-c:a", "pcm_s16le", processed)
            with wave.open(str(processed), "rb") as wav:
                audio = wav.readframes(wav.getnframes())
            duration = len(audio) / (2 * RATE)
            if duration > segment["maxDuration"]:
                raise RuntimeError(f"Generated clip exceeds its window: {name}")
            start = anchors[segment["anchor"]]["start"] + segment["offset"]
            offset = round(start * RATE) * 2
            combined[offset:offset + len(audio)] = audio
            entries.append({**segment, "seed": seed, "start_seconds": start,
                            "duration_seconds": duration, "tempo": round(tempo, 5),
                            "raw_duration_seconds": raw_seconds, "raw_sha256": sha256(raw),
                            "file": f"sentences/{name}.wav"})
            print(f"  {duration:.3f}s / {segment['maxDuration']:.3f}s window; tempo {tempo:.3f}", flush=True)
        pre_normalized = stage / "combined.wav"
        write_wav(pre_normalized, combined)
        output = stage / "voiceover_full.wav"
        ffmpeg("-i", pre_normalized, "-af", "loudnorm=I=-18:TP=-1.5:LRA=7", "-ar", RATE, "-ac", 1, "-c:a", "pcm_s16le", output)
        media = probe(output)
        if abs(media["duration_seconds"] - narration_duration) > .005:
            raise RuntimeError("Combined audio duration differs from the picture timeline.")
        reference = ROOT.parent / "skin_reconstruction" / "audios" / "reference" / "01_open_source_hook.mp3"
        manifest = {"generated_at_utc": datetime.now(timezone.utc).isoformat(),
                    "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base", "voice": plan["voice"], "language": plan["language"],
                    "synthetic_audio": True, "narration_sha256": sha256(plan_path),
                    "reference_audio_sha256": sha256(reference),
                    "target_wpm": plan["targetWpm"], "tempo_range": [minimum_tempo, maximum_tempo],
                    "method": "scene-level narration synthesis, edge silence trimming, bounded pitch-preserving tempo adjustment",
                    "timeline_duration": narration_duration, "segments": entries,
                    "combined_audio": {"file": "voiceover_full.wav", **media, "sha256": sha256(output)}}
        (audios / "sentences").mkdir(exist_ok=True)
        for segment in entries:
            os.replace(stage / f"{segment['id']}.wav", audios / segment["file"])
        os.replace(output, audios / "voiceover_full.wav")
        (audios / "qwen3_tts_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Saved {len(entries)} sentences and {media['duration_seconds']:.3f}s narration.", flush=True)


if __name__ == "__main__":
    main()
