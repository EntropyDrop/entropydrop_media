#!/usr/bin/env python3
"""Chinese narration and independent visual overrides; no physics retiming or subtitles.

Use import to split voiceover.zh.txt, tts ID to synthesize only changed paragraphs,
build ID for a preview, assemble for the Chinese master, and check --full for QA.
"""
import argparse, copy, fcntl, io, json, math, os, re, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np
from video import Project, atomic_text, digest, media_output, paragraphs, probe, read, save, sha, wav_read, wav_write
from zh_visuals import ChineseVisuals
from zh_project import ChineseProject

R=Path(__file__).resolve().parents[1]
OUTPUT='exports/space_three_worlds_zh_latest.mp4'

def trim(data):
    n=len(data)//240
    rms=np.sqrt(np.mean(data[:n*240].astype(float).reshape(n,240)**2,axis=1))
    active=np.flatnonzero(rms>100)
    if not len(active):raise ValueError('Silent TTS output')
    return data[max(0,active[0]*240-1920):min(len(data),(active[-1]+1)*240+2880)]

def import_script(p):
    text=(R/'voiceover.zh.txt').read_text()
    pieces=re.split(r'^\[([^\]]+)\] (.+)\n',text,flags=re.M)
    if pieces[0].strip():raise ValueError('Chinese script must start with [module_id] title')
    found=[]
    for i in range(1,len(pieces),3):
        mid,title,body=pieces[i:i+3];found.append(mid)
        d=p.directory(mid)
        paras=[' '.join(x.split()) for x in body.strip().split('\n\n') if x.strip()]
        if not p.is_additional(mid) and len(paras)!=(len(p.plan(mid)['voice_timing']) if p.independent else len(paragraphs(d/'script.en.txt'))):raise ValueError(f'{mid}: Chinese paragraph count must match English timing anchors')
        atomic_text(d/'script.zh.txt','\n\n'.join(paras)+'\n')
        save(d/'title.zh.json',{'title':title})
    if found!=p.ids:raise ValueError('Chinese headings must match all project IDs in order')
    print('IMPORTED',len(found),'modules',flush=True)

def tts(p,mid):
    import urllib.request
    d=p.directory(mid);texts=paragraphs(d/'script.zh.txt');chunks=[]
    cfg=read(d/'dub.zh.json') if (d/'dub.zh.json').exists() else {}
    op=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for i,text in enumerate(texts):
        seed=cfg.get('seeds',{}).get(str(i+1),42+i)
        parts=cfg.get('segments',{}).get(str(i+1),[text])
        if re.sub(r'\s+','',''.join(parts))!=re.sub(r'\s+','',text):raise ValueError('TTS segmentation must preserve the full Chinese text')
        seeds=cfg.get('segment_seeds',{}).get(str(i+1),[seed+j for j in range(len(parts))])
        if len(seeds)!=len(parts):raise ValueError('Segment seeds must match segment count')
        requests=[{**p.config['tts']['request'],'language':'Chinese','input':part,'seed':seeds[j]} for j,part in enumerate(parts)]
        request=requests[0] if len(requests)==1 else {'requests':requests,'gap_seconds':.10}
        name=f'modules/{mid}/audio/zh/{digest(request)[:20]}.wav';path=R/name
        if path.exists() and path.with_suffix('.request.json').exists() and read(path.with_suffix('.request.json'))==request:
            data=wav_read(path)
            print('CACHED',mid,i+1,flush=True)
        else:
            print('TTS',mid,i+1,flush=True)
            pieces=[]
            for j,item in enumerate(requests):
                partfile=d/'audio/zh'/('part-'+digest(item)[:20]+'.wav')
                cachedpart=len(requests)>1 and partfile.exists() and partfile.with_suffix('.request.json').exists() and read(partfile.with_suffix('.request.json'))==item
                if cachedpart:data=wav_read(partfile)
                else:
                    if len(requests)>1:print('TTS PART',mid,i+1,j+1,flush=True)
                    req=urllib.request.Request(p.config['tts']['url'],data=json.dumps(item).encode(),headers={'Content-Type':'application/json'})
                    with op.open(req,timeout=180) as response:
                        if response.headers.get('x-synthetic-audio','').lower()!='true':raise ValueError('Missing synthetic-audio marker')
                        raw=response.read()
                    with wave.open(io.BytesIO(raw)) as w:
                        if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(1,2,24000):raise ValueError('Invalid TTS WAV format')
                        data=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').copy()
                units=len(re.findall(r'[\u3400-\u9fff]|[A-Za-z0-9]+',item['input']))
                if not len(data) or len(data)/24000>units*.45+5:raise ValueError(f'{mid}/{i+1}: abnormal TTS duration; revise seed or text')
                if len(requests)>1 and not cachedpart:
                    wav_write(partfile,data);save(partfile.with_suffix('.request.json'),item)
                if pieces:pieces.append(np.zeros(2400,dtype=np.int16))
                pieces.append(trim(data) if len(requests)>1 else data)
            data=np.concatenate(pieces)
            trim(data)
            wav_write(path,data);save(path.with_suffix('.request.json'),request)
        dur=len(trim(data))/24000
        chunk={'text':text,'file':name,'sha256':sha(path),'request_sha256':digest(request),'trimmed_duration':dur}
        chunks.append(chunk)
        print('VOICE',mid,i+1,f'{dur:.2f}s',flush=True)
    save(d/'voice.zh.json',{'language':'Chinese','voice':'entropydrop','chunks':chunks})

