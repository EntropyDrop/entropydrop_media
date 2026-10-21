#!/usr/bin/env python3
"""Portrait framing within the shared print_custom_figure project."""
import argparse
import concurrent.futures
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from media_common import check_export, project_formats

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "portrait-edit.json"
GRAPHICS = ROOT / "assets/portrait"
REVIEW = ROOT / "review/portrait"
WORK = ROOT / "renders/work/portrait"
W, H, FPS = 1080, 1920, 30
PAPER, GREEN, INK, MUTED = "#f3f5ef", "#1d7a3b", "#111611", "#52735a"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(*args):
    subprocess.run([str(x) for x in args], check=True)


def ffmpeg(*args):
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args)


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ]))


def input_snapshot(source, paths):
    return {name: [(source/name).stat().st_size, (source/name).stat().st_mtime_ns]
            for name in sorted(paths)}


def load_config():
    config = json.loads(CONFIG.read_text())
    fps, formats = project_formats()
    return {**config, **formats["portrait"], "fps": fps,
            "sourceRender": formats["landscape"]["output"]}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def text_layer(name, lines, boxes=(), opaque=False):
    """Render new typography, never edit the source photographs with Pillow."""
    output = GRAPHICS / (name + ".png")
    im = Image.new("RGBA", (W, H), PAPER if opaque else (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    for rectangle, color in boxes:
        draw.rectangle(rectangle, fill=color)
    for text, x, y, size, color in lines:
        font = ImageFont.truetype(str(GRAPHICS / "fusion-pixel.woff2"), size)
        if draw.textbbox((x, y), text, font=font, anchor="lt")[2] > W - 50:
            raise ValueError(f"Text leaves portrait safe margin: {text}")
        draw.text((x, y), text, fill=color, font=font, anchor="lt")
    im.save(output)
    return output


def prepare_graphics(source, config):
    GRAPHICS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / "assets/fonts/fusion-pixel-12px-proportional-zh_hans.ttf.woff2",
                    GRAPHICS / "fusion-pixel.woff2")
    text_layer("opening", [
        ("Make Your Own", 92, 169, 60, INK),
        ("Figure at Home", 92, 246, 60, GREEN),
    ], [((64, 140, 884, 336), (243, 245, 239, 242)), ((64, 140, 71, 336), GREEN)])
    for i, screen in enumerate(config["screens"]):
        lines = [
            ("EntropyDrop", 64, 104, 32, MUTED),
            (screen["title"], 64, 177, 65, INK),
        ]
        boxes = []
        if screen.get("showDetail", True):
            lines.append((screen["focusLabel"], 64, 944, 30, GREEN))
            boxes.append(((64, 909, 166, 914), GREEN))
        text_layer(f"screen-{i + 1}", lines, boxes, opaque=True)
    text_layer("bridge", [
        ("EntropyDrop", 64, 115, 32, MUTED),
        ("TIME TO BUILD", 64, 235, 32, MUTED),
        ("Let's put it", 64, 318, 88, INK),
        ("together.", 64, 426, 120, GREEN),
    ], [((64, 585, 182, 591), GREEN)], opaque=True)
    text_layer("ending", [
        ("YOUR SKIN.", 64, 1195, 96, INK),
        ("MADE REAL.", 64, 1300, 96, GREEN),
    ], opaque=True)
    text_layer("ending-cta", [
        ("Try it yourself", 64, 1473, 38, MUTED),
        ("entropydrop.com", 64, 1537, 60, GREEN),
        ("FREE TOOLS & DOWNLOADS", 82, 1651, 30, GREEN),
    ], [((64, 1627, 800, 1708), GREEN), ((67, 1630, 797, 1705), "#e3f0e5")])


def position_expression(points):
    expression = str(points[-1][1])
    for (a, x), (b, y) in reversed(list(zip(points, points[1:]))):
        segment = str(x) if x == y else f"{x}+({y-x})*(t-{a})/{b-a}"
        expression = f"if(lt(t,{b}),{segment},{expression})"
    return expression


def make_jobs(config, timeline):
    jobs = []

    def add(id, src, frames, mode, **kwargs):
        jobs.append(dict(id=id, src=src, frames=frames, startFrame=sum(x["frames"] for x in jobs),
                         mode=mode, **kwargs))

    for i, photo in enumerate(timeline["showcase"]["photos"]):
        add(f"opening-{i + 1:02}", photo["source"], photo["frames"],
            **config["opening"][i], still=True, overlay="opening")
    for i, clip in enumerate(timeline["clips"]):
        width_fraction = config["screens"][i].get("recordingWidthFraction", 1)
        if not 0 < width_fraction <= 1:
            raise ValueError("Recording width fraction must be between zero and one")
        add(f"screen-{i + 1}", clip["src"], clip["frames"], "screen",
            crop=config["screens"][i]["crop"], overlay=f"screen-{i + 1}",
            showDetail=config["screens"][i].get("showDetail", True),
            recordingWidthFraction=width_fraction)
    add("bridge", "assets/assembly/assembly-bridge-still.png", round(timeline["outro"]["duration"] * FPS),
        "card", crop=config["bridgeCrop"], still=True, overlay="bridge", photoY=650, photoWidth=1080)
    for shot in timeline["assembly"]["shots"]:
        framing = config["assembly"][shot["id"]]
        width = framing["width"]
        points = framing.get("keyframes", [[0, framing.get("centerX")], [shot["duration"], framing.get("centerX")]])
        if points[0][0] != 0 or points[-1][0] != shot["duration"]:
            raise ValueError("Focus keyframes must cover a whole shot")
        if any(a[0] >= b[0] for a, b in zip(points, points[1:])):
            raise ValueError("Focus keyframes must increase")
        if any(x is None or not width / 2 <= x <= 1920 - width / 2 for _, x in points):
            raise ValueError("Assembly crop leaves the source frame")
        left = position_expression([[t, x - width / 2] for t, x in points])
        add(shot["id"], timeline["assembly"]["video"], shot["frames"], "blur",
            seek=shot["start"], crop=[left, 0, width, 1080])
    for i, photo in enumerate(timeline["stickers"]["photos"]):
        framing = config["stickerOverview"] if i == 0 else {
            "mode": "cover", "crop": [config["stickerFocusX"][i] - 846, 0, 1692, 3008]}
        add(f"sticker-{i + 1:02}", photo["source"], photo["frames"], **framing, still=True)
    add("ending", timeline["ending"]["image"], round(timeline["ending"]["duration"] * FPS),
        "card", crop=config["endingCrop"], still=True, overlay="ending", photoY=0, photoWidth=1080, cta=True)
    if sum(x["frames"] for x in jobs) != timeline["totalFrames"]:
        raise ValueError("Portrait timing must match the original frame for frame")
    for key, id in [("outro", "bridge"), ("assembly", "01_parts"), ("stickers", "sticker-01"), ("ending", "ending")]:
        if next(x["startFrame"] for x in jobs if x["id"] == id) != round(timeline[key]["start"] * FPS):
            raise ValueError(f"Scene boundary mismatch: {key}")
    return jobs


def filter_graph(job):
    x, y, width, height = job["crop"]
    crop = f"crop={width}:{height}:x='{x}':y={y}"
    image = job.get("still", False)
    # Convert JPEG full-range BT.601 to limited-range BT.709 before compositing.
    normalize = "scale=iw:ih:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709," if image and job["src"].lower().endswith(".jpg") else ""
    nodes = [f"[0:v]setpts=PTS-STARTPTS,{normalize}setsar=1,format=yuv420p[src]"]
    mode = job["mode"]
    if mode == "cover":
        nodes += [f"[src]{crop},scale={W}:{H}:flags=lanczos[base]"]
    elif mode == "blur":
        # Blurred continuation keeps wide groups / hands intact without black bars.
        nodes += ["[src]split[bg0][fg0]",
                  f"[bg0]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,gblur=sigma=16,scale={W}:{H},eq=brightness=-0.06[bg]",
                  f"[fg0]{crop},scale={W}:-2:flags=lanczos[fg]",
                  "[bg][fg]overlay=0:(H-h)/2[base]"]
    elif mode == "screen":
        if job.get("showDetail", True):
            nodes += ["[src]split[full0][detail0]",
                      f"[full0]scale={W}:-2:flags=lanczos[full]",
                      f"[detail0]{crop},scale=720:720:flags=lanczos[detail]",
                      "[1:v][full]overlay=0:294[panel]",
                      "[panel][detail]overlay=160:1010[base]"]
        else:
            width_fraction = job.get("recordingWidthFraction", 1)
            horizontal_crop = (f"crop=w='trunc(iw*{width_fraction}/2)*2':h=ih:x='(iw-ow)/2':y=0,"
                               if width_fraction < 1 else "")
            nodes += [f"[src]{horizontal_crop}scale={W}:-2:flags=lanczos[full]",
                      "[1:v][full]overlay=(W-w)/2:(H-h)/2[base]"]
    elif mode == "card":
        nodes += [f"[src]{crop},scale={job['photoWidth']}:-2:flags=lanczos[photo]",
                  f"[1:v][photo]overlay=0:{job['photoY']}[base]"]
    else:
        raise ValueError(mode)
    if job.get("overlay") and mode not in ("screen", "card"):
        nodes += ["[base][1:v]overlay=0:0[with_text]"]
        label = "with_text"
    else:
        label = "base"
    if job.get("cta"):
        nodes += [f"[{label}][2:v]overlay=0:0:enable='gte(t,3.3)'[with_cta]"]
        label = "with_cta"
    nodes += [f"[{label}]setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[out]"]
    return ";".join(nodes)


def inputs(source, job):
    options = ["-filter_complex_threads", "1", "-threads", "2"]
    if job.get("still"):
        options += ["-loop", "1", "-framerate", FPS]
    elif job.get("seek"):
        options += ["-ss", job["seek"]]
    options += ["-i", source / job["src"]]
    if job.get("overlay"):
        options += ["-loop", "1", "-framerate", FPS, "-i", GRAPHICS / (job["overlay"] + ".png")]
    if job.get("cta"):
        options += ["-loop", "1", "-framerate", FPS, "-i", GRAPHICS / "ending-cta.png"]
    return options


def contact_sheets(items, prefix):
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 15)
    for offset in range(0, len(items), 8):
        batch = items[offset:offset + 8]
        sheet = Image.new("RGB", (1080, math.ceil(len(batch) / 4) * 512), PAPER)
        draw = ImageDraw.Draw(sheet)
        for i, (path, label) in enumerate(batch):
            with Image.open(path) as photo:
                sheet.paste(photo.convert("RGB").resize((270, 480)), (i % 4 * 270, i // 4 * 512))
            draw.text((i % 4 * 270 + 5, i // 4 * 512 + 485), label, font=font, fill=INK)
        sheet.save(REVIEW / f"{prefix}-{offset // 8 + 1:02}.jpg", quality=90)


def review(source, jobs):
    folder = REVIEW
    folder.mkdir(parents=True, exist_ok=True)

    def frame(job):
        time = 4 if job.get("cta") else job["frames"] / FPS / 2
        output = folder / (job["id"] + ".jpg")
        ffmpeg(*inputs(source, job), "-filter_complex", filter_graph(job), "-map", "[out]",
               "-ss", time, "-frames:v", 1, "-q:v", 2, output)
        return output, job["id"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        items = list(pool.map(frame, jobs))
    contact_sheets(items[:10] + items[-1:], "portrait-layout")
    contact_sheets(items[10:19], "portrait-assembly")
    contact_sheets(items[19:-1], "portrait-stickers")
    print(f"Portrait previews: {folder}", flush=True)


def audio_hash(path):
    return subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
                                    "-c:a", "copy", "-f", "hash", "-hash", "sha256", "-"]).decode().strip()


def check(config, source):
    manifest = json.loads((ROOT / "renders/portrait-manifest.json").read_text())
    output = ROOT / config["output"]
    assert sha256(CONFIG) == manifest["edit_sha256"], "Portrait framing changed after render"
    assert sha256(ROOT / "build_vertical.py") == manifest["builder_sha256"], "Builder changed after render"
    assert sha256(output) == manifest["output_sha256"], "Output changed after render"
    for relative, digest in manifest["source_hashes"].items():
        assert sha256(source / relative) == digest, f"Changed original input: {relative}"
    timeline = json.loads((source / "timeline.json").read_text())
    assert manifest["scenes"] == make_jobs(config, timeline), "Portrait timeline or framing changed"
    for name, expected in manifest["graphics_hashes"].items():
        assert sha256(GRAPHICS/name) == expected, f"Changed portrait graphics: {name}"
    assert audio_hash(output) == audio_hash(source / config["sourceRender"]), "AAC audio differs"
    check_export("portrait")


def render(config, source, timeline, jobs):
    folder = WORK
    folder.mkdir(parents=True, exist_ok=True)
    source_paths = {x["src"] for x in jobs} | {"timeline.json", "project.json", CONFIG.name,
                    "assets/fonts/fusion-pixel-12px-proportional-zh_hans.ttf.woff2", config["sourceRender"]}
    original = input_snapshot(source, source_paths)
    source_hashes = {path: sha256(source / path) for path in sorted(source_paths)}
    code_hash = sha256(Path(__file__))

    def encode(job):
        output = folder / (job["id"] + ".mp4")
        cache = output.with_suffix(".json")
        signature = dict(job=job, builder=code_hash, source_sha256=source_hashes[job["src"]],
                         overlays={key: sha256(GRAPHICS / (key + ".png"))
                                   for key in [job.get("overlay"), "ending-cta" if job.get("cta") else None] if key})
        if output.exists() and cache.exists() and json.loads(cache.read_text()) == signature:
            return output
        ffmpeg(*inputs(source, job), "-filter_complex", filter_graph(job), "-map", "[out]",
               "-frames:v", job["frames"], "-r", FPS, "-an", "-c:v", "libx264", "-preset", "fast",
               "-crf", 16, "-threads", 2, "-g", FPS, "-keyint_min", FPS, "-sc_threshold", 0,
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-video_track_timescale", 15360, "-movflags", "+faststart", output)
        if int(probe(output)["streams"][0]["nb_frames"]) != job["frames"]:
            raise ValueError(f"Wrong frame count: {job['id']}")
        write_json(cache, signature)
        print(f"Rendered {job['id']}: {job['frames']} frames", flush=True)
        return output

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        parts = list(pool.map(encode, jobs))
    concat = folder / "parts.txt"
    concat.write_text("".join(f"file '{p.name}'\n" for p in parts))
    output = ROOT / config["output"]
    staging = output.with_name(output.stem + ".rendering.mp4")
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-i", source / config["sourceRender"],
           "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-t", timeline["duration"],
           "-movflags", "+faststart", staging)
    if input_snapshot(source, source_paths) != original:
        raise RuntimeError("Shared inputs changed during the portrait build; inspect before delivery")
    staging.replace(output)
    write_json(ROOT / "renders/portrait-manifest.json", dict(
        width=W, height=H, fps=FPS, frames=timeline["totalFrames"], duration=timeline["duration"],
        edit_sha256=sha256(CONFIG), builder_sha256=code_hash, output_sha256=sha256(output),
        source_hashes=source_hashes, source_inventory=original, scenes=jobs,
        variant="portrait", graphics_hashes={p.name: sha256(p) for p in sorted(GRAPHICS.iterdir()) if p.is_file()},
        audio="Unchanged AAC stream copied from the landscape export", output=config["output"]))
    check(config, source)
    print(output, flush=True)


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--review", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    config = load_config()
    source = ROOT
    if (source / config["sourceRender"]).resolve() == (ROOT / config["output"]).resolve():
        raise ValueError("Landscape and portrait exports must have distinct paths")
    if (config["width"], config["height"], config["fps"]) != (W, H, FPS):
        raise ValueError("This layout is designed for 1080 × 1920 / 30 fps")
    if args.check:
        check(config, source)
        return
    if not args.review:
        check_export("landscape")
    timeline = json.loads((source / "timeline.json").read_text())
    landscape = next(stream for stream in probe(source / config["sourceRender"])["streams"]
                     if stream["codec_type"] == "video")
    if int(landscape["nb_frames"]) != timeline["totalFrames"] or timeline["fps"] != FPS:
        raise ValueError("Original render and timeline must agree")
    prepare_graphics(source, config)
    jobs = make_jobs(config, timeline)
    if args.review:
        review(source, jobs)
    else:
        render(config, source, timeline, jobs)


if __name__ == "__main__":
    main()
