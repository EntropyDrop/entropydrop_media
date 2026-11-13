"""Chinese-only visual overrides. Shared English assets are read-only."""
from pathlib import Path
from video import read,sha,digest,media_output,video_info

class ChineseVisuals:
    def __init__(self,dub):
        self.dub=dub;self.p=dub.p;self.root=self.p.root;self.plans={};self.built=set()

    def plan(self,mid,stack=()):
        if mid in stack:raise ValueError('Chinese visual dependency cycle: '+' -> '.join((*stack,mid)))
        if mid in self.plans:return self.plans[mid]
        d=self.p.directory(mid);base=self.p.plan(mid);override=d/'module.zh.json'
        config=read(override if override.exists() else d/'module.json')
        deps={c['source'].split(':',1)[1] for c in config['clips'] if c['source'].startswith('module:')}
        depplans={m:self.plan(m,(*stack,mid)) for m in deps}
        changed=override.exists() or any(v['changed'] for v in depplans.values())
        if not changed:
            result={'id':mid,'changed':False,'path':d/'video.mp4','signature':base['video_sig'],'duration':base['duration'],'dependencies':[], 'clips':base['clips']}
            self.plans[mid]=result;return result
        clips=[];start=0
        for c in config['clips']:
            end=c['end_at']
            if end=='end':end=base['duration']
            elif isinstance(end,str) and end.startswith('voice:'):end=base['voice_timing'][int(end.split(':')[1])-1]['start']
            length=float(end)-start
            if length<=0:raise ValueError(f'{mid}: non-positive Chinese clip interval')
            source=c['source']
            if source.startswith('module:'):
                dep=depplans[source.split(':',1)[1]];path=dep['path'];available=dep['duration'];source_sig=dep['signature']
            else:
                path=self.p.path(source);source_sig=sha(path)
                available=None if path.suffix.lower() in ['.png','.jpg','.jpeg','.webp'] else video_info(path)[1]
            a=float(c.get('in',0));b=c.get('out','auto');b=a+length if b=='auto' else float(b)
            if not 0<=a<b or (available is not None and b>available+.5/self.p.fps):raise ValueError(f'{mid}: insufficient Chinese footage for {source}: {a}..{b}, available {available}')
            mode=c.get('mode','realtime')
            if mode not in ['realtime','fit']:raise ValueError('Invalid clip mode')
            if mode=='realtime' and abs((b-a)-length)>.5/self.p.fps:raise ValueError('Physical demonstrations must remain realtime')
            clips.append({'source':source,'path':str(path),'in':a,'out':b,'duration':length,'source_sig':source_sig,'mode':mode});start=float(end)
        if abs(start-base['duration'])>1e-6:raise ValueError('Chinese visual edit must cover the module duration')
        signature=digest({'version':1,'clips':[{k:v for k,v in c.items() if k!='path'} for c in clips],'format':self.p.config['format'],'encoder':self.p.config['encoder']})
        result={'id':mid,'changed':True,'path':d/'video.zh.mp4','signature':signature,'duration':base['duration'],'dependencies':sorted(deps),'clips':clips}
        self.plans[mid]=result;return result

    def current(self,mid):
        plan=self.plan(mid);entry=self.dub.state['modules'].get(mid,{})
        if plan['changed']:
            if not self.dub.valid(entry,'visual',plan['signature'],plan['path']):raise ValueError(f'{mid}: Chinese visual cache is stale; run dub.py build')
            return plan['path'],entry['visual_sha256']
        e=self.p.state['modules'].get(mid,{})
        if not self.p.valid(e,'video',plan['signature'],plan['path']):raise ValueError(f'{mid}: shared English video is stale')
        return plan['path'],e['video_sha256']

    def build(self,mid):
        if mid in self.built:return self.current(mid)
        plan=self.plan(mid)
        for dep in plan['dependencies']:self.build(dep)
        if plan['changed']:
            entry=self.dub.state['modules'].setdefault(mid,{})
            if not self.dub.valid(entry,'visual',plan['signature'],plan['path']):
                inputs=[];filters=[];fmt=self.p.config['format'];enc=self.p.config['encoder']
                for i,c in enumerate(plan['clips']):
                    path=Path(c['path'])
                    if path.suffix.lower() in ['.png','.jpg','.jpeg','.webp']:inputs+=['-loop','1','-framerate',str(self.p.fps)]
                    inputs+=['-i',str(path)]
                    filters.append(f"[{i}:v]trim=start={c['in']}:end={c['out']},setpts=(PTS-STARTPTS)*{c['duration']/(c['out']-c['in'])},fps={self.p.fps},scale={fmt['width']}:{fmt['height']}:force_original_aspect_ratio=decrease,pad={fmt['width']}:{fmt['height']}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v{i}]")
                filters.append(''.join(f'[v{i}]' for i in range(len(plan['clips'])))+f"concat=n={len(plan['clips'])}:v=1:a=0[v]")
                media_output(plan['path'],[*inputs,'-filter_complex',';'.join(filters),'-map','[v]','-an','-t',str(plan['duration']),'-c:v','libx264','-preset',enc['preset'],'-crf',str(enc['crf']),'-threads',str(enc['threads']),'-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart'])
                entry.update(visual_sig=plan['signature'],visual_sha256=sha(plan['path']));self.dub.checkpoint();print('CHINESE VISUAL',mid,flush=True)
        self.built.add(mid);return self.current(mid)

    def concat_file(self):
        from video import atomic_text
        path=self.root/'cache/concat.zh.txt'
        quote=lambda p:str(p).replace("'","'\\''")
        atomic_text(path,''.join("file '"+quote(self.current(m)[0])+"'\n" for m in self.p.ids))
        return path
