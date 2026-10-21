"""The 59-second portrait cut and its phrase-preserving piano excerpt."""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / 'portrait-edit.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def position(points, time):
    for (a, x), (b, y) in zip(points, points[1:]):
        if time <= b:
            return x + (y-x) * (time-a) / (b-a)
    return points[-1][1]


def resolve_edit(base, variant):
    edit = copy.deepcopy(base)
    edit['formats'] = {variant: base['formats'][variant]}
    if variant != 'portrait':
        return edit
    config = json.loads(CONFIG.read_text())
    originals = {shot['id']: shot for shot in base['shots']}
    shots = []
    for selection in config['shots']:
        shot = copy.deepcopy(originals[selection['id']])
        offset, duration = selection.get('trimStart', 0), selection['duration']
        if not 0 <= offset < offset + duration <= shot['duration'] + 1e-8:
            raise ValueError(f"Portrait trim leaves the original shot: {shot['id']}")
        if 'in' in shot:
            speed = (shot['out'] - shot['in']) / shot['duration']
            shot['in'] += offset * speed
            shot['out'] = shot['in'] + duration * speed
        if 'keyframes' in shot:
            points = shot['keyframes']
            shot['keyframes'] = [[0, position(points, offset)]] + [
                [t-offset, x] for t, x in points if offset < t < offset+duration
            ] + [[duration, position(points, offset+duration)]]
        shot['duration'] = duration
        shots.append(shot)
    edit['shots'] = shots
    edit['photoEndingStart'] = config['photoEndingStart']
    edit['targetDuration'] = config['duration']
    if abs(sum(shot['duration'] for shot in shots) - config['duration']) > 1e-8:
        raise ValueError('Portrait edit must total exactly 59 seconds')
    return edit


def build_music(full_music, edit, scenes, ffmpeg):
    config = json.loads(CONFIG.read_text())
    duration = edit['targetDuration']
    final_start = scenes[-1]['start']
    music = ROOT / 'audios/mini-gundam-bach-prelude-v5-portrait-59s.wav'
    encoded = music.with_suffix('.m4a')
    composition = music.with_suffix('.json')
    source = ROOT / full_music['wave']
    full_score = json.loads((ROOT/full_music['composition']).read_text())
    if full_score['duration'] != 88 or full_score['final_chord_start'] != 85:
        raise ValueError('Update the portrait score ranges for the changed full performance')
    # Full performance: 2.5 seconds per bar. Keep bars 1–4 and 17–35;
    # C major resolves into D minor, G7 and C, followed by the original cadence.
    ranges = config['music']['sourceRanges']
    crossfade = .02
    prelude_length = sum(end-start for start, end in ranges[:-1]) - crossfade
    tempo = prelude_length / final_start
    starts = {shot['id']: shot['start'] for shot in scenes}
    metadata = dict(id='mini-gundam-bach-prelude-v5-portrait-59s', kind='piano-excerpt',
                    title=full_music['title'], origin=full_music['origin'], duration=duration,
                    source_wave=full_music['wave'], source_wave_sha256=digest(source),
                    source_composition=full_music['composition'],
                    source_composition_sha256=digest(ROOT/full_music['composition']),
                    source_ranges=ranges, retained_measures=[[1,4],[17,35]],
                    crossfade_seconds=crossfade, tempo_factor=tempo,
                    performed_bpm_before_final_chord=96*tempo, final_chord_start=final_start,
                    bpm=edit['bpm'], sections={key: starts[value] for key,value in edit['music'].items()},
                    events=[{'time': shot['start']} for shot in scenes[1:-1]],
                    generator_sha256=digest(Path(__file__)))
    if not (music.exists() and encoded.exists() and composition.exists()
            and json.loads(composition.read_text()) == metadata):
        a,b,c = ranges
        filters = (f'[0:a]asplit=3[a][b][c];'
                   f'[a]atrim=start={a[0]}:end={a[1]},asetpts=PTS-STARTPTS[p1];'
                   f'[b]atrim=start={b[0]}:end={b[1]},asetpts=PTS-STARTPTS[p2];'
                   f'[p1][p2]acrossfade=d={crossfade}:c1=qsin:c2=qsin,'
                   f'atempo={tempo:.12f},apad,atrim=end_sample={round(final_start*48000)}[flow];'
                   f'[c]atrim=start={c[0]}:end={c[1]},asetpts=PTS-STARTPTS[tail];'
                   f'[flow][tail]concat=n=2:v=0:a=1,apad,atrim=end_sample={round(duration*48000)},'
                   f'afade=t=out:st={duration-.8}:d=0.8[out]')
        ffmpeg('-i',source,'-filter_complex',filters,'-map','[out]',
               '-ar',48000,'-ac',2,'-c:a','pcm_s16le',music)
        ffmpeg('-i',music,'-c:a','aac','-b:a','192k','-ar',48000,encoded)
        composition.write_text(json.dumps(metadata,indent=2)+'\n')
    return dict(**metadata, wave=str(music.relative_to(ROOT)), wave_sha256=digest(music),
                encoded=str(encoded.relative_to(ROOT)), encoded_sha256=digest(encoded),
                composition=str(composition.relative_to(ROOT)), composition_sha256=digest(composition))
