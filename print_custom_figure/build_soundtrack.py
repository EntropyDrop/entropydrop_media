#!/usr/bin/env python3
"""Build the evolving electronic arrangement and duck its closing resolution."""
import argparse
import json
import tempfile
from pathlib import Path

from build_assembly import ffmpeg, sha256, synthesize

ROOT = Path(__file__).resolve().parent


def refresh_sections(assembly, assembly_path, stickers, stickers_path, work):
    """Refresh music and previews without re-encoding the existing picture."""
    synthesize(ROOT / assembly['music'], assembly['duration'], assembly['bpm'],
               assembly['beat_accents'], work)
    assembly['music_sha256'] = sha256(ROOT / assembly['music'])
    assembly['music_arrangement'] = 'evolving-electro-v2'
    assembly_path.write_text(json.dumps(assembly, indent=2) + '\n')
    synthesize(ROOT / stickers['music'], stickers['musicDuration'], assembly['bpm'],
               assembly['beat_accents'], work)
    stickers['music_sha256'] = sha256(ROOT / stickers['music'])
    stickers['assembly_manifest_sha256'] = sha256(assembly_path)
    stickers['music_arrangement'] = 'evolving-electro-v2'
    stickers_path.write_text(json.dumps(stickers, indent=2) + '\n')
    ffmpeg('-i', ROOT / assembly['video'], '-i', ROOT / assembly['music'],
           '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac',
           '-b:a', '192k', '-t', assembly['duration'], '-movflags', '+faststart',
           ROOT / 'renders/assembly-installation.mp4')
    ffmpeg('-i', ROOT / stickers['video'], '-ss', assembly['duration'],
           '-i', ROOT / stickers['music'], '-map', '0:v:0', '-map', '1:a:0',
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', stickers['duration'],
           '-movflags', '+faststart', ROOT / 'renders/sticker-installation.mp4')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-sections', action='store_true',
                        help='Also update assembly/sticker music and their standalone previews.')
    args = parser.parse_args()
    project = json.loads((ROOT / "project.json").read_text())
    assembly_path = ROOT / project["assembly"]["manifest"]
    stickers_path = ROOT / project["stickers"]["manifest"]
    assembly = json.loads(assembly_path.read_text())
    stickers = json.loads(stickers_path.read_text())
    ending_duration = project["ending"]["duration"]
    ending_start = assembly["duration"] + stickers["duration"]
    duration = ending_start + ending_duration
    target = ROOT / "audios/assembly-stickers-ending-electro.wav"
    with tempfile.TemporaryDirectory(prefix="figure-score-") as directory:
        work = Path(directory)
        if args.refresh_sections:
            refresh_sections(assembly, assembly_path, stickers, stickers_path, work)
        full = work / "full.wav"
        synthesize(full, duration, assembly["bpm"], assembly["beat_accents"], work,
                   ending_start=ending_start)
        # Ease down before the final voice enters; retain all assembly accents.
        duck_start = ending_start - .35
        volume = f"if(lt(t,{duck_start}),1,if(lt(t,{ending_start}),1-0.68*(t-{duck_start})/0.35,0.32))"
        ffmpeg("-i", full, "-af", f"volume='{volume}':eval=frame",
               "-c:a", "pcm_s16le", target)
    manifest = {"src": str(target.relative_to(ROOT)), "sha256": sha256(target),
                "duration": duration, "endingDuration": ending_duration,
                "arrangement": "evolving-electro-v2", "bpm": assembly["bpm"],
                "sections": [
                    {"start": 0, "end": 2, "description": "Minimal pulse and soft chord introduction"},
                    {"start": 2, "end": 10, "description": "First pluck motif with changing harmony"},
                    {"start": 10, "end": 24, "description": "Bass variations, percussion answers and short drum fills"},
                    {"start": 24, "end": assembly["duration"], "description": "Half-time feel for the assembled figure"},
                    {"start": assembly["duration"], "end": 36, "description": "New call-and-response motif for sticker photos"},
                    {"start": 36, "end": 40, "description": "Two-bar break with soft pads and rim percussion"},
                    {"start": 40, "end": ending_start, "description": "Full groove returns with lower melodic answers"},
                    {"start": ending_start, "end": duration, "description": "Sustained resolution beneath closing narration"}
                ],
                "assembly_manifest_sha256": sha256(assembly_path),
                "stickers_manifest_sha256": sha256(stickers_path)}
    (ROOT / "audios/full_soundtrack_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Built {duration:.3f}s score with a quiet {ending_duration}s closing section.")


if __name__ == "__main__":
    main()
