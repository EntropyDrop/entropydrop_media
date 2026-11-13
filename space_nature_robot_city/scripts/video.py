#!/usr/bin/env python3
"""Chinese-first, independently replaceable narration and real-footage modules."""
import argparse, hashlib, io, json, math, re, subprocess, time, urllib.request, urllib.error, wave
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parents[1]
def read(p):return json.loads(Path(p).read_text())
def save(p,v):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args):subprocess.run(args,check=True)
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
def wavread(p):
 with wave.open(str(p)) as w:
  assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,24000)
  return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()
def wavwrite(p,data):
 Path(p).parent.mkdir(parents=True,exist_ok=True)
 with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(data.astype('<i2').tobytes())
def trim(data):
 n=len(data)//240;rms=np.sqrt(np.mean(data[:n*240].astype(float).reshape(n,240)**2,axis=1));active=np.flatnonzero(rms>100)
 if not len(active):raise ValueError('Silent narration')
 return data[max(0,active[0]*240-1440):min(len(data),(active[-1]+1)*240+1920)]
def imports():
 parts=re.split(r'^\[([^\]]+)\] (.+)\n',(R/'voiceover.zh.txt').read_text(),flags=re.M)
 for i in range(1,len(parts),3):
  mid,title,body=parts[i:i+3];d=R/'modules'/mid;d.mkdir(parents=True,exist_ok=True);(d/'script.zh.txt').write_text(body.strip()+'\n');save(d/'title.zh.json',{'title':title})
def tts(mid):
 d=R/'modules'/mid;paras=[p.strip() for p in (d/'script.zh.txt').read_text().split('\n\n') if p.strip()]
 cfg=read(R/'production.json')['tts'];op=urllib.request.build_opener(urllib.request.ProxyHandler({}));records=[];samples=[np.zeros(4800,dtype=np.int16)];cursor=.2
 overrides=read(d/'tts.zh.json') if (d/'tts.zh.json').exists() else {}
 for pi,para in enumerate(paras):
  sentences=[x for x in re.split(r"(?<=[。！？])\s*",para) if x] if pi+1 in overrides.get("chunked_paragraphs",[]) else [para]
  for si,sentence in enumerate(sentences):
   request={'model':cfg['model'],'voice':cfg['voice'],'language':'Chinese','response_format':'wav','input':sentence,'seed':overrides.get(f'{pi+1}.{si+1}',42+pi*17+si)}
   for attempt in range(4):
    digest=hashlib.sha256(json.dumps(request,sort_keys=True,ensure_ascii=False).encode()).hexdigest();p=R/'audios'/'zh'/f'{digest[:24]}.wav'
    if p.exists() and p.with_suffix('.request.json').exists() and read(p.with_suffix('.request.json'))==request:data=wavread(p)
    else:
     print('TTS',mid,pi+1,si+1,sentence,flush=True)
     req=urllib.request.Request(cfg['url'],data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
     for retry in range(30):
      try:
       with op.open(req,timeout=180) as resp:
        if resp.headers.get('x-synthetic-audio','').lower()!='true':raise ValueError('Missing synthetic audio marker')
        raw=resp.read()
       break
      except urllib.error.HTTPError as error:
       if error.code!=429:raise
       time.sleep(max(5,float(error.headers.get('Retry-After','8'))))
     else:raise RuntimeError('TTS service remains busy')
     with wave.open(io.BytesIO(raw)) as w:
      assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,24000);data=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()
     wavwrite(p,data);save(p.with_suffix('.request.json'),request)
    data=trim(data);duration=len(data)/24000;units=len(re.findall(r'[\u3400-\u9fff]|[A-Za-z0-9]+',sentence))
    if units*.07<=duration<=units*.45+4:break
    print('RETRY ABNORMAL',mid,pi+1,si+1,duration,flush=True)
    request['seed']+=1
   else:raise ValueError(f'Four abnormal TTS attempts: {mid}/{pi+1}.{si+1}')
   records.append({'paragraph':pi+1,'sentence':si+1,'text':sentence,'file':str(p.relative_to(R)),'start':cursor,'duration':duration,'sha256':sha(p)})
   samples.extend([data,np.zeros(3000 if si<len(sentences)-1 else 6000,dtype=np.int16)]);cursor+=duration+(3000 if si<len(sentences)-1 else 6000)/24000
 voice=np.concatenate(samples);pad=math.ceil((len(voice)/24000+.15)*30)/30;voice=np.pad(voice,(0,round(pad*24000)-len(voice)))
 wavwrite(d/'voice.zh.wav',voice);save(d/'voice.zh.json',{'duration':pad,'file':'voice.zh.wav','sha256':sha(d/'voice.zh.wav'),'sentences':records});print('READY',mid,pad,flush=True)
