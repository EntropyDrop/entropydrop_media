#!/usr/bin/env python3
"""Export modular Chinese SRT/VTT from the approved rendered voice track.

Cached alignments need only Python's standard library. For changed audio install
faster-whisper, numpy, scipy and jieba; use --model-cache to choose temporary storage.
No source audio, video, script or timeline is changed by this command.
"""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import unicodedata
import wave

MODEL = 'base'
ALIGN_VERSION = 'faster-whisper-1.2.1-base-known-text-v1'
CLOSE = '，。！？；：、,.!?;:）】”’」》'
OPEN = '（【“‘「《'
STRONG = '。！？!?；;'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def atomic_text(path, text):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(text, encoding='utf-8')
    os.replace(temporary, path)


def save(path, data):
    atomic_text(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def norm(text):
    return re.sub(r'\s+', '', text)


def width(text):
    return sum(1 if unicodedata.east_asian_width(c) in 'WF' else .5 for c in text)


def legal_boundaries(text, lexical=None):
    """Keep Latin names, numbers and punctuation with the surrounding phrase."""
    blocked = set()
    for m in re.finditer(r'[A-Za-z0-9](?:[A-Za-z0-9 ./+_\-]*[A-Za-z0-9])?', text):
        blocked.update(range(m.start()+1, m.end()))
    return [0] + [i for i in range(1, len(text))
                  if i not in blocked and (lexical is None or i in lexical) and text[i] not in CLOSE
                  and text[i-1] not in OPEN and not text[i].isspace()
                  and not (text[i-1]=='—' and text[i]=='—')] + [len(text)]


def break_cost(text, index):
    if index == len(text):
        return 0
    left = text[:index].rstrip('”’）】」》 ')
    if left and left[-1] in STRONG:
        return 0
    if left.endswith('——'):
        return 0
    if left and left[-1] in '，：,:' :
        return .35
    if left and left[-1] in '并的和或与':
        return 7.2
    return 3.2


def wrap(text, lexical=None):
    text = text.strip()
    if width(text) <= 23:
        return text
    choices = []
    for i in legal_boundaries(text, lexical)[1:-1]:
        a, b = text[:i].strip(), text[i:].strip()
        wa, wb = width(a), width(b)
        if max(wa, wb) <= 23:
            choices.append((abs(wa-wb)/8 + break_cost(text, i), a+'\n'+b))
    if not choices:
        raise ValueError('Cannot wrap caption: ' + text)
    return min(choices)[1]


def char_times(text, words):
    assert ''.join(w['word'] for w in words) == text, 'Alignment text mismatch'
    out = []
    for w in words:
        count = len(w['word'])
        for i in range(count):
            out.append((w['start'] + (w['end']-w['start'])*i/count,
                        w['start'] + (w['end']-w['start'])*(i+1)/count))
    return out


def segment(text, words, duration, lexical):
    times = char_times(text, words)
    boundaries = legal_boundaries(text, lexical)
    dp = {0: (0, [])}
    for end in boundaries[1:]:
        options = []
        for start in reversed(boundaries):
            if start >= end or start not in dp:
                continue
            phrase = text[start:end].strip()
            w = width(phrase)
            if w > 40:
                continue
            d = times[end-1][1] - times[start][0]
            if d > 6.5 or d < .55:
                continue
            crossed = [m for m in re.finditer(r'[。！？!?；;]|——',text[start:end-1])
                       if width(text[start:start+m.start()])>6]
            score = (1.4 + ((w-18)/13)**2 + ((d-3.3)/4)**2
                     + break_cost(text, end) + max(0, 1.2-d)*5 + 4*len(crossed))
            options.append((dp[start][0]+score, dp[start][1]+[(start,end)]))
        if options:
            dp[end] = min(options, key=lambda x:x[0])
    if len(text) not in dp:
        raise ValueError('Unable to segment: ' + text)
    out = []
    spans = dp[len(text)][1]
    for i, (a, b) in enumerate(spans):
        start = max(0, times[a][0] - .04)
        end = min(duration, times[b-1][1] + .08)
        if i+1 < len(spans):
            end = min(end, max(0, times[b][0] - .04))
        if end - start < .45:
            raise ValueError('Caption too short: ' + text[a:b])
        out.append({'start':start, 'end':end, 'text':wrap(text[a:b], {i-a for i in lexical if a<=i<=b})})
    assert norm(''.join(c['text'] for c in out)) == norm(text)
    return out


def stamp(seconds, vtt=False):
    ms = round(seconds*1000)
    s, ms = divmod(ms,1000)
    m, s = divmod(s,60)
    h, m = divmod(m,60)
    return f'{h:02}:{m:02}:{s:02}{"." if vtt else ","}{ms:03}'


def write_captions(base, cues):
    blocks = [f'{i}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}'
              for i,c in enumerate(cues,1)]
    atomic_text(base.with_suffix('.srt'), '\n\n'.join(blocks)+'\n')
    blocks = [f'{stamp(c["start"],True)} --> {stamp(c["end"],True)}\n{c["text"]}'
              for c in cues]
    atomic_text(base.with_suffix('.vtt'), 'WEBVTT\n\n'+'\n\n'.join(blocks)+'\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--model-cache',type=Path,default=Path('/private/tmp/space-vlog-subtitles-zh-model'))
    args = ap.parse_args()
    root = args.root.resolve()
    timeline_path = root/'current-timeline.zh.json'
    timeline_bytes = timeline_path.read_bytes()
    timeline = json.loads(timeline_bytes)
    video = root/'exports/space_three_worlds_zh_latest.mp4'
    video_hash = file_sha(video)
    all_cues, reports, pending = [], [], []
    model = tokenizer = None
    generated = reused = 0
    for chapter in timeline['chapters']:
        mid = chapter['id']
        directory = root/'modules'/mid
        script = (directory/'script.zh.txt').read_text(encoding='utf-8')
        paras = [' '.join(x.split()) for x in script.strip().split('\n\n') if x.strip()]
        assert paras == [p['text'] for p in chapter['voice_timing']], f'Stale timeline: {mid}'
        path = directory/'subtitles.zh.alignment.json'
        old = json.loads(path.read_text()) if path.exists() else {}
        cache = {p['key']:p for p in old.get('paragraphs',[])}
        aligned, module_cues = [], []
        with wave.open(str(directory/'voice.zh.wav'),'rb') as f:
            rate, channels, sample_width = f.getframerate(), f.getnchannels(), f.getsampwidth()
            assert rate==24000 and channels==1 and sample_width==2
            pcm = f.readframes(f.getnframes())
        for p in chapter['voice_timing']:
            begin = round(p['start']*rate)
            end = begin+round(p['duration']*rate)
            raw = pcm[begin*2:end*2]
            key = sha(ALIGN_VERSION.encode()+p['text'].encode()+raw)
            if key in cache:
                record = cache[key]
                reused += 1
            else:
                import numpy as np
                from scipy.signal import resample_poly
                from faster_whisper import WhisperModel
                from faster_whisper.tokenizer import Tokenizer
                from faster_whisper.audio import pad_or_trim
                if model is None:
                    model = WhisperModel(MODEL, device='cpu', compute_type='int8', cpu_threads=4,
                                         download_root=str(args.model_cache))
                    tokenizer = Tokenizer(model.hf_tokenizer, model.model.is_multilingual,
                                          task='transcribe', language='zh')
                audio = resample_poly(np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768,2,3)
                assert len(audio) <= 30*16000, f'Paragraph needs chunking: {mid}'
                features = model.feature_extractor(audio)
                encoder = model.encode(pad_or_trim(features))
                words = model.find_alignment(tokenizer,[tokenizer.encode(p['text'])],encoder,
                                             round(len(audio)/160))[0]
                words = [{k:(float(v) if k!='word' else v) for k,v in w.items()
                          if k in ('word','start','end','probability')} for w in words]
                record = {'key':key,'text':p['text'],'duration':p['duration'],'words':words}
                generated += 1
            assert record['text'] == p['text']
            assert ''.join(w['word'] for w in record['words']) == p['text']
            if 'lexical_boundaries' not in record:
                import jieba
                jieba.setLogLevel(40)
                for term in ('体素','微体素','以太群岛','支奴干','四旋翼','自然原野','铜城',
                             '无人机','旋翼','智能体','螺旋桨','越野车','建模工具','铺路机器人'):
                    jieba.add_word(term)
                position = 0
                boundaries = [0]
                for token in jieba.cut(p['text'], HMM=False):
                    position += len(token)
                    boundaries.append(position)
                assert position == len(p['text'])
                record['lexical_boundaries'] = boundaries
            aligned.append(record)
            local = segment(p['text'],record['words'],p['duration'], set(record['lexical_boundaries']))
            for c in local:
                module_cues.append({**c,'start':c['start']+p['start'],
                                    'end':c['end']+p['start'],'paragraph':p['paragraph']})
            print(f'{mid} paragraph {p["paragraph"]}: {len(local)} cues',flush=True)
        save(path,{'version':ALIGN_VERSION,'audio_sha256':sha(pcm),'paragraphs':aligned})
        for c in module_cues:
            all_cues.append({**c,'module':mid,'start':c['start']+chapter['start'],
                             'end':c['end']+chapter['start']})
        pending.append((directory/'subtitles.zh',module_cues))
        reports.append({'id':mid,'start':chapter['start'],'duration':chapter['duration'],
                        'paragraphs':len(aligned),'cues':len(module_cues),'audio_sha256':sha(pcm)})
    assert timeline_path.read_bytes() == timeline_bytes, 'Timeline changed during export'
    issues=[]
    previous_end=0
    for i,c in enumerate(all_cues,1):
        assert 0<=c['start']<c['end']<=timeline['duration']
        assert round(c['start']*1000)>=round(previous_end*1000), f'Overlapping cue {i}'
        lines=c['text'].splitlines()
        assert len(lines)<=2 and max(width(l) for l in lines)<=23
        cps=width(c['text'].replace('\n',''))/(c['end']-c['start'])
        if cps>10:
            issues.append({'cue':i,'module':c['module'],'time':stamp(c['start']),
                           'text':c['text'],'cjk_equivalent_chars_per_second':round(cps,2)})
        previous_end=c['end']
    assert norm(''.join(c['text'] for c in all_cues)) == norm(''.join(
        p['text'] for c in timeline['chapters'] for p in c['voice_timing']))
    assert file_sha(video)==video_hash, 'Movie changed during export'
    for base,cues in pending:
        # with_suffix replaces .zh, so supply an extra disposable suffix.
        write_captions(Path(str(base)+'.out'),cues)
    export=root/'exports/space_three_worlds_zh_latest'
    write_captions(Path(str(export)+'.out'),all_cues)
    format_checks = {}
    for ext in ('.srt','.vtt'):
        result = subprocess.run(['ffprobe','-v','error','-count_packets','-show_entries',
                                 'stream=codec_name,nb_read_packets','-of','json',str(export)+ext],
                                check=True,capture_output=True,text=True)
        streams = json.loads(result.stdout)['streams']
        assert len(streams)==1 and int(streams[0]['nb_read_packets'])==len(all_cues)
        format_checks[ext] = streams[0]
    report={'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'method':'Known-script Whisper token alignment on rendered 24kHz module narration',
            'alignment_version':ALIGN_VERSION,'language':'zh-CN','burned_in':False,
            'video':str(video.relative_to(root)),'video_sha256':video_hash,
            'video_duration':timeline['duration'],'timeline_sha256':sha(timeline_bytes),
            'module_count':len(reports),'paragraph_count':sum(x['paragraphs'] for x in reports),
            'cue_count':len(all_cues),'new_alignments':generated,'reused_alignments':reused,
            'full_script_coverage':True,'timestamps_in_order_and_non_overlapping':True,
            'max_lines':2,'max_line_width_cjk_equivalent':23,
            'reading_speed_review':issues,'format_validation':format_checks,'modules':reports,'cues':all_cues,
            'exports':{ext:{'path':str(export.relative_to(root))+ext,
                            'sha256':file_sha(Path(str(export)+ext))} for ext in ('.srt','.vtt')}}
    save(root/'review/subtitles.zh.json',report)
    print(json.dumps({k:report[k] for k in ('cue_count','paragraph_count','new_alignments',
                                          'reused_alignments','reading_speed_review')},ensure_ascii=False),flush=True)


if __name__ == '__main__':
    main()
