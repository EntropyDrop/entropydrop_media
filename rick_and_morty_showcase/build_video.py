#!/usr/bin/env python3
"""Build landscape and portrait edits from independently framed source shots."""
import argparse
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_soundtrack import synthesize
from edit_timeline import resolve_edit
from prepare_assets import prepare_assets

ROOT = Path(__file__).resolve().parent
EDIT = ROOT / "edit.json"
RENDER_VERSION = 1


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def probe(path):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                                              "-of", "json", str(path)]))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def timeline(edit):
    cursor = 0
    scenes = []
    seen = set()
    for shot in edit["shots"]:
        frames = round(shot["duration"] * edit["fps"])
        if shot["id"] in seen or frames < 1 or abs(frames / edit["fps"] - shot["duration"]) > 1e-8:
            raise ValueError("Use unique shot IDs and positive whole-frame durations")
        seen.add(shot["id"])
        start = cursor / edit["fps"]
        if abs(start * edit["bpm"] / 60 - round(start * edit["bpm"] / 60)) > 1e-8:
            raise ValueError("Picture cuts must match the edit timing grid")
        scenes.append({**shot, "start": start, "frames": frames})
        cursor += frames
    return scenes, cursor / edit["fps"], cursor


def image_source(shot, variant):
    return ROOT / shot.get(f"{variant}Image", shot["image"])


def framing(edit, shot, variant):
    if "image" in shot:
        with Image.open(image_source(shot, variant)) as image:
            source_width, source_height = image.size
        ratio_width, ratio_height = (16, 9) if variant == "landscape" else (9, 16)
        unit = int(min(source_width / ratio_width, source_height / ratio_height) // 2) * 2
        width, height = ratio_width * unit, ratio_height * unit
        if unit < 2:
            raise ValueError(f"Photo is too small: {shot['id']}")
        center = shot.get("imageCenterX", source_width / 2) if variant == "portrait" else source_width / 2
        x = min(max(0, round(center - width / 2)), source_width - width) // 2 * 2
        y = min(max(0, shot.get("imageY", (source_height - height) / 2)), source_height - height) // 2 * 2
        return {"width": width, "height": height, "y": y, "x": [[0, x], [shot["duration"], x]]}
    if variant == "landscape":
        x, y, width, height = shot.get("landscape", edit["defaultLandscape"])
        points = [[0, x], [shot["duration"], x]]
    else:
        crop = {**edit["defaultPortrait"], **shot.get("portrait", {})}
        width, height, y = crop["width"], crop["height"], crop["y"]
        centers = shot.get("keyframes", [[0, shot["centerX"]], [shot["duration"], shot["centerX"]]])
        points = [[time, center - width / 2] for time, center in centers]
    target = edit["formats"][variant]
    if (width <= 0 or height <= 0 or width % 2 or height % 2
            or width * target["height"] != height * target["width"]
            or not 0 <= y <= 1080 - height):
        raise ValueError(f"Invalid crop for {shot['id']} / {variant}")
    if points[0][0] != 0 or points[-1][0] != shot["duration"]:
        raise ValueError("Focus keyframes must cover the complete shot")
    if any(a[0] >= b[0] for a, b in zip(points, points[1:])):
        raise ValueError("Focus keyframes must increase in time")
    if any(not 0 <= x <= 1920 - width for _, x in points):
        raise ValueError(f"Crop leaves the source: {shot['id']} / {variant}")
    return {"width": width, "height": height, "y": y, "x": points}


def position_at(points, time):
    for (a, x), (b, y) in zip(points, points[1:]):
        if time <= b:
            return x + (y - x) * max(0, time - a) / (b - a)
    return points[-1][1]


def position_expression(points):
    expression = str(points[-1][1])
    for (a, x), (b, y) in reversed(list(zip(points, points[1:]))):
        value = str(x) if x == y else f"{x}+({y-x})*(t-{a})/{b-a}"
        expression = f"if(lt(t,{b}),{value},{expression})"
    return expression


def enhancement(edit, shot, variant):
    """Only sharpen moving source footage, at source and export resolution."""
    config = edit.get("enhancement")
    if not config or "image" in shot or "freeze" in shot:
        return None
    return {
        "id": config["id"],
        "beforeScale": config["beforeScale"],
        "afterScale": config["afterScale"][variant],
    }


def contact_sheets(items, folder, variant):
    width, height = (480, 270) if variant == "landscape" else (270, 480)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 14)
    except OSError:
        font = ImageFont.load_default()
    columns, per_page = 3, 12
    for offset in range(0, len(items), per_page):
        sheet = Image.new("RGB", (columns * width, (height + 32) * 4), "#f3f4f1")
        draw = ImageDraw.Draw(sheet)
        for cell, (path, label) in enumerate(items[offset:offset + per_page]):
            x, y = cell % columns * width, cell // columns * (height + 32)
            with Image.open(path) as picture:
                sheet.paste(picture.convert("RGB").resize((width, height)), (x, y))
            draw.text((x + 5, y + height + 7), label[:32], fill="#174e40", font=font)
        output = folder / f"{variant}-{offset // per_page + 1:02}.jpg"
        sheet.save(output, quality=92)
        print(output, flush=True)


