#!/usr/bin/env python3
"""Sync this Shorts Hyperframes project to generated voiceover audio."""

from __future__ import annotations

import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HTML_PATH = ROOT / "index.html"
SCRIPT_PATH = ROOT / "top5_marvel_shorts_en.youtube-script.md"
COMBINED_AUDIO = ROOT / "audios" / "voiceover_full.wav"

RANK_SCENES = ["rank-5", "rank-4", "rank-3", "rank-2", "rank-1"]
DANCE_VIDEO_IDS = {
    "rank-5": "rank-5-dance-video",
    "rank-4": "rank-4-dance-video",
    "rank-3": "rank-3-dance-video",
    "rank-2": "rank-2-dance-video",
    "rank-1": "rank-1-dance-video",
}
OPENING_INTRO_DURATION = 1.0
COUNT_DURATION = 1.2
ORIGINAL_DURATION = 1.25


@dataclass(frozen=True)
class Chapter:
    index: int
    slug: str
    title: str
    audio_file: Path
    start: float
    duration: float

    @property
    def end(self) -> float:
        return self.start + self.duration


def fmt(value: float) -> str:
    return f"{value:.3f}"


def fmt_clock(value: float) -> str:
    minutes = int(value // 60)
    seconds = value - minutes * 60
    return f"{minutes}:{seconds:05.2f}"


def ffprobe_duration(path: Path) -> float:
    output = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(output)


def parse_audio_files(markdown: str) -> list[tuple[int, str, str, Path]]:
    heading_re = re.compile(r"^###\s+VO\s+(\d+)\s+\|\s+([^|]+)\s+\|\s+([^|]+)\s+\|\s+(.+)$", re.MULTILINE)
    matches = list(heading_re.finditer(markdown))
    chapters: list[tuple[int, str, str, Path]] = []
    for pos, match in enumerate(matches):
        block_start = match.end()
        block_end = matches[pos + 1].start() if pos + 1 < len(matches) else len(markdown)
        block = markdown[block_start:block_end]
        audio_match = re.search(r"-\s*Audio file:\s*`([^`]+)`", block)
        if not audio_match:
            raise ValueError(f"VO {match.group(1)} is missing an Audio file line.")
        audio_file = ROOT.parent / audio_match.group(1)
        chapters.append((int(match.group(1)), match.group(3).strip(), match.group(4).strip(), audio_file))
    if not chapters:
        raise ValueError("No VO blocks found in script.")
    return chapters


def build_chapters() -> list[Chapter]:
    markdown = SCRIPT_PATH.read_text(encoding="utf-8")
    cursor = 0.0
    chapters: list[Chapter] = []
    for index, slug, title, audio_file in parse_audio_files(markdown):
        if not audio_file.exists():
            raise FileNotFoundError(audio_file)
        duration = ffprobe_duration(audio_file)
        chapters.append(Chapter(index=index, slug=slug, title=title, audio_file=audio_file, start=cursor, duration=duration))
        cursor += duration
    return chapters


def rebuild_combined_audio(chapters: list[Chapter]) -> None:
    COMBINED_AUDIO.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".ffconcat", delete=False) as handle:
        list_path = Path(handle.name)
        for chapter in chapters:
            handle.write(f"file '{chapter.audio_file.resolve().as_posix()}'\n")
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_path),
                "-ar",
                "32000",
                "-ac",
                "1",
                str(COMBINED_AUDIO),
            ],
            check=True,
        )
    finally:
        list_path.unlink(missing_ok=True)


def replace_attr(html: str, element_id: str, attr: str, value: float) -> str:
    pattern = rf'(<[^>]+id="{re.escape(element_id)}"[^>]*\s{attr}=")[^"]+(")'
    html, count = re.subn(pattern, rf"\g<1>{fmt(value)}\2", html, count=1)
    if count != 1:
        raise ValueError(f"Could not update {attr} for #{element_id}.")
    return html


def replace_root_duration(html: str, duration: float) -> str:
    html, count = re.subn(
        r'(<div id="root"[^>]*data-duration=")[^"]+(")',
        rf"\g<1>{fmt(duration)}\2",
        html,
        count=1,
    )
    if count != 1:
        raise ValueError("Could not update #root data-duration.")
    return html


def reveal_offset(scene_id: str) -> float:
    if scene_id == "rank-5":
        return OPENING_INTRO_DURATION + COUNT_DURATION + ORIGINAL_DURATION
    return COUNT_DURATION + ORIGINAL_DURATION


def build_audio_block(total_duration: float) -> str:
    src = COMBINED_AUDIO.relative_to(ROOT).as_posix()
    return "\n".join(
        [
            "    <!-- Voiceover audio generated from MiniMax TTS outputs. -->",
            f'    <audio id="vo-full" class="clip voiceover-track" src="{src}" data-start="0" '
            f'data-duration="{fmt(total_duration)}" data-track-index="70" data-media-start="0" '
            'data-volume="1" preload="auto"></audio>',
        ]
    )


def replace_audio_block(html: str, total_duration: float) -> str:
    block = build_audio_block(total_duration)
    existing = re.search(
        r'\n\s*<!-- Voiceover audio generated from MiniMax TTS outputs\. -->\n\s*<audio id="vo-full"[\s\S]*?</audio>\n?',
        html,
    )
    if existing:
        return html[: existing.start()] + "\n" + block + "\n" + html[existing.end() :]
    marker = '    <div class="progress-track" aria-hidden="true">'
    if marker not in html:
        raise ValueError("Could not find progress-track insertion point.")
    return html.replace(marker, block + "\n\n" + marker, 1)


