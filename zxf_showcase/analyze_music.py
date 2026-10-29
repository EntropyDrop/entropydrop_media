#!/usr/bin/env python3
"""Measure the actual recording's beat positions; never substitute a synthetic grid."""
import argparse,json
from pathlib import Path
import numpy as np
import librosa
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT/json.loads((ROOT/'edit.json').read_text())['music']['source']);p.add_argument('--start-bpm',type=float,default=90);a=p.parse_args()
y,sr=librosa.load(a.input,sr=22050)
hop=256
onset=librosa.onset.onset_strength(y=y,sr=sr,hop_length=hop)
tempo,frames=librosa.beat.beat_track(onset_envelope=onset,sr=sr,hop_length=hop,start_bpm=a.start_bpm,tightness=200,trim=False)
beats=librosa.frames_to_time(frames,sr=sr,hop_length=hop)
# Keep the consistent quarter-note pulse through the syncopated guitar accents.
refined=beats
data={'input':str(a.input.resolve().relative_to(ROOT)),'analysis':'librosa detected beat positions; 256 sample hop, 90 BPM prior','tempo_bpm':float(np.asarray(tempo).ravel()[0]),'sample_rate':sr,'hop_samples':hop,'duration':len(y)/sr,'beats':[round(float(t),6) for t in refined]}
(ROOT/'audios').mkdir(exist_ok=True)
(ROOT/'audios/beat-analysis.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('tempo',data['tempo_bpm'],'beats',len(refined),'duration',data['duration'])
print([(i,round(t,3)) for i,t in enumerate(refined) if 35<t<70])
