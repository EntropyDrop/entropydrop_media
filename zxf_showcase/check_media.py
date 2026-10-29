#!/usr/bin/env python3
"""Validate actual exports: frames, sound coverage, color, decodability and beat sync."""
import json
import subprocess
from fractions import Fraction
from pathlib import Path
from build_video import ROOT,load,plan,probe,sha256,write_json,music_config,comparison_hashes


def main():
    edit=load();results=[]
    source_hash=sha256(ROOT/edit['source'])
    for fmt in edit['formats']:
        music=music_config(edit,fmt)
        expected=plan(edit,fmt);m=json.loads((ROOT/'renders'/f'{fmt}-manifest.json').read_text());output=ROOT/m['output']
        assert m['editSha256']==sha256(ROOT/'edit.json'),'Stale edit'
        assert m['sourceSha256']==source_hash,'Source changed'
        assert m['beatMapSha256']==sha256(ROOT/music['beatMap']),'Stale beat map'
        assert m['musicSource']==music['instrumental'],'Incorrect format soundtrack'
        assert m['musicSourceSha256']==sha256(ROOT/m['musicSource']),'Instrumental changed'
        assert m['renderSha256']==sha256(output),'Export changed'
        assert m['musicSha256']==sha256(ROOT/m['music']),'Music mix changed'
        assert m['shots']==expected['shots'],'Timeline differs from edit'
        expected_images={s['image']:sha256(ROOT/s['image']) for s in expected['shots'] if 'image' in s}
        assert m['imageSourceHashes']==expected_images,'Photo source changed'
        assert m['comparisonSourceHashes']==comparison_hashes(expected),'Comparison source changed'
        info=probe(output);v=[s for s in info['streams'] if s['codec_type']=='video'];a=[s for s in info['streams'] if s['codec_type']=='audio']
        assert len(v)==len(a)==1
        v,a=v[0],a[0]
        assert (v['width'],v['height'])==(m['width'],m['height'])
        assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
        assert v['color_range']=='tv' and v['color_space']=='bt709'
        assert Fraction(v['avg_frame_rate'])==m['fps']
        assert int(v['nb_frames'])==m['frames']==sum(s['frames'] for s in m['shots'])
        assert abs(float(v['duration'])-m['duration'])<1/m['fps']
        assert a['codec_name']=='aac' and a['sample_rate']=='48000' and a['channels']==2
        assert abs(float(a['start_time']))<.025 and abs(float(a['duration'])-m['duration'])<.05
        max_error=max(abs(s['beatErrorMs']) for s in m['shots'])
        assert max_error<=1000/m['fps']/2+1e-3
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(output),'-f','null','-'],check=True)
        # Analyze the delivered AAC, including its encoding overshoot.
        loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(output),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
        block=loud.stderr[loud.stderr.rfind('{'):loud.stderr.rfind('}')+1];levels=json.loads(block)
        assert abs(float(levels['input_i'])-music['targetLUFS'])<2,levels
        assert float(levels['input_tp'])<-.5,levels
        photo_shots=[s for s in m['shots'] if 'image' in s]
        r=dict(format=fmt,file=m['output'],width=m['width'],height=m['height'],duration=m['duration'],frames=m['frames'],fps=m['fps'],shots=len(m['shots']),photoShots=len(photo_shots),uniquePhotos=len(expected_images),photoDuration=sum(s['frames'] for s in photo_shots)/m['fps'],maxBeatAlignmentErrorMs=round(max_error,3),integratedLUFS=float(levels['input_i']),truePeakDbTP=float(levels['input_tp']),fullDecode='passed')
        results.append(r);print(json.dumps(r,ensure_ascii=False),flush=True)
    write_json(ROOT/'renders/validation.json',{'passed':True,'formats':results})


if __name__=='__main__':main()