class Dub:
    def __init__(self,p):
        p=p if isinstance(p,ChineseProject) else ChineseProject(p)
        self.p=p;self.timeline=p.timeline();self.state_path=R/'cache/dub.zh.state.json'
        self.state=read(self.state_path) if self.state_path.exists() else {'modules':{}}
        self.plans={};self.visuals=ChineseVisuals(self)

    def plan(self,mid):
        if mid in self.plans:return self.plans[mid]
        d=self.p.directory(mid);en=self.p.plan(mid)
        texts=paragraphs(d/'script.zh.txt');chunks=read(d/'voice.zh.json')['chunks']
        if texts!=[x['text'] for x in chunks]:raise ValueError(f'{mid}: Chinese script changed; run tts first')
        if len(texts)!=len(en['voice_timing']):raise ValueError(f'{mid}: paragraph count differs from English anchors')
        e=self.p.state['modules'].get(mid,{})
        if not self.p.independent and not self.p.is_additional(mid) and not self.p.valid(e,'video',en['video_sig'],d/'video.mp4'):raise ValueError(f'{mid}: English video is stale; rebuild it first')
        timing=read(d/'dub.zh.json').get('duration_overrides',{}) if (d/'dub.zh.json').exists() else {}
        items=[]
        for i,(ch,anchor) in enumerate(zip(chunks,en['voice_timing'])):
            src=R/ch['file']
            if sha(src)!=ch['sha256']:raise ValueError(f'{mid}: voice hash mismatch')
            raw=trim(wav_read(src));duration=len(raw)/24000
            slot=float(timing.get(str(i+1),anchor['duration']))
            limit=en['voice_timing'][i+1]['start'] if i+1<len(en['voice_timing']) else en['duration']
            if not math.isfinite(slot) or slot<=0 or anchor['start']+slot>limit+1/24000:raise ValueError(f'{mid}/{i+1}: Chinese duration overlaps the next paragraph or module end')
            tempo=duration/slot
            if not .78<=tempo<=1.30:raise ValueError(f'{mid}/{i+1}: tempo {tempo:.3f} outside 0.78–1.30; revise Chinese wording/seed for {anchor["duration"]:.2f}s slot (raw {duration:.2f}s)')
            items.append({'paragraph':i+1,'text':ch['text'],'source':ch['file'],'sha256':ch['sha256'],'start':anchor['start'],'duration':slot,'raw_duration':duration,'tempo':tempo,'data':raw})
        sig=digest({'version':1,'duration':en['duration'],'items':[{k:v for k,v in x.items() if k!='data'} for x in items]})
        plan={'duration':en['duration'],'items':items,'signature':sig,'video_sha256':e.get('video_sha256')}
        self.plans[mid]=plan;return plan

    def valid(self,entry,key,sig,path):return entry.get(key+'_sig')==sig and path.exists() and entry.get(key+'_sha256')==sha(path)
    def checkpoint(self):save(self.state_path,self.state)

    def build(self,mid,preview=True):
        plan=self.plan(mid);d=self.p.directory(mid);entry=self.state['modules'].setdefault(mid,{})
        visual,visual_hash=self.visuals.build(mid)
        voice=d/'voice.zh.wav'
        if not self.valid(entry,'voice',plan['signature'],voice):
            result=np.zeros(round(plan['duration']*24000),dtype=np.int16)
            for item in plan['items']:
                if abs(item['tempo']-1)<1e-9:
                    aligned=item['data']
                else:
                    process=subprocess.run(['ffmpeg','-nostdin','-v','error','-f','s16le','-ar','24000','-ac','1','-i','pipe:0','-af',f'atempo={item["tempo"]:.9f},apad','-t',str(item['duration']),'-f','s16le','-ar','24000','-ac','1','pipe:1'],input=item['data'].astype('<i2').tobytes(),stdout=subprocess.PIPE,check=True)
                    aligned=np.frombuffer(process.stdout,dtype='<i2')
                at=round(item['start']*24000);end=at+len(aligned)
                if end>len(result):raise ValueError('Narration exceeded module boundary')
                result[at:end]=aligned
            wav_write(voice,result)
            entry.update(voice_sig=plan['signature'],voice_sha256=sha(voice))
            self.checkpoint()
        sig=digest([visual_hash,entry['voice_sha256'],self.p.config['audio']['preview_filter']])
        out=d/'preview.zh.mp4'
        if preview and not self.valid(entry,'preview',sig,out):
            media_output(out,['-i',str(visual),'-i',str(voice),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',self.p.config['audio']['preview_filter'],'-ar','48000','-ac','2','-c:a','aac','-b:a','192k','-metadata:s:a:0','language=zho','-t',str(plan['duration']),'-movflags','+faststart'])
            entry.update(preview_sig=sig,preview_sha256=sha(out));self.checkpoint()
        print('READY',mid,flush=True)

    def assemble(self):
        if not self.p.independent:
            _,_,english_signature=self.p.signatures()
            if not self.p.valid(self.p.state,'master',english_signature,R/self.p.config['output']):
                raise ValueError('English master is stale; run scripts/video.py assemble before dubbing this edit')
        for mid in self.p.ids:self.build(mid)
        duration=self.timeline['duration'];audio=self.p.config['audio']
        voice=R/'cache/master-voice.zh.wav';mix=R/'cache/master-mix.zh.m4a';master=R/OUTPUT
        sig=digest([self.state['modules'][mid]['voice_sha256'] for mid in self.p.ids]+[sha(R/audio['ambient']),audio])
        if not self.valid(self.state,'mix',sig,mix):
            wav_write(voice,np.concatenate([wav_read(self.p.directory(mid)/'voice.zh.wav') for mid in self.p.ids]))
            af=f'[0:a]{audio["voice_filter"]}[v];[1:a]volume={audio["ambient_gain"]}[m];[v][m]amix=inputs=2:normalize=0,alimiter=limit={audio["limiter"]}:level=false,afade=t=out:st={duration-1}:d=1[a]'
            media_output(mix,['-i',str(voice),'-stream_loop','-1','-i',str(R/audio['ambient']),'-filter_complex',af,'-map','[a]','-t',str(duration),'-ar','48000','-ac','2','-c:a','aac','-b:a','192k'])
            self.state.update(mix_sig=sig,mix_sha256=sha(mix));self.checkpoint()
        english=R/self.p.config['output'];enhash=self.p.english_reference_sha256 if self.p.independent else sha(english)
        titles=[read(self.p.directory(mid)/'title.zh.json')['title'] for mid in self.p.ids]
        concat=self.visuals.concat_file()
        visual_hashes=[self.visuals.current(mid)[1] for mid in self.p.ids]
        sig=digest([enhash,self.state['mix_sha256'],self.timeline,titles,visual_hashes])
        if not self.valid(self.state,'master',sig,master):
            meta=[';FFMETADATA1','title=Space 开发日志｜三座世界，三种载具','artist=EntropyDrop']
            for c,title in zip(self.timeline['chapters'],titles):
                title=title.replace('\\','\\\\').replace('=','\\=').replace(';','\\;').replace('#','\\#').replace('\n',' ')
                meta+=['[CHAPTER]','TIMEBASE=1/1000',f'START={round(c["start"]*1000)}',f'END={round((c["start"]+c["duration"])*1000)}','title='+title]
            metadata=R/'cache/chapters.zh.ffmetadata';atomic_text(metadata,'\n'.join(meta)+'\n')
            media_output(master,['-f','concat','-safe','0','-i',str(concat),'-i',str(mix),'-i',str(metadata),'-map','0:v:0','-map','1:a:0','-map_metadata','2','-map_chapters','2','-c','copy','-metadata:s:a:0','language=zho','-metadata:s:a:0','title=中文 · entropydrop','-t',str(duration),'-movflags','+faststart'])
            self.state.update(master_sig=sig,master_sha256=sha(master),english_master_sha256=enhash);self.checkpoint()
        timeline={**copy.deepcopy(self.timeline),'language':'Chinese','source_english_sha256':enhash,'changed_visual_modules':[m for m in self.p.ids if self.visuals.plan(m)['changed']]}
        for c in timeline['chapters']:
            mid=c['id'];c['preview']=f'modules/{mid}/preview.zh.mp4'
            c['voice_timing']=[{k:v for k,v in x.items() if k!='data'} for x in self.plan(mid)['items']]
            c['title']=read(self.p.directory(mid)/'title.zh.json')['title']
            c['clips']=[{k:v for k,v in clip.items() if k not in ['path','source_sig']} for clip in self.visuals.plan(mid)['clips']]
        save(R/'current-timeline.zh.json',timeline)
        print('MASTER',master,flush=True)

    def check(self,full=False):
        checks=[]
        for mid in self.p.ids:
            p=self.plan(mid);d=self.p.directory(mid);e=self.state['modules'][mid]
            assert self.valid(e,'voice',p['signature'],d/'voice.zh.wav'),f'{mid}: stale voice'
            _,visual_hash=self.visuals.current(mid)
            sig=digest([visual_hash,e['voice_sha256'],self.p.config['audio']['preview_filter']])
            assert self.valid(e,'preview',sig,d/'preview.zh.mp4'),f'{mid}: stale preview'
            data=probe(d/'preview.zh.mp4');v=next(s for s in data['streams'] if s['codec_type']=='video')
            assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1920,1080,'30/1',round(p['duration']*30))
            assert len(wav_read(d/'voice.zh.wav'))==round(p['duration']*24000)
            checks.append({'module':mid,'paragraphs':[{k:v for k,v in x.items() if k not in ['data','text']} for x in p['items']]})
        out=R/OUTPUT;en=R/self.p.config['output']
        assert (self.p.english_reference_sha256 if self.p.independent else sha(en))==self.state['english_master_sha256'],'English reference changed; assemble Chinese again'
        assert sha(out)==self.state['master_sha256'],'Chinese master hash mismatch'
        assert self.state['mix_sig']==digest([self.state['modules'][mid]['voice_sha256'] for mid in self.p.ids]+[sha(R/self.p.config['audio']['ambient']),self.p.config['audio']]),'Stale Chinese mix'
        data=probe(out);v=next(s for s in data['streams'] if s['codec_type']=='video');a=next(s for s in data['streams'] if s['codec_type']=='audio')
        assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1920,1080,'30/1',round(self.timeline['duration']*30))
        assert abs(float(data['format']['duration'])-self.timeline['duration'])<.08
        assert not any(s['codec_type']=='subtitle' for s in data['streams'])
        assert a['tags']['language']=='zho'
        titles=[read(self.p.directory(mid)/'title.zh.json')['title'] for mid in self.p.ids]
        expected=digest([self.p.english_reference_sha256 if self.p.independent else sha(en),self.state['mix_sha256'],self.timeline,titles,[self.visuals.current(mid)[1] for mid in self.p.ids]])
        assert self.state['master_sig']==expected,'Chinese master inputs changed; assemble again'
        # Concat uses Annex B while MP4 stores length-prefixed NAL units. Normalize
        # both before hashing so mux framing is not mistaken for changed images.
        def streamhash(path,concat=False):return subprocess.check_output(['ffmpeg','-nostdin','-v','error','-xerror',*(['-f','concat','-safe','0'] if concat else []),'-i',str(path),'-map','0:v:0','-c:v','copy','-bsf:v','h264_mp4toannexb','-f','hash','-hash','sha256','-']).decode().strip()
        assert streamhash(out)==streamhash(self.visuals.concat_file(),True),'Chinese video differs from module assembly'
        freeze=R/'review/english-frozen-for-chinese-review.json'
        frozen=read(freeze)['files'] if freeze.exists() and not self.p.independent else {}
        for name,checksum in frozen.items():assert sha(R/name)==checksum,'Frozen English file changed: '+name
        def codedhash(path):return subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(path),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
        same=codedhash(out)==codedhash(en)
        if full:subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
        save(R/'review/modular-check.zh.json',{'passed':True,'duration':self.timeline['duration'],'modules':checks,'full_decode':full,'video_identical_to_english':same,'changed_visual_modules':[m for m in self.p.ids if self.visuals.plan(m)['changed']],'english_frozen_files_verified':len(frozen),'languages_independent':self.p.independent,'english_master_sha256':sha(en),'master_sha256':sha(out)})
        print(f'CHECK PASSED: {len(checks)} modules; Chinese visual assembly verified; English preserved; no subtitles',flush=True)

    def index(self):
        items=[]
        for mid in dict.fromkeys(self.p.base.ids+self.p.ids):
            d=self.p.base.path('modules/'+mid);m=read(d/('module.zh.json' if self.p.is_additional(mid) else 'module.json'))
            items.append({'id':mid,'label':m['label'],'zh':(d/'script.zh.txt').read_text() if mid in self.p.ids else None,'en':(d/'script.en.txt').read_text() if mid in self.p.base.ids else None})
        page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Space 中英文模块预览</title>