def build(mid):
 d=R/'modules'/mid;audio=read(d/'voice.zh.json');m=read(d/'module.json');dur=audio['duration'];clips=m['clips'];available=sum(c['duration'] for c in clips)
 if available+1/30<dur:raise ValueError(f'{mid}: need {dur}s, footage covers only {available}s')
 args=['ffmpeg','-nostdin','-v','warning','-filter_complex_threads','1'];filters=[]
 for i,c in enumerate(clips):
  args+=['-threads','1','-ss',str(c.get('start',0)),'-t',str(c['duration']),'-i',str(R/c['file'])]
  filters.append(f'[{i}:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,setpts=PTS-STARTPTS[v{i}]')
 args+=['-i',str(d/'voice.zh.wav')];filters.append(''.join(f'[v{i}]' for i in range(len(clips)))+f'concat=n={len(clips)}:v=1:a=0[v]')
 out=d/'preview.zh.mp4';tmp=d/'preview.zh.pending.mp4'
 args+=['-filter_complex',';'.join(filters),'-map','[v]','-map',f'{len(clips)}:a','-t',str(dur),'-c:v','libx264','-threads','4','-preset','fast','-crf','19','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-af','loudnorm=I=-16:TP=-1.5:LRA=7','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart','-y',str(tmp)]
 run(args);tmp.replace(out);save(d/'build.zh.json',{'duration':dur,'sha256':sha(out),'voice_sha256':audio['sha256'],'clips':clips});print('BUILT',mid,flush=True)
def timestamp(t):
 n=round(t*1000);h,n=divmod(n,3600000);m,n=divmod(n,60000);s,ms=divmod(n,1000);return f'{h:02}:{m:02}:{s:02},{ms:03}'
def assemble(ids, publish=True):
 lines=[];cues=[];offset=0
 for mid in ids:
  d=R/'modules'/mid;built=read(d/'build.zh.json');voice=read(d/'voice.zh.json');p=d/'preview.zh.mp4'
  if sha(p)!=built['sha256'] or voice['sha256']!=built['voice_sha256']:raise ValueError('Stale module: '+mid)
  lines.append("file '"+str(p).replace("'","'\\''")+"'")
  for s in voice['sentences']:cues.append(f'{len(cues)+1}\n{timestamp(offset+s["start"])} --> {timestamp(offset+s["start"]+s["duration"])}\n{s["text"]}\n')
  offset+=voice['duration']
 lst=R/'cache/concat.zh.txt';lst.write_text('\n'.join(lines)+'\n');out=R/read(R/'production.json')['outputs']['zh'];tmp=out.with_suffix('.pending.mp4')
 full_voice=R/'cache/voice.zh.wav';wavwrite(full_voice,np.concatenate([wavread(R/'modules'/mid/'voice.zh.wav') for mid in ids]))
 run(['ffmpeg','-nostdin','-v','warning','-f','concat','-safe','0','-i',str(lst),'-i',str(full_voice),'-map','0:v:0','-map','1:a:0','-t',str(offset),'-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=7','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart','-y',str(tmp)])
 if publish:tmp.replace(out)
 result=out if publish else tmp
 result.with_suffix('.paragraphs.srt').write_text('\n'.join(cues));save(R/('review/master.zh.json' if publish else 'review/staged-master.zh.json'),{'file':str(result),'sha256':sha(result),'duration':offset,'modules':ids,'probe':probe(result)})
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['import','tts','build','assemble','stage','check']);p.add_argument('modules',nargs='*');a=p.parse_args();ids=a.modules or read(R/'production.json')['module_order']
 if a.action=='import':imports()
 elif a.action=='assemble':assemble(ids)
 elif a.action=='stage':assemble(ids,False)
 elif a.action=='check':
  out=R/read(R/'production.json')['outputs']['zh'];run(['ffmpeg','-v','error','-i',str(out),'-f','null','-']);print(json.dumps(probe(out),indent=2))
 else:
  for mid in ids:(tts if a.action=='tts' else build)(mid)
if __name__=='__main__':main()