def review(edit, scenes, variant):
    folder = ROOT / "review/framing"
    folder.mkdir(parents=True, exist_ok=True)
    jobs = [(variant, shot, fraction) for shot in scenes for fraction in ((.5,) if "image" in shot else (.08, .5, .92))]

    def sample(job):
        variant, shot, fraction = job
        source = ROOT / edit["sources"][shot["source"]] if "source" in shot else None
        crop = framing(edit, shot, variant)
        time = shot.get("freeze", shot.get("in", 0) + (shot.get("out", 0) - shot.get("in", 0)) * fraction)
        x = position_at(crop["x"], shot["duration"] * fraction)
        width, height = (480, 270) if variant == "landscape" else (270, 480)
        output = folder / f"{variant}-{shot['id']}-{fraction:.2f}.jpg"
        inputs = ["-i", image_source(shot, variant)] if "image" in shot else ["-ss", time, "-i", source]
        ffmpeg(*inputs, "-frames:v", 1, "-vf",
               f"crop={crop['width']}:{crop['height']}:{x}:{crop['y']},scale={width}:{height}:flags=lanczos,setsar=1",
               "-threads", 1, output)
        return variant, output, f"{shot['id']} {fraction:.0%}"

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        images = list(executor.map(sample, jobs))
    for variant in (variant,):
        contact_sheets([(path, label) for kind, path, label in images if kind == variant], folder, variant)


def build_music(edit, scenes, duration, variant):
    folder = ROOT / "audios"
    work = ROOT / f"renders/music-work/{variant}"
    folder.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    starts = {shot["id"]: shot["start"] for shot in scenes}
    sections = {key: starts[shot_id] for key, shot_id in edit["music"].items()}
    events = [{"time": shot["start"]} for shot in scenes[1:-1]]
    music = folder / f"rick-and-morty-electro-{variant}.wav"
    encoded = music.with_suffix(".m4a")
    cache = music.with_suffix(".json")
    signature = dict(id=f"rick-and-morty-electro-{variant}", bpm=edit["bpm"],
                     duration=duration, sections=sections, events=events,
                     generator_sha256=sha256(ROOT / "build_soundtrack.py"),
                     origin="Locally synthesized electronic score adapted from techno_showcase")
    if not (music.exists() and encoded.exists() and cache.exists()
            and json.loads(cache.read_text()) == signature):
        synthesize(music, duration, edit["bpm"], events, work,
                   ending_start=sections["ending"], section_times=sections)
        ffmpeg("-i", music, "-c:a", "aac", "-b:a", "192k", "-ar", 48000,
               "-metadata", "title=Rick and Morty Showcase — Electronic", encoded)
        cache.write_text(json.dumps(signature, indent=2) + "\n")
        print(f"Generated {variant} score: {duration}s / {edit['bpm']} BPM", flush=True)
    return {**signature, "wave": str(music.relative_to(ROOT)), "wave_sha256": sha256(music),
            "encoded": str(encoded.relative_to(ROOT)), "encoded_sha256": sha256(encoded)}


