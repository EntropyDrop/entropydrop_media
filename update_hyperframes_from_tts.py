#!/usr/bin/env python3
"""Update Hyperframes timing from generated MiniMax audio and subtitle files."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_voiceover_audio import (  # noqa: E402
    DEFAULT_OUTPUT_DIR,
    DEFAULT_SCRIPT,
    DEFAULT_SUBTITLE_DIR,
    parse_voiceover_chapters,
)


DEFAULT_HTML = Path("skingen_en/index.html")
DEFAULT_COMBINED_AUDIO = Path("skingen_en/audios/voiceover_full.wav")
SCENE_IDS = [
    "scene-hook",
    "scene-results",
    "scene-cta",
    "scene-skin-structure",
    "scene-hard",
    "scene-general-models",
    "scene-finetune",
    "scene-image-to-skin",
    "scene-dataset",
    "scene-rendering",
    "scene-training-convergence",
    "scene-data-loop",
    "scene-alpha",
    "scene-limits",
    "scene-closing",
]


@dataclass(frozen=True)
class ChapterTiming:
    index: int
    slug: str
    title: str
    audio_file: Path
    subtitle_file: Path
    start: float
    duration: float


@dataclass
class Caption:
    text: str
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.001, self.end - self.start)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync Hyperframes scenes, audio clips, and subtitles from generated MiniMax TTS outputs.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML, help="Hyperframes index.html to update.")
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT, help="Structured video script.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Audio output directory.")
    parser.add_argument("--subtitle-dir", type=Path, default=DEFAULT_SUBTITLE_DIR, help="MiniMax subtitle JSON directory.")
    parser.add_argument("--combined-audio", type=Path, default=DEFAULT_COMBINED_AUDIO, help="Single continuous voiceover audio file used by Hyperframes.")
    parser.add_argument("--no-combined-audio", action="store_true", help="Keep separate per-chapter audio elements instead of one continuous track.")
    parser.add_argument("--rebuild-combined-audio", action="store_true", help="Rebuild the continuous voiceover audio file with ffmpeg.")
    parser.add_argument("--subtitle-offset", type=float, default=0.0, help="Shift generated subtitles in seconds; positive values delay subtitles.")
    parser.add_argument("--max-caption-chars", type=int, default=52, help="Maximum characters per generated subtitle clip.")
    parser.add_argument("--max-caption-duration", type=float, default=2.8, help="Maximum seconds per generated subtitle clip.")
    parser.add_argument("--outro-padding", type=float, default=3.0, help="Seconds to hold the final visual after the voiceover ends.")
    parser.add_argument("--dry-run", action="store_true", help="Print summary without writing HTML.")
    return parser.parse_args()


def fmt_seconds(value: float) -> str:
    return f"{value:.3f}"


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


def build_chapter_timings(args: argparse.Namespace) -> list[ChapterTiming]:
    chapters = parse_voiceover_chapters(args.script.read_text(encoding="utf-8"), args.output_dir)
    timings: list[ChapterTiming] = []
    cursor = 0.0
    for chapter in chapters:
        audio_file = chapter.audio_file
        subtitle_file = args.subtitle_dir / chapter.subtitle_name
        if not audio_file.exists():
            raise FileNotFoundError(audio_file)
        if not subtitle_file.exists():
            raise FileNotFoundError(subtitle_file)
        duration = ffprobe_duration(audio_file)
        timings.append(
            ChapterTiming(
                index=chapter.index,
                slug=chapter.slug,
                title=chapter.title,
                audio_file=audio_file,
                subtitle_file=subtitle_file,
                start=cursor,
                duration=duration,
            )
        )
        cursor += duration
    return timings


def clean_caption_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.?!:;])", r"\1", text)
    text = re.sub(r"([,?!:;])(?=[A-Za-z0-9])", r"\1 ", text)
    text = re.sub(r"\.(?=[A-Z])", ". ", text)
    return text


def time_seconds(value: object) -> float:
    return float(value or 0.0) / 1000.0


def char_time_at(values: list[float | None], index: int, fallback: float) -> float:
    if 0 <= index < len(values) and values[index] is not None:
        return float(values[index])
    for cursor in range(index - 1, -1, -1):
        if values[cursor] is not None:
            return float(values[cursor])
    for cursor in range(index + 1, len(values)):
        if values[cursor] is not None:
            return float(values[cursor])
    return fallback


def span_caption(text: str, starts: list[float | None], ends: list[float | None], span_start: int, span_end: int, fallback_end: float) -> Caption | None:
    raw = text[span_start:span_end]
    caption_text = clean_caption_text(raw)
    if not caption_text:
        return None

    leading = len(raw) - len(raw.lstrip())
    trailing = len(raw.rstrip())
    first = span_start + leading
    last = span_start + trailing - 1
    start = max(0.0, char_time_at(starts, first, 0.0) - 0.04)
    end = min(fallback_end, char_time_at(ends, last, fallback_end) + 0.16)
    if end <= start:
        end = min(fallback_end, start + 0.35)
    return Caption(caption_text, start, end)


def captions_from_word_segment(segment: dict, max_chars: int, max_duration: float) -> list[Caption]:
    text = str(segment.get("text") or "")
    if not text:
        return []

    segment_begin = time_seconds(segment.get("time_begin"))
    segment_end = max(segment_begin + 0.35, time_seconds(segment.get("time_end")))
    starts: list[float | None] = [None] * len(text)
    ends: list[float | None] = [None] * len(text)
    text_offset = int(segment.get("text_begin") or 0)

    for word in segment.get("timestamped_words") or []:
        begin = int(word.get("word_begin") or 0) - text_offset
        end = int(word.get("word_end") or begin) - text_offset
        if end <= 0 or begin >= len(text):
            continue
        begin = max(0, begin)
        end = min(len(text), end)
        word_begin = time_seconds(word.get("time_begin"))
        word_end = time_seconds(word.get("time_end"))
        for index in range(begin, end):
            starts[index] = word_begin if starts[index] is None else min(starts[index], word_begin)
            ends[index] = word_end if ends[index] is None else max(ends[index], word_end)

    tokens = list(re.finditer(r"\S+\s*", text))
    captions: list[Caption] = []
    chunk_start: int | None = None
    chunk_end = 0

    for token in tokens:
        if chunk_start is None:
            chunk_start = token.start()
        chunk_end = token.end()
        candidate = clean_caption_text(text[chunk_start:chunk_end])
        local_start = char_time_at(starts, chunk_start, segment_begin)
        local_end = char_time_at(ends, max(chunk_start, chunk_end - 1), segment_end)
        token_text = token.group(0).strip()
        hard_punctuation = token_text.endswith((".", "?", "!", ":"))
        soft_punctuation = token_text.endswith((",", ";"))

        should_break = (
            len(candidate) >= max_chars
            or (local_end - local_start >= max_duration and len(candidate) >= 26)
            or (hard_punctuation and (len(candidate) >= 18 or local_end - local_start >= 1.2))
            or (soft_punctuation and len(candidate) >= max_chars * 0.72)
        )
        if should_break:
            caption = span_caption(text, starts, ends, chunk_start, chunk_end, segment_end)
            if caption:
                captions.append(caption)
            chunk_start = None

    if chunk_start is not None and chunk_start < chunk_end:
        caption = span_caption(text, starts, ends, chunk_start, chunk_end, segment_end)
        if caption:
            captions.append(caption)
    return captions


def captions_from_subtitle_file(path: Path, chapter_start: float, chapter_duration: float, max_chars: int, max_duration: float) -> list[Caption]:
    data = json.loads(path.read_text(encoding="utf-8"))
    captions: list[Caption] = []
    for segment in data:
        if segment.get("timestamped_words"):
            local_captions = captions_from_word_segment(segment, max_chars, max_duration)
        else:
            local_captions = [
                Caption(
                    clean_caption_text(str(segment.get("text") or "")),
                    time_seconds(segment.get("time_begin")),
                    time_seconds(segment.get("time_end")),
                )
            ]
        for caption in local_captions:
            start = chapter_start + max(0.0, caption.start)
            end = chapter_start + min(chapter_duration, caption.end)
            if end > start and caption.text:
                captions.append(Caption(caption.text, start, end))
    return captions


def build_all_captions(timings: list[ChapterTiming], max_chars: int, max_duration: float, subtitle_offset: float) -> list[Caption]:
    captions: list[Caption] = []
    for timing in timings:
        captions.extend(captions_from_subtitle_file(timing.subtitle_file, timing.start, timing.duration, max_chars, max_duration))

    captions.sort(key=lambda item: (item.start, item.end))
    previous_end = 0.0
    for caption in captions:
        caption.start = max(0.0, caption.start + subtitle_offset)
        caption.end = max(caption.start + 0.001, caption.end + subtitle_offset)
        if caption.start < previous_end + 0.004:
            caption.start = previous_end + 0.004
        if caption.end <= caption.start:
            caption.end = caption.start + 0.12
        previous_end = caption.end

    rounded_previous_end = 0.0
    for caption in captions:
        rounded_start = float(fmt_seconds(caption.start))
        rounded_end = float(fmt_seconds(caption.end))
        if rounded_start <= rounded_previous_end:
            rounded_start = rounded_previous_end + 0.004
        if rounded_end <= rounded_start:
            rounded_end = rounded_start + 0.12
        caption.start = rounded_start
        caption.end = rounded_end
        rounded_previous_end = rounded_end
    return captions


def rebuild_combined_audio(timings: list[ChapterTiming], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".ffconcat", delete=False) as handle:
        list_path = Path(handle.name)
        for timing in timings:
            audio_path = timing.audio_file.resolve()
            handle.write(f"file '{audio_path.as_posix()}'\n")

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
                str(output),
            ],
            check=True,
        )
    finally:
        list_path.unlink(missing_ok=True)


def versioned_audio_path(path: Path) -> Path:
    version = int(path.stat().st_mtime)
    versioned = path.with_name(f"{path.stem}_{version}{path.suffix}")
    for old_path in path.parent.glob(f"{path.stem}_*{path.suffix}"):
        if old_path != versioned:
            old_path.unlink(missing_ok=True)
    if not versioned.exists() or versioned.stat().st_size != path.stat().st_size:
        shutil.copy2(path, versioned)
    return versioned


def replace_attr(html_text: str, element_id: str, attr: str, value: float) -> str:
    pattern = rf'(<[^>]+id="{re.escape(element_id)}"[^>]*\s{attr}=")[^"]+(")'
    replaced, count = re.subn(pattern, rf"\g<1>{fmt_seconds(value)}\2", html_text, count=1)
    if count != 1:
        raise ValueError(f"Could not update {attr} for #{element_id}.")
    return replaced


def extract_showcase_ids(html_text: str) -> list[str]:
    match = re.search(r'<section id="scene-results"[\s\S]*?</section>', html_text)
    if not match:
        return []
    return re.findall(r'id="(showcase-[^"]+)"\s+class="showcase-shot\b', match.group(0))


def update_scene_and_showcase_timing(html_text: str, timings: list[ChapterTiming], outro_padding: float) -> str:
    audio_duration = sum(item.duration for item in timings)
    composition_duration = audio_duration + max(0.0, outro_padding)
    html_text = re.sub(
        r'(<div id="root"[^>]*data-duration=")[^"]+(")',
        rf"\g<1>{fmt_seconds(composition_duration)}\2",
        html_text,
        count=1,
    )

    for index, (scene_id, timing) in enumerate(zip(SCENE_IDS, timings)):
        html_text = replace_attr(html_text, scene_id, "data-start", timing.start)
        duration = timing.duration + max(0.0, outro_padding) if index == len(SCENE_IDS) - 1 else timing.duration
        html_text = replace_attr(html_text, scene_id, "data-duration", duration)

    results = timings[1]
    showcases = extract_showcase_ids(html_text)
    if not showcases:
        raise ValueError("Could not find showcase clips in #scene-results.")
    showcase_start = timings[0].start
    showcase_duration = timings[2].start - showcase_start if len(timings) >= 3 else timings[0].duration + results.duration
    html_text = replace_attr(html_text, "scene-results", "data-start", showcase_start)
    html_text = replace_attr(html_text, "scene-results", "data-duration", showcase_duration)
    showcase_dur = showcase_duration / len(showcases)
    for idx, showcase_id in enumerate(showcases):
        start = showcase_start + idx * showcase_dur
        html_text = replace_attr(html_text, showcase_id, "data-start", start)
        html_text = replace_attr(html_text, showcase_id, "data-duration", showcase_dur)

    if 'id="skin-uv-closeup"' in html_text and len(timings) >= 4:
        skin_structure = timings[3]
        # VO04 has hand-directed beats: hold the UV map for the coordinate-system
        # explanation, hold the layer diagram for overlay geometry, then play the
        # folding animation only for the final wrap-to-3D explanation.
        uv_duration = min(53.0, max(14.0, skin_structure.duration - 33.652))
        layers_duration = min(13.5, max(8.0, skin_structure.duration - uv_duration - 20.152))
        fold_start = skin_structure.start + uv_duration + layers_duration
        fold_duration = max(1.0, skin_structure.start + skin_structure.duration - fold_start)
        fold_video_duration = min(20.2, fold_duration)

        html_text = replace_attr(html_text, "skin-uv-closeup", "data-start", skin_structure.start)
        html_text = replace_attr(html_text, "skin-uv-closeup", "data-duration", uv_duration)
        html_text = replace_attr(html_text, "skin-layers-closeup", "data-start", skin_structure.start + uv_duration)
        html_text = replace_attr(html_text, "skin-layers-closeup", "data-duration", layers_duration)
        html_text = replace_attr(html_text, "skin-fold-video", "data-start", fold_start)
        html_text = replace_attr(html_text, "skin-fold-video", "data-duration", fold_duration)
        html_text = replace_attr(html_text, "uv-fold-video", "data-start", fold_start)
        html_text = replace_attr(html_text, "uv-fold-video", "data-duration", fold_video_duration)

    if 'id="cta-demo-video"' in html_text and len(timings) >= 3:
        cta = timings[2]
        html_text = replace_attr(html_text, "cta-demo-video", "data-start", cta.start)
        html_text = replace_attr(html_text, "cta-demo-video", "data-duration", cta.duration)

    if 'id="hard-fold-video"' in html_text and len(timings) >= 5:
        hard = timings[4]
        html_text = replace_attr(html_text, "hard-fold-video", "data-start", hard.start)
        html_text = replace_attr(html_text, "hard-fold-video", "data-duration", hard.duration)
        html_text = replace_attr(html_text, "hard-video-label", "data-start", hard.start)
        html_text = replace_attr(html_text, "hard-video-label", "data-duration", hard.duration)

    if 'id="render-pair-surface"' in html_text and len(timings) >= 10:
        rendering = timings[9]
        render_pairs = [
            ("render-pair-surface", 0.000, 20.451),
            ("render-pair-camera", 20.451, 14.112),
            ("render-pair-lighting", 34.563, 10.656),
            ("render-pair-layers", 45.219, max(1.0, rendering.duration - 45.219)),
        ]
        for pair_id, offset, duration in render_pairs:
            html_text = replace_attr(html_text, pair_id, "data-start", rendering.start + offset)
            html_text = replace_attr(html_text, pair_id, "data-duration", duration)

    if 'id="training-phase-early"' in html_text and len(timings) >= 11:
        training = timings[10]
        phase_plan = [
            ("training-phase-early", 0.00, 0.28),
            ("training-phase-mid", 0.28, 0.19),
            ("training-phase-late", 0.47, 0.29),
            ("training-phase-final", 0.76, 0.24),
        ]
        for phase_id, offset_ratio, duration_ratio in phase_plan:
            phase_start = training.start + training.duration * offset_ratio
            phase_duration = max(1.0, training.duration * duration_ratio)
            html_text = replace_attr(html_text, phase_id, "data-start", phase_start)
            html_text = replace_attr(html_text, phase_id, "data-duration", phase_duration)
    return html_text


def build_audio_and_subtitle_block(
    timings: list[ChapterTiming],
    captions: list[Caption],
    combined_audio: Path | None,
    outro_padding: float,
    html_parent: Path,
) -> str:
    lines = [
        '    <!-- Voiceover audio generated from MiniMax TTS outputs. -->',
    ]

    if combined_audio is not None:
        src = combined_audio.relative_to(html_parent).as_posix()
        lines.append(
            f'    <audio id="vo-full" class="clip voiceover-track" src="{src}" '
            f'data-start="0" data-duration="{fmt_seconds(sum(item.duration for item in timings) + max(0.0, outro_padding))}" '
            f'data-track-index="70" data-media-start="0" data-volume="1" preload="auto"></audio>'
        )
    else:
        for offset, timing in enumerate(timings, 70):
            src = timing.audio_file.relative_to(html_parent).as_posix()
            lines.append(
                f'    <audio id="vo-{timing.index:02d}" class="clip voiceover-track" src="{src}" '
                f'data-start="{fmt_seconds(timing.start)}" data-duration="{fmt_seconds(timing.duration)}" '
                f'data-track-index="{offset}" data-media-start="0" data-volume="1" preload="auto"></audio>'
            )

    lines.append("")
    lines.append("    <!-- Word-timed subtitles generated from MiniMax subtitle JSON files. -->")
    for index, caption in enumerate(captions, 1):
        escaped_text = html.escape(caption.text, quote=False)
        lines.append(
            f'    <div id="sub-{index:03d}" class="subtitle-line clip" '
            f'data-start="{fmt_seconds(caption.start)}" data-duration="{fmt_seconds(caption.duration)}" '
            f'data-track-index="50"><span class="subtitle-copy">{escaped_text}</span></div>'
        )
    return "\n".join(lines)


def replace_audio_and_subtitles(html_text: str, block: str) -> str:
    start_match = re.search(
        r'(?m)^[ \t]*(?:<!-- Voiceover audio generated|<audio id="vo-(?:01|full)")',
        html_text,
    )
    if start_match is None:
        raise ValueError("Could not find generated audio/subtitle block start.")
    start = start_match.start()

    end_match = re.search(r'(?m)^[ \t]*</div>\s*\n[ \t]*<script>', html_text[start:])
    if end_match is None:
        raise ValueError("Could not find root closing marker after generated subtitles.")
    end = start + end_match.start()
    return html_text[:start] + block + "\n" + html_text[end:]


def main() -> int:
    args = parse_args()
    timings = build_chapter_timings(args)
    captions = build_all_captions(timings, args.max_caption_chars, args.max_caption_duration, args.subtitle_offset)
    html_text = args.html.read_text(encoding="utf-8")
    html_text = update_scene_and_showcase_timing(html_text, timings, args.outro_padding)

    combined_audio = None if args.no_combined_audio else args.combined_audio
    if combined_audio is not None and (args.rebuild_combined_audio or not combined_audio.exists()) and not args.dry_run:
        rebuild_combined_audio(timings, combined_audio)

    html_text = replace_audio_and_subtitles(
        html_text,
        build_audio_and_subtitle_block(timings, captions, combined_audio, args.outro_padding, args.html.parent),
    )

    total_duration = sum(item.duration for item in timings)
    composition_duration = total_duration + max(0.0, args.outro_padding)
    print(f"Chapters: {len(timings)}")
    print(f"Captions: {len(captions)}")
    print(f"Audio duration: {total_duration:.3f}s")
    print(f"Composition duration: {composition_duration:.3f}s")
    if combined_audio is not None:
        print(f"Combined audio: {combined_audio}")
    if args.dry_run:
        return 0

    args.html.write_text(html_text, encoding="utf-8")
    print(f"Updated: {args.html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
