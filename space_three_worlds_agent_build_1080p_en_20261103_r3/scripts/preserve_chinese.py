"""Pin approved Chinese timing and video before editing the English base.

The language versions keep the same source footage and module IDs. Existing
video caches are hardlinked, not re-encoded; atomic output replacement then
lets either language evolve without changing the other.
"""
from pathlib import Path
import copy,os
import dub
from video import Project,read,save,sha

def make_independent(root):
    root=Path(root);dub.R=root
    cfg=read(root/'project.zh.json')
    if cfg.get('independent'):return
    before=dub.Dub(Project(root));master=root/dub.OUTPUT;master_hash=sha(master)
    visuals={m:before.visuals.plan(m) for m in before.p.ids}
    current={m:before.visuals.current(m) for m in before.p.ids}
    natural=[m for m in before.p.ids if before.p.is_additional(m)]
    for mid in before.p.ids:
        d=before.p.directory(mid)
        if mid not in natural:
            plan=before.p.plan(mid)
            save(d/'timing.zh.json',{k:v for k,v in plan.items() if k!='voice'})
        if not (d/'module.zh.json').exists():save(d/'module.zh.json',read(d/'module.json'))
        target=d/'video.zh.mp4';source,checksum=current[mid]
        if not target.exists():os.link(source,target)
        assert sha(target)==checksum,'Chinese video copy differs: '+mid
    cfg.update(independent=True,natural_timing_modules=natural,english_reference_sha256=sha(root/before.p.config['output']))
    save(root/'project.zh.json',cfg)
    after=dub.Dub(Project(root))
    for mid in after.p.ids:
        old,new=visuals[mid],after.visuals.plan(mid)
        clean=lambda c:{k:v for k,v in c.items() if k not in ['path','source_sig']}
        assert [clean(c) for c in old['clips']]==[clean(c) for c in new['clips']],mid+' edit changed during detachment'
        assert before.plan(mid)['signature']==after.plan(mid)['signature'],mid+' voice timing changed'
        entry=after.state['modules'][mid]
        entry.update(visual_sig=new['signature'],visual_sha256=current[mid][1])
    assert before.timeline==after.timeline,'Detachment changed the Chinese timeline'
    after.checkpoint()
    assert sha(master)==master_hash
    save(root/'review/chinese-language-independence.json',{'passed':True,'master_sha256':master_hash,'modules':after.p.ids,'natural_timing_modules':natural,'method':'Preserve all timing and edit plans, hardlink identical video caches, retain montage dependencies. English changes no longer affect Chinese timing or its master signature.'})
    print('CHINESE INDEPENDENT: approved movie, audio, previews and timeline preserved',flush=True)

if __name__=='__main__':make_independent(Path(__file__).resolve().parents[1])