def render(edit, scenes, duration, frames, variant, music, source_hash):
    target = edit["formats"][variant]
    fps = edit["fps"]
    work = ROOT / f"renders/work/{variant}"
    work.mkdir(parents=True, exist_ok=True)

    def encode(shot):
        source = ROOT / edit["sources"][shot["source"]] if "source" in shot else None
        stat = source.stat() if source else None
        crop = framing(edit, shot, variant)
        detail = enhancement(edit, shot, variant)
        output = work / f"{shot['id']}.mp4"
        cache = output.with_suffix(".json")
        signature = dict(version=RENDER_VERSION, source=shot.get("source"), source_size=stat.st_size if stat else None,
                         source_mtime_ns=stat.st_mtime_ns if stat else None,
                         target=target, fps=fps, shot={key: value for key, value in shot.items() if key != "start"}, crop=crop)
        if "image" in shot:
            signature["image_sha256"] = sha256(image_source(shot, variant))
        if detail:
            signature["enhancement"] = detail
        if output.exists() and cache.exists() and json.loads(cache.read_text()) == signature:
            return output
        x = position_expression(crop["x"])
        color = (f"scale={target['width']}:{target['height']}:flags=lanczos:in_range=pc:out_range=tv:"
                 "in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p,"
                 "setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709")
        crop_filter = f"crop={crop['width']}:{crop['height']}:x='{x}':y={crop['y']}"
        if "image" in shot:
            inputs = ["-loop", 1, "-framerate", fps, "-i", image_source(shot, variant)]
            color = color.replace("in_color_matrix=bt601:", "")
            filters = f"{crop_filter},{color}"
        elif "freeze" in shot:
            still = work / f"{shot['id']}.png"
            ffmpeg("-ss", shot["freeze"], "-i", source, "-frames:v", 1, "-vf",
                   "scale=in_range=pc:out_range=pc:in_color_matrix=bt601,format=rgb24", still)
            inputs = ["-loop", 1, "-framerate", fps, "-i", still]
            color = color.replace("in_color_matrix=bt601:", "")
            filters = f"{crop_filter},{color}"
        else:
            speed = (shot["out"] - shot["in"]) / shot["duration"]
            inputs = ["-ss", shot["in"], "-t", shot["out"] - shot["in"], "-i", source]
            before_scale = ",".join(detail["beforeScale"]) + "," if detail else ""
            after_scale = "," + ",".join(detail["afterScale"]) if detail else ""
            filters = (f"setpts=(PTS-STARTPTS)/{speed:.12f},fps={fps},{crop_filter},"
                       f"{before_scale}{color}{after_scale},"
                       "tpad=stop_mode=clone:stop_duration=0.5")
        ffmpeg(*inputs, "-map", "0:v:0", "-an", "-vf", filters, "-frames:v", shot["frames"],
               "-c:v", "libx264", "-preset", "fast", "-crf", 16, "-threads", 2,
               "-g", fps, "-keyint_min", fps, "-sc_threshold", 0,
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-video_track_timescale", 15360, "-movflags", "+faststart", output)
        video = next(stream for stream in probe(output)["streams"] if stream["codec_type"] == "video")
        if int(video["nb_frames"]) != shot["frames"]:
            raise ValueError(f"Incomplete scene: {variant} / {shot['id']}")
        cache.write_text(json.dumps(signature, indent=2) + "\n")
        print(f"{variant}: {shot['id']} / {shot['duration']}s", flush=True)
        return output

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        parts = list(executor.map(encode, scenes))
    concat = work / "parts.txt"
    concat.write_text("".join(f"file '{part.name}'\n" for part in parts))
    picture = work / "picture.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy", "-bsf:v",
           "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
           "-movflags", "+faststart", picture)
    output = ROOT / f"renders/rick-and-morty-showcase-{variant}.mp4"
    staging = output.with_name(output.stem + "-rendering.mp4")
    ffmpeg("-i", picture, "-i", ROOT / music["encoded"], "-map", "0:v:0", "-map", "1:a:0",
           "-c", "copy", "-t", duration, "-movflags", "+faststart", staging)
    video = next(stream for stream in probe(staging)["streams"] if stream["codec_type"] == "video")
    if int(video["nb_frames"]) != frames:
        raise ValueError(f"Incomplete {variant} export")
    staging.replace(output)
    rendered_scenes = []
    for shot in scenes:
        scene = {**shot, "framing": framing(edit, shot, variant),
                 "enhancement": enhancement(edit, shot, variant)}
        if "image" in shot:
            scene.update(render_image=str(image_source(shot, variant).relative_to(ROOT)),
                         render_image_sha256=sha256(image_source(shot, variant)),
                         original_image_sha256=sha256(ROOT / shot["image"]))
        rendered_scenes.append(scene)
    manifest = dict(id=edit["id"], variant=variant, **target, fps=fps, frames=frames, duration=duration,
                    sources=edit["sources"], source_sha256=source_hash, edit_sha256=sha256(EDIT),
                    render_version=RENDER_VERSION, music=music,
                    enhancement=edit.get("enhancement"),
                    render=str(output.relative_to(ROOT)), render_sha256=sha256(output),
                    scenes=rendered_scenes)
    (ROOT / f"renders/{variant}-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for label, time in (("opening", 1), ("process", duration * .45), ("ending", duration - 1)):
        ffmpeg("-ss", time, "-i", output, "-frames:v", 1, ROOT / f"renders/{variant}-{label}.jpg")
    print(f"Exported {variant}: {target['width']} × {target['height']} / {duration}s / {frames} frames", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review", action="store_true")
    parser.add_argument("--format", choices=("landscape", "portrait"))
    args = parser.parse_args()
    base = json.loads(EDIT.read_text())
    prepare_assets(base)
    source_durations = {}
    source_hash = {}
    for key, relative in base["sources"].items():
        source = ROOT / relative
        metadata = probe(source)
        video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        if (video["width"], video["height"]) != (1920, 1080):
            raise ValueError(f"Expected 1920 × 1080 source: {key}")
        source_durations[key] = float(metadata["format"]["duration"])
        if not args.review:
            source_hash[key] = sha256(source)
    for variant in ([args.format] if args.format else base['formats']):
        edit = resolve_edit(base, variant)
        scenes, duration, frames = timeline(edit)
        validate_scenes(edit, scenes, source_durations)
        if args.review:
            review(edit, scenes, variant)
            continue
        music = build_music(edit, scenes, duration, variant)
        render(edit, scenes, duration, frames, variant, music, source_hash)


def validate_scenes(edit, scenes, source_durations):
    for shot in scenes:
        if "image" in shot:
            valid = all(image_source(shot, variant).is_file() for variant in edit["formats"])
        elif "freeze" in shot:
            valid = 0 <= shot["freeze"] < source_durations[shot["source"]]
        else:
            valid = 0 <= shot["in"] < shot["out"] <= source_durations[shot["source"]]
        if not valid:
            raise ValueError(f"Invalid source range: {shot['id']}")
        for variant in edit["formats"]:
            framing(edit, shot, variant)


if __name__ == "__main__":
    main()
