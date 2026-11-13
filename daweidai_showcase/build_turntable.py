#!/usr/bin/env python3
"""Center a real turntable recording and retime one revolution by tracked angle."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter1d

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "turntable-edit.json"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1048576), b""):
            digest.update(block)
    return digest.hexdigest()


def prepared_path(variant):
    return ROOT / f"renders/turntable/{variant}/clip.mp4"


def figure_box(image):
    """The yellow/black/green figure is separated from its gray/white surroundings."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = ((hsv[:, :, 2] < 105) | ((hsv[:, :, 1] > 65) & (hsv[:, :, 2] < 235))).astype("uint8") * 255
    mask[:8] = 0
    mask[470:] = 0
    mask[:, :300] = 0
    mask[:, 680:] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask)
    choices = [j for j in range(1, count) if stats[j, cv2.CC_STAT_AREA] > 1500]
    if not choices:
        raise ValueError("Figure tracking failed")
    index = max(choices, key=lambda j: stats[j, cv2.CC_STAT_AREA])
    return stats[index, :4].astype(float) * 2


def plane_basis(points):
    a, b, c, d = points
    return np.stack(((b - a + c - d) / 2, (d - a + c - b) / 2), axis=1)


def analyze(config):
    start, end = config["sourceFrames"]
    cap = cv2.VideoCapture(str(ROOT / config["source"]))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    frames = []
    for index in range(start, end + 1):
        ok, frame = cap.read()
        if not ok:
            raise ValueError(f"Missing turntable frame {index}")
        frames.append(cv2.resize(frame, (960, 540), interpolation=cv2.INTER_AREA))
    cap.release()
    boxes = np.array([figure_box(frame) for frame in frames])
    centers = gaussian_filter1d(boxes[:, :2] + boxes[:, 2:] / 2, 1.0, axis=0, mode="nearest")
    heights = gaussian_filter1d(boxes[:, 3], 1.0, mode="nearest")
    quad = np.float32(config["topPlaneSeed960"])
    inverse = np.linalg.inv(plane_basis(quad))
    gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    angles, point_counts = [], []
    for index, frame in enumerate(frames):
        if index:
            mask = np.zeros_like(gray)
            cv2.fillConvexPoly(mask, np.int32(quad), 255)
            mask = cv2.erode(mask, np.ones((15, 15), np.uint8))
            points = cv2.goodFeaturesToTrack(gray, maxCorners=150, qualityLevel=.003,
                                            minDistance=3, mask=mask, blockSize=3)
            if points is None or len(points) < 8:
                raise ValueError("Not enough head-plane features")
            following = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            moved, good, _ = cv2.calcOpticalFlowPyrLK(
                gray, following, points, None, winSize=(15, 15), maxLevel=2,
                criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 40, .001))
            back, backward, _ = cv2.calcOpticalFlowPyrLK(following, gray, moved, None,
                                                       winSize=(15, 15), maxLevel=2)
            valid = ((good.ravel() != 0) & (backward.ravel() != 0)
                     & (np.linalg.norm(back - points, axis=2).ravel() < .5))
            if valid.sum() < 8:
                raise ValueError("Head-plane tracking lost its reliable features")
            transform, inliers = cv2.findHomography(points[valid], moved[valid], cv2.RANSAC, .7)
            if transform is None:
                raise ValueError("Could not fit head-plane motion")
            quad = cv2.perspectiveTransform(quad.reshape(-1, 1, 2), transform).reshape(4, 2)
            gray = following
            point_counts.append(int(valid.sum()))
        else:
            point_counts.append(0)
        matrix = inverse @ plane_basis(quad)
        angles.append(np.arctan2(matrix[1, 0] - matrix[0, 1], matrix[0, 0] + matrix[1, 1]))
    raw_phase = -np.degrees(np.unwrap(angles))
    raw_phase = np.maximum.accumulate(raw_phase - raw_phase[0])
    # Visual front/side/back landmarks limit drift from the approximate planar camera model.
    anchor_frames, anchor_degrees = np.array(config["angleAnchors"]).T
    anchor_values = np.interp(anchor_frames - start, np.arange(len(raw_phase)), raw_phase)
    if not np.all(np.diff(anchor_values) > 0):
        raise ValueError("Angular anchors must progress through the revolution")
    calibrated = PchipInterpolator(anchor_values, anchor_degrees)(raw_phase)
    calibrated[0], calibrated[-1] = 0, 360
    calibrated = np.maximum.accumulate(calibrated)
    rows = [dict(sourceFrame=start + i, bbox=box.tolist(), center=center.tolist(),
                 height=float(height), trackedDegrees=float(raw), degrees=float(angle),
                 trackedPoints=count)
            for i, (box, center, height, raw, angle, count) in enumerate(
                zip(boxes, centers, heights, raw_phase, calibrated, point_counts))]
    return rows


