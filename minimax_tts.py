#!/usr/bin/env python3
"""Generate speech audio with MiniMax T2A HTTP.

Reads the API key from .minimax_api_key by default. The script uses the
non-streaming /v1/t2a_v2 endpoint and writes the returned hex audio to a file.
Long text is split into chunks because MiniMax recommends streaming for texts
over 3,000 characters.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable


DEFAULT_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2"
DEFAULT_MODEL = "speech-2.8-hd"
#DEFAULT_VOICE_ID = "English_expressive_narrator"
DEFAULT_VOICE_ID = "English_Aussie_Bloke"
DEFAULT_OUTPUT = "hyperframes_codex/audios/test.mp3"


class MiniMaxTTSError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate TTS audio with MiniMax T2A HTTP.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    input_group = parser.add_mutually_exclusive_group(required=False)
    input_group.add_argument("--text", help="Text to synthesize.")
    input_group.add_argument("--input", "-i", type=Path, help="Text file to synthesize.")

    parser.add_argument("--output", "-o", type=Path, default=Path(DEFAULT_OUTPUT), help="Output audio path.")
    parser.add_argument("--api-key-file", type=Path, default=Path(".minimax_api_key"), help="MiniMax API key file.")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="MiniMax T2A HTTP endpoint.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="MiniMax speech model.")
    parser.add_argument("--voice-id", default=DEFAULT_VOICE_ID, help="Voice ID.")
    parser.add_argument("--language-boost", default="auto", help="Language boost value, such as auto, English, Chinese.")
    parser.add_argument("--speed", type=float, default=1.0, help="Voice speed.")
    parser.add_argument("--volume", type=float, default=1.0, help="Voice volume.")
    parser.add_argument("--pitch", type=int, default=-1, help="Voice pitch.")
    parser.add_argument("--emotion", help="Optional emotion, if supported by the voice/model.")
    parser.add_argument("--format", choices=("mp3", "wav", "flac"), default="mp3", help="Output audio format.")
    parser.add_argument("--sample-rate", type=int, default=32000, help="Audio sample rate.")
    parser.add_argument("--bitrate", type=int, default=128000, help="Audio bitrate.")
    parser.add_argument("--channel", type=int, choices=(1, 2), default=1, help="Audio channel count.")
    parser.add_argument("--chunk-size", type=int, default=2800, help="Max text characters per request. Use 0 to disable.")
    parser.add_argument("--keep-chunks", action="store_true", help="Also write numbered chunk files next to the output.")
    parser.add_argument("--sleep", type=float, default=0.2, help="Seconds to sleep between chunk requests.")
    parser.add_argument("--subtitle-enable", action="store_true", help="Ask MiniMax to generate subtitle timestamps.")
    parser.add_argument(
        "--subtitle-type",
        choices=("sentence", "word", "word_streaming"),
        default="sentence",
        help="MiniMax subtitle timestamp granularity.",
    )
    parser.add_argument("--subtitle-output", type=Path, help="Where to save the returned subtitle file/content.")
    parser.add_argument("--metadata-output", type=Path, help="Where to save response metadata without audio hex.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned requests without calling the API.")
    return parser.parse_args()


def read_api_key(path: Path) -> str:
    try:
        key = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise MiniMaxTTSError(f"API key file not found: {path}") from exc
    if not key:
        raise MiniMaxTTSError(f"API key file is empty: {path}")
    return key


def read_text(args: argparse.Namespace) -> str:
    if args.text is not None:
        text = args.text
    elif args.input is not None:
        text = args.input.read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        raise MiniMaxTTSError("Provide --text, --input, or pipe text through stdin.")

    text = text.strip()
    if not text:
        raise MiniMaxTTSError("No text to synthesize.")
    return text


def split_long_sentence(sentence: str, limit: int) -> Iterable[str]:
    words = sentence.split()
    if len(sentence) <= limit or len(words) <= 1:
        for start in range(0, len(sentence), limit):
            yield sentence[start : start + limit].strip()
        return

    chunk: list[str] = []
    chunk_len = 0
    for word in words:
        next_len = chunk_len + len(word) + (1 if chunk else 0)
        if chunk and next_len > limit:
            yield " ".join(chunk)
            chunk = [word]
            chunk_len = len(word)
        else:
            chunk.append(word)
            chunk_len = next_len
    if chunk:
        yield " ".join(chunk)


def split_text(text: str, limit: int) -> list[str]:
    if limit <= 0 or len(text) <= limit:
        return [text]

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    pieces: list[str] = []
    sentence_pattern = re.compile(r"(?<=[.!?。！？])\s+")

    for paragraph in paragraphs:
        if len(paragraph) <= limit:
            pieces.append(paragraph)
            continue
        for sentence in sentence_pattern.split(paragraph):
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) <= limit:
                pieces.append(sentence)
            else:
                pieces.extend(split_long_sentence(sentence, limit))

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        separator = "\n\n" if current else ""
        if current and len(current) + len(separator) + len(piece) > limit:
            chunks.append(current)
            current = piece
        else:
            current = f"{current}{separator}{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def build_payload(args: argparse.Namespace, text: str) -> dict:
    subtitle_enabled = args.subtitle_enable or args.subtitle_output is not None
    voice_setting = {
        "voice_id": args.voice_id,
        "speed": args.speed,
        "vol": args.volume,
        "pitch": args.pitch,
    }
    if args.emotion:
        voice_setting["emotion"] = args.emotion

    payload = {
        "model": args.model,
        "text": text,
        "stream": False,
        "language_boost": args.language_boost,
        "output_format": "hex",
        "voice_setting": voice_setting,
        "audio_setting": {
            "sample_rate": args.sample_rate,
            "bitrate": args.bitrate,
            "format": args.format,
            "channel": args.channel,
        },
        "subtitle_enable": subtitle_enabled,
    }
    if subtitle_enabled:
        payload["subtitle_type"] = args.subtitle_type
    return payload


def post_tts(endpoint: str, api_key: str, payload: dict) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise MiniMaxTTSError(f"MiniMax HTTP {exc.code}: {error_body}") from exc
    except urllib.error.URLError as exc:
        raise MiniMaxTTSError(f"MiniMax request failed: {exc}") from exc

    try:
        return json.loads(response_body)
    except json.JSONDecodeError as exc:
        raise MiniMaxTTSError(f"MiniMax returned non-JSON response: {response_body[:500]}") from exc


def extract_audio_bytes(response: dict) -> bytes:
    base_resp = response.get("base_resp") or response.get("base_response")
    if isinstance(base_resp, dict):
        status_code = base_resp.get("status_code")
        if status_code not in (None, 0):
            message = base_resp.get("status_msg") or base_resp.get("status_message") or base_resp
            raise MiniMaxTTSError(f"MiniMax API error: {message}")

    data = response.get("data")
    if not isinstance(data, dict):
        raise MiniMaxTTSError(f"Missing response data: {response}")

    audio_hex = data.get("audio")
    if not audio_hex:
        raise MiniMaxTTSError(f"Missing data.audio in response: {response}")

    try:
        return bytes.fromhex(audio_hex)
    except ValueError as exc:
        raise MiniMaxTTSError("data.audio was not valid hex audio.") from exc


def extract_subtitle_reference(response: dict) -> str | None:
    data = response.get("data")
    if not isinstance(data, dict):
        return None
    subtitle = data.get("subtitle_file") or data.get("subtitle") or data.get("subtitle_url")
    if subtitle is None:
        return None
    if not isinstance(subtitle, str):
        return json.dumps(subtitle, ensure_ascii=False, indent=2)
    return subtitle


def write_response_metadata(response: dict, output: Path) -> None:
    metadata = json.loads(json.dumps(response))
    data = metadata.get("data")
    if isinstance(data, dict) and isinstance(data.get("audio"), str):
        data["audio"] = f"<omitted {len(data['audio'])} hex chars>"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_subtitle_reference(reference: str, output: Path, api_key: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if reference.startswith(("http://", "https://")):
        request = urllib.request.Request(reference, headers={"Authorization": f"Bearer {api_key}"})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                output.write_bytes(response.read())
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise MiniMaxTTSError(f"MiniMax subtitle HTTP {exc.code}: {error_body}") from exc
        except urllib.error.URLError as exc:
            raise MiniMaxTTSError(f"MiniMax subtitle download failed: {exc}") from exc
    else:
        output.write_text(reference.rstrip() + "\n", encoding="utf-8")


def chunk_output_path(output: Path, index: int) -> Path:
    return output.with_name(f"{output.stem}.part{index:03d}{output.suffix}")


def main() -> int:
    args = parse_args()
    text = read_text(args)
    chunks = split_text(text, args.chunk_size)

    if len(chunks) > 1 and args.format != "mp3":
        raise MiniMaxTTSError("Chunk merging is only supported for mp3. Use --format mp3 or reduce text length.")

    print(f"Text length: {len(text)} characters")
    print(f"Requests: {len(chunks)} chunk(s)")
    print(f"Output: {args.output}")
    if args.subtitle_enable or args.subtitle_output is not None:
        print(f"Subtitle type: {args.subtitle_type}")
        if args.subtitle_output is not None:
            print(f"Subtitle output: {args.subtitle_output}")

    if args.dry_run:
        for index, chunk in enumerate(chunks, 1):
            print(f"chunk {index:03d}: {len(chunk)} characters")
        return 0

    api_key = read_api_key(args.api_key_file)
    audio_parts: list[bytes] = []

    for index, chunk in enumerate(chunks, 1):
        print(f"Requesting chunk {index}/{len(chunks)} ({len(chunk)} chars)...")
        payload = build_payload(args, chunk)
        response = post_tts(args.endpoint, api_key, payload)
        audio = extract_audio_bytes(response)
        audio_parts.append(audio)

        if args.metadata_output is not None:
            metadata_path = args.metadata_output if len(chunks) == 1 else chunk_output_path(args.metadata_output, index)
            write_response_metadata(response, metadata_path)
            print(f"  wrote metadata {metadata_path}")

        if args.subtitle_output is not None:
            subtitle_reference = extract_subtitle_reference(response)
            if not subtitle_reference:
                raise MiniMaxTTSError("MiniMax response did not include data.subtitle_file.")
            subtitle_path = args.subtitle_output if len(chunks) == 1 else chunk_output_path(args.subtitle_output, index)
            write_subtitle_reference(subtitle_reference, subtitle_path, api_key)
            print(f"  wrote subtitle {subtitle_path}")

        if args.keep_chunks or len(chunks) > 1:
            part_path = chunk_output_path(args.output, index)
            part_path.parent.mkdir(parents=True, exist_ok=True)
            part_path.write_bytes(audio)
            print(f"  wrote {part_path}")

        if index < len(chunks) and args.sleep > 0:
            time.sleep(args.sleep)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(b"".join(audio_parts))
    print(f"Done: {args.output} ({args.output.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MiniMaxTTSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
