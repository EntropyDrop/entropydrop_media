#!/usr/bin/env python3
"""Render an independent 9:16 Douyin cut using per-shot source framing."""
import argparse
import concurrent.futures
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_video import ffmpeg, probe, sha256
from build_soundtrack import synthesize

ROOT = Path(__file__).resolve().parent
SETTINGS = ROOT / "douyin-edit.json"


def opening_photos(config, horizontal):
    photos = horizontal["showcase"]["photos"]
    count = config["openingPhotoCount"]
    if not isinstance(count, int) or not 1 <= count <= len(photos):
        raise ValueError("Choose at least one opening photo from the original sequence")
    return photos[:count]


def focus_points(framing, duration):
    points = framing.get("keyframes")
    if points is None:
        points = [[0, framing["centerX"]], [duration, framing["centerX"]]]
    if points[0][0] != 0 or points[-1][0] != duration:
        raise ValueError("Focus keyframes must cover the complete shot")
    if any(a[0] >= b[0] for a, b in zip(points, points[1:])):
        raise ValueError("Focus keyframes must increase in time")
    return points


def position_at(points, time):
    for (a, x), (b, y) in zip(points, points[1:]):
        if time <= b:
            return x + (y - x) * max(0, time - a) / (b - a)
    return points[-1][1]


def position_expression(points):
    expression = str(points[-1][1])
    for (a, x), (b, y) in reversed(list(zip(points, points[1:]))):
        segment = str(x) if x == y else f"{x}+({y-x})*(t-{a})/{b-a}"
        expression = f"if(lt(t,{b}),{segment},{expression})"
    return expression


def shot_framing(config, shot):
    framing = shot.get('portraitFraming', config["shots"][shot["id"]])
    crop = {**config["defaultCrop"], **framing.get("crop", {})}
    w, h, y = crop["width"], crop["height"], crop["y"]
    if w * 16 != h * 9 or w <= 0 or h <= 0 or min(w, h) % 2 or not 0 <= y <= 1080 - h:
        raise ValueError(f"Invalid portrait crop: {shot['id']}")
    points = focus_points(framing, shot["duration"])
    if any(not w / 2 <= x <= 1920 - w / 2 for _, x in points):
        raise ValueError(f"Focus leaves the source frame: {shot['id']}")
    return crop, points


def portrait_shots(config, horizontal):
    """Shorten individual actions at their existing speed; retain original framing."""
    originals = {shot['id']: shot for shot in horizontal['shots']}
    shots = []
    for selection in config['cut']:
        original = originals[selection['id']]
        offset, duration = selection.get('trimStart', 0), selection['duration']
        if not 0 <= offset < offset+duration <= original['duration']+1e-8:
            raise ValueError(f"Portrait trim leaves source shot: {original['id']}")
        speed = (original['out']-original['in'])/original['duration']
        framing = dict(config['shots'][original['id']])
        points = focus_points(framing, original['duration'])
        framing['keyframes'] = [[0, position_at(points, offset)]] + [
            [t-offset, x] for t,x in points if offset < t < offset+duration
        ] + [[duration, position_at(points, offset+duration)]]
        shot = dict(original, duration=duration, frames=round(duration*config['fps']),
                    portraitFraming=framing)
        shot['in'] = original['in'] + offset*speed
        shot['out'] = shot['in'] + duration*speed
        shots.append(shot)
    return shots


