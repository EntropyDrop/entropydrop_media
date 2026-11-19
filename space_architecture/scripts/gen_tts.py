#!/usr/bin/env python3
"""Generate sentence-level Chinese TTS narration for space_architecture using qwen3-tts (entropydrop)."""

import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_URL = os.environ.get("ENTROPYDROP_TTS_URL", "http://192.168.0.10:8008/v1/audio/speech")
TTS_MODEL = "qwen3-tts"
TTS_VOICE = "entropydrop"


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def wavread(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").copy()


def wavwrite(path: Path, data: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(data.astype("<i2").tobytes())


def trim_audio(data: np.ndarray) -> np.ndarray:
    n = len(data) // 240
    rms = np.sqrt(np.mean(data[: n * 240].astype(float).reshape(n, 240) ** 2, axis=1))
    active = np.flatnonzero(rms > 100)
    if not len(active):
        raise ValueError("Silent narration")
    return data[max(0, active[0] * 240 - 1440) : min(len(data), (active[-1] + 1) * 240 + 1920)]


def split_clauses(para: str) -> list[str]:
    return [x.strip() for x in re.split(r"(?<=[。！？；])\s*", para) if x.strip()]


def parse_module(module_id: str) -> tuple[str, list[str]]:
    vo_path = ROOT / "space_architecture" / "voiceover.zh.txt"
    text = vo_path.read_text(encoding="utf-8")
    pattern = rf"^\[{re.escape(module_id)}\]\s+(.+)\n([\s\S]*?)(?=\n\[[^\]]+\]|\Z)"
    m = re.search(pattern, text, flags=re.M)
    if not m:
        raise ValueError(f"Module {module_id} not found in {vo_path}")
    title = m.group(1).strip()
    body = m.group(2).strip()
    paras = [p.strip() for p in body.split("\n\n") if p.strip()]
    return title, paras


def synth_sentence(sentence: str, seed: int, cache_dirs: list[Path], tts_url: str) -> np.ndarray:
    primary_cache = cache_dirs[0]
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    for attempt in range(4):
        req_payload = {
            "model": TTS_MODEL,
            "voice": TTS_VOICE,
            "language": "Chinese",
            "response_format": "wav",
            "input": sentence,
            "seed": seed + attempt,
        }
        digest = hashlib.sha256(json.dumps(req_payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        filename_prefix = digest[:24]

        # Check existing caches first
        found_data = None
        for cd in cache_dirs:
            w_path = cd / f"{filename_prefix}.wav"
            m_path = cd / f"{filename_prefix}.request.json"
            if w_path.exists() and m_path.exists():
                try:
                    if json.loads(m_path.read_text(encoding="utf-8")) == req_payload:
                        found_data = wavread(w_path)
                        print(f"  [CACHE HIT] {sentence[:28]}...", flush=True)
                        break
                except Exception:
                    pass

        if found_data is not None:
            data = found_data
        else:
            print(f"  [TTS REQUEST] seed={seed+attempt}: {sentence}", flush=True)
            req = urllib.request.Request(
                tts_url,
                data=json.dumps(req_payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            raw = None
            for retry in range(20):
                try:
                    with op.open(req, timeout=180) as resp:
                        raw = resp.read()
                    break
                except urllib.error.HTTPError as err:
                    if err.code != 429:
                        raise
                    time.sleep(max(4.0, float(err.headers.get("Retry-After", "6"))))
            if raw is None:
                raise RuntimeError(f"TTS service unavailable or busy for: {sentence}")

            with wave.open(io.BytesIO(raw), "rb") as w:
                assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
                data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").copy()

            target_wav = primary_cache / f"{filename_prefix}.wav"
            target_meta = primary_cache / f"{filename_prefix}.request.json"
            wavwrite(target_wav, data)
            save_json(target_meta, req_payload)

        trimmed = trim_audio(data)
        dur = len(trimmed) / 24000.0
        units = len(re.findall(r"[\u3400-\u9fff]|[A-Za-z0-9]+", sentence))
        if units * 0.06 <= dur <= units * 0.50 + 4.0:
            return trimmed
        print(f"  RETRY abnormal duration {dur:.2f}s for {units} units", flush=True)

    raise ValueError(f"Failed TTS sanity check for: {sentence}")


def build_module_tts(mid: str, tts_url: str = DEFAULT_URL) -> None:
    print(f"\n==========================================")
    print(f"Synthesizing voiceover for: {mid}")
    print(f"Service URL: {tts_url}")
    print(f"==========================================")

    title, paras = parse_module(mid)
    mod_dir = ROOT / "space_architecture" / mid
    out_dir = mod_dir / "audios" / mid
    primary_cache = ROOT / "space_architecture" / "audios" / "cache_zh"
    legacy_cache = ROOT / "legacy" / "audios" / "cache_zh"

    out_dir.mkdir(parents=True, exist_ok=True)
    primary_cache.mkdir(parents=True, exist_ok=True)
    cache_dirs = [primary_cache, legacy_cache]

    lead_sil = np.zeros(int(0.15 * 24000), dtype=np.int16)
    samples = [lead_sil]
    cursor = len(lead_sil) / 24000.0
    records = []

    for pi, para in enumerate(paras):
        clauses = split_clauses(para)
        for si, clause in enumerate(clauses):
            seed = 101 + pi * 23 + si * 7
            data = synth_sentence(clause, seed, cache_dirs, tts_url)
            dur = len(data) / 24000.0
            records.append({
                "id": f"p{pi+1}s{si+1}",
                "paragraph": pi + 1,
                "sentence": si + 1,
                "text": clause,
                "start": round(cursor, 3),
                "duration": round(dur, 3),
                "end": round(cursor + dur, 3),
            })
            pause_sec = 0.14 if si < len(clauses) - 1 else 0.28
            pause_samples = np.zeros(int(pause_sec * 24000), dtype=np.int16)
            samples.extend([data, pause_samples])
            cursor += dur + len(pause_samples) / 24000.0

    raw_voice = np.concatenate(samples)
    total_sec = math.ceil((len(raw_voice) / 24000.0 + 0.30) * 30) / 30.0
    raw_voice = np.pad(raw_voice, (0, round(total_sec * 24000) - len(raw_voice)))
    raw_wav = out_dir / "voice.raw.zh.wav"
    norm_wav = out_dir / "voice.zh.wav"
    wavwrite(raw_wav, raw_voice)

    # Loudness normalize to -16 LUFS and resample cleanly to 48kHz PCM WAV
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "warning",
            "-i", str(raw_wav),
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=7",
            "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
            str(norm_wav),
        ],
        check=True,
    )

    meta = {
        "module": mid,
        "title": title,
        "duration": round(total_sec, 3),
        "file": f"audios/{mid}/voice.zh.wav",
        "sentences": records,
    }
    save_json(out_dir / "voice.zh.json", meta)
    print(f"\nSUCCESS {mid}: total duration = {total_sec:.2f}s ({len(records)} clauses)")
    print(f"Generated files:")
    print(f"  - {norm_wav}")
    print(f"  - {out_dir / 'voice.zh.json'}\n")


if __name__ == "__main__":
    url = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_URL
    target = sys.argv[1] if len(sys.argv) > 1 else "02_modeling"
    build_module_tts(target, url)
