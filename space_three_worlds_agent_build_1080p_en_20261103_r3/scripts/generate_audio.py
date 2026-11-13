import json,subprocess,time,wave,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
chapters=json.loads((ROOT/'narration.json').read_text())
url='http://192.168.0.10:8008/v1/audio/speech'
manifest={'model':'Qwen/Qwen3-TTS-12Hz-1.7B-Base','voice':'entropydrop','language':'English','synthetic':True,'source_workflow':'skin_reconstruction/regenerate_audio.py','chapters':[]}
full=[];cursor=0
for ci,ch in enumerate(chapters):
    chunks=[];frames=[]
    for si,text in enumerate(ch['sentences']):
        name=f"{ch['id']}__{si+1:02}"
        wav=ROOT/'audios/raw'/f'{name}.wav';req=wav.with_suffix('.request.json');header=wav.with_suffix('.headers')
        payload={'model':'qwen3-tts','input':text,'voice':'entropydrop','language':'English','response_format':'wav','seed':42+si}
        if wav.exists() and (not req.exists() or json.loads(req.read_text()) != payload):
            wav.unlink()
        req.write_text(json.dumps(payload))
        if not wav.exists():
            for attempt in range(4):
                print('Generating',name,flush=True)
                p=subprocess.run(['curl','--noproxy','*','-sS','--max-time','600','-H','Content-Type: application/json','--data-binary','@'+str(req),'-D',str(header),'-o',str(wav),'-w','%{http_code}',url],capture_output=True,text=True)
                if p.returncode==0 and p.stdout=='200':break
                wav.unlink(missing_ok=True)
                if attempt==3:raise RuntimeError(p.stderr or p.stdout)
                time.sleep(8)
        if 'x-synthetic-audio: true' not in header.read_text().lower():raise RuntimeError('Missing synthetic audio header')
        with wave.open(str(wav)) as w:
            assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,24000)
            raw=w.readframes(w.getnframes());duration=w.getnframes()/24000
        frames.extend([raw,b'\x00\x00'*int(.32*24000)])
        chunks.append({'file':str(wav.relative_to(ROOT)),'text':text,'duration':duration,'sha256':hashlib.sha256(wav.read_bytes()).hexdigest()})
    # Half a second before speech, one second after each chapter.
    data=b'\x00\x00'*12000+b''.join(frames)+b'\x00\x00'*24000
    out=ROOT/'audios'/f"{ch['id']}.wav"
    with wave.open(str(out),'wb') as w:
        w.setparams((1,2,24000,0,'NONE','not compressed'));w.writeframes(data)
    duration=len(data)/48000
    manifest['chapters'].append({**ch,'file':str(out.relative_to(ROOT)),'start':cursor,'duration':duration,'chunks':chunks})
    full.append(data);cursor+=duration
    print('DONE',ch['id'],round(duration,2),'sec',flush=True)
    (ROOT/'audios/manifest.json').write_text(json.dumps(manifest,indent=2))
manifest['duration']=cursor
(ROOT/'audios/manifest.json').write_text(json.dumps(manifest,indent=2))
print('TOTAL',cursor,flush=True)
