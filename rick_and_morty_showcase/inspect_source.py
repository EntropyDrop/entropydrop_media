#!/usr/bin/env python3
"""Extract timestamped contact sheets for making and checking source selections."""
import argparse
import concurrent.futures
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent


def timestamp(seconds):
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(int(minutes), 60)
    return f"{hours:02}:{minutes:02}:{seconds:05.2f}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / "sources/VID_20261016_123013.mp4")
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--end", type=float, default=3210)
    parser.add_argument("--step", type=float, default=60)
    parser.add_argument("--times", type=float, nargs="+")
    parser.add_argument("--name", default="overview")
    args = parser.parse_args()
    folder = ROOT / "review" / args.name
    folder.mkdir(parents=True, exist_ok=True)
    times = args.times or [args.start + i * args.step for i in range(int((args.end - args.start) / args.step) + 1)]

    def extract(seconds):
        image = folder / f"{seconds:010.3f}.jpg"
        if not image.exists():
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(seconds),
                            "-i", str(args.source), "-frames:v", "1", "-vf", "scale=480:-1", "-q:v", "3",
                            "-threads", "1", str(image)], check=True)
        return image

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        images = list(executor.map(extract, times))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 20)
    except OSError:
        font = ImageFont.load_default()
    sheets = []
    for offset in range(0, len(images), 20):
        sheet = Image.new("RGB", (1920, 5 * 305), "#f3f4f1")
        draw = ImageDraw.Draw(sheet)
        for index, (file, seconds) in enumerate(zip(images[offset:offset+20], times[offset:offset+20])):
            x, y = (index % 4) * 480, (index // 4) * 305
            with Image.open(file) as frame:
                sheet.paste(frame, (x, y))
            draw.text((x + 12, y + 275), timestamp(seconds), fill="#0c4f27", font=font)
        output = folder / f"sheet-{offset // 20 + 1:02}.jpg"
        sheet.save(output, quality=92)
        sheets.append(str(output))
    (folder / "samples.json").write_text(json.dumps(dict(source=str(args.source), times=times, sheets=sheets), indent=2) + "\n")
    print("\n".join(sheets), flush=True)


if __name__ == "__main__":
    main()
