#!/usr/bin/env python3
"""Build a reproducible, centered assembly montage and an original soundtrack."""
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

from build_soundtrack import synthesize
from prepare_showcase import prepare_showcase

ROOT = Path(__file__).resolve().parent
VERSION = 1


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def probe(path):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                              "-show_entries", "stream=nb_frames,r_frame_rate,width,height,color_space,color_range,color_transfer,color_primaries:format=duration",
                                              "-of", "json", str(path)]))


def graphics(edit):
    folder = ROOT / "assets/graphics"
    folder.mkdir(parents=True, exist_ok=True)
    # Only deterministic sizing here; the image itself was expanded by image_gen.
    ffmpeg("-i", ROOT / edit["ending"]["image"], "-vf",
           "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1",
           "-frames:v", 1, folder / "ending.png")


def main():
    edit_path = ROOT / "assembly-edit.json"
    edit = json.loads(edit_path.read_text())
    source = ROOT / edit["source"]
    source_stat = source.stat()
    source_duration = float(probe(source)["format"]["duration"])
    fps = edit["fps"]
    work = ROOT / "renders/work"
    work.mkdir(parents=True, exist_ok=True)
    (ROOT / "assets/assembly").mkdir(parents=True, exist_ok=True)
    (ROOT / "audios").mkdir(parents=True, exist_ok=True)
    showcase, photo_parts = prepare_showcase(edit["showcase"], fps, work)
    opening_frames = showcase["frames"]
    opening_duration = showcase["duration"]
    cursor = 0
    shots = []
    for shot in edit["shots"]:
        count = round(shot["duration"] * fps)
        if count < 1 or abs(count / fps - shot["duration"]) > 1e-8:
            raise ValueError("Use positive whole-frame durations")
        if not 0 <= shot["in"] < shot["out"] <= source_duration:
            raise ValueError(f"Invalid source range: {shot['id']}")
        x, y, w, h = shot["crop"]
        if min(x, y) < 0 or min(w, h) <= 0 or x + w > 1920 or y + h > 1080 or w * 9 != h * 16:
            raise ValueError(f"Invalid 16:9 crop: {shot['id']}")
        start = cursor / fps
        if abs(start * edit["bpm"] / 60 - round(start * edit["bpm"] / 60)) > 1e-8:
            raise ValueError("Cuts must land on the music beat grid")
        shots.append({**shot, "start": start, "frames": count,
                      "speed": (shot["out"] - shot["in"]) / shot["duration"]})
        cursor += count

    def cut(shot):
        output = work / f"{shot['id']}.mp4"
        cache = work / f"{shot['id']}.json"
        signature = dict(version=VERSION, source_size=source_stat.st_size,
                         source_mtime_ns=source_stat.st_mtime_ns, fps=fps, shot=shot)
        if output.exists() and cache.exists() and json.loads(cache.read_text()) == signature:
            return output
        x, y, w, h = shot["crop"]
        filters = (f"crop={w}:{h}:{x}:{y},setpts=(PTS-STARTPTS)/{shot['speed']:.12f},fps={fps},"
                   "scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,"
                   "setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=0.5")
        ffmpeg("-ss", shot["in"], "-t", shot["out"] - shot["in"], "-i", source,
               "-map", "0:v:0", "-an", "-vf", filters, "-frames:v", shot["frames"],
               "-c:v", "libx264", "-preset", "fast", "-crf", 16, "-threads", 2,
               "-g", fps, "-keyint_min", fps, "-sc_threshold", 0,
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-video_track_timescale", 15360, "-movflags", "+faststart", output)
        actual_frames = int(probe(output)["streams"][0]["nb_frames"])
        if actual_frames != shot["frames"]:
            raise ValueError(f"Incomplete shot: {shot['id']}")
        cache.write_text(json.dumps(signature, indent=2) + "\n")
        print(f"{shot['id']}: {shot['in']}–{shot['out']}s → {shot['duration']}s ({shot['speed']:.2f}×)", flush=True)
        return output

    graphics(edit)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        parts = list(executor.map(cut, shots))
    concat = work / "assembly-parts.txt"
    concat.write_text("".join(f"file '{p.name}'\n" for p in parts))
    montage = ROOT / "assets/assembly/assembly-montage.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy",
           "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-movflags", "+faststart", montage)
    montage_duration = cursor / fps
    ending_frames = round(edit["ending"]["duration"] * fps)
    ending_start = opening_duration + montage_duration
    duration = (opening_frames + cursor + ending_frames) / fps
    ending = work / "ending.mp4"
    ffmpeg("-loop", 1, "-framerate", fps, "-i", ROOT / "assets/graphics/ending.png",
           "-vf", "scale=1920:1080:in_range=pc:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
           "-frames:v", ending_frames, "-c:v", "libx264", "-preset", "fast", "-crf", 16,
           "-g", fps, "-keyint_min", fps, "-sc_threshold", 0,
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-video_track_timescale", 15360, "-movflags", "+faststart", ending)
    concat.write_text("".join(f"file '{p.name}'\n" for p in [*photo_parts, *parts, ending]))
    picture = work / "picture.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy",
           "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-movflags", "+faststart", picture)
    music = ROOT / "audios/techno-electro.wav"
    # Edit boundaries use the same 120 BPM pulse as the reference project.
    events = [{"time": shot["start"]} for shot in shots[1:]]
    assembly_music = ROOT / "audios/assembly-electro.wav"
    synthesize(assembly_music, montage_duration + ending_frames / fps, edit["bpm"], events, work,
               ending_start=montage_duration)
    opening_music = ROOT / "audios/opening-electro.wav"
    # Keep the original assembly score unchanged, with a new opening phrase before it.
    synthesize(opening_music, opening_duration + 2, edit["bpm"], [], work)
    ffmpeg("-i", opening_music, "-i", assembly_music, "-filter_complex",
           f"[0:a]atrim=duration={opening_duration},afade=t=out:st={opening_duration - .01}:d=0.01,asetpts=PTS-STARTPTS[intro];"
           "[1:a]asetpts=PTS-STARTPTS[assembly];[intro][assembly]concat=n=2:v=0:a=1[a]",
           "-map", "[a]", "-ar", 48000, "-ac", 2, "-c:a", "pcm_s16le", music)
    final = ROOT / "renders/techno-showcase.mp4"
    staging = final.with_name("techno-showcase-rendering.mp4")
    ffmpeg("-i", picture, "-i", music,
           "-map", "0:v:0", "-map", "1:a:0", "-frames:v", opening_frames + cursor + ending_frames,
           "-t", duration, "-c:v", "copy",
           "-c:a", "aac", "-b:a", "192k", "-ar", 48000,
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-movflags", "+faststart", staging)
    if int(probe(staging)["streams"][0]["nb_frames"]) != opening_frames + cursor + ending_frames:
        raise ValueError("Incomplete final render")
    staging.replace(final)
    manifest = dict(source=edit["source"], source_duration=source_duration, source_sha256=sha256(source),
                    edit_sha256=sha256(edit_path), fps=fps, bpm=edit["bpm"], width=1920, height=1080,
                    showcase=showcase, montage_start=opening_duration,
                    montage_frames=cursor, montage_duration=montage_duration, frames=opening_frames + cursor + ending_frames,
                    duration=duration, video="assets/assembly/assembly-montage.mp4", video_sha256=sha256(montage),
                    music="audios/techno-electro.wav", music_sha256=sha256(music),
                    music_origin="Original oscillator and noise synthesis, adapted from print_custom_figure; no external music or samples",
                    render="renders/techno-showcase.mp4", render_sha256=sha256(final),
                    opening_label_duration=0, ending={**edit["ending"], "start": ending_start,
                        "image_sha256": sha256(ROOT / edit["ending"]["image"]),
                        "rendered_image": "assets/graphics/ending.png",
                        "rendered_image_sha256": sha256(ROOT / "assets/graphics/ending.png")},
                    shots=[{**shot, "assembly_start": shot["start"], "start": opening_duration + shot["start"]}
                           for shot in shots])
    (ROOT / "assets/assembly/manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    ffmpeg("-ss", 1, "-i", final, "-frames:v", 1, ROOT / "renders/preview-opening.jpg")
    ffmpeg("-ss", opening_duration + 1, "-i", final, "-frames:v", 1, ROOT / "renders/preview-assembly.jpg")
    ffmpeg("-ss", ending_start - 4, "-i", final, "-frames:v", 1, ROOT / "renders/preview-finished.jpg")
    ffmpeg("-ss", ending_start + 1, "-i", final, "-frames:v", 1, ROOT / "renders/preview-ending.jpg")
    print(f"Rendered {duration:.2f}s / {opening_frames + cursor + ending_frames} frames / 1920 × 1080 / {fps} fps", flush=True)


if __name__ == "__main__":
    main()
