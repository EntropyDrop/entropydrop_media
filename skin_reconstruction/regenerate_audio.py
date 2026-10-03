#!/usr/bin/env python3
"""Generate sentence-paced narration with the local EntropyDrop voice clone."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from datetime import datetime, timezone
from pathlib import Path

from rebuild_combined_audio import AUDIOS_DIR, CHAPTERS, TOTAL_DURATION
from regenerate_audio_whole_clip import (
    DEFAULT_URL, MANIFEST, REFERENCE_DIR, generate, probe,
    read_response_headers, request_payload, sha256,
)

ROOT = Path(__file__).resolve().parent
SOURCES_DIR = AUDIOS_DIR / "qwen3_sentence_sources"
WORD_PATTERN = re.compile(r"\b[\w'-]+\b")


def sentence_chunks(text):
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    result = []
    for para_index, paragraph in enumerate(paragraphs):
        sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", paragraph) if part.strip()]
        for sentence_index, sentence in enumerate(sentences):
            has_next = sentence_index + 1 < len(sentences) or para_index + 1 < len(paragraphs)
            pause = 0.24 if sentence_index + 1 < len(sentences) else (0.40 if has_next else 0.0)
            result.append((sentence, pause))
    return result


def prepare(stage, url, seed, target_wpm, selected):
    plan = {
        "prepared_at_utc": datetime.now(timezone.utc).isoformat(),
        "service_url": url,
        "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "voice": "entropydrop",
        "language": "English",
        "seed": seed,
        "target_wpm": target_wpm,
        "chapters": [],
    }
    for index, (audio_path, start) in enumerate(CHAPTERS):
        if index + 1 not in selected:
            continue
        transcript = AUDIOS_DIR / "transcripts" / f"{audio_path.stem}.txt"
        text = transcript.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"Empty transcript: {transcript}")
        slot = (CHAPTERS[index + 1][1] if index + 1 < len(CHAPTERS) else TOTAL_DURATION) - start
        chunks = []
        for part_index, (sentence, pause) in enumerate(sentence_chunks(text), 1):
            words = len(WORD_PATTERN.findall(sentence))
            if not words or len(sentence) > 2000:
                raise ValueError(f"Invalid sentence in {transcript}: {sentence}")
            chunk_id = f"{audio_path.stem}__{part_index:02d}"
            target_seconds = max(1.2, words * 60 / target_wpm)
            (stage / f"{chunk_id}.request.json").write_bytes(request_payload(sentence, seed))
            chunks.append({
                "id": chunk_id,
                "text": sentence,
                "words": words,
                "target_seconds": round(target_seconds, 3),
                "pause_after_seconds": pause,
            })
        predicted = sum(c["target_seconds"] + c["pause_after_seconds"] for c in chunks)
        if predicted > slot + 0.02:
            raise RuntimeError(f"{audio_path.name}: planned {predicted:.2f}s exceeds {slot:.2f}s slot")
        plan["chapters"].append({
            "file": audio_path.name,
            "transcript": str(transcript.relative_to(AUDIOS_DIR)),
            "transcript_sha256": sha256(transcript),
            "start_seconds": start,
            "slot_seconds": slot,
            "chunks": chunks,
        })
    (stage / "plan.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n")
    return plan


def stretch_chunk(source, target, seconds, raw_seconds):
    requested_tempo = raw_seconds / seconds
    tempo = min(1.25, max(0.68, requested_tempo))
    output_seconds = max(seconds, raw_seconds / tempo + 0.08) if tempo < requested_tempo else seconds
    filters = f"atempo={tempo:.8f},aresample=24000,apad=whole_dur={output_seconds:.3f},atrim=0:{output_seconds:.3f}"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-af", filters, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(target),
    ], check=True)
    return round(tempo, 4)


def assemble_wav(stage, chapter, chunk_details):
    output = stage / chapter["file"].replace(".mp3", ".wav")
    with wave.open(str(output), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(24000)
        for chunk, details in zip(chapter["chunks"], chunk_details):
            with wave.open(str(stage / f"{chunk['id']}.wav"), "rb") as source:
                if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 24000):
                    raise RuntimeError(f"Unexpected WAV format: {chunk['id']}")
                destination.writeframes(source.readframes(source.getnframes()))
            silence_frames = round(chunk["pause_after_seconds"] * 24000)
            if silence_frames:
                destination.writeframes(b"\0\0" * silence_frames)
    return output


def finalize(stage, plan, direct_downloads):
    entries = []
    for index, chapter in enumerate(plan["chapters"], 1):
        details = []
        print(f"[{index}/{len(plan['chapters'])}] {chapter['file']}", flush=True)
        for chunk in chapter["chunks"]:
            source = stage / f"{chunk['id']}.mp3"
            headers_file = stage / f"{chunk['id']}.headers"
            headers = read_response_headers(headers_file) if direct_downloads else chunk["response_headers"]
            media = probe(source)
            if (media["codec"], media["sample_rate"], media["channels"]) != ("mp3", 24000, 1):
                raise RuntimeError(f"Unexpected generated format: {source.name}: {media}")
            processed = stage / f"{chunk['id']}.wav"
            tempo = stretch_chunk(
                source, processed,
                chunk["target_seconds"], media["duration_seconds"],
            )
            details.append({
                **chunk,
                "raw_duration_seconds": media["duration_seconds"],
                "processed_duration_seconds": probe(processed)["duration_seconds"],
                "tempo": tempo,
                "generation_seconds_header": headers["generation_seconds_header"],
                "raw_sha256": sha256(source),
            })

        wav = assemble_wav(stage, chapter, details)
        output = stage / chapter["file"]
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", str(wav),
            "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(output),
        ], check=True)
        media = probe(output)
        if media["duration_seconds"] > chapter["slot_seconds"] + 0.02:
            raise RuntimeError(f"{output.name} exceeds its timeline slot: {media['duration_seconds']}s")
        entry = {
            "file": chapter["file"],
            "transcript": chapter["transcript"],
            "transcript_sha256": chapter["transcript_sha256"],
            "start_seconds": chapter["start_seconds"],
            "slot_seconds": chapter["slot_seconds"],
            **media,
            "sha256": sha256(output),
            "chunks": details,
        }
        entries.append(entry)
        print(f"  {media['duration_seconds']}s / {chapter['slot_seconds']}s slot", flush=True)

    selected_files = {entry["file"] for entry in entries}
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"clips": []}
    previous_by_file = {entry["file"]: entry for entry in previous["clips"]}
    for old_audio, _ in CHAPTERS:
        if old_audio.name not in selected_files:
            if old_audio.name not in previous_by_file:
                raise RuntimeError(f"Missing prior generation record for {old_audio.name}")
            transcript = AUDIOS_DIR / previous_by_file[old_audio.name]["transcript"]
            if sha256(transcript) != previous_by_file[old_audio.name]["transcript_sha256"]:
                raise RuntimeError(f"Unchanged audio has a modified transcript: {old_audio.name}")
            shutil.copy2(old_audio, stage / old_audio.name)
    all_by_file = {**previous_by_file, **{entry["file"]: entry for entry in entries}}
    all_entries = [
        {
            **all_by_file[path.name],
            "start_seconds": start,
            "slot_seconds": (CHAPTERS[index + 1][1] if index + 1 < len(CHAPTERS) else TOTAL_DURATION) - start,
        }
        for index, (path, start) in enumerate(CHAPTERS)
    ]

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
        "service_url": plan["service_url"],
        "model": plan["model"],
        "voice": plan["voice"],
        "language": plan["language"],
        "seed": plan["seed"],
        "method": "sentence chunks with pitch-preserving tempo correction",
        "target_wpm": plan["target_wpm"],
        "reference_audio": str(reference_audio.relative_to(AUDIOS_DIR)),
        "reference_audio_sha256": sha256(reference_audio),
        "reference_transcript": str(reference_text.relative_to(AUDIOS_DIR)),
        "clips": all_entries,
        "combined_audio": {**combined_media, "sha256": sha256(combined)},
    }
    staged_manifest = stage / MANIFEST.name
    staged_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    SOURCES_DIR.mkdir(exist_ok=True)
    for chapter in plan["chapters"]:
        for chunk in chapter["chunks"]:
            shutil.copy2(stage / f"{chunk['id']}.mp3", SOURCES_DIR / f"{chunk['id']}.mp3")
    for old_audio, _ in CHAPTERS:
        if old_audio.name in selected_files:
            os.replace(stage / old_audio.name, old_audio)
    os.replace(combined, AUDIOS_DIR / combined.name)
    os.replace(staged_manifest, MANIFEST)
    print(f"Replaced {len(entries)} clips and rebuilt the combined track.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--target-wpm", type=float, default=185)
    parser.add_argument("--chapters", default="1-10", help="Comma-separated chapter numbers or ranges, e.g. 3-5,7-10")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--finalize-stage", type=Path)
    args = parser.parse_args()
    if args.prepare_only and args.finalize_stage:
        parser.error("--prepare-only and --finalize-stage cannot be used together")
    selected = set()
    for part in args.chapters.split(","):
        bounds = part.strip().split("-")
        if len(bounds) == 1:
            selected.add(int(bounds[0]))
        elif len(bounds) == 2:
            selected.update(range(int(bounds[0]), int(bounds[1]) + 1))
        else:
            parser.error(f"Invalid chapter selection: {part}")
    if not selected or any(number < 1 or number > len(CHAPTERS) for number in selected):
        parser.error("Chapter numbers must be between 1 and 10")

    stage = args.finalize_stage.resolve() if args.finalize_stage else Path(tempfile.mkdtemp(prefix=".tts-staging-", dir=ROOT))
    if stage.parent != ROOT or not stage.name.startswith(".tts-staging-"):
        raise ValueError("Stage must be a .tts-staging-* directory inside this project")
    print(f"Staging output in {stage}", flush=True)
    try:
        if args.finalize_stage:
            plan = json.loads((stage / "plan.json").read_text(encoding="utf-8"))
        else:
            plan = prepare(stage, args.url, args.seed, args.target_wpm, selected)
        if args.prepare_only:
            print(f"Prepared {sum(len(c['chunks']) for c in plan['chapters'])} sentence requests.", flush=True)
            return
        if not args.finalize_stage:
            for chapter in plan["chapters"]:
                for chunk in chapter["chunks"]:
                    print(f"Generating {chunk['id']}", flush=True)
                    chunk["response_headers"] = generate(
                        plan["service_url"], chunk["text"], plan["seed"], stage / f"{chunk['id']}.mp3"
                    )
        finalize(stage, plan, bool(args.finalize_stage))
    except Exception:
        print(f"Generation stopped; staged files remain in {stage}", file=sys.stderr, flush=True)
        raise
    else:
        if not args.prepare_only:
            shutil.rmtree(stage)


if __name__ == "__main__":
    main()
