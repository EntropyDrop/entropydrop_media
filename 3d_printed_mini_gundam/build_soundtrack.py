"""Bach BWV 846: a locally rendered piano performance fitted to the 88-second film.

The composition and public-domain score are J. S. Bach / Mutopia Project.
This project supplies the performance timing, dynamics, pedal and audio rendering;
it does not claim authorship of Bach's composition or import an existing recording.
"""
import hashlib
import json
import math
import random
import struct
import subprocess
from pathlib import Path

RATE = 48000
SCORE_ID = 'mini-gundam-bach-prelude-v5'
SCORE_TITLE = 'J. S. Bach - Prelude in C major, BWV 846 (piano rendition)'
SCORE_VERSION = 5
TEMPO_RATIO = .8
SCORE_ORIGIN = 'J. S. Bach BWV 846, public-domain Mutopia score; a new local piano rendering with macOS bundled instrument bank, no imported music recording'
ROOT = Path(__file__).resolve().parent
SCORE_FOLDER = ROOT/'score_sources/bach-bwv846'
BANK = Path('/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls')
SOURCE_PAGE = 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def score_dependencies():
    paths = [ROOT/'render_piano.swift', SCORE_FOLDER/'wtk1-prelude1.mid',
             SCORE_FOLDER/'wtk1-prelude1.ly', SCORE_FOLDER/'source.json']
    return {str(path.relative_to(ROOT)):digest(path) for path in paths} | {'macos_instrument_bank':digest(BANK)}


def ffmpeg(*args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)


def read_midi(path):
    """Read note timing from a standard MIDI score without a MIDI-library dependency."""
    data = path.read_bytes()
    assert data[:4] == b'MThd'
    header_length = struct.unpack('>I',data[4:8])[0]
    midi_format, track_count, division = struct.unpack('>HHH',data[8:14])
    assert midi_format in (0,1) and not division & 0x8000
    pos = 8+header_length
    notes, names = [], {}
    for track in range(track_count):
        assert data[pos:pos+4] == b'MTrk'
        length = struct.unpack('>I',data[pos+4:pos+8])[0]
        block = data[pos+8:pos+8+length]
        pos += 8+length
        index, tick, running = 0,0,None
        active = {}
        def vlq():
            nonlocal index
            value = 0
            while True:
                byte = block[index]; index += 1
                value = (value << 7) | (byte & 0x7f)
                if not byte & 0x80: return value
        while index < len(block):
            tick += vlq()
            if block[index] & 0x80:
                status = block[index]; index += 1
                if status < 0xf0: running = status
            else:
                assert running is not None
                status = running
            if status == 0xff:
                kind = block[index]; index += 1
                size = vlq()
                if kind == 3: names[track] = block[index:index+size].decode('utf-8',errors='replace')
                index += size
                continue
            if status in (0xf0,0xf7):
                size = vlq(); index += size
                continue
            kind, channel = status & 0xf0,status & 0x0f
            size = 1 if kind in (0xc0,0xd0) else 2
            values = block[index:index+size]; index += size
            if kind not in (0x80,0x90): continue
            pitch, velocity = values
            key = (channel,pitch)
            if kind == 0x90 and velocity:
                active.setdefault(key,[]).append(tick)
            else:
                starts = active.get(key,[])
                assert starts, f'Unmatched note-off {track}/{pitch}'
                start = starts.pop(0)
                notes.append({'beat':start/division,'length':(tick-start)/division,
                              'midi':pitch,'track':track})
        assert not any(active.values()), 'Score contains unterminated notes'
    return sorted(notes,key=lambda n:(n['beat'],n['midi'])),names


