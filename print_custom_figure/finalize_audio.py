#!/usr/bin/env python3
"""Mux the master WAVs at exact sample positions, retaining the rendered video."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RATE = 48000


def main():
    timeline = json.loads((ROOT / "timeline.json").read_text())
    video = ROOT / "renders/print-your-custom-figure-at-home.mp4"
    temporary = video.with_name(video.stem + ".audio-sync.mp4")
    info = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=start_time:format=start_time", "-of", "json", str(video)
    ]))
    # Hyperframes 0.6.6 adds AAC encoder padding when muxing. Reset picture to
    # zero and mix from the lossless masters instead of re-encoding its AAC.
    offset = float(info["streams"][0].get("start_time", 0)) - float(info["format"].get("start_time", 0))
    duration = timeline["duration"]
    count = round(duration * RATE)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
               "-itsoffset", str(-offset), "-i", str(video),
               "-i", str(ROOT / "audios/voiceover_full.wav")]
    filters = [f"[1:a]aresample={RATE},asetpts=PTS-STARTPTS,apad=whole_len={count}[voice]"]
    soundtrack = timeline.get("soundtrack")
    if soundtrack:
        command += ["-i", str(ROOT / soundtrack["src"])]
        delay = round(soundtrack["start"] * RATE)
        filters += [f"[2:a]aresample={RATE},asetpts=PTS-STARTPTS,adelay={delay}S:all=1[music]",
                    f"[voice][music]amix=inputs=2:duration=first:normalize=0,atrim=end_sample={count}[audio]"]
    else:
        filters += [f"[voice]atrim=end_sample={count}[audio]"]
    command += ["-filter_complex", ";".join(filters), "-map", "0:v:0", "-map", "[audio]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", str(RATE), "-ac", "2",
                "-t", str(duration), "-movflags", "+faststart", str(temporary)]
    subprocess.run(command, check=True)
    temporary.replace(video)
    print(f"Muxed narration and music at exact sample positions: {video}")


if __name__ == "__main__":
    main()
