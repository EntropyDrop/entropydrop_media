"""Chinese dub audio/ASR QA. Run after dub.py assemble and check --full.
Requires numpy, opencc-python-reimplemented, pypinyin; recognition itself is local.
"""
from pathlib import Path
import difflib,json,re,subprocess,sys
import numpy as np
from opencc import OpenCC
from pypinyin import lazy_pinyin
from video import read,save,sha,wav_read,paragraphs,atomic_text
from dub import trim
R=Path(__file__).resolve().parents[1];cc=OpenCC('t2s')
def norm(s):
    s=cc.convert(s).lower().replace('12.5','十二点五').replace('8分之1','八分之一')
    s=s.translate(str.maketrans('0123456789','零一二三四五六七八九'))
    return lazy_pinyin(re.sub(r'[^\u3400-\u9fffa-z]+',' ',s),errors=lambda x:re.findall(r'[a-z]+',x))
def silence(data):
    n=len(data)//240
    rms=np.sqrt(np.mean(data[:n*240].astype(float).reshape(n,240)**2,axis=1))
    current=longest=0
    for value in rms:
        current=current+1 if value<100 else 0;longest=max(longest,current)
    return longest*.01
timeline=read(R/'current-timeline.zh.json');asr=read(R/'review/current-voice-asr.zh.json');items=[]
for c in timeline['chapters']:
    mid=c['id'];d=R/'modules'/mid;chunks=read(d/'voice.zh.json')['chunks'];texts=paragraphs(d/'script.zh.txt');voice=wav_read(d/'voice.zh.wav')
    assert texts==[x['text'] for x in chunks]
    assert len(voice)==round(c['duration']*24000)
    for ch,t in zip(chunks,c['voice_timing']):
        assert sha(R/ch['file'])==ch['sha256']
        record=asr[ch['sha256']];assert record['expected']==ch['text'] and record['model']=='small'
        options=[record['actual']]+record.get('other_transcripts',[])+([record['previous_without_hint']] if record.get('previous_without_hint') else [])
        scores=[difflib.SequenceMatcher(None,norm(ch['text']),norm(x),autojunk=False).ratio() for x in options]
        best=max(scores);actual=options[scores.index(best)]
        end=round((t['start']+t['duration'])*24000)
        end_rms=float(np.sqrt(np.mean(voice[max(0,end-720):end].astype(float)**2)))
        boundary=None
        if end_rms>150:
            source=trim(wav_read(R/ch['file']))
            rendered=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-f','s16le','-ar','24000','-ac','1','-i','pipe:0','-af',f'atempo={t["tempo"]:.9f}','-f','s16le','-ar','24000','-ac','1','pipe:1'],input=source.tobytes())
            boundary={'complete_transformed_samples':len(rendered)//2,'slot_samples':round(t['duration']*24000),'full_signal_retained':len(rendered)//2<=round(t['duration']*24000),'source_ending_30ms_rms':round(float(np.sqrt(np.mean(source[-720:].astype(float)**2))),2)}
        items.append({'module':mid,'paragraph':t['paragraph'],'phonetic_similarity':round(best,4),'asr_variants':len(options),'expected':ch['text'],'asr_best':actual,'tempo':t['tempo'],'ending_30ms_rms':round(end_rms,2),'raw_audio_sha256':ch['sha256'],'boundary_review':boundary})
    assert silence(voice)<1.5,(mid,'excess narration silence',silence(voice))
full=np.concatenate([wav_read(R/'modules'/c['id']/'voice.zh.wav') for c in timeline['chapters']])
master=R/'exports/space_three_worlds_zh_latest.mp4'
scan_path=R/'review/current-audio-scan.zh.log';scan_key=R/'review/current-audio-scan.zh.sha256.json'
if scan_path.exists() and scan_key.exists() and read(scan_key).get('master_sha256')==sha(master):
    scan_text=scan_path.read_text()
else:
    scan=subprocess.run(['ffmpeg','-nostdin','-i',str(master),'-map','0:a:0','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,check=True)
    scan_text=scan.stderr;atomic_text(scan_path,scan_text);save(scan_key,{'master_sha256':sha(master)})
meter=json.JSONDecoder().raw_decode(scan_text[scan_text.rfind('{'):])[0]
assert -18<=float(meter['input_i'])<=-14,meter
assert float(meter['input_tp'])<=-.5,meter
flags=[x for x in items if x['phonetic_similarity']<.85 or (x['ending_30ms_rms']>150 and not x['boundary_review']['full_signal_retained'])]
result={'passed':not flags,'modules':len(timeline['chapters']),'paragraphs':len(items),'duration':timeline['duration'],'master_sha256':sha(master),'english_master_sha256':sha(R/'exports/space_three_worlds_latest.mp4'),'source_script_sha256':sha(R/'voiceover.zh.txt'),'max_voice_silence_seconds':silence(full),'integrated_lufs':float(meter['input_i']),'true_peak_dbfs':float(meter['input_tp']),'tempo_range':[min(x['tempo'] for x in items),max(x['tempo'] for x in items)],'review_method':'Local small ASR with vocabulary-only hint and saved unprompted transcripts where available; Chinese phonetic normalization handles homophone spelling. Deterministic timing, silence, boundary and loudness checks. This is not a claim of continuous human listening.','needs_review':flags,'paragraph_checks':items}
save(R/'review/current-qa.zh.json',result)
print(json.dumps({k:v for k,v in result.items() if k not in ['paragraph_checks','needs_review','review_method']},ensure_ascii=False,indent=2))
for x in flags:print('REVIEW',x['module'],x['paragraph'],x['phonetic_similarity'],x['ending_30ms_rms'],x['asr_best'],flush=True)
if flags:sys.exit(1)
