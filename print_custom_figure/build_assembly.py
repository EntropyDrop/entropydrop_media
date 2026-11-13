#!/usr/bin/env python3
"""Cut the selected assembly actions onto a beat grid and synthesize an original score."""
import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent
RATE = 48000


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def synthesize(path, duration, bpm, events, work, *, ending_start=None):
    """Arrange an original electronic score around the assembly and sticker sections."""
    rng = np.random.default_rng(1202026)
    signal = np.zeros((round(duration * RATE), 2), dtype=np.float64)
    beat = 60 / bpm
    bar_length = beat * 4

    def add(sound, start, gain, pan=0):
        offset = round(start * RATE)
        if offset < 0:
            sound, offset = sound[-offset:], 0
        n = min(len(sound), len(signal) - offset)
        if n <= 0:
            return
        stereo = np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
        signal[offset:offset+n] += gain * sound[:n, None] * stereo

    def times(seconds):
        return np.arange(round(seconds * RATE)) / RATE

    def pitched(midi, seconds, brightness=.18):
        t = times(seconds)
        f = 440 * 2 ** ((midi-69)/12)
        tone = np.sin(2*np.pi*f*t) + brightness*np.sin(4*np.pi*f*t) + .07*np.sin(6*np.pi*f*t)
        envelope = np.minimum(1, t/.008) * np.exp(-t/(seconds*.36))
        envelope *= np.minimum(1, (seconds-t)/.035)
        return tone * envelope

    def pad(midi, seconds):
        t = times(seconds)
        f = 440 * 2 ** ((midi-69)/12)
        tone = (.68*np.sin(2*np.pi*f*t) + .2*np.sin(2*np.pi*f*1.002*t)
                + .12*np.sin(4*np.pi*f*t))
        envelope = np.minimum(1, t/.26) * np.minimum(1, (seconds-t)/.7)
        return tone * envelope

    kick_t = times(.38)
    kick_phase = 2*np.pi*(48*kick_t + 105*.032*(1-np.exp(-kick_t/.032)))
    kick = np.sin(kick_phase)*np.exp(-kick_t/.12) + .07*rng.normal(size=len(kick_t))*np.exp(-kick_t/.006)
    snare_t = times(.20)
    snare_noise = sosfilt(butter(2, 1400, 'highpass', fs=RATE, output='sos'), rng.normal(size=len(snare_t)))
    snare = .55*snare_noise*np.exp(-snare_t/.045) + .35*np.sin(2*np.pi*185*snare_t)*np.exp(-snare_t/.035)
    hat_t = times(.075)
    hat = sosfilt(butter(2, 7500, 'highpass', fs=RATE, output='sos'), rng.normal(size=len(hat_t)))*np.exp(-hat_t/.016)
    open_t = times(.22)
    open_hat = sosfilt(butter(2, 6500, 'highpass', fs=RATE, output='sos'), rng.normal(size=len(open_t)))*np.exp(-open_t/.052)
    rim_t = times(.09)
    rim = (np.sin(2*np.pi*810*rim_t)+.32*np.sin(2*np.pi*1370*rim_t))*np.exp(-rim_t/.014)

    cm, ab, eb, bb, gm = (48, 51, 55), (44, 48, 51), (51, 55, 58), (46, 50, 53), (43, 46, 50)
    # Written harmony rather than an indefinitely repeated tonic after 24s.
    harmony = [cm, cm, ab, ab, eb, bb, ab, bb, cm, gm, ab, bb,
               cm, eb, ab, eb, bb, cm, ab, bb, eb, bb, cm, cm, ab, cm, cm]
    patterns = [(0, None, 2, 1, None, 2, None, 1),
                (2, 1, None, 0, 1, None, 2, None),
                (0, None, None, 1, None, 2, 1, None),
                (1, None, 2, None, 0, 1, None, 2)]
    bar_count = int(np.ceil(duration / bar_length))
    for bar in range(bar_count):
        start = bar * bar_length
        chord = harmony[bar % len(harmony)]
        closing = ending_start is not None and start >= ending_start
        if closing:
            continue  # The closing card has its own sparse, sustained resolution.
        overview = start < 2
        pose = 24 <= start < 28
        breakdown = 36 <= start < 40
        stickers = 28 <= start < 36 or start >= 40
        busy = 10 <= start < 24 or start >= 40
        root = chord[0] - 12
        section_gain = .75 if overview else (.55 if pose else (1.0 if stickers else .9))

        # Keep the 120 BPM pulse and existing contact accents. Short fills and
        # a two-bar break vary the groove without shifting the picture edits.
        for quarter in range(4):
            time = start + quarter*beat
            if ending_start is not None and time >= ending_start:
                continue
            if not breakdown and (not pose or quarter in (0, 2)):
                add(kick, time, .5*section_gain*(1 if quarter in (0, 2) else .89))
            elif breakdown and quarter == 0:
                add(kick, time, .21)
            if quarter in (1, 3) and not overview and not pose:
                add(rim if breakdown else snare, time, .09 if breakdown else .21, -.12)
            if not overview:
                hat_gain = .04 if breakdown or pose else (.07 if quarter%2 else .085)
                add(hat, time+beat/2, hat_gain, .3 if quarter%2 else -.3)
                if busy and (quarter+bar)%3 == 0:
                    add(hat, time+beat*.75, .025, -.22)
            if stickers and quarter in (0, 2) and bar%2:
                add(rim, time+beat*.75, .055, .28)
            if not breakdown and (not pose or quarter in (0, 2)):
                bass_note = root + (12 if quarter == 3 and bar%2 else (7 if quarter == 2 and bar%4 == 3 else 0))
                add(pitched(bass_note, .32, .28), time+.035, .23*section_gain)
        if (busy or stickers) and bar%2 == 1:
            add(open_hat, start+3.5*beat, .048, .22)
        if bar in (3, 7, 11, 15, 21):
            for offset, gain in ((3.25, .045), (3.5, .07), (3.75, .095)):
                add(snare, start+offset*beat, gain, -.18+offset*.08)

        if overview or pose or breakdown:
            # A quieter texture makes the next melodic entry perceptible.
            for index, midi in enumerate(chord):
                add(pad(midi+12, bar_length+.65), start, .026 if overview else .036, (index-1)*.4)
            if pose:
                add(pitched(chord[bar%3]+24, 1.25, .08), start+.25, .06, .2)
            continue

        pattern = patterns[(bar//2+bar%2) % len(patterns)]
        if stickers:
            # A new, more spacious call-and-response motif for the photo sequence.
            pattern = ((2, None, 1, None, 0, 1, None, None) if bar%2 == 0
                       else (None, 0, None, 2, None, 1, 2, None))
        for eighth, degree in enumerate(pattern):
            if degree is None:
                continue
            time = start + eighth*beat/2
            if ending_start is not None and time >= ending_start:
                continue
            note = chord[degree]+24
            if stickers and bar%4 == 3 and eighth == 6:
                note = 72  # Resolve the response back to C.
            pluck = pitched(note, .52 if stickers else .40, .10 if stickers else .16)
            gain = .085 if stickers else (.065 if bar%2 else .08)
            pan = .32 if eighth%2 else -.32
            add(pluck, time, gain, pan)
            add(pluck, time+.1875, gain*.18, -pan)
        if busy or stickers:
            # Warm lower chord stabs answer the plucks; no continuous eighth-note ostinato.
            for index, midi in enumerate(chord):
                add(pitched(midi+12, .65, .10), start+1.5*beat, .022, (index-1)*.42)
        if stickers and bar%4 in (1, 3):
            for offset, note in ((.5, chord[1]+12), (2.75, chord[2]+12)):
                add(pitched(note, .8, .07), start+offset*beat, .042, -.26)

    # Brief pickups signal section changes, with room left around contact clicks.
    for boundary in (10, 18, 28, 40):
        if boundary < duration and (ending_start is None or boundary < ending_start):
            swell = pitched(72, .36, .06)[::-1].copy()
            swell *= np.minimum(1, (len(swell)-1-np.arange(len(swell)))/(RATE*.025))
            add(swell, boundary-.36, .045, -.15)
    click_t = times(.085)
    click = (np.sin(2*np.pi*(1250*click_t-3200*click_t**2)) + .2*rng.normal(size=len(click_t))) * np.exp(-click_t/.018)
    for event in events:
        add(click, event['time'], .14)
    if ending_start is not None:
        closing_length = duration-ending_start
        for index, midi in enumerate((48, 55, 60, 63)):
            add(pad(midi, closing_length), ending_start, .046, (index-1.5)*.25)
        for delay, midi in ((.05, 72), (.8, 67), (1.55, 63), (4.2, 72)):
            if delay < closing_length:
                add(pitched(midi, 1.8, .06), ending_start+delay, .065, -.2 if midi==67 else .2)
    fade_in = np.minimum(1, np.arange(len(signal))/(RATE*.008))
    fade_out = np.minimum(1, (len(signal)-1-np.arange(len(signal)))/(RATE*1.25))
    signal *= (fade_in*fade_out)[:, None]
    signal *= .82/max(.82, np.max(np.abs(signal)))
    raw = work / 'score-raw.wav'
    with wave.open(str(raw), 'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(RATE)
        wav.writeframes((signal*32767).astype('<i2').tobytes())
    ffmpeg('-i', raw, '-af', 'loudnorm=I=-19:TP=-2:LRA=7', '-ar', RATE, '-ac', 2, '-c:a', 'pcm_s16le', path)

def main():
    edit_path = ROOT / "assembly-edit.json"
    edit = json.loads(edit_path.read_text())
    source = ROOT / edit["source"]
    fps, bpm = edit["fps"], edit["bpm"]
    work = ROOT / "renders" / "assembly-work"
    work.mkdir(parents=True, exist_ok=True)
    (ROOT / edit["video"]).parent.mkdir(parents=True, exist_ok=True)
    shots, events, parts = [], [], []
    cursor = 0
    for shot in edit["shots"]:
        count = round(shot["duration"] * fps)
        if abs(count/fps - shot["duration"]) > 1e-8:
            raise ValueError("Shot durations must be whole frames")
        start = cursor / fps
        if abs(start*bpm/60 - round(start*bpm/60)) > 1e-8:
            raise ValueError("Each cut must land on a beat")
        anchors = [(shot["in"], 0)] + [(e["source"], e["target"]) for e in shot["events"]] + [(shot["out"], shot["duration"])]
        piece_files, rates = [], []
        for index, ((a, x), (b, y)) in enumerate(zip(anchors, anchors[1:])):
            if b <= a or y <= x:
                raise ValueError(f"Non-monotonic retiming: {shot['id']}")
            speed = (b-a)/(y-x)
            rates.append(round(speed, 4))
            piece = work / f"{shot['id']}-{index}.mp4"
            piece_frames = round((y-x)*fps)
            filters = f"setpts=(PTS-STARTPTS)/{speed:.10f},fps={fps},scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=0.1"
            ffmpeg("-ss", a, "-t", b-a, "-i", source, "-map", "0:v:0", "-an", "-vf", filters,
                   "-frames:v", piece_frames, "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                   "-g", fps, "-keyint_min", fps, "-sc_threshold", 0,
                   "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", piece)
            piece_files.append(piece)
        parts.extend(piece_files)
        for event in shot["events"]:
            time = start + event["target"]
            if abs(time*bpm/60 - round(time*bpm/60)) > 1e-8:
                raise ValueError("Assembly accent must land on a beat")
            events.append({"time": time, "source_time": event["source"], "label": event["label"]})
        shots.append({**shot, "start": start, "frames": count, "playback_rates": rates})
        cursor += count
        print(f"Cut {shot['id']}: {shot['in']}–{shot['out']}s → {shot['duration']}s", flush=True)
    concat = work / "parts.txt"
    concat.write_text("".join(f"file '{p.name}'\n" for p in parts))
    ffmpeg("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy", "-movflags", "+faststart", ROOT / edit["video"])
    duration = cursor/fps
    synthesize(ROOT / edit["music"], duration, bpm, events, work)
    manifest = {"source": edit["source"], "source_sha256": sha256(source), "edit_sha256": sha256(edit_path),
                "fps": fps, "bpm": bpm, "frames": cursor, "duration": duration,
                "video": edit["video"], "video_sha256": sha256(ROOT / edit["video"]),
                "music": edit["music"], "music_sha256": sha256(ROOT / edit["music"]),
                "music_origin": "Original oscillator and noise synthesis; no external music or samples", "music_seed": 1202026,
                "shots": shots, "beat_accents": events}
    (ROOT / "assets/assembly/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    ffmpeg("-i", ROOT / edit["video"], "-i", ROOT / edit["music"], "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", duration, "-movflags", "+faststart", ROOT / "renders/assembly-installation.mp4")
    print(f"Assembly complete: {duration}s / {cursor} frames / {bpm} BPM", flush=True)


if __name__ == "__main__":
    main()