def render_variant(config, rows, target, folder, variant):
    folder.mkdir(parents=True, exist_ok=True)
    frame_dir = folder / "frames"
    frame_dir.mkdir(exist_ok=True)
    width, height = target["width"], target["height"]
    duration, fps = config["duration"], config["fps"]
    fill = config["figureHeight"][variant]
    cap = cv2.VideoCapture(str(ROOT / config["source"]))
    cap.set(cv2.CAP_PROP_POS_FRAMES, config["sourceFrames"][0])
    selected, framing = [], []
    previous_angle = -1.0
    for row in rows:
        ok, frame = cap.read()
        if not ok:
            raise ValueError("Incomplete turntable source")
        angle = row["degrees"]
        if angle - previous_angle < .25 and row is not rows[-1]:
            continue  # Remove the source's stationary/repeated poses.
        scale = height * fill / row["height"]
        cx, cy = row["center"]
        matrix = np.array([[scale, 0, width / 2 - cx * scale],
                           [0, scale, height / 2 - cy * scale]], dtype=np.float64)
        picture = cv2.warpAffine(frame, matrix, (width, height), flags=cv2.INTER_LANCZOS4,
                                 borderMode=cv2.BORDER_REPLICATE)
        path = frame_dir / f"{row['sourceFrame']:04}.png"
        if not cv2.imwrite(str(path), picture):
            raise OSError(path)
        x, y, w, h = row["bbox"]
        output_box = [(x - cx) * scale + width / 2, (y - cy) * scale + height / 2,
                      w * scale, h * scale]
        if output_box[0] < 0 or output_box[1] < 0 or output_box[0] + output_box[2] > width or output_box[1] + output_box[3] > height:
            raise ValueError(f"Turntable framing clips the figure: {variant}")
        center_error = [output_box[0] + output_box[2] / 2 - width / 2,
                        output_box[1] + output_box[3] / 2 - height / 2]
        framing.append(dict(sourceFrame=row["sourceFrame"], bbox=output_box, centerError=center_error))
        selected.append((path, .1 + duration * angle / 360))
        previous_angle = angle
    cap.release()
    # Millisecond PNG timestamps preserve the nonlinear angle-based edit. Handles at each
    # end allow motion interpolation to deliver both the first and final visible poses.
    entries = [(selected[0][0], 0), *selected, (selected[-1][0], duration + .2)]
    concat = folder / "frames.ffconcat"
    lines = ["ffconcat version 1.0"]
    for index, (path, time) in enumerate(entries):
        lines += [f"file 'frames/{path.name}'", "option framerate 1000"]
        if index + 1 < len(entries):
            lines.append(f"duration {entries[index + 1][1] - time:.9f}")
    concat.write_text("\n".join(lines) + "\n")
    filters = ("scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p,"
               f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:"
               "me=epzs:mb_size=16:search_param=16:vsbmc=1:scd=none,"
               f"trim=start=0.1:end={duration + .1},setpts=PTS-STARTPTS,"
               "unsharp=5:5:0.3:3:3:0,setsar=1,"
               "setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709")
    output = folder / "clip.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "concat", "-safe", "0", "-i", str(concat), "-an", "-vf", filters,
                    "-frames:v", str(round(duration * fps)), "-c:v", "libx264", "-preset", "fast",
                    "-crf", "16", "-threads", "2", "-g", str(fps), "-keyint_min", str(fps),
                    "-sc_threshold", "0", "-colorspace", "bt709", "-color_primaries", "bt709",
                    "-color_trc", "bt709", "-video_track_timescale", "15360",
                    "-map_metadata", "-1", "-movflags", "+faststart", str(output)], check=True)
    metadata = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames",
        "-of", "json", str(output)]))
    if int(metadata["streams"][0]["nb_frames"]) != round(duration * fps):
        raise ValueError("Incomplete interpolated turntable export")
    print(f"Prepared centered turntable: {variant} / {duration}s", flush=True)
    return dict(path=str(output.relative_to(ROOT)), sha256=sha256(output), **target,
                frames=round(duration * fps), framing=framing)


def contact_sheet(item, variant, folder):
    width, height = (480, 270) if variant == "landscape" else (270, 480)
    sheet = Image.new("RGB", (width * 4, (height + 28) * 2), "#f3f4f1")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 14)
    cap = cv2.VideoCapture(str(ROOT / item["path"]))
    for i in range(8):
        cap.set(cv2.CAP_PROP_POS_MSEC, i * 1000)
        ok, picture = cap.read()
        if not ok:
            raise ValueError("Could not inspect the prepared clip")
        picture = cv2.resize(picture, (width, height), interpolation=cv2.INTER_AREA)
        x, y = i % 4 * width, i // 4 * (height + 28)
        sheet.paste(Image.fromarray(cv2.cvtColor(picture, cv2.COLOR_BGR2RGB)), (x, y))
        draw.text((x + 5, y + height + 5), f"{i}s / target {i * 45} deg", fill="black", font=font)
    cap.release()
    output = folder / f"{variant}-contact.jpg"
    sheet.save(output, quality=92)
    print(output, flush=True)


def prepare(edit, *, preview=False):
    if not any(shot.get("type") == "turntable" for shot in edit["shots"]):
        return None
    config = json.loads(CONFIG.read_text())
    signature = dict(config=config, source_sha256=sha256(ROOT / config["source"]),
                     generator_sha256=sha256(Path(__file__)), preview=preview)
    folder = ROOT / ("review/turntable/prepared" if preview else "renders/turntable")
    manifest_path = folder / "manifest.json"
    folder.mkdir(parents=True, exist_ok=True)
    if manifest_path.exists():
        saved = json.loads(manifest_path.read_text())
        if saved["signature"] == signature and all(
            (ROOT / item["path"]).is_file() and sha256(ROOT / item["path"]) == item["sha256"]
            for item in saved["formats"].values()
        ):
            return saved
    rows = analyze(config)
    (folder / "tracking.json").write_text(json.dumps(rows, indent=2) + "\n")
    outputs = {}
    for variant, target in edit["formats"].items():
        target = {k: v // 2 if preview else v for k, v in target.items()}
        outputs[variant] = render_variant(config, rows, target, folder / variant, variant)
        contact_sheet(outputs[variant], variant, folder)
    manifest = dict(signature=signature, duration=config["duration"], fps=config["fps"],
                    targetDegreesPerSecond=360 / config["duration"], formats=outputs)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    prepare(json.loads((ROOT / "edit.json").read_text()), preview=args.preview)
