"""Resolve independent durations while preserving source playback speed."""
import copy


def position_at(points, time):
    for (a, x), (b, y) in zip(points, points[1:]):
        if time <= b:
            return x + (y - x) * max(0, time - a) / (b - a)
    return points[-1][1]


def resolve_edit(base, variant):
    edit = copy.deepcopy(base)
    if variant == "landscape":
        return edit
    shots = []
    for shot in edit["shots"]:
        if shot.get("landscapeOnly"):
            continue
        original_duration = shot["duration"]
        duration = shot.pop("portraitDuration", original_duration)
        offset = shot.pop("portraitTrimStart", (original_duration - duration) / 2)
        if not 0 <= offset <= original_duration - duration:
            raise ValueError(f"Portrait trim outside shot: {shot['id']}")
        if "in" in shot:
            speed = (shot["out"] - shot["in"]) / original_duration
            shot["in"] += offset * speed
            shot["out"] = shot["in"] + duration * speed
        if "keyframes" in shot:
            points = shot["keyframes"]
            shot["keyframes"] = ([[0, position_at(points, offset)]]
                                 + [[t - offset, x] for t, x in points if offset < t < offset + duration]
                                 + [[duration, position_at(points, offset + duration)]])
        shot["duration"] = duration
        shots.append(shot)
    edit["shots"] = shots
    return edit
