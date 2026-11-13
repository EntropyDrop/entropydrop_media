#!/usr/bin/env python3
"""New sampled orchestral performance based on the original song's melody.

No original or third-party arranged audio is mixed into these renders. This is
an arrangement of an existing composition, not a copyright-free composition.
"""
import argparse
import hashlib
import json
import math
import random
import subprocess
from pathlib import Path
import mido

ROOT=Path(__file__).resolve().parent
BPM=135
QUARTER=60/BPM
RATE=48000
VOICES=[
    dict(name='First violins — melody',program=48,pan=-.22,gain=0),
    dict(name='Second violins and violas',program=49,pan=-.05,gain=-12),
    dict(name='Cellos',program=42,pan=.26,gain=-8),
    dict(name='Double basses',program=43,pan=.32,gain=-11),
    dict(name='Clarinet — opening melody',program=71,pan=.10,gain=-2),
    dict(name='Flute — upper doubling',program=73,pan=-.08,gain=-12),
    dict(name='French horns',program=60,pan=.18,gain=-13),
    dict(name='Harp',program=46,pan=-.35,gain=-12),
    dict(name='Timpani',program=47,pan=.08,gain=-17),
    dict(name='Pizzicato strings — pulse',program=45,pan=-.15,gain=-10),
]
CHORDS={
    'Bb':(46,[58,62,65]),'F':(41,[57,60,65]),'Gm':(43,[55,58,62]),
    'Eb':(39,[55,58,63]),'Cm':(48,[55,60,63]),'Dm':(38,[57,62,65]),
    'F7':(41,[57,60,63]),'Bb/D':(38,[58,62,65]),'F/A':(45,[57,60,65]),
}


def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


