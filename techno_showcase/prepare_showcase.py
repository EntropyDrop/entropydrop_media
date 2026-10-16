#!/usr/bin/env python3
"""Preserve originals and prepare a chronological montage with optional AI outpaints."""
import concurrent.futures
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_showcase(config, fps, work):
    originals = ROOT / "sources/showcase"
    assets = ROOT / "assets/showcase/photos"
    originals.mkdir(parents=True, exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    source_directory = Path(config["importDirectory"]).expanduser()
    frames_per_photo = round(config["durationPerPhoto"] * fps)
    if frames_per_photo <= 0 or abs(frames_per_photo / fps - config["durationPerPhoto"]) > 1e-8:
        raise ValueError("Photo durations must be positive whole frames")
    if config["fit"] not in ("contain", "cover"):
        raise ValueError("Choose contain or cover for the opening photographs")
    background = config.get("background", "#000000")
    ai_images = None
    if config.get("aiManifest"):
        ai_manifest = json.loads((ROOT / config["aiManifest"]).read_text())
        ai_images = {image["original"]: image for image in ai_manifest["images"]}
    if not config["photos"] or len(set(config["photos"])) != len(config["photos"]):
        raise ValueError("Use a nonempty photo list without duplicates")
    photos = []
    for name in config["photos"]:
        original = originals / name
        if not original.exists():
            shutil.copy2(source_directory / name, original)
        with Image.open(original) as image:
            exif = image.getexif()
            details = exif.get_ifd(34665) if 34665 in exif else {}
            captured = details.get(36867, exif.get(306, ""))
            subsecond = details.get(37521, "")
            dimensions = list(image.size)
        photos.append(dict(name=name, captured=captured, subsecond=subsecond, dimensions=dimensions,
                           source=str(original.relative_to(ROOT)), source_sha256=sha256(original)))
    photos.sort(key=lambda photo: (photo["captured"], photo["subsecond"].ljust(9, "0"), photo["name"]))
    for index, photo in enumerate(photos):
        original = ROOT / photo["source"]
        override = config.get("imageOverrides", {}).get(photo["name"])
        if override:
            asset = ROOT / override
            with Image.open(asset) as image:
                image_dimensions = list(image.size)
            if abs(image_dimensions[0] / image_dimensions[1] - 16 / 9) > .01:
                raise ValueError(f"Selected opening image must be approximately 16:9: {asset}")
            photo.update(preparation="user-selected-image", imageDimensions=image_dimensions,
                         selectedBy="user")
        elif ai_images is not None:
            ai_image = ai_images[photo["name"]]
            if ai_image["source_sha256"] != photo["source_sha256"]:
                raise ValueError(f"The original photo no longer matches its AI outpaint: {photo['name']}")
            asset = ROOT / ai_image["image"]
            if not asset.exists() or sha256(asset) != ai_image["image_sha256"]:
                raise ValueError(f"Restore the saved AI outpaint: {asset}")
            with Image.open(asset) as image:
                image_dimensions = list(image.size)
            if abs(image_dimensions[0] / image_dimensions[1] - 16 / 9) > .01:
                raise ValueError(f"AI outpaint must be approximately 16:9: {asset}")
            photo.update(preparation="ai-background-outpaint", imageDimensions=image_dimensions,
                         ai_manifest=config["aiManifest"])
        else:
            asset = assets / f"{index + 1:03}{original.suffix.lower()}"
            if not asset.exists() or sha256(asset) != photo["source_sha256"]:
                shutil.copy2(original, asset)
            photo.update(preparation="original-byte-copy", imageDimensions=photo["dimensions"])
        photo.update(image=str(asset.relative_to(ROOT)), image_sha256=sha256(asset),
                     start=index * frames_per_photo / fps, startFrame=index * frames_per_photo,
                     frames=frames_per_photo, duration=frames_per_photo / fps)

    def encode(item):
        index, photo = item
        output = work / f"photo-{index + 1:03}.mp4"
        cache = output.with_suffix(".json")
        signature = dict(version=2, image_sha256=photo["image_sha256"], frames=frames_per_photo,
                         fps=fps, background=background if config["fit"] == "contain" else None, fit=config["fit"])
        if not output.exists() or not cache.exists() or json.loads(cache.read_text()) != signature:
            sizing = ("force_original_aspect_ratio=increase:force_divisible_by=2:" if config["fit"] == "cover"
                      else "force_original_aspect_ratio=decrease:force_divisible_by=2:")
            framing = ("crop=1920:1080," if config["fit"] == "cover"
                       else f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color={background},")
            filters = ("scale=1920:1080:" + sizing
                       + "flags=lanczos:in_range=pc:out_range=tv:out_color_matrix=bt709," + framing
                       + "setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709")
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1",
                            "-framerate", str(fps), "-i", str(ROOT / photo["image"]), "-vf", filters,
                            "-frames:v", str(frames_per_photo), "-an", "-c:v", "libx264", "-crf", "16",
                            "-preset", "fast", "-threads", "2", "-g", str(fps), "-keyint_min", str(fps),
                            "-sc_threshold", "0", "-colorspace", "bt709", "-color_primaries", "bt709",
                            "-color_trc", "bt709", "-video_track_timescale", "15360", "-movflags", "+faststart",
                            str(output)], check=True)
            cache.write_text(json.dumps(signature, indent=2) + "\n")
            print(f"Opening photo {index + 1}: {photo['name']} / {photo['duration']}s", flush=True)
        return output

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        parts = list(executor.map(encode, enumerate(photos)))
    total_frames = len(photos) * frames_per_photo
    manifest = dict(fps=fps, frames=total_frames, duration=total_frames / fps, imageCount=len(photos),
                    imagePreparation=("user-selected-and-ai-outpaint" if config.get("imageOverrides")
                                      else "ai-background-outpaint" if ai_images is not None else "original-byte-copy"),
                    aiManifest=config.get("aiManifest"), fit=config["fit"],
                    background=background if config["fit"] == "contain" else None,
                    photos=photos)
    (ROOT / "assets/showcase/manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    return manifest, parts
