#!/usr/bin/env python3
"""Extract structured voiceover blocks and generate missing MiniMax TTS audio.

Default behavior:
  1. Parse "## Full Voiceover Draft" in video/skingen.en.youtube-script.md.
  2. Extract every "### VO NN | start-end | slug | title" block.
  3. Write per-chapter transcript .txt files.
  4. Call video/minimax_tts.py for missing MP3 files.

Existing MP3 files are skipped unless --force is provided.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


DEFAULT_SCRIPT = Path("skingen.en.youtube-script.md")
DEFAULT_TTS_SCRIPT = Path("minimax_tts.py")
DEFAULT_TRANSCRIPT_DIR = Path("hyperframes_codex/audios/transcripts")
DEFAULT_OUTPUT_DIR = Path("hyperframes_codex/audios")
DEFAULT_SUBTITLE_DIR = Path("hyperframes_codex/audios/subtitles")
DEFAULT_METADATA_DIR = Path("hyperframes_codex/audios/metadata")


@dataclass(frozen=True)
class VoiceoverChapter:
    index: int
    time_range: str
    slug: str
    title: str
    audio_file: Path
    target_duration: str
    text: str

    @property
    def transcript_name(self) -> str:
        return f"{self.index:02d}_{self.slug}.txt"

    @property
    def subtitle_name(self) -> str:
        return f"{self.index:02d}_{self.slug}.json"

    @property
    def metadata_name(self) -> str:
        return f"{self.index:02d}_{self.slug}.response.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate missing voiceover MP3s from the structured Full Voiceover Draft.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT, help="Markdown video script.")
    parser.add_argument("--tts-script", type=Path, default=DEFAULT_TTS_SCRIPT, help="MiniMax TTS helper script.")
    parser.add_argument("--transcript-dir", type=Path, default=DEFAULT_TRANSCRIPT_DIR, help="Where chapter .txt files are written.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Used when a block has no Audio file field.")
    parser.add_argument("--subtitle-dir", type=Path, default=DEFAULT_SUBTITLE_DIR, help="Where MiniMax subtitle files are written.")
    parser.add_argument("--metadata-dir", type=Path, default=DEFAULT_METADATA_DIR, help="Where MiniMax response metadata files are written.")
    parser.add_argument("--only", nargs="*", help="Only process these indexes or slugs, e.g. 09 dataset_design.")
    parser.add_argument("--force", action="store_true", help="Regenerate even if the MP3 already exists.")
    parser.add_argument("--extract-only", action="store_true", help="Only write transcript files; do not call TTS.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing transcripts or calling TTS.")
    parser.add_argument("--between-chapter-sleep", type=float, default=0.2, help="Sleep between TTS requests.")
    parser.add_argument("--no-subtitles", action="store_true", help="Do not request MiniMax subtitle timestamps.")
    parser.add_argument("--subtitle-type", choices=("sentence", "word", "word_streaming"), default="word", help="MiniMax subtitle timestamp granularity.")
    parser.add_argument("--save-metadata", action="store_true", help="Save MiniMax response metadata. May include temporary subtitle URLs.")

    # Optional pass-through overrides. If omitted, minimax_tts.py uses its defaults.
    parser.add_argument("--api-key-file", type=Path, help="MiniMax API key file.")
    parser.add_argument("--model", help="MiniMax model override.")
    parser.add_argument("--voice-id", help="Voice ID override.")
    parser.add_argument("--language-boost", help="Language boost override.")
    parser.add_argument("--speed", type=float, help="Voice speed override.")
    parser.add_argument("--volume", type=float, help="Voice volume override.")
    parser.add_argument("--pitch", type=int, help="Voice pitch override.")
    parser.add_argument("--emotion", help="Voice emotion override.")
    return parser.parse_args()


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug or "chapter"


def output_from_block(lines: list[str], index: int, slug: str, output_dir: Path) -> Path:
    for line in lines:
        match = re.match(r"-\s*Audio file:\s*`([^`]+)`", line.strip())
        if match:
            return Path(match.group(1))
    return output_dir / f"{index:02d}_{slug}.mp3"


def duration_from_block(lines: list[str]) -> str:
    for line in lines:
        match = re.match(r"-\s*Target duration:\s*`?([^`]+)`?", line.strip())
        if match:
            return match.group(1).strip()
    return ""


def extract_voiceover_text(lines: list[str]) -> str:
    in_block = False
    text_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not in_block and stripped == "```text":
            in_block = True
            continue
        if in_block and stripped == "```":
            break
        if in_block:
            text_lines.append(line.rstrip())
    text = "\n".join(text_lines).strip()
    if not text:
        raise ValueError("Voiceover block is missing a ```text fenced section.")
    return text


def parse_voiceover_chapters(markdown: str, output_dir: Path) -> list[VoiceoverChapter]:
    lines = markdown.splitlines()
    section_start = None
    for idx, line in enumerate(lines):
        if line.strip() == "## Full Voiceover Draft":
            section_start = idx + 1
            break
    if section_start is None:
        raise ValueError("Could not find '## Full Voiceover Draft'.")

    section_lines: list[str] = []
    for line in lines[section_start:]:
        if line.startswith("## ") and line.strip() != "## Full Voiceover Draft":
            break
        section_lines.append(line)

    heading_re = re.compile(r"^###\s+VO\s+(\d+)\s+\|\s+([^|]+)\s+\|\s+([^|]+)\s+\|\s+(.+)$")
    chapters: list[VoiceoverChapter] = []
    current_heading: re.Match[str] | None = None
    current_lines: list[str] = []

    def flush_current() -> None:
        if current_heading is None:
            return
        index = int(current_heading.group(1))
        time_range = current_heading.group(2).strip()
        slug = slugify(current_heading.group(3).strip())
        title = current_heading.group(4).strip()
        audio_file = output_from_block(current_lines, index, slug, output_dir)
        target_duration = duration_from_block(current_lines)
        text = extract_voiceover_text(current_lines)
        chapters.append(
            VoiceoverChapter(
                index=index,
                time_range=time_range,
                slug=slug,
                title=title,
                audio_file=audio_file,
                target_duration=target_duration,
                text=text,
            )
        )

    for line in section_lines:
        match = heading_re.match(line)
        if match:
            flush_current()
            current_heading = match
            current_lines = []
        elif current_heading is not None:
            current_lines.append(line)
    flush_current()

    if not chapters:
        raise ValueError("No structured VO blocks found.")
    return chapters


def should_process(chapter: VoiceoverChapter, only: list[str] | None) -> bool:
    if not only:
        return True
    wanted = {item.lower() for item in only}
    return f"{chapter.index:02d}" in wanted or str(chapter.index) in wanted or chapter.slug.lower() in wanted


def tts_command(args: argparse.Namespace, chapter: VoiceoverChapter, transcript: Path, output: Path) -> list[str]:
    cmd = [
        sys.executable,
        str(args.tts_script),
        "--input",
        str(transcript),
        "--output",
        str(output),
    ]
    if not args.no_subtitles:
        cmd.extend(
            [
                "--subtitle-enable",
                "--subtitle-type",
                args.subtitle_type,
                "--subtitle-output",
                str(args.subtitle_dir / chapter.subtitle_name),
            ]
        )
        if args.save_metadata:
            cmd.extend(["--metadata-output", str(args.metadata_dir / chapter.metadata_name)])
    pass_through = [
        ("--api-key-file", args.api_key_file),
        ("--model", args.model),
        ("--voice-id", args.voice_id),
        ("--language-boost", args.language_boost),
        ("--speed", args.speed),
        ("--volume", args.volume),
        ("--pitch", args.pitch),
        ("--emotion", args.emotion),
    ]
    for flag, value in pass_through:
        if value is not None:
            cmd.extend([flag, str(value)])
    return cmd


def main() -> int:
    args = parse_args()
    markdown = args.script.read_text(encoding="utf-8")
    chapters = parse_voiceover_chapters(markdown, args.output_dir)
    chapters = [chapter for chapter in chapters if should_process(chapter, args.only)]

    if not chapters:
        print("No matching chapters.")
        return 0

    print(f"Found {len(chapters)} chapter(s).")

    for chapter in chapters:
        transcript_path = args.transcript_dir / chapter.transcript_name
        audio_path = chapter.audio_file
        exists = audio_path.exists()

        print(f"{chapter.index:02d}. {chapter.title} [{chapter.time_range}]")
        print(f"    transcript: {transcript_path}")
        print(f"    audio:      {audio_path}")
        if not args.no_subtitles:
            print(f"    subtitle:   {args.subtitle_dir / chapter.subtitle_name}")
        print(f"    chars:      {len(chapter.text)}")

        if args.dry_run:
            print("    dry-run: no files written")
            continue

        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_text(chapter.text + "\n", encoding="utf-8")

        if args.extract_only:
            print("    extracted transcript only")
            continue

        if exists and not args.force:
            print("    skipped: MP3 already exists")
            continue

        audio_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = tts_command(args, chapter, transcript_path, audio_path)
        print("    generating...")
        subprocess.run(cmd, check=True)
        if args.between_chapter_sleep > 0:
            time.sleep(args.between_chapter_sleep)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
