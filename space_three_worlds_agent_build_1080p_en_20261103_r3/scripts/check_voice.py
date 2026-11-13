from faster_whisper import WhisperModel
from pathlib import Path
import json,re,difflib,time,argparse,tempfile
R=Path(__file__).resolve().parents[1];O=R/'review/current-voice-asr.json'
parser=argparse.ArgumentParser(description='Local English TTS-to-script cross-check. Requires faster-whisper.');parser.add_argument('--model',default='base.en');parser.add_argument('--model-cache',default=str(Path(tempfile.gettempdir())/'space-vlog-asr-model'));args=parser.parse_args()
model=None
results=json.loads(O.read_text()) if O.exists() else {}
def norm(s):return re.findall(r"[a-z0-9]+",s.lower())
for d in sorted((R/'modules').iterdir()):
 texts=[' '.join(p.split()) for p in (d/'script.en.txt').read_text().strip().split('\n\n') if p.strip()]
 chunks=json.load(open(d/'voice.json'))['chunks']
 if texts!=[x['text'] for x in chunks]:continue
 for i,ch in enumerate(chunks):
  key=ch['sha256']
  if key in results:continue
  if model is None:model=WhisperModel(args.model,device='cpu',compute_type='int8',cpu_threads=4,download_root=args.model_cache)
  seg,info=model.transcribe(str(R/ch['file']),language='en',beam_size=3,vad_filter=True,condition_on_previous_text=False)
  parts=[{'start':s.start,'end':s.end,'text':s.text} for s in seg];actual=' '.join(s['text'].strip() for s in parts);ratio=difflib.SequenceMatcher(None,norm(ch['text']),norm(actual),autojunk=False).ratio()
  result={'module':d.name,'paragraph':i+1,'source':ch['file'],'expected':ch['text'],'actual':actual,'similarity':round(ratio,4),'duration':info.duration,'segments':parts};results[key]=result;O.write_text(json.dumps(results,ensure_ascii=False,indent=2));print(d.name,i+1,round(info.duration,2),round(ratio,3),actual if ratio<.8 else '',flush=True)
print('ASR CHECK COMPLETE',len(results),flush=True)
