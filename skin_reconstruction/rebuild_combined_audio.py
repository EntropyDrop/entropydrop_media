#!/usr/bin/env python3
"""Build the continuous voiceover_full.wav aligned with the video timeline."""

import subprocess
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIOS_DIR = ROOT / "audios"
OUTPUT_FILE = AUDIOS_DIR / "voiceover_full.wav"

SCRIPT_PATH = ROOT.parent / "skin-reconstruction.en.youtube-script.md"


def read_chapter_timeline():
    def seconds(stamp):
        minutes, value = stamp.strip().split(":")
        return int(minutes) * 60 + float(value)

    chapters = []
    end = 0.0
    pattern = r"^### VO (\d+) \| ([^|]+) \| ([^|]+) \|"
    for number, time_range, slug in re.findall(pattern, SCRIPT_PATH.read_text(encoding="utf-8"), re.MULTILINE):
        start, next_end = map(seconds, time_range.strip().split("-"))
        if int(number) != len(chapters) + 1 or abs(start - end) > 0.000001 or next_end <= start:
            raise ValueError(f"Invalid chapter timeline at VO {number}")
        chapters.append((AUDIOS_DIR / f"{int(number):02d}_{slug.strip()}.mp3", start))
        end = next_end
    if len(chapters) != 10:
        raise ValueError("Expected 10 voiceover chapters in the script")
    return chapters, end


CHAPTERS, TOTAL_DURATION = read_chapter_timeline()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio-dir", type=Path, default=AUDIOS_DIR)
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE)
    args = parser.parse_args()
    inputs = []
    delays = []
    for idx, (path, start_s) in enumerate(CHAPTERS):
        path = args.audio_dir / path.name
        if not path.exists():
            raise FileNotFoundError(f"Missing audio file: {path}")
        inputs.extend(["-i", str(path)])
        ms = int(round(start_s * 1000))
        delays.append(f"[{idx}:a]adelay={ms}|{ms}[a{idx}]")

    delay_str = ";".join(delays)
    mix_inputs = "".join(f"[a{i}]" for i in range(len(CHAPTERS)))
    filter_complex = (
        f"{delay_str};{mix_inputs}amix=inputs={len(CHAPTERS)}:dropout_transition=0:normalize=0[mixed];"
        f"[mixed]apad=whole_dur={TOTAL_DURATION},atrim=0:{TOTAL_DURATION}[out]"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[out]",
        "-ar",
        "32000",
        "-ac",
        "1",
        str(args.output),
    ]
    subprocess.run(cmd, check=True)
    print(f"Generated {args.output} ({TOTAL_DURATION}s)")


if __name__ == "__main__":
    main()