<style>body{margin:28px;max-width:1300px;background:#111a1d;color:#e5eee9;font:17px/1.6 system-ui}a{color:#a5d380}select{font:inherit;padding:8px;background:#233134;color:inherit;border:1px solid #547065}video{width:100%;max-height:67vh;background:#000}pre{white-space:pre-wrap;font:inherit;color:#bbc9c5}header{display:flex;gap:15px;align-items:center;flex-wrap:wrap}h1{font-size:25px}</style>
<h1>Space · 中英文模块预览</h1><p>中英文版本可独立修改文案与局部镜头。1080p · 无字幕。</p>
<header><select id="language"><option value="zh">中文配音</option><option value="en">English voiceover</option></select><select id="module"></select><a id="master">播放当前全片</a><a href="README-模块化工程.txt">编辑说明</a></header>
<h2 id="title"></h2><video id="player" controls preload="metadata"></video><p><a id="scriptfile">本模块文案</a> · <a href="voiceover.zh.txt">完整中文稿</a></p><pre id="script"></pre>
<script>const items=PAYLOAD,orders=ORDERS;
const pick=document.querySelector('#module'),lang=document.querySelector('#language'),player=document.querySelector('#player');
function populate(id){pick.replaceChildren();for(const mid of orders[lang.value]){const m=items.find(x=>x.id===mid),o=document.createElement('option');o.value=mid;o.textContent=mid+' · '+m.label;pick.append(o)}if(orders[lang.value].includes(id))pick.value=id;}
function show(){const m=items.find(x=>x.id===pick.value),l=lang.value;document.querySelector('#title').textContent=m.label;player.src='modules/'+m.id+'/preview'+(l==='zh'?'.zh':'')+'.mp4';document.querySelector('#master').href='exports/space_three_worlds_'+(l==='zh'?'zh_':'')+'latest.mp4';document.querySelector('#script').textContent=m[l];document.querySelector('#scriptfile').href='modules/'+m.id+'/script.'+l+'.txt';history.replaceState(null,'','#'+m.id+'/'+l)}
pick.onchange=show;lang.onchange=()=>{populate(pick.value);show()};const [id,l]=location.hash.slice(1).split('/');if(['en','zh'].includes(l))lang.value=l;populate(id);show();</script></html>'''
        atomic_text(R/'双语模块预览.html',page.replace('PAYLOAD',json.dumps(items,ensure_ascii=False).replace('<','\\u003c')).replace('ORDERS',json.dumps({'zh':self.p.ids,'en':self.p.base.ids})))
        print('INDEX',R/'双语模块预览.html',flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['import','tts','build','assemble','check','timing','index'])
    parser.add_argument('modules',nargs='*');parser.add_argument('--all',action='store_true');parser.add_argument('--full',action='store_true')
    args=parser.parse_args();p=ChineseProject(Project())
    with open(R/'cache/project.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        ids=p.ids if args.all else args.modules
        if args.command in ['tts','build'] and not ids:raise ValueError('Specify module IDs or --all')
        if args.command=='import':import_script(p)
        elif args.command=='tts':
            failures=[]
            for mid in ids:
                try:tts(p,mid)
                except Exception as e:
                    failures.append(mid);print('TTS FAILED',mid,str(e),flush=True)
            if failures:raise ValueError('TTS incomplete: '+', '.join(failures))
        else:
            dub=Dub(p)
            if args.command=='build':
                for mid in ids:dub.build(mid)
            elif args.command=='assemble':dub.assemble();dub.index()
            elif args.command=='check':dub.check(args.full)
            elif args.command=='index':dub.index()
            elif args.command=='timing':
                for mid in ids or p.ids:
                    d=p.directory(mid);chunks=read(d/'voice.zh.json')['chunks'];anchors=p.plan(mid)['voice_timing']
                    for i,(ch,anchor) in enumerate(zip(chunks,anchors)):
                        dur=len(trim(wav_read(R/ch['file'])))/24000
                        print(mid,i+1,round(dur,2),round(anchor['duration'],2),round(dur/anchor['duration'],3),flush=True)

if __name__=='__main__':main()