def update_html(chapters: list[Chapter]) -> None:
    total_duration = chapters[-1].end
    html = HTML_PATH.read_text(encoding="utf-8")
    html = replace_root_duration(html, total_duration)

    visual_chapters = chapters[:5]
    closing = chapters[5]
    for scene_id, chapter in zip(RANK_SCENES, visual_chapters):
        html = replace_attr(html, scene_id, "data-start", chapter.start)
        html = replace_attr(html, scene_id, "data-duration", chapter.duration)

        offset = reveal_offset(scene_id)
        video_start = chapter.start + offset
        video_duration = max(0.25, chapter.duration - offset)
        video_id = DANCE_VIDEO_IDS[scene_id]
        html = replace_attr(html, video_id, "data-start", video_start)
        html = replace_attr(html, video_id, "data-duration", video_duration)

    html = replace_attr(html, "outro", "data-start", closing.start)
    html = replace_attr(html, "outro", "data-duration", closing.duration)
    html = replace_audio_block(html, total_duration)
    HTML_PATH.write_text(html, encoding="utf-8")


def replace_script_storyboard(markdown: str, chapters: list[Chapter]) -> str:
    c = chapters
    rows = [
        "| Time | Visual Direction | Voiceover Focus | On-Screen Text |",
        "| :--- | :--- | :--- | :--- |",
        f"| {fmt_clock(0)}-{fmt_clock(OPENING_INTRO_DURATION)} | Full-screen title card with no character reveal | Read the title without spoiling #5 | `Top 5 Popular Marvel Characters as Minecraft Skins` |",
    ]
    names = ["Doctor Strange", "Deadpool", "Thor", "Iron Man", "Spider-Man"]
    focuses = [
        "Multiverse-stage popularity",
        "Short-form and meme popularity",
        "Original Avenger recognition",
        "MCU legacy and fan loyalty",
        "Global icon status",
    ]
    notes = [
        "The MCU's multiverse guide and one of Marvel's strongest modern leads.",
        "The fourth-wall antihero built for memes, searches, and short-form chaos.",
        "An original Avenger god with decade-long mainstream recognition.",
        "Tony Stark became the MCU's foundation and a fan legend.",
        "Marvel's global icon, loved across comics, movies, and every generation.",
    ]
    for idx, chapter in enumerate(c[:5]):
        scene_id = RANK_SCENES[idx]
        count_start = chapter.start + (OPENING_INTRO_DURATION if scene_id == "rank-5" else 0.0)
        original_start = count_start + COUNT_DURATION
        reveal_start = chapter.start + reveal_offset(scene_id)
        rank = 5 - idx
        name = names[idx]
        rows.extend(
            [
                f"| {fmt_clock(count_start)}-{fmt_clock(original_start)} | Full-screen countdown card: `#{rank}` | Reveal {name} | `#{rank}` / `{name}` |",
                f"| {fmt_clock(original_start)}-{fmt_clock(reveal_start)} | {name} original image full-screen | Show source image | `Original` |",
                f"| {fmt_clock(reveal_start)}-{fmt_clock(chapter.end)} | Original shrinks to lower-left; dancing Minecraft skin dominates | {focuses[idx]} | `Minecraft skin reveal` / `{notes[idx]}` |",
            ]
        )
    rows.append(
        f"| {fmt_clock(c[5].start)}-{fmt_clock(c[5].end)} | Clean EntropyDrop ad end card with no ranking numbers | Promote the skin generator | `Make your own Minecraft skin` / `Skins generated by EntropyDrop.com` |"
    )
    storyboard = "## Storyboard\n\n" + "\n".join(rows) + "\n"
    return re.sub(r"## Storyboard\n[\s\S]*?\n## Full Voiceover Draft", storyboard + "\n## Full Voiceover Draft", markdown, count=1)


def update_script(chapters: list[Chapter]) -> None:
    markdown = SCRIPT_PATH.read_text(encoding="utf-8")
    markdown = re.sub(r"- Target length: .*", f"- Target length: {fmt(chapters[-1].end)} seconds", markdown, count=1)
    markdown = replace_script_storyboard(markdown, chapters)

    heading_re = re.compile(r"^(###\s+VO\s+(\d+)\s+\|\s+)([^|]+)(\s+\|\s+[^|]+\s+\|)", re.MULTILINE)

    def heading_repl(match: re.Match[str]) -> str:
        index = int(match.group(2))
        chapter = chapters[index - 1]
        return f"{match.group(1)}{fmt_clock(chapter.start)}-{fmt_clock(chapter.end)}{match.group(4)}"

    markdown = heading_re.sub(heading_repl, markdown)

    duration_re = re.compile(r"- Target duration:\s*`?[^`\n]+`?")
    cursor = 0

    def duration_repl(_: re.Match[str]) -> str:
        nonlocal cursor
        chapter = chapters[cursor]
        cursor += 1
        return f"- Target duration: `{fmt(chapter.duration)}s`"

    markdown = duration_re.sub(duration_repl, markdown, count=len(chapters))
    SCRIPT_PATH.write_text(markdown, encoding="utf-8")


def main() -> int:
    chapters = build_chapters()
    rebuild_combined_audio(chapters)
    update_html(chapters)
    update_script(chapters)
    print("Synced timing to audio:")
    for chapter in chapters:
        print(f"  VO {chapter.index:02d}: {fmt_clock(chapter.start)}-{fmt_clock(chapter.end)} ({fmt(chapter.duration)}s)")
    print(f"  total: {fmt(chapters[-1].end)}s")
    print(f"  combined audio: {COMBINED_AUDIO.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
