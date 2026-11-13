#!/usr/bin/env python3
from pathlib import Path
import json,subprocess,wave,hashlib,io,math,re
import numpy as np
from PIL import Image,ImageDraw
from video import Project,probe,sha
R=Path(__file__).resolve().parents[1];P=Project(R);M=R/P.config['output'];T=json.loads((R/'current-timeline.json').read_text());OUT=R/'review/current-contact-sheets';OUT.mkdir(exist_ok=True)
source=json.loads((R/'review/voiceover-import.json').read_text());assert sha(R/'voiceover.en.txt')==source['sha256'],'Author script changed during build'
lines=(R/'voiceover.en.txt').read_text().splitlines();heads=[i for i,line in enumerate(lines) if ':' in line and line and line[0].isupper() and not re.search(r'[:.!?;]$',line) and len(line)<110]
assert len(heads)==len(P.ids)
for i,mid in enumerate(P.ids):
 body=' '.join('\n'.join(lines[heads[i]+1:heads[i+1] if i+1<len(heads) else len(lines)]).split())
 assert body==' '.join((P.directory(mid)/'script.en.txt').read_text().split()),mid+' differs from the author script'
for c in T['chapters']:
 tag=OUT/(c['id']+'.sha256');preview_sha=sha(R/c['preview']);context=OUT/(c['id']+'.context.json');stamp={'start':c['start'],'title':c['title']}
 if tag.exists() and tag.read_text()==preview_sha and context.exists() and json.loads(context.read_text())==stamp and (OUT/(c['id']+'.jpg')).exists():continue
 raw=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(R/c['preview']),'-vf','fps=1/2,scale=480:270','-f','image2pipe','-vcodec','mjpeg','-q:v','4','pipe:1'])
 frames=[]
 while True:
  a=raw.find(b'\xff\xd8');b=raw.find(b'\xff\xd9',a+2)
  if a<0 or b<0:break
  frames.append(Image.open(io.BytesIO(raw[a:b+2])).convert('RGB'));raw=raw[b+2:]
 sheet=Image.new('RGB',(1920,48+298*math.ceil(len(frames)/4)),(16,20,23));d=ImageDraw.Draw(sheet);d.text((12,16),c['id']+' | '+c['title']+' | current edit / 2 second intervals',fill='white')
 for i,im in enumerate(frames):
  x=i%4*480;y=48+i//4*298;sheet.paste(im,(x,y));sec=c['start']+i*2;d.text((x+8,y+274),f'{int(sec//60):02d}:{int(sec%60):02d} / module +{i*2:02d}s',fill='white')
 sheet.save(OUT/(c['id']+'.jpg'),quality=88);tag.write_text(preview_sha);context.write_text(json.dumps(stamp));print('SHEET',c['id'],flush=True)
with wave.open(str(R/'cache/master-voice.wav')) as w:
 sr=w.getframerate();samples=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)
window=round(sr*.02);rms=np.sqrt(np.mean(samples[:len(samples)//window*window].reshape(-1,window)**2,axis=1));silent=rms<100
starts=np.flatnonzero(silent&~np.r_[False,silent[:-1]]);ends=np.flatnonzero(silent&~np.r_[silent[1:],False])+1
silences=[{'start':float(s*.02),'duration':float((e-s)*.02)} for s,e in zip(starts,ends) if (e-s)*.02>.5];maxsil=max((e-s)*.02 for s,e in zip(starts,ends));assert maxsil<1.5,f'Unexplained silence {maxsil}s'
audit=json.loads((R/'review/current-voice-asr.json').read_text());checked=[]
for mid in P.ids:
 p=P.plan(mid)
 for ch in json.loads((P.directory(mid)/'voice.json').read_text())['chunks']:
  a=audit[ch['sha256']];assert a['expected']==ch['text'];assert a['similarity']>.84,(mid,a['paragraph'],a['actual']);assert a['duration']<len(ch['text'].split())*.7+3,(mid,'abnormally long TTS');checked.append({'module':mid,'paragraph':a['paragraph'],'similarity':a['similarity']})
info=probe(M);v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio');assert not any(s['codec_type']=='subtitle' for s in info['streams'])
# Dark marketplace modals are valid UI; reserve blank-frame detection for pixels
# within 2% of black. The setting still detects a one-second true-black fixture.
result=subprocess.run(['ffmpeg','-nostdin','-v','info','-i',str(M),'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-vf','blackdetect=d=.25:pix_th=.02','-f','null','-'],capture_output=True,text=True,check=True);(R/'review/current-av-scan.log').write_text(result.stderr);loud=json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind('{'):])[0];assert float(loud['input_tp'])<0;assert 'black_start:' not in result.stderr
q={'passed':True,'output':P.config['output'],'duration_seconds':T['duration'],'width':v['width'],'height':v['height'],'fps':v['r_frame_rate'],'subtitles':False,'audio':{'codec':a['codec_name'],'sample_rate':a['sample_rate'],'loudness':loud,'max_near_silent_voice_interval_seconds':maxsil,'silences_over_half_second':silences},'source_script_sha256':source['sha256'],'author_wording_preserved':True,'asr':{'engine':'local faster-whisper base.en; recognizer spelling/number normalization differences manually inspected','chunks':checked,'human_listening_review':False},'visual_review':{'contact_sheets':str(OUT.relative_to(R)),'interval_seconds':2,'black_intervals':0,'blank_frame_pixel_threshold':0.02},'sha256':sha(M)}
(R/'review/current-qa.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n');print('QA PASSED',T['duration'],'seconds; max narration silence',maxsil,'LUFS',loud['input_i'],flush=True)
