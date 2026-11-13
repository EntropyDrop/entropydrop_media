"""Local Chinese ASR check, resumable by audio hash; does not send audio off-device."""
from pathlib import Path
import argparse,difflib,json,re,sys,time
from faster_whisper import WhisperModel
from opencc import OpenCC
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R/'scripts'))
from video import save,read,paragraphs,sha
parser=argparse.ArgumentParser()
parser.add_argument('--watch',action='store_true')
parser.add_argument('--model',default='base')
parser.add_argument('--model-cache',default='/private/tmp/space-vlog-zh/asr-model')
args=parser.parse_args()
out=R/'review/current-voice-asr.zh.json'
results=read(out) if out.exists() else {}
hint='以下是普通话游戏解说，内容包含体素、微体素、无人机、第一人称、第三人称、悬停、支奴干、以太群岛、独立悬挂、弹簧、阻尼、旋翼、驾驶位。'
model=None;convert=OpenCC('t2s')
def norm(s):return re.findall(r'[\u3400-\u9fff]|[a-z0-9]+',convert.convert(s).lower())
idle=0
while True:
    complete=True;changed=False
    for mid in read(R/('project.zh.json' if (R/'project.zh.json').exists() else 'project.json'))['order']:
        d=R/'modules'/mid
        if not (d/'voice.zh.json').exists():complete=False;continue
        chunks=read(d/'voice.zh.json')['chunks']
        if paragraphs(d/'script.zh.txt')!=[x['text'] for x in chunks]:complete=False;continue
        for i,ch in enumerate(chunks):
            key=ch['sha256']
            if key in results and results[key].get('model')==args.model and results[key].get('vocabulary_hint')==hint:continue
            assert sha(R/ch['file'])==key
            if model is None:model=WhisperModel(args.model,device='cpu',compute_type='int8',cpu_threads=4,download_root=args.model_cache)
            segments,info=model.transcribe(str(R/ch['file']),language='zh',beam_size=5,vad_filter=True,condition_on_previous_text=False,initial_prompt=hint)
            parts=[{'start':s.start,'end':s.end,'text':s.text} for s in segments]
            actual=''.join(x['text'].strip() for x in parts)
            ratio=difflib.SequenceMatcher(None,norm(ch['text']),norm(actual),autojunk=False).ratio()
            previous=results.get(key)
            alternatives=list(dict.fromkeys((previous.get('other_transcripts',[])+[previous['actual']]+([previous['previous_without_hint']] if previous.get('previous_without_hint') else [])) if previous else []))
            results[key]={'module':mid,'paragraph':i+1,'expected':ch['text'],'actual':actual,'similarity':round(ratio,4),'duration':info.duration,'model':args.model,'segments':parts,'vocabulary_hint':hint,'other_transcripts':alternatives,'previous_without_hint':previous.get('actual') if previous and not previous.get('vocabulary_hint') else None}
            save(out,results);changed=True
            print(mid,i+1,round(info.duration,2),round(ratio,3),actual if ratio<.8 else '',flush=True)
    if complete or not args.watch:break
    idle=0 if changed else idle+1
    if idle>180:print('WATCH STOP: no new audio for one hour',flush=True);break
    time.sleep(20)
print('ASR FINISHED',len(results),flush=True)