def photo_framing(config, image, focus=None):
    with Image.open(image) as picture:
        width, height = picture.size
    unit = int(min(width / 9, height / 16) // 2) * 2
    w, h = unit * 9, unit * 16
    x = round((focus or {}).get("centerX", width / 2) - w / 2)
    y = round((focus or {}).get("centerY", height / 2) - h / 2)
    return [min(max(0, x), width - w), min(max(0, y), height - h), w, h]


def picture_filters(config, rectangle):
    x, y, w, h = rectangle
    return (f"crop={w}:{h}:{x}:{y},scale={config['width']}:{config['height']}:flags=lanczos:"
            "in_range=pc:out_range=tv:out_color_matrix=bt709,setsar=1,format=yuv420p,"
            "setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709")


def encode_options(config):
    fps = config["fps"]
    return ["-an", "-c:v", "libx264", "-preset", "fast", "-crf", 16, "-threads", 2,
            "-g", fps, "-keyint_min", fps, "-sc_threshold", 0,
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-video_track_timescale", 15360, "-movflags", "+faststart"]


def contact_sheets(items, folder, prefix, columns=4):
    folder.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 15)
    outputs = []
    per_page = columns * 2
    for offset in range(0, len(items), per_page):
        page = Image.new("RGB", (270 * columns, 1024), "#f3f4f1")
        draw = ImageDraw.Draw(page)
        for cell, (path, label) in enumerate(items[offset:offset+per_page]):
            x, y = cell % columns * 270, cell // columns * 512
            with Image.open(path) as frame:
                page.paste(frame.convert("RGB").resize((270, 480)), (x, y))
            draw.text((x + 5, y + 486), label[:27], fill="#0c4f27", font=font)
        output = folder / f"{prefix}-{offset // per_page + 1:02}.jpg"
        page.save(output, quality=92)
        outputs.append(str(output))
    print("\n".join(outputs), flush=True)


def review(config, horizontal):
    folder = ROOT / "review/douyin-framing"
    folder.mkdir(parents=True, exist_ok=True)
    source = ROOT / horizontal["source"]

    def frame(shot):
        crop, points = shot_framing(config, shot)
        local_time = shot["duration"] / 2
        source_time = (shot["in"] + shot["out"]) / 2
        left = position_at(points, local_time) - crop["width"] / 2
        output = folder / (shot["id"] + ".jpg")
        filters = (f"crop={crop['width']}:{crop['height']}:{left}:{crop['y']},"
                   "scale=270:480:flags=lanczos,setsar=1")
        ffmpeg("-ss", source_time, "-i", source, "-frames:v", 1, "-vf", filters, output)
        return output, shot["id"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        items = list(executor.map(frame, portrait_shots(config, horizontal)))
    contact_sheets(items, folder, "assembly")
    photo_items = []
    for index, photo in enumerate(opening_photos(config, horizontal)):
        rectangle = photo_framing(config, ROOT / photo["image"], config["photoFocus"].get(photo["name"]))
        output = folder / f"photo-{index + 1:03}.jpg"
        x, y, w, h = rectangle
        ffmpeg("-i", ROOT / photo["image"], "-frames:v", 1, "-vf",
               f"crop={w}:{h}:{x}:{y},scale=270:480:flags=lanczos,setsar=1", output)
        photo_items.append((output, f"Photo {index + 1}"))
    contact_sheets(photo_items, folder, "photos")


def render(config, horizontal):
    work = ROOT / "renders/douyin-work"
    work.mkdir(parents=True, exist_ok=True)
    fps = config["fps"]
    source = ROOT / horizontal["source"]
    source_stat = source.stat()
    jobs = []
    for index, photo in enumerate(opening_photos(config, horizontal)):
        rectangle = photo_framing(config, ROOT / photo["image"], config["photoFocus"].get(photo["name"]))
        jobs.append(dict(id=f"photo-{index + 1:03}", image=photo["image"], image_sha256=photo["image_sha256"],
                         crop=rectangle, frames=photo["frames"], start=photo["start"], duration=photo["duration"]))
    for shot in portrait_shots(config, horizontal):
        crop, points = shot_framing(config, shot)
        jobs.append(dict(id=shot["id"], source=horizontal["source"], inPoint=shot["in"], outPoint=shot["out"],
                         crop=crop, focus=points, frames=shot["frames"], start=shot["start"], duration=shot["duration"]))
    ending = {**horizontal["ending"], 'duration': config['endingDuration']}
    first_focus = config["photoFocus"].get(horizontal["showcase"]["photos"][0]["name"])
    jobs.append(dict(id="ending", image=ending["image"], image_sha256=ending["image_sha256"],
                     crop=photo_framing(config, ROOT / ending["image"], first_focus),
                     frames=round(ending["duration"] * fps), start=ending["start"], duration=ending["duration"]))
    cursor = 0
    scenes = []
    for job in jobs:
        scenes.append({**job, "original_start": job["start"], "start": cursor / fps})
        cursor += job["frames"]
    duration = cursor / fps
    if duration != config['duration']:
        raise ValueError('Portrait timeline must total exactly 59 seconds')
    ending_start = scenes[-1]["start"]

    def encode(job):
        output = work / (job["id"] + ".mp4")
        cache = output.with_suffix(".json")
        signature = dict(version=1, width=config["width"], height=config["height"], fps=fps, job=job,
                         source_size=source_stat.st_size, source_mtime_ns=source_stat.st_mtime_ns)
        if output.exists() and cache.exists() and json.loads(cache.read_text()) == signature:
            return output
        if "image" in job:
            ffmpeg("-loop", 1, "-framerate", fps, "-i", ROOT / job["image"],
                   "-vf", picture_filters(config, job["crop"]), "-frames:v", job["frames"],
                   *encode_options(config), output)
        else:
            crop = job["crop"]
            left = position_expression([[t, x - crop["width"] / 2] for t, x in job["focus"]])
            speed = (job["outPoint"] - job["inPoint"]) / job["duration"]
            filters = (f"setpts=(PTS-STARTPTS)/{speed:.12f},fps={fps},"
                       f"crop={crop['width']}:{crop['height']}:x='{left}':y={crop['y']},"
                       f"scale={config['width']}:{config['height']}:flags=lanczos:in_range=pc:out_range=tv:"
                       "in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p,"
                       "setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,"
                       "tpad=stop_mode=clone:stop_duration=0.5")
            ffmpeg("-ss", job["inPoint"], "-t", job["outPoint"] - job["inPoint"], "-i", source,
                   "-map", "0:v:0", "-vf", filters, "-frames:v", job["frames"], *encode_options(config), output)
        if int(probe(output)["streams"][0]["nb_frames"]) != job["frames"]:
            raise ValueError(f"Incomplete portrait scene: {job['id']}")
        cache.write_text(json.dumps(signature, indent=2) + "\n")
        print(f"Portrait {job['id']}: {job['duration']}s", flush=True)
        return output

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        parts = list(executor.map(encode, jobs))
    concat = work / "parts.txt"
    concat.write_text("".join(f"file '{path.name}'\n" for path in parts))
    picture = work / "picture.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy",
           "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
           "-movflags", "+faststart", picture)
    output = ROOT / config["output"]
    staging = output.with_name(output.stem + "-rendering.mp4")
    starts = {scene["id"]: scene["start"] for scene in scenes}
    sections = {"assembly": starts["01_parts"], "head": starts["02_face"],
                "torso": starts["07_torso_front"], "head_attach": starts["10_head_attach"],
                "arms": starts["11_arm_front"], "legs": starts["16_leg_front"],
                "leg_attach": starts["19_leg_attach"], "pose": starts["21_finished"]}
    events = [{"time": scene["start"]} for scene in scenes[1:-1]]
    bpm = config["musicBpm"]
    if bpm <= 0 or any(abs(event["time"] * bpm / 60 - round(event["time"] * bpm / 60)) > 1e-8
                       for event in events):
        raise ValueError("The score pulse must match every picture cut")
    music = ROOT / "audios/techno-douyin-electro.wav"
    encoded_music = music.with_suffix(".m4a")
    music.parent.mkdir(parents=True, exist_ok=True)
    synthesize(music, duration, bpm, events, work, ending_start=ending_start, section_times=sections)
    ffmpeg("-i", music, "-c:a", "aac", "-b:a", "192k", "-ar", 48000, encoded_music)
    ffmpeg("-i", picture, "-i", encoded_music, "-map", "0:v:0", "-map", "1:a:0",
           "-c", "copy", "-t", duration, "-movflags", "+faststart", staging)
    if int(probe(staging)["streams"][0]["nb_frames"]) != cursor:
        raise ValueError("Incomplete portrait export")
    staging.replace(output)
    manifest = dict(id=config["id"], width=config["width"], height=config["height"], fps=fps,
                    duration=duration, frames=cursor,
                    edit_sha256=sha256(SETTINGS), source_edit_sha256=horizontal["edit_sha256"],
                    horizontal_render_sha256=horizontal["render_sha256"],
                    music=dict(wave=str(music.relative_to(ROOT)), wave_sha256=sha256(music),
                               encoded=str(encoded_music.relative_to(ROOT)), encoded_sha256=sha256(encoded_music),
                               origin="Original electronic score regenerated for the shortened portrait timeline",
                               bpm=bpm, sections=sections, events=events, ending_start=ending_start,
                               generator_sha256=sha256(ROOT / "build_soundtrack.py")),
                    render=config["output"], render_sha256=sha256(output), scenes=scenes)
    (ROOT / "renders/douyin-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for label, time in (("opening", 1), ("assembly", sections["assembly"] + 1), ("ending", ending_start + 1)):
        ffmpeg("-ss", time, "-i", output, "-frames:v", 1, ROOT / f"renders/douyin-preview-{label}.jpg")
    print(f"Douyin export: {config['width']} × {config['height']} / {duration}s / {fps} fps", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review", action="store_true")
    args = parser.parse_args()
    config = json.loads(SETTINGS.read_text())
    horizontal = json.loads((ROOT / "assets/assembly/manifest.json").read_text())
    if horizontal["edit_sha256"] != sha256(ROOT / "assembly-edit.json"):
        raise ValueError("Rebuild the horizontal edit before rendering its portrait variant")
    if config["fps"] != horizontal["fps"] or config["width"] * 16 != config["height"] * 9:
        raise ValueError("Use a 9:16 portrait canvas at the original frame rate")
    if args.review:
        review(config, horizontal)
    else:
        render(config, horizontal)


if __name__ == "__main__":
    main()
