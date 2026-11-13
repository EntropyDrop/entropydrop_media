"""Small local integration fixture: dubbing preserves frames and rejects stale inputs."""
from pathlib import Path
import json,sys,tempfile,subprocess,shutil
import numpy as np
import dub,video

with tempfile.TemporaryDirectory(prefix='space-dub-test-') as tmp:
    root=Path(tmp);dub.R=root
    cfg=video.read(video.ROOT/'project.json');cfg['order']=['01_sample','02_dependent']
    cfg['audio']['ambient']='ambient.wav';cfg['output']='exports/english.mp4'
    video.save(root/'project.json',cfg)
    d=root/'modules/01_sample';d.mkdir(parents=True)
    data=(np.sin(np.arange(14400)*2*np.pi*240/24000)*3000).astype(np.int16)
    video.wav_write(d/'source.en.wav',data);video.wav_write(d/'source.zh.wav',data)
    video.wav_write(root/'ambient.wav',data//30)
    subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','color=c=0x124c32:s=1920x1080:r=30','-frames:v','1',str(root/'still.png')],check=True)
    video.save(d/'module.json',{'id':'01_sample','title':'Sample','label':'样例','clips':[{'source':'still.png','in':0,'out':'auto','end_at':'end','mode':'realtime'}]})
    (d/'script.en.txt').write_text('Sample narration.\n');(d/'script.zh.txt').write_text('测试旁白。\n')
    video.save(d/'title.zh.json',{'title':'样例'})
    video.save(d/'voice.json',{'chunks':[{'text':'Sample narration.','file':'modules/01_sample/source.en.wav','sha256':video.sha(d/'source.en.wav')}]})
    good={'chunks':[{'text':'测试旁白。','file':'modules/01_sample/source.zh.wav','sha256':video.sha(d/'source.zh.wav')}]}
    video.save(d/'voice.zh.json',good)
    d2=root/'modules/02_dependent';shutil.copytree(d,d2)
    video.save(d2/'module.json',{'id':'02_dependent','title':'Dependent','label':'依赖','clips':[{'source':'module:01_sample','in':0,'out':'auto','end_at':'end','mode':'realtime'}]})
    p=video.Project(root);p.assemble();english=video.sha(root/cfg['output'])
    dub.Dub(p).assemble();dub.Dub(video.Project(root)).check(True)
    master=root/dub.OUTPUT;original=video.sha(master)
    old_videos={mid:video.sha(root/'modules'/mid/'video.mp4') for mid in cfg['order']}
    subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','color=c=0xb9462a:s=1920x1080:r=30','-frames:v','1',str(root/'changed.png')],check=True)
    config=video.read(d/'module.json');config['clips'][0]['source']='changed.png';video.save(d/'module.zh.json',config)
    dub.Dub(video.Project(root)).assemble();dub.Dub(video.Project(root)).check(True)
    assert video.sha(master)!=original
    assert all(video.sha(root/'modules'/mid/'video.mp4')==checksum for mid,checksum in old_videos.items())
    assert (d2/'video.zh.mp4').exists(),'Chinese dependency did not rebuild'
    assert video.read(root/'current-timeline.zh.json')['changed_visual_modules']==cfg['order']
    original=video.sha(master)
    print('PASS Chinese-only visuals and dependent montage; English unchanged',flush=True)
    voice=video.wav_read(d/'voice.zh.wav');raw=dub.trim(video.wav_read(d/'source.zh.wav'))
    start=round(video.Project(root).plan('01_sample')['voice_timing'][0]['start']*24000)
    assert np.array_equal(voice[start:start+len(raw)],raw),'Unit-rate narration was modified'
    assert video.sha(root/cfg['output'])==english
    def rejected(label,action):
        try:action()
        except (ValueError,AssertionError):pass
        else:raise AssertionError('Did not reject '+label)
        assert video.sha(master)==original,'Rejected operation damaged Chinese master'
        print('PASS',label,flush=True)
    video.save(d/'dub.zh.json',{'duration_overrides':{'1':2}})
    rejected('Chinese timing crosses module end',lambda:dub.Dub(video.Project(root)).build('01_sample'))
    video.save(d/'dub.zh.json',{})
    (d/'script.zh.txt').write_text('修改后的文案。\n')
    rejected('script changed without TTS',lambda:dub.Dub(video.Project(root)).build('01_sample'))
    (d/'script.zh.txt').write_text('测试旁白。\n')
    video.wav_write(d/'source.zh.wav',np.tile(data,4));good['chunks'][0]['sha256']=video.sha(d/'source.zh.wav');video.save(d/'voice.zh.json',good)
    rejected('oversized narration',lambda:dub.Dub(video.Project(root)).build('01_sample'))
    video.wav_write(d/'source.zh.wav',data)
    rejected('corrupt voice hash',lambda:dub.Dub(video.Project(root)).build('01_sample'))
    good['chunks'][0]['sha256']=video.sha(d/'source.zh.wav');video.save(d/'voice.zh.json',good)
    d3=root/'modules/03_chinese_only';d3.mkdir()
    (d3/'script.zh.txt').write_text('新增中文章节。\n')
    video.wav_write(d3/'source.zh.wav',np.tile(data,2))
    video.save(d3/'voice.zh.json',{'chunks':[{'text':'新增中文章节。','file':'modules/03_chinese_only/source.zh.wav','sha256':video.sha(d3/'source.zh.wav')}]})
    video.save(d3/'title.zh.json',{'title':'新增中文章节'})
    video.save(d3/'module.zh.json',{'id':'03_chinese_only','title':'Chinese only','label':'新增','clips':[{'source':'still.png','in':0,'out':'auto','end_at':'end','mode':'realtime'}]})
    video.save(root/'project.zh.json',{'order':['01_sample','03_chinese_only','02_dependent']})
    dub.Dub(video.Project(root)).assemble();dub.Dub(video.Project(root)).check(True)
    tl=video.read(root/'current-timeline.zh.json')
    assert [c['id'] for c in tl['chapters']]==['01_sample','03_chinese_only','02_dependent']
    assert tl['chapters'][1]['voice_timing'][0]['tempo']==1
    assert video.sha(root/cfg['output'])==english
    assert not (d3/'script.en.txt').exists()
    original=video.sha(master)
    print('PASS Chinese-only insertion, natural timing and English preservation',flush=True)
    video.save(root/'project.zh.json',{'order':['01_sample','03_chinese_only']})
    rejected('unacknowledged Chinese omission',lambda:dub.Dub(video.Project(root)))
    video.save(root/'project.zh.json',{'order':['01_sample','03_chinese_only'],'excluded':['02_dependent']})
    before_duration=tl['duration'];excluded_hash=video.sha(d2/'preview.zh.mp4')
    dub.Dub(video.Project(root)).assemble();dub.Dub(video.Project(root)).check(True);dub.Dub(video.Project(root)).index()
    tl=video.read(root/'current-timeline.zh.json')
    assert [c['id'] for c in tl['chapters']]==['01_sample','03_chinese_only']
    assert abs(tl['duration']-(before_duration-p.plan('02_dependent')['duration']))<1e-8
    assert video.sha(d2/'preview.zh.mp4')==excluded_hash
    assert video.sha(root/cfg['output'])==english
    page=(root/'双语模块预览.html').read_text()
    assert json.dumps({'zh':['01_sample','03_chinese_only'],'en':['01_sample','02_dependent']}) in page
    original=video.sha(master)
    video.save(root/'project.zh.json',{'order':['01_sample','03_chinese_only'],'excluded':['01_sample','02_dependent']})
    rejected('Chinese exclusion overlaps active order',lambda:dub.Dub(video.Project(root)))
    video.save(root/'project.zh.json',{'order':['01_sample','03_chinese_only'],'excluded':['02_dependent']})
    print('PASS Chinese-only omission, retained source assets, independent preview orders and English preservation',flush=True)
    with open(root/cfg['output'],'ab') as f:f.write(b'stale')
    rejected('stale English master',lambda:dub.Dub(video.Project(root)).assemble())
    # An approved Chinese cut must survive later English timing/order changes.
    video.Project(root).assemble()
    from preserve_chinese import make_independent
    approved=video.sha(master)
    make_independent(root)
    zh_previews={m:video.sha(root/'modules'/m/'preview.zh.mp4') for m in ['01_sample','03_chinese_only']}
    cfg['order']=['01_sample','03_chinese_only'];video.save(root/'project.json',cfg)
    video.save(d3/'module.json',video.read(d3/'module.zh.json'))
    (d3/'script.en.txt').write_text('New English chapter.\n')
    video.save(d3/'voice.json',{'chunks':[{'text':'New English chapter.','file':'modules/03_chinese_only/source.zh.wav','sha256':video.sha(d3/'source.zh.wav')}]})
    video.wav_write(d/'source.en.wav',np.tile(data,3))
    voice_en=video.read(d/'voice.json');voice_en['chunks'][0]['sha256']=video.sha(d/'source.en.wav');video.save(d/'voice.json',voice_en)
    module_en=video.read(d/'module.json');module_en['clips'][0]['source']='changed.png';video.save(d/'module.json',module_en)
    video.Project(root).assemble()
    dub.Dub(video.Project(root)).assemble();dub.Dub(video.Project(root)).check(True)
    assert video.sha(master)==approved,'English synchronization altered approved Chinese movie'
    assert all(video.sha(root/'modules'/m/'preview.zh.mp4')==h for m,h in zh_previews.items())
    print('PASS independent Chinese timing, natural added chapter, footage and master after English sync',flush=True)
    print('ALL DUB INTEGRATION CHECKS PASSED',flush=True)
