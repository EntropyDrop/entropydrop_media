#!/usr/bin/env python3
"""Estimate notes and harmonic evidence from the original recording, not a cover.

The pitch track is an approximate transcription. It is retained separately from
the new orchestration so that musical edits remain inspectable and reproducible.
"""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT/'.cache/numba'))
import json
import numpy as np
import librosa
from scipy.ndimage import median_filter


def main():
    out=ROOT/'score';out.mkdir(exist_ok=True)
    beat_file=ROOT/'score/original-beats.json'
    beats=np.array(json.loads(beat_file.read_text())['beats'])
    sr=16000;hop=160;duration=180
    source=ROOT/'audios/separated/htdemucs_ft/nian-zhang-shi-original'
    cache=ROOT/'audios/melody-pitch.npz'
    if cache.exists():
        track=np.load(cache);f0=track['f0'];prob=track['prob'];rms=track['rms']
    else:
        y,_=librosa.load(source/'vocals.wav',sr=sr,duration=duration)
        print('Tracking original vocal melody...',flush=True)
        f0,voiced,prob=librosa.pyin(y,fmin=librosa.note_to_hz('C3'),fmax=librosa.note_to_hz('C6'),
                                  sr=sr,frame_length=1024,hop_length=hop,fill_na=np.nan)
        rms=librosa.feature.rms(y=y,frame_length=1024,hop_length=hop)[0]
        np.savez_compressed(cache,f0=f0,prob=prob,rms=rms)
    valid=np.isfinite(f0)&(prob>.12)&(rms>.010)
    # A second pitch model is more reliable on breathy consonants and long notes.
    # Cache both estimates so the refinement can be inspected without a rerun.
    crepe_cache=ROOT/'audios/crepe-pitch.npz'
    if not crepe_cache.exists():
        import torch
        import torchcrepe
        torch.set_num_threads(6)
        vocal,_=librosa.load(source/'vocals.wav',sr=sr,duration=170)
        print('Refining with CREPE...',flush=True)
        cf,cp=torchcrepe.predict(torch.from_numpy(vocal).unsqueeze(0),sr,hop_length=hop,
                                fmin=100,fmax=700,model='full',return_periodicity=True,
                                batch_size=256,device='cpu')
        np.savez_compressed(crepe_cache,f0=cf[0].numpy(),prob=cp[0].numpy(),
                            rms=librosa.feature.rms(y=vocal,frame_length=1024,hop_length=hop)[0])
    track=np.load(crepe_cache);f0=track['f0'];prob=track['prob'];rms=track['rms']
    valid=np.isfinite(f0)&(prob>.38)&(rms>.012)
    pitch=np.zeros(len(f0),dtype=int)
    pitch[valid]=np.rint(librosa.hz_to_midi(f0[valid])).astype(int)
    # Median filtering removes brief pitch-estimator glitches and vocal vibrato.
    pitch=median_filter(pitch,size=7)
    t=np.arange(len(f0))*hop/sr
    runs=[];start=0
    for i in range(1,len(pitch)+1):
        if i==len(pitch) or pitch[i]!=pitch[start]:
            if pitch[start] and (i-start)*hop/sr>=.085:
                a=t[start];b=min(duration,i*hop/sr)
                x=float(np.interp(a,beats,np.arange(len(beats))))
                end=float(np.interp(b,beats,np.arange(len(beats))))
                runs.append(dict(source_start=round(a,3),source_end=round(b,3),
                                 beat=round(x*4)/4,end=round(end*4)/4,
                                 midi=int(pitch[start]),confidence=round(float(np.mean(prob[start:i])),3)))
            start=i
    notes=[]
    for n in runs:
        if n['end']<=n['beat']:continue
        # Reject very short chromatic pitch estimates in this B-flat-major song.
        if n['midi']%12 not in [10,0,2,3,5,7,9] and n['end']-n['beat']<=.5:continue
        if notes and notes[-1]['midi']==n['midi'] and n['beat']-notes[-1]['end']<=.25:
            notes[-1]['end']=n['end'];notes[-1]['source_end']=n['source_end']
        else:notes.append(n)
    print('Analyzing original harmonic accompaniment...',flush=True)
    y,_=librosa.load(source/'no_vocals.wav',sr=22050,duration=duration)
    harmonic=librosa.effects.harmonic(y,margin=3)
    chroma=librosa.feature.chroma_cqt(y=harmonic,sr=22050,hop_length=512)
    ct=librosa.frames_to_time(np.arange(chroma.shape[1]),sr=22050,hop_length=512)
    bars=[]
    for beat in range(0,min(len(beats)-4,400),4):
        selected=chroma[:,(ct>=beats[beat])&(ct<beats[beat+4])]
        bars.append(dict(beat=beat,chroma=np.round(selected.mean(axis=1),5).tolist()))
    data=dict(method='Original isolated vocal: pYIN inspection, CREPE refinement, 10 ms hop, 1/16-note quantization; accompaniment CQT harmonic evidence',
              source='sources/music/nian-zhang-shi-original.wav',source_beats=beats.tolist(),notes=notes,bars=bars)
    (out/'original-transcription.json').write_text(json.dumps(data,indent=2)+'\n')
    print(f'{len(notes)} estimated notes',flush=True)
    for b in range(0,400,4):
        ns=[n for n in notes if b<=n['beat']<b+4]
        if ns:print(f"{b:3} / {beats[b]:6.1f}s: "+' '.join(f"{librosa.midi_to_note(n['midi'])}@{n['beat']-b:g}:{n['end']-n['beat']:g}" for n in ns))


if __name__=='__main__':main()
