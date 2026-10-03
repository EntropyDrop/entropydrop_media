#!/usr/bin/env python3
"""Regenerate the ten narration clips with the local EntropyDrop voice clone."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from rebuild_combined_audio import AUDIOS_DIR, CHAPTERS, TOTAL_DURATION

ROOT = Path(__file__).resolve().parent
REFERENCE_DIR = AUDIOS_DIR / "reference"
MANIFEST = AUDIOS_DIR / "qwen3_tts_manifest.json"
DEFAULT_URL = "http://tts.example.invalid/v1/audio/speech"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path):
    result = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,sample_rate,channels",
        "-of", "json", str(path),
    ], text=True)
    data = json.loads(result)
    stream = data["streams"][0]
    return {
        "duration_seconds": round(float(data["format"]["duration"]), 3),
        "codec": stream["codec_name"],
        "sample_rate": int(stream["sample_rate"]),
        "channels": stream["channels"],
    }


def request_payload(text, seed):
    return json.dumps({
        "model": "qwen3-tts",
        "input": text,
        "voice": "entropydrop",
        "language": "English",
        "response_format": "mp3",
        "seed": seed,
    }).encode("utf-8")


def read_response_headers(header_file):
    lines = header_file.read_text().splitlines()
    if not lines or " 200 " not in lines[0]:
        raise RuntimeError(f"Unexpected TTS response: {lines[:2]}")
    headers = {}
    for line in lines:
        if ":" in line:
            name, value = line.split(":", 1)
            headers[name.lower()] = value.strip()
    if headers.get("x-synthetic-audio", "").lower() != "true":
        raise RuntimeError("Service did not identify the response as synthetic audio")
    return {
        "audio_duration_header": headers.get("x-audio-duration"),
        "generation_seconds_header": headers.get("x-generation-seconds"),
    }


def generate(url, text, seed, output):
    payload = request_payload(text, seed)
    header_file = output.with_suffix(".headers")
    for attempt in range(4):
        try:
            result = subprocess.run([
                "curl", "--silent", "--show-error", "--max-time", "1800",
                "--header", "Content-Type: application/json", "--data-binary", "@-",
                "--dump-header", str(header_file), "--output", str(output),
                "--write-out", "%{http_code}", url,
            ], input=payload, capture_output=True, check=True)
            status = int(result.stdout.decode("ascii"))
            if status == 429 and attempt < 3:
                print("  Service busy; retrying in 10 seconds", flush=True)
                time.sleep(10)
                continue
            if status != 200:
                raise RuntimeError(f"TTS HTTP {status}: {output.read_text(errors='replace')[:500]}")
            headers = read_response_headers(header_file)
            header_file.unlink()
            return headers
        except subprocess.CalledProcessError as error:
            if attempt == 3:
                raise RuntimeError(f"curl failed: {error.stderr.decode(errors='replace')}") from error
            print("  Service busy; retrying in 10 seconds", flush=True)
            time.sleep(10)
    raise RuntimeError("TTS request failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--prepare-only", action="store_true", help="Write request files for direct curl calls")
    parser.add_argument("--finalize-stage", type=Path, help="Validate downloaded audio and install it")
    args = parser.parse_args()

    stage = args.finalize_stage or Path(tempfile.mkdtemp(prefix=".tts-staging-", dir=ROOT))
    if args.finalize_stage and (stage.parent != ROOT or not stage.name.startswith(".tts-staging-")):
        raise ValueError("Stage must be a .tts-staging-* directory inside this project")
    print(f"Staging output in {stage}", flush=True)
    if args.prepare_only:
        for old_audio, _ in CHAPTERS:
            transcript = AUDIOS_DIR / "transcripts" / f"{old_audio.stem}.txt"
            text = transcript.read_text(encoding="utf-8").strip()
            if not text or len(text) > 2000:
                raise ValueError(f"Invalid transcript length: {transcript}")
            (stage / f"{old_audio.stem}.request.json").write_bytes(request_payload(text, args.seed))
        print("Prepared ten request files.", flush=True)
        return
    entries = []
    try:
        for index, (old_audio, start) in enumerate(CHAPTERS):
            transcript = AUDIOS_DIR / "transcripts" / f"{old_audio.stem}.txt"
            text = transcript.read_text(encoding="utf-8").strip()
            if not text or len(text) > 2000:
                raise ValueError(f"Invalid transcript length: {transcript}")
            slot = (CHAPTERS[index + 1][1] if index + 1 < len(CHAPTERS) else TOTAL_DURATION) - start
            output = stage / old_audio.name
            print(f"[{index + 1}/{len(CHAPTERS)}] {old_audio.name}", flush=True)
            headers = (read_response_headers(output.with_suffix(".headers"))
                       if args.finalize_stage else generate(args.url, text, args.seed, output))
            media = probe(output)
            if media["codec"] != "mp3" or media["channels"] != 1 or media["sample_rate"] != 24000:
                raise RuntimeError(f"Unexpected audio format for {output.name}: {media}")
            if media["duration_seconds"] > slot + 0.02:
                raise RuntimeError(
                    f"{output.name} is {media['duration_seconds']}s, exceeding its {slot}s timeline slot"
                )
            entry = {
                "file": old_audio.name,
                "transcript": str(transcript.relative_to(AUDIOS_DIR)),
                "transcript_sha256": sha256(transcript),
                "start_seconds": start,
                "slot_seconds": slot,
                **media,
                **headers,
                "sha256": sha256(output),
            }
            entries.append(entry)
            print(f"  {media['duration_seconds']}s / {slot}s slot", flush=True)

        combined = stage / "voiceover_full.wav"
        subprocess.run([
            sys.executable, str(ROOT / "rebuild_combined_audio.py"),
            "--audio-dir", str(stage), "--output", str(combined),
        ], check=True)
        combined_media = probe(combined)
        if combined_media["codec"] != "pcm_s16le" or abs(combined_media["duration_seconds"] - TOTAL_DURATION) > 0.01:
            raise RuntimeError(f"Unexpected combined audio: {combined_media}")

        reference_audio = REFERENCE_DIR / CHAPTERS[0][0].name
        reference_text = REFERENCE_DIR / f"{CHAPTERS[0][0].stem}.txt"
        REFERENCE_DIR.mkdir(exist_ok=True)
        if not reference_audio.exists():
            shutil.copy2(CHAPTERS[0][0], reference_audio)
        if not reference_text.exists():
            shutil.copy2(AUDIOS_DIR / "transcripts" / reference_text.name, reference_text)

        manifest = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "service_url": args.url,
            "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            "voice": "entropydrop",
            "language": "English",
            "seed": args.seed,
            "reference_audio": str(reference_audio.relative_to(AUDIOS_DIR)),
            "reference_audio_sha256": sha256(reference_audio),
            "reference_transcript": str(reference_text.relative_to(AUDIOS_DIR)),
            "clips": entries,
            "combined_audio": {**combined_media, "sha256": sha256(combined)},
        }
        staged_manifest = stage / MANIFEST.name
        staged_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        for old_audio, _ in CHAPTERS:
            os.replace(stage / old_audio.name, old_audio)
        os.replace(combined, AUDIOS_DIR / combined.name)
        os.replace(staged_manifest, MANIFEST)
        print("Replaced all ten clips and the combined track.", flush=True)
    except Exception:
        print(f"Generation stopped; staged files remain in {stage}", file=sys.stderr, flush=True)
        raise
    else:
        for path in stage.glob("*.request.json"):
            path.unlink()
        for path in stage.glob("*.headers"):
            path.unlink()
        stage.rmdir()


if __name__ == "__main__":
    main()
