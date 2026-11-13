#!/usr/bin/env python3
"""Continuous English narration, precise edit list, native 1080p30. No subtitles."""
import json,math,subprocess,wave,os
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parents[1]
OLD=R.parent/'space_three_worlds_agent_build_1080p_en_20261103'
if not OLD.exists():OLD=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_three_worlds_agent_build_1080p_en_20261103')
SR=24000;FPS=30
M=json.loads((R/'audios/manifest.json').read_text())
work=R/'review/edited-chapters';work.mkdir(exist_ok=True)
def run(args):subprocess.run(['ffmpeg','-nostdin','-y','-v','error',*map(str,args)],check=True)
def old(n):return R/'footage/reused'/f'{n}.mp4'
def new(n):return R/'footage'/f'{n}.mp4'
def audio(chunk):
 with wave.open(str(R/chunk['file'])) as w:a=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()
 # Trim only near-silent head/tail. Keep 80ms before and 120ms after voiced energy.
 n=len(a)//240; rms=np.sqrt(np.mean(a[:n*240].astype(float).reshape(n,240)**2,axis=1)); voiced=np.flatnonzero(rms>100)
 if len(voiced):start=max(0,int(voiced[0]*240)-1920);end=min(len(a),int((voiced[-1]+1)*240)+2880)
 else:raise ValueError('Silent TTS chunk')
 return a[start:end],{'trim_start':start/SR,'trim_end':(len(a)-end)/SR}
chapters=[];cursor=0;full=[]
for ci,ch in enumerate(M['chapters']):
 arrays=[];timings=[];pos=.20
 for chunk in ch['chunks']:
  a,trim=audio(chunk);timings.append({'start':pos,'duration':len(a)/SR,'text':chunk['text'],'source':chunk['file'],**trim});arrays.append(a);pos+=len(a)/SR+.25
 duration=math.ceil((pos-.25+.35)*FPS)/FPS
 data=np.zeros(round(duration*SR),dtype=np.int16)
 for a,t in zip(arrays,timings):at=round(t['start']*SR);data[at:at+len(a)]=a
 full.append(data)
 # Each tuple: input, in, out, output duration. Dynamic tests retain realtime speed.
 def fit(path,a,b):return [(path,a,b,duration)]
 t2=timings[2]['start'] if len(timings)>2 else duration
 edits={
 0:fit(old('01-intro'),0,duration),
 1:fit(new('02-aether-tour-clean'),0,duration),
 2:fit(new('03-toolbar-clean'),0,duration),
 3:fit(old('04-agent'),0,47),
 4:fit(old('05-chinook-prompt'),0,duration),
 5:fit(new('06-chinook-inspect-clean'),0,duration),
 6:fit(new('07-chinook-refine-clean'),0,duration),
 7:fit(new('08-chinook-controls-clean'),0,duration),
 8:fit(new('09-chinook-flight-a-clean'),0,duration),
 9:fit(new('10-chinook-flight-b-clean'),0,duration),
 10:fit(old('11-nature-tour'),0,42),
 11:fit(old('12-rover-prompt'),0,duration),
 12:fit(old('13-rover-inspect'),0,41),
 13:fit(old('14-rover-light-a'),0,37),
 14:[(old('15-rover-light-b'),4,20,timings[1]['start']),(old('15-rover-light-b'),26,41,duration-timings[1]['start'])],
 15:fit(new('16-rover-roll-test'),0,duration),
 16:fit(new('17-rover-steering-test'),0,duration),
 17:fit(old('18-copper-tour'),0,42),
 18:[(R/'stills/19-drone-follow-prompt.png',0,duration,duration)],
 19:[(old('20-drone-refine'),0,13,timings[1]['start']),(old('20-drone-refine'),13,25,t2-timings[1]['start']),(old('20-drone-refine'),25,38,duration-t2)],
 20:fit(new('21-drone-airborne-follow'),0,duration),
 21:fit(new('22-drone-airborne-orbit'),0,duration),
 22:[(new('10-chinook-flight-b-clean'),8,16,8),(new('17-rover-steering-test'),24,32,8),(new('22-drone-airborne-orbit'),1,1+duration-16,duration-16)]
 }[ci]
 # Branch values above reference paragraph 3 for a few chapters; all have >=2.
 out=work/(ch['id']+'.mp4');inputs=[];filters=[];sources=[]
 for j,(path,a,b,d) in enumerate(edits):
  if path.suffix=='.png':inputs+=['-loop','1','-framerate','30','-i',str(path)]
  else:inputs+=['-i',str(path)]
  filters.append(f'[{j}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)*{d/(b-a)},fps=30,setsar=1,format=yuv420p[v{j}]')
  sources.append({'file':str(path.relative_to(R)),'in':a,'out':b,'duration':d,'speed':(b-a)/d})
 filters.append(''.join(f'[v{j}]' for j in range(len(edits)))+f'concat=n={len(edits)}:v=1:a=0[v]')
 if not out.exists():run([*inputs,'-filter_complex',';'.join(filters),'-map','[v]','-an','-t',duration,'-c:v','libx264','-preset','fast','-crf','18','-threads','4','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',out])
 chapters.append({'id':ch['id'],'title':ch['title'],'start':cursor,'duration':duration,'voice_timing':timings,'edits':sources,'footage':str(out.relative_to(R))});cursor+=duration
 print('EDITED',ch['id'],duration,flush=True)
 (R/'timeline.json').write_text(json.dumps({'duration':cursor,'width':1920,'height':1080,'fps':FPS,'language':'English','subtitles':False,'chapters':chapters},indent=2))
voice=R/'audios/voiceover_timeline.wav'
with wave.open(str(voice),'wb') as w:w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(b''.join(a.tobytes() for a in full))
# Retain the previous original ambient score, quietly underneath the continuous voice.
ambient=R/'audios/ambient_original.wav'
mix=R/'audios/final_mix.m4a'
run(['-i',voice,'-i',ambient,'-filter_complex',f'[0:a]loudnorm=I=-16:TP=-1.5:LRA=7[v];[1:a]volume=.75[m];[v][m]amix=inputs=2:normalize=0,alimiter=limit=.89:level=false,afade=t=out:st={cursor-1}:d=1[a]','-map','[a]','-t',cursor,'-ar','48000','-ac','2','-c:a','aac','-b:a','192k',mix])
metadata=R/'chapters.ffmetadata';lines=[';FFMETADATA1','title=Space Devlog | Three Worlds, Three Machines | Revised','artist=EntropyDrop','comment=1080p development-client footage. English synthetic narration; no subtitles. Cursor-free Aether retakes; airborne character-following quadcopter with orbit camera.']
for c in chapters:lines+=['[CHAPTER]','TIMEBASE=1/1000',f"START={round(c['start']*1000)}",f"END={round((c['start']+c['duration'])*1000)}",'title='+c['title']]
metadata.write_text('\n'.join(lines)+'\n');concat=R/'review/concat.txt';concat.write_text(''.join("file '"+str(R/c['footage'])+"'\n" for c in chapters))
master=R/'exports/space_three_worlds_agent_build_1080p_en_r3.mp4'
run(['-f','concat','-safe','0','-i',concat,'-i',mix,'-i',metadata,'-map','0:v:0','-map','1:a:0','-map_metadata','2','-map_chapters','2','-c','copy','-t',cursor,'-movflags','+faststart',master])
(R/'chapters.txt').write_text('\n'.join(f"{int(c['start']//60):02d}:{int(c['start']%60):02d} {c['title']}" for c in chapters)+'\n')
print('COMPLETE',cursor,master,flush=True)
