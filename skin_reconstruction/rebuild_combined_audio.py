#!/usr/bin/env python3
"""Build the continuous 455-second voiceover_full.wav aligned with the video timeline."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIOS_DIR = ROOT / "audios"
OUTPUT_FILE = AUDIOS_DIR / "voiceover_full.wav"

CHAPTERS = [
    (AUDIOS_DIR / "01_open_source_hook.mp3", 0.0),
    (AUDIOS_DIR / "02_why_another_model.mp3", 20.0),
    (AUDIOS_DIR / "03_community_showcase_1.mp3", 60.0),
    (AUDIOS_DIR / "04_community_showcase_2.mp3", 110.0),
    (AUDIOS_DIR / "05_community_showcase_3.mp3", 160.0),
    (AUDIOS_DIR / "06_try_it_online.mp3", 210.0),
    (AUDIOS_DIR / "07_website_walkthrough.mp3", 220.0),
    (AUDIOS_DIR / "08_how_pipeline_works.mp3", 330.0),
    (AUDIOS_DIR / "09_stage_two.mp3", 360.0),
    (AUDIOS_DIR / "10_technical_details.mp3", 405.0),
]
TOTAL_DURATION = 455.0


def main() -> None:
    inputs = []
    delays = []
    for idx, (path, start_s) in enumerate(CHAPTERS):
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
        str(OUTPUT_FILE),
    ]
    subprocess.run(cmd, check=True)
    print(f"Generated {OUTPUT_FILE} ({TOTAL_DURATION}s)")


if __name__ == "__main__":
    main()
