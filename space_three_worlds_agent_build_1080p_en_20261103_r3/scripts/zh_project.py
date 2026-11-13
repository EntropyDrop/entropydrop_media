"""Chinese-only chapter order and natural timing without modifying English inputs."""
import math,re
from video import Project,read,paragraphs,sha,wav_read

class ChineseProject:
    def __init__(self,base):
        self.base=base;self.root=base.root;self.config=base.config;self.fps=base.fps;self.state=base.state
        cfg=self.root/'project.zh.json'
        localized=read(cfg) if cfg.exists() else {'order':base.ids}
        self.ids=localized['order'];self.excluded=localized.get('excluded',[])
        self.independent=localized.get('independent',False)
        self.natural_modules=localized.get('natural_timing_modules',[])
        self.english_reference_sha256=localized.get('english_reference_sha256')
        if len(self.excluded)!=len(set(self.excluded)) or any(m in self.ids or (m not in base.ids and not self.independent) for m in self.excluded):raise ValueError('Invalid Chinese excluded module IDs')
        if len(self.ids)!=len(set(self.ids)) or any(not re.fullmatch(r'[a-z0-9_]+',m) for m in self.ids):raise ValueError('Invalid Chinese module IDs')
        if not self.independent and [m for m in self.ids if m in base.ids]!=[m for m in base.ids if m not in self.excluded]:raise ValueError('Chinese order must retain non-excluded shared chapters in order')
        self.plans={}
    def __getattr__(self,name):return getattr(self.base,name)
    def is_additional(self,mid):return mid in self.natural_modules if self.independent else mid not in self.base.ids
    def directory(self,mid):
        if mid not in self.ids:raise ValueError('Unknown Chinese module '+mid)
        return self.base.path('modules/'+mid)
    def plan(self,mid):
        if not self.is_additional(mid):
            return read(self.directory(mid)/'timing.zh.json') if self.independent else self.base.plan(mid)
        if mid in self.plans:return self.plans[mid]
        from dub import trim
        d=self.directory(mid);cfg=read(d/'module.zh.json');chunks=read(d/'voice.zh.json')['chunks']
        if paragraphs(d/'script.zh.txt')!=[c['text'] for c in chunks]:raise ValueError('Chinese script changed; run tts first')
        timing=self.config['narration_timing'];at=timing['lead'];anchors=[]
        for i,ch in enumerate(chunks):
            src=self.path(ch['file'])
            if sha(src)!=ch['sha256']:raise ValueError('Chinese voice hash mismatch')
            duration=len(trim(wav_read(src)))/24000
            anchors.append({'paragraph':i+1,'start':at,'duration':duration})
            at+=duration+timing['gap']
        duration=math.ceil((at-timing['gap']+timing['tail'])*self.fps)/self.fps
        result={'id':mid,'title':cfg['title'],'label':cfg['label'],'duration':duration,'voice_timing':anchors,'clips':[]}
        self.plans[mid]=result;return result
    def timeline(self):return Project.timeline(self)
    def signatures(self):return self.base.signatures()
