from pathlib import Path
import json,re,difflib,hashlib
from faster_whisper import WhisperModel
from opencc import OpenCC
from pypinyin import lazy_pinyin
R=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')
out=Path('/private/tmp/robot-city-voice-asr.json');results=json.loads(out.read_text()) if out.exists() else {}
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,download_root='/private/tmp/robot-city-asr-model')
cc=OpenCC('t2s')
def norm(s):return ''.join(re.findall(r'[\u3400-\u9fff]|[a-z0-9]+',cc.convert(s).lower()))
for p in sorted(R.glob('modules/*/voice.zh.json')):
 for ch in json.loads(p.read_text())['sentences']:
  key=ch['sha256']
  if key in results:continue
  audio=R/ch['file'];assert hashlib.sha256(audio.read_bytes()).hexdigest()==key
  ss,info=model.transcribe(str(audio),language='zh',beam_size=5,vad_filter=True,condition_on_previous_text=False,initial_prompt='Space，Nature，Agent Build，机器人，体素，勘测，铺路，运输，建筑，绿化，背包。')
  seg=[dict(start=s.start,end=s.end,text=s.text) for s in ss];actual=''.join(s['text'] for s in seg)
  expected=ch['text'];a,b=norm(expected),norm(actual)
  ratio=difflib.SequenceMatcher(None,a,b,autojunk=False).ratio();phonetic=difflib.SequenceMatcher(None,lazy_pinyin(a),lazy_pinyin(b),autojunk=False).ratio()
  results[key]=dict(module=p.parent.name,paragraph=ch['paragraph'],expected=expected,actual=actual,similarity=ratio,phonetic_similarity=phonetic,duration=info.duration,segments=seg)
  out.write_text(json.dumps(results,ensure_ascii=False,indent=2));print(p.parent.name,ch['paragraph'],round(phonetic,3),actual,flush=True)
print('FINISHED',len(results),flush=True)
