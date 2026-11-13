from pathlib import Path
import subprocess,json,re,hashlib,math
from PIL import Image,ImageDraw
import numpy as np
R=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')
M=R/'exports/space_nature_robot_city_zh_latest.mp4';T=Path('/private/tmp/robot-city-qa');T.mkdir(exist_ok=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(M)]));video=next(x for x in probe['streams'] if x['codec_type']=='video');audio=next(x for x in probe['streams'] if x['codec_type']=='audio');assert(video['width'],video['height'],video['r_frame_rate'])==(1920,1080,'30/1');assert not any(x['codec_type']=='subtitle' for x in probe['streams'])
duration=float(probe['format']['duration']);timeline=[];offset=0;asr=json.loads((R/'review/voice-asr.zh.json').read_text());voiceChecks=[];flags=[]
for mid in json.loads((R/'production.json').read_text())['module_order']:
 d=R/'modules'/mid;v=json.loads((d/'voice.zh.json').read_text());b=json.loads((d/'build.zh.json').read_text());assert b['voice_sha256']==v['sha256'];assert b['clips']==json.loads((d/'module.json').read_text())['clips'];assert (d/'script.zh.txt').read_text().strip().split('\n\n')==[x['text'] for x in v['sentences']];assert hashlib.sha256((d/'preview.zh.mp4').read_bytes()).hexdigest()==b['sha256']
 timeline.append(dict(id=mid,start=offset,duration=v['duration'],title=json.loads((d/'title.zh.json').read_text())['title']));offset+=v['duration']
 for s in v['sentences']:
  a=asr[s['sha256']];assert a['expected']==s['text'];voiceChecks.append(dict(module=mid,paragraph=s['paragraph'],score=a['phonetic_similarity'],sha256=s['sha256']))
  if a['phonetic_similarity']<.95:flags.append(voiceChecks[-1])
assert abs(offset-duration)<.15,(offset,duration)
command=['ffmpeg','-hide_banner','-nostats','-i',str(M),'-vf','blackdetect=d=0.15:pix_th=0.07:pic_th=0.98','-af','silencedetect=noise=-40dB:d=0.9,loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'];r=subprocess.run(command,stderr=subprocess.PIPE,text=True);assert r.returncode==0
(T/'decode.log').write_text(r.stderr);black=re.findall(r'black_start:([0-9.]+) black_end:([0-9.]+) black_duration:([0-9.]+)',r.stderr);silence=re.findall(r'silence_start: ([0-9.]+)|silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)',r.stderr);meter=json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr,re.S)[-1])
subprocess.run(['ffmpeg','-v','error','-y','-i',str(M),'-vf','fps=1/2,scale=320:180:flags=lanczos','-q:v','4',str(T/'frame-%04d.jpg')],check=True)
frames=sorted(T.glob('frame-*.jpg'));sheets=[]
for page in range(math.ceil(len(frames)/24)):
 sheet=Image.new('RGB',(1920,840),(16,22,19));draw=ImageDraw.Draw(sheet)
 for k,p in enumerate(frames[page*24:(page+1)*24]):
  idx=page*24+k;t=idx*2;chapter=next((c for c in reversed(timeline) if t>=c['start']),timeline[0]);x=k%6*320;y=k//6*210;sheet.paste(Image.open(p),(x,y));draw.text((x+5,y+182),f'{t//60:02}:{t%60:02}  {chapter["id"]}',fill='white')
 path=T/f'contact-{page+1:02}.jpg';sheet.save(path,quality=88);sheets.append(str(path))
report=dict(file=str(M),sha256=hashlib.sha256(M.read_bytes()).hexdigest(),duration=duration,expected_duration=offset,resolution=[1920,1080],fps=30,burned_subtitles=False,audio=audio,loudness=meter,black_intervals=black,silence_intervals_over_0_9_seconds=silence,voice_checks=voiceChecks,voice_flags=flags,chapters=timeline,contact_sheets=sheets,review_method='Full-file decode, black/silence/loudness analysis, every-2-second visual contact sheets, local small ASR against every spoken paragraph. Not a claim of continuous human listening.',visual_review_pending=True)
(T/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['duration','resolution','fps','loudness','black_intervals','silence_intervals_over_0_9_seconds','voice_flags','contact_sheets']},ensure_ascii=False,indent=2))
