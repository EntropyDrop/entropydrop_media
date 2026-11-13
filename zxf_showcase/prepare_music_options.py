#!/usr/bin/env python3
"""Prepare private, level-matched audition excerpts of licensed music candidates."""
import json
import os
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('NUMBA_CACHE_DIR',str(ROOT/'.cache/numba'))
import librosa
import numpy as np

STARTS={'1':24,'2':16,'3':20,'4':32}
DESCRIPTIONS={
    '1':'木吉他、贝斯的轻快流行配乐；优先用于贴皮、组装与成品展示。',
    '2':'舒缓的 Lounge / Chillout，鼓和贝斯保持节奏；适合干净的产品展示。',
    '3':'放松的乡村木吉他，适合手工制作过程和较温暖的成品收尾。',
    '4':'钢琴为主的沉静方向，适合偏纪念感、慢一些的展示。',
}


def main():
    items=json.loads((ROOT/'sources/music-candidates/candidate-metadata.json').read_text())
    folder=ROOT/'audios/music-candidates';folder.mkdir(exist_ok=True)
    for item in items:
        path=ROOT/item['localFile']
        y,sr=librosa.load(path,sr=22050,duration=85)
        onset=librosa.onset.onset_strength(y=y,sr=sr,hop_length=256)
        tempo,indices=librosa.beat.beat_track(onset_envelope=onset,sr=sr,hop_length=256,start_bpm=100,trim=False)
        beats=librosa.frames_to_time(indices,sr=sr,hop_length=256)
        start=float(beats[np.searchsorted(beats,STARTS[item['id']])])
        out=folder/f"{item['id']}-{path.stem}-preview.mp3"
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(path),
                        '-t','24','-af','loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=0.08,afade=t=out:st=23.4:d=0.6',
                        '-ar','48000','-ac','2','-c:a','libmp3lame','-b:a','192k',str(out)],check=True)
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(path)]))
        item.update(durationSeconds=float(probe['format']['duration']),estimatedBPM=round(float(np.ravel(tempo)[0]),1),
                    previewStartSeconds=round(start,4),preview=str(out.relative_to(ROOT)),description=DESCRIPTIONS[item['id']],
                    sampleRate=sr,beatHopSamples=256,detectedBeats=[round(float(b),6) for b in beats])
        print(item['id'],item['name'],item['estimatedBPM'],item['preview'],flush=True)
    record=dict(checkedDate='2026-10-29',purpose='Private music selection for zxf_showcase; full export selection pending',
                recommended=['1','2'],license=dict(name='Mixkit Stock Music Free License',
                url='https://mixkit.co/license/modal/musicFree/',terms='https://mixkit.co/terms/',
                attributionRequired=False,allowed=['Commercial and non-commercial online videos','Social media posts','Online marketing ads'],
                exclusions=['TV/radio broadcast','CD/DVD','Video games','Standalone music redistribution or music-only remix'],
                caveat='Licensed use is not public-domain status and does not guarantee that an automated platform claim will never occur.',
                evidenceFolder='sources/music-candidates/'),tracks=items)
    (ROOT/'music-candidates.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