def source_chord(transcription,beat):
    # Select diatonic harmony from the original accompaniment's chroma evidence.
    row=next(b for b in transcription['bars'] if b['beat']==int(beat//4)*4)
    c=row['chroma']
    choices=['Bb','F','Gm','Eb','Cm','Dm']
    return max(choices,key=lambda name:sum(c[n%12] for n in CHORDS[name][1]))


def sections(fmt):
    if fmt=='landscape':
        return [(4,32,64,'verse'),(68,96,32,'rise'),(100,128,64,'chorus'),(164,160,32,'reprise')],212
    return [(4,64,32,'verse'),(36,112,16,'rise'),(52,128,56,'chorus')],124


def arrange(fmt,transcription):
    mapping,total=sections(fmt);coda=total-16;notes=[];controls=[]
    rng=random.Random(20261029+(fmt=='portrait'))
    def add(voice,beat,length,pitch,velocity,locked=False):
        at=max(0,beat*QUARTER+(0 if locked else rng.uniform(-.008,.008)))
        end=min((beat+length)*QUARTER,total*QUARTER-.75)
        if end-at<.025:return
        notes.append(dict(time=round(at,6),duration=round(end-at,6),midi=int(pitch),
                          velocity=max(25,min(102,int(velocity+rng.randint(-2,2)))),voice=voice,
                          beat=round(beat,4),length=round(length,4)))
    melody=[]
    for destination,origin,length,kind in mapping:
        for note in transcription['notes']:
            if not origin<=note['beat']<origin+length:continue
            start=destination+note['beat']-origin
            end=min(destination+length,destination+note['end']-origin)
            pitch=note['midi']
            # Avoid transcription octave outliers outside the original lead range.
            while pitch>77:pitch-=12
            while pitch<53:pitch+=12
            if end>start:melody.append(dict(beat=start,end=end,midi=pitch,section=kind,source_beat=note['beat']))
    # A newly composed cadence uses the song's descending closing contour.
    for b,d,n in [(0,1,67),(1,1,65),(2,1.8,63),(4,1,65),(5,1,62),(6,1.8,60),(8,5.6,58)]:
        melody.append(dict(beat=coda+b,end=coda+b+d,midi=n,section='coda',source_beat=None))
    melody.sort(key=lambda n:n['beat'])
    # Keep the melody monophonic after quantization, and join tiny breath gaps.
    for i,n in enumerate(melody):
        if i+1<len(melody):n['end']=min(n['end'],melody[i+1]['beat'])
        length=n['end']-n['beat']
        if length<.125:continue
        kind=n['section'];strong=kind in ('chorus','reprise')
        accent=4 if n['beat']%4<.2 else 0
        velocity=(83 if strong else 72)+accent
        add(0,n['beat'],length*.99,n['midi'],velocity,True)
        if kind in ('verse','rise','coda'):
            add(4,n['beat']+.008,length*.94,n['midi'],70 if kind=='verse' else 64)
        elif length>=.75 and n['midi']>=65:
            add(5,n['beat']+.015,length*.94,n['midi'],62)
    bars=[]
    previous=[58,62,65]
    for bar in range(total//4):
        beat=bar*4
        segment=next((s for s in mapping if s[0]<=beat<s[0]+s[2]),None)
        if beat>=coda:
            chord=['Eb','F7','Bb','Bb'][(beat-coda)//4];kind='coda'
        elif segment:
            dest,origin,_,kind=segment;chord=source_chord(transcription,origin+beat-dest)
        else:chord='Bb';kind='intro'
        bass,tones=CHORDS[chord]
        if kind=='coda' and beat>=coda+8:tones=[58,62,65]
        # Smooth voice leading in the middle strings, avoiding block-chord leaps.
        voiced=[]
        for i,tone in enumerate(tones):
            choices=[tone-12,tone,tone+12]
            voiced.append(min((n for n in choices if 50<=n<=70),key=lambda n:abs(n-previous[i])))
        previous=voiced
        strong=kind in ('chorus','reprise');ending=beat>=coda+8
        level=72 if strong else 58
        sustain=6 if beat==coda+8 else 3.90
        if beat==coda+12:continue
        for pitch in voiced:add(1,beat,sustain,pitch,level)
        add(2,beat,sustain,bass+12,62 if strong else 50)
        add(3,beat,sustain,bass-12 if bass>=43 else bass,63 if strong else 50)
        if kind in ('rise','chorus','reprise','coda'):
            # Spacious horn fifths; low dynamics preserve the lead melody.
            add(6,beat,sustain,bass+12,57 if strong else 46)
            add(6,beat+.025,sustain-.025,bass+19,51 if strong else 42)
        if not ending:
            # Harp eighth notes and soft pizzicato quarters make edit beats audible.
            pattern=[0,1,2,1,0,2,1,2]
            for step,idx in enumerate(pattern):
                pitch=tones[idx]+12
                add(7,beat+step*.5,.65,pitch,51+(7 if step==0 else 0)+(5 if strong else 0),True)
            for step in range(4):
                add(9,beat+step,.46,bass+12 if step%2==0 else tones[1],
                    (65 if step==0 else 48)+(7 if strong else 0),True)
        if strong or beat in (0,coda,coda+4,coda+8):
            add(8,beat,1.65,bass if bass<=48 else bass-12,53 if strong else 44,True)
        bars.append(dict(beat=beat,chord=chord,section=kind))
        # Bow/breath expression swells, while the quarter-note grid stays fixed.
        for voice in [0,1,2,3,4,5,6]:
            for offset,value in [(0,89),(.7,98),(2.4,105),(3.8,91)]:
                if ending:value=int(94-18*offset/4)
                controls.append(dict(time=round((beat+offset)*QUARTER,6),voice=voice,controller=11,value=value))
    # The final tonic lasts into a quiet hall tail instead of being chopped mid-phrase.
    for voice in range(len(VOICES)):
        controls.append(dict(time=0,voice=voice,controller=7,value=100))
    perf=dict(title='念张师 · 自编配管弦乐版',format=fmt,tempo_bpm=BPM,key='B-flat major',
              duration=total*QUARTER+.05,sample_rate=RATE,
              sound_bank=str(ROOT/'sources/instruments/GeneralUser-GS.sf2'),voices=VOICES,
              notes=sorted(notes,key=lambda n:(n['time'],n['voice'],n['midi'])),controls=controls,
              total_beats=total,sections=mapping,bars=bars,melody=melody)
    return perf


def save_midi(perf,path):
    midi=mido.MidiFile(ticks_per_beat=960)
    meta=mido.MidiTrack();midi.tracks.append(meta)
    meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
    meta.append(mido.MetaMessage('key_signature',key='Bb'))
    meta.append(mido.MetaMessage('time_signature',numerator=4,denominator=4))
    for voice,cfg in enumerate(VOICES):
        channel=voice if voice<9 else voice+1
        track=mido.MidiTrack();midi.tracks.append(track)
        track.append(mido.MetaMessage('track_name',name=cfg['name'].replace('—','-')))
        track.append(mido.Message('program_change',channel=channel,program=cfg['program']))
        track.append(mido.Message('control_change',channel=channel,control=10,value=round(64+cfg['pan']*63)))
        events=[]
        for n in perf['notes']:
            if n['voice']!=voice:continue
            for at,kind,value in [(n['time'],'note_on',n['velocity']),(n['time']+n['duration'],'note_off',0)]:
                events.append((round(at/QUARTER*960),0 if kind=='note_off' else 2,
                               mido.Message(kind,channel=channel,note=n['midi'],velocity=value)))
        for c in perf['controls']:
            if c['voice']==voice:
                events.append((round(c['time']/QUARTER*960),1,mido.Message('control_change',channel=channel,
                               control=c['controller'],value=c['value'])))
        last=0
        for tick,_,message in sorted(events,key=lambda e:(e[0],e[1])):
            message.time=tick-last;track.append(message);last=tick
    midi.save(path)


def main():
    p=argparse.ArgumentParser();p.add_argument('--format',choices=['all','landscape','portrait'],default='all')
    p.add_argument('--score-only',action='store_true');args=p.parse_args()
    trans=json.loads((ROOT/'score/original-transcription.json').read_text())
    for fmt in (['landscape','portrait'] if args.format=='all' else [args.format]):
        perf=arrange(fmt,trans)
        score=ROOT/'score'/f'orchestra-{fmt}.json';write(score,perf)
        save_midi(perf,score.with_suffix('.mid'))
        if not args.score_only:
            raw=ROOT/'audios'/f'orchestra-{fmt}-raw.wav'
            subprocess.run(['swift','-module-cache-path',str(ROOT/'.cache/swift-module-cache'),
                            str(ROOT/'render_orchestra.swift'),str(score),str(raw)],check=True)
            out=ROOT/'audios'/f'nian-zhang-shi-own-orchestra-{fmt}.wav'
            duration=perf['total_beats']*QUARTER
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af',
                            f'highpass=f=35,lowpass=f=14500,afade=t=out:st={duration-.65}:d=0.65',
                            '-ar',str(RATE),'-ac','2','-c:a','pcm_s24le',str(out)],check=True)
            print(out,flush=True)
    beatmap=dict(input='score/orchestra-landscape.mid',analysis='Exact quarter-note grid of the newly arranged score',
                 tempo_bpm=BPM,beats=[round(i*QUARTER,9) for i in range(221)])
    write(ROOT/'music-beats.json',beatmap)
    if not args.score_only:
        digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        metadata=dict(title='念张师 · 自编配管弦乐版',type='New local sampled performance of an existing song',
                      originalRecording=dict(url='https://www.youtube.com/watch?v=ZZh1kRr0KQk',
                                             localFile='sources/music/nian-zhang-shi-original.wav',
                                             usage='Reference for melody transcription and harmonic analysis only; no source audio in final mix'),
                      thirdPartyArrangementAudioUsed=False,tempoBPM=BPM,key='B-flat major',
                      method='Transcribed melody, new orchestration and cadences; ten sampled orchestral parts, phrased dynamics and hall reverb',
                      instruments=dict(name='GeneralUser GS 2.0.3',author='S. Christian Collins',
                                       url='https://github.com/mrbumpy409/GeneralUser-GS',
                                       license='score/GeneralUser-GS-LICENSE.txt',sha256=digest(ROOT/'sources/instruments/GeneralUser-GS.sf2')),
                      compositionRights='Original composition rights are not cleared by creating this new performance. No commercial license has been obtained.',
                      files={fmt:dict(audio=f'audios/nian-zhang-shi-own-orchestra-{fmt}.wav',
                                      sha256=digest(ROOT/f'audios/nian-zhang-shi-own-orchestra-{fmt}.wav'),
                                      midi=f'score/orchestra-{fmt}.mid',performance=f'score/orchestra-{fmt}.json')
                             for fmt in ['landscape','portrait'] if (ROOT/f'audios/nian-zhang-shi-own-orchestra-{fmt}.wav').exists()},
                      dependencies={name:digest(ROOT/name) for name in ['build_orchestra.py','render_orchestra.swift','score/original-transcription.json']},
                      previousVersion='renders/revisions/before-own-orchestra-20261029/')
        write(ROOT/'music-source.json',metadata)


if __name__=='__main__':main()