def synthesize(path,duration,bpm,events,work,*,ending_start=None,section_times=None):
    """Perform the complete 35-bar prelude, with its final chord aligned at 85s."""
    path.parent.mkdir(parents=True,exist_ok=True)
    work.mkdir(parents=True,exist_ok=True)
    source_notes, names = read_midi(SCORE_FOLDER/'wtk1-prelude1.mid')
    total_beats = max(n['beat']+n['length'] for n in source_notes)
    assert abs(total_beats-140) < 1e-6, f'Unexpected score length: {total_beats}'
    final_start = ending_start if ending_start is not None else duration-3
    # 34 measures lead to the final chord; the last measure receives a fermata.
    quarter = final_start/136
    rng = random.Random(1710202605)
    phrase_shape = [61,62,64,60,62,64,66,62,64,67,63,66,64,67,62,63,65,
                    67,61,63,65,67,69,68,63,65,67,69,68,69,71,68,64,62,60]
    upper_track = next((track for track,name in names.items() if 'upper' in name.lower()),None)
    if upper_track is None:
        tracks = sorted({n['track'] for n in source_notes})
        upper_track = max(tracks,key=lambda track:sum(n['midi'] for n in source_notes if n['track']==track)
                          /sum(n['track']==track for n in source_notes))
    notes = []
    for source in source_notes:
        bar = min(34,int(source['beat']//4))
        voice = 0 if source['track']==upper_track else 1
        local = source['beat'] % 4
        at = source['beat']*quarter
        length = source['length']*quarter
        if bar < 34:
            # Tiny agogic shaping breathes within each half bar while all barlines stay fixed.
            at += .010*math.sin(math.pi*(local % 2)/2) + rng.uniform(-.0035,.0035)
            length *= 1.08 if voice==0 else .97
            length = min(length, (bar+1)*4*quarter-at-.018)
        else:
            at = final_start + (source['midi']-24)*.0010
            length = duration-at-.62
        at = max(0,at)
        accent = 3 if local % 2 in (.5,1.25) else 0
        velocity = phrase_shape[bar]+accent+rng.randint(-2,2)
        if voice==1:
            velocity -= 9 if source['midi']>=48 else 13
        if bar==34:
            velocity = 60 if voice==0 else 50
        notes.append({'time':round(at,6),'duration':round(max(.045,length),6),
                      'midi':source['midi'],'velocity':max(35,min(82,velocity)),
                      'voice':voice,'score_beat':source['beat']})
    pedal = []
    for bar in range(34):
        start = bar*4*quarter
        pedal.extend([{'time':start+.035,'value':95},
                      {'time':start+4*quarter-.065,'value':0}])
    pedal.extend([{'time':final_start+.025,'value':95},{'time':duration-.62,'value':0}])
    performance = {'duration':duration,'sample_rate':RATE,'sound_bank':str(BANK),
                   'notes':sorted(notes,key=lambda n:n['time']),'pedal':pedal}
    performance_path = work/f'{SCORE_ID}-performance.json'
    performance_path.write_text(json.dumps(performance,indent=2)+'\n')
    raw = work/f'{SCORE_ID}-raw.wav'
    subprocess.run(['swift','-module-cache-path',str(work/'swift-module-cache'),
                    str(ROOT/'render_piano.swift'),str(performance_path),str(raw)],check=True)
    # The piano is rendered locally; gently release the room tail into the exact endpoint.
    faded = work/f'{SCORE_ID}-faded.wav'
    ffmpeg('-i',raw,'-af',f'afade=t=in:st=0:d=0.008,afade=t=out:st={duration-.8}:d=0.8',
           '-ar',RATE,'-ac',2,'-c:a','pcm_s24le',faded)
    first = subprocess.run(['ffmpeg','-hide_banner','-i',str(faded),'-af',
                            'loudnorm=I=-18:TP=-2:LRA=7:print_format=json','-f','null','-'],
                           check=True,capture_output=True,text=True).stderr
    measured = json.loads(first[first.rfind('{'):first.rfind('}')+1])
    normalizer = ('loudnorm=I=-18:TP=-2:LRA=7:linear=true:'
                  f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                  f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                  f"offset={measured['target_offset']}")
    ffmpeg('-i',faded,'-af',normalizer,'-ar',RATE,'-ac',2,'-c:a','pcm_s16le',path)
    metadata = {'id':SCORE_ID,'title':SCORE_TITLE,'version':SCORE_VERSION,
                'composer':'Johann Sebastian Bach','work':'Prelude in C major, BWV 846',
                'duration':duration,'picture_grid_bpm':bpm,'arrangement_bpm':bpm*TEMPO_RATIO,
                'performed_bpm_before_final_chord':60/quarter,'origin':SCORE_ORIGIN,
                'style':'Baroque piano / flowing arpeggios, phrased dynamics and pedal',
                'source_page':SOURCE_PAGE,'source_license':'Public Domain (Mutopia edition)',
                'dependencies':score_dependencies(),'score_measures':35,'source_note_count':len(source_notes),
                'final_chord_start':final_start,'sections':section_times,'loudness_target_lufs':-18,
                'true_peak_target_dbtp':-2,'notes_and_hits':performance['notes'],'pedal':pedal}
    path.with_suffix('.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
