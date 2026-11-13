#!/usr/bin/env python3
"""Space vlog: editable modules, content-based incremental builds, atomic exports.

Only project.json and modules/*/{module.json,script.en.txt,voice.json} are inputs.
Legacy narration.json/timeline.json and dated R3 artifacts are reference snapshots.
Requires Python 3.10+, numpy, ffmpeg and ffprobe. No network calls except `tts`.
"""
import argparse
import hashlib
import html
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import wave
import fcntl
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VERSION = 1

def read(path):
    return json.loads(Path(path).read_text())

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def atomic_text(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(value)
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)

def save(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def run(args):
    subprocess.run([str(x) for x in args], check=True)

def media_output(path, args):
    """Never truncate the current good output, including hardlinked R3 assets."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.' + path.stem + '-', suffix=path.suffix, dir=path.parent)
    os.close(fd)
    try:
        run(['ffmpeg', '-nostdin', '-y', '-v', 'error', *args, tmp])
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))

def video_info(path):
    p = probe(path)
    return next(s for s in p['streams'] if s['codec_type'] == 'video'), float(p['format']['duration'])

def wav_read(path):
    with wave.open(str(path)) as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, 24000):
            raise ValueError(f'{path}: expected mono PCM16 24000 Hz')
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').copy()

def wav_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(suffix='.wav', dir=path.parent)
    os.close(fd)
    try:
        with wave.open(tmp, 'wb') as w:
            w.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            w.writeframes(data.astype('<i2').tobytes())
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)

def paragraphs(path):
    return [' '.join(p.split()) for p in path.read_text().strip().split('\n\n') if p.strip()]

class Project:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.config = read(self.root / 'project.json')
        self.ids = self.config['order']
        if len(self.ids) != len(set(self.ids)):
            raise ValueError('Duplicate module IDs in project order')
        self.fps = self.config['format']['fps']
        self.state_path = self.root / 'cache/build-state.json'
        self.state = read(self.state_path) if self.state_path.exists() else {'modules': {}}
        self.plans = {}
        self.hashes = {}
        self.built = set()
        self.report = {'video_rebuilt': [], 'voice_rebuilt': [], 'previews_rebuilt': [], 'master_rebuilt': False, 'mix_rebuilt': False}

    def path(self, relative):
        p = Path(os.path.abspath(self.root / relative))
        if not p.is_relative_to(self.root) or Path(relative).is_absolute():
            raise ValueError(f'Asset must be project-relative: {relative}')
        return p

    def hash(self, path):
        key = str(path)
        if key not in self.hashes:
            self.hashes[key] = sha(path)
        return self.hashes[key]

    def directory(self, module):
        if module not in self.ids:
            raise ValueError(f'Unknown module {module}')
        return self.path('modules/' + module)

    def plan(self, module, stack=()):
        if module in stack:
            raise ValueError('Module dependency cycle: ' + ' -> '.join((*stack, module)))
        if module in self.plans:
            return self.plans[module]
        d = self.directory(module)
        m = read(d / 'module.json')
        texts = paragraphs(d / 'script.en.txt')
        lock = read(d / 'voice.json')['chunks']
        if not texts or texts != [x['text'] for x in lock]:
            raise ValueError(f'{module}: script changed; run `python3 scripts/video.py tts {module}` first')
        timing = self.config['narration_timing']
        pos = timing['lead']; chunks = []; voice_timing = []
        for chunk in lock:
            path = self.path(chunk['file'])
            if self.hash(path) != chunk['sha256']:
                raise ValueError(f'{module}: voice file hash mismatch: {chunk["file"]}; update voice.json for intentional replacement')
            raw = wav_read(path)
            n = len(raw) // 240
            rms = np.sqrt(np.mean(raw[:n * 240].astype(float).reshape(n, 240) ** 2, axis=1))
            voiced = np.flatnonzero(rms > timing['trim_rms'])
            if not len(voiced):
                raise ValueError(f'{module}: silent voice chunk')
            a = max(0, int(voiced[0] * 240) - round(timing['trim_before'] * 24000))
            b = min(len(raw), int((voiced[-1] + 1) * 240) + round(timing['trim_after'] * 24000))
            data = raw[a:b]
            voice_timing.append({'start': pos, 'duration': len(data) / 24000, 'text': chunk['text'], 'source': chunk['file']})
            chunks.append(data); pos += len(data) / 24000 + timing['gap']
        duration = math.ceil((pos - timing['gap'] + timing['tail']) * self.fps) / self.fps
        voice = np.zeros(round(duration * 24000), dtype=np.int16)
        for data, t in zip(chunks, voice_timing):
            a = round(t['start'] * 24000); voice[a:a + len(data)] = data
        voice_sig = digest({'version': VERSION, 'pcm': hashlib.sha256(voice.tobytes()).hexdigest()})
        clips = []; dependencies = []; start = 0
        for clip in m['clips']:
            end = clip['end_at']
            if end == 'end': end = duration
            elif isinstance(end, str) and end.startswith('voice:'):
                end = voice_timing[int(end.split(':')[1]) - 1]['start']
            end = float(end); length = end - start
            if length <= 0:
                raise ValueError(f'{module}: non-positive clip duration; review clip anchors after script change')
            source = clip['source']
            if source.startswith('module:'):
                dep = source.split(':', 1)[1]
                dep_plan = self.plan(dep, (*stack, module))
                path = self.directory(dep) / 'video.mp4'
                source_sig = dep_plan['video_sig']; available = dep_plan['duration']; dependencies.append(dep)
            else:
                path = self.path(source); source_sig = self.hash(path)
                available = None if path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp'] else video_info(path)[1]
            a = float(clip.get('in', 0)); b = clip.get('out', 'auto')
            if b == 'auto': b = a + length
            b = float(b)
            if not 0 <= a < b or (available is not None and b > available + .5 / self.fps):
                raise ValueError(f'{module}: source {source} ends at {available}; requested {a}..{b}. Supply longer footage or revise the edit.')
            mode = clip.get('mode', 'realtime')
            if mode not in ['realtime', 'fit']:
                raise ValueError(f'{module}: unknown mode {mode}')
            if mode == 'realtime' and abs((b - a) - length) > .5 / self.fps:
                raise ValueError(f'{module}: realtime clip length must match its output interval')
            clips.append({'source': source, 'path': str(path), 'in': a, 'out': b, 'duration': length, 'source_sig': source_sig, 'mode': mode})
            start = end
        if abs(start - duration) > 1e-6:
            raise ValueError(f'{module}: last clip must end at module end')
        video_sig = digest({'version': VERSION, 'clips': [{k:v for k,v in c.items() if k != 'path'} for c in clips], 'format': self.config['format'], 'encoder': self.config['encoder']})
        result = {'id': module, 'title': m['title'], 'label': m['label'], 'duration': duration, 'voice': voice, 'voice_timing': voice_timing, 'clips': clips, 'dependencies': dependencies, 'video_sig': video_sig, 'voice_sig': voice_sig}
        self.plans[module] = result
        return result

    def valid(self, entry, key, signature, path):
        return entry.get(key + '_sig') == signature and path.is_file() and entry.get(key + '_sha256') == self.hash(path)

    def checkpoint(self):
        save(self.state_path, self.state)

    def build(self, module):
        if module in self.built: return
        p = self.plan(module); d = self.directory(module)
        for dep in p['dependencies']: self.build(dep)
        entry = self.state['modules'].setdefault(module, {})
        video = d / 'video.mp4'; voice = d / 'voice.wav'; preview = d / 'preview.mp4'
        if not self.valid(entry, 'video', p['video_sig'], video):
            inputs = []; filters = []
            fmt = self.config['format']; enc = self.config['encoder']
            for i, c in enumerate(p['clips']):
                path = Path(c['path'])
                if path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp']:
                    inputs += ['-loop', '1', '-framerate', str(self.fps)]
                inputs += ['-i', str(path)]
                filters.append(f"[{i}:v]trim=start={c['in']}:end={c['out']},setpts=(PTS-STARTPTS)*{c['duration']/(c['out']-c['in'])},fps={self.fps},scale={fmt['width']}:{fmt['height']}:force_original_aspect_ratio=decrease,pad={fmt['width']}:{fmt['height']}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v{i}]")
            filters.append(''.join(f'[v{i}]' for i in range(len(p['clips']))) + f"concat=n={len(p['clips'])}:v=1:a=0[v]")
            media_output(video, [*inputs, '-filter_complex', ';'.join(filters), '-map', '[v]', '-an', '-t', str(p['duration']), '-c:v', 'libx264', '-preset', enc['preset'], '-crf', str(enc['crf']), '-threads', str(enc['threads']), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart'])
            entry.update(video_sig=p['video_sig'], video_sha256=sha(video)); self.hashes.pop(str(video), None)
            self.report['video_rebuilt'].append(module)
        if not self.valid(entry, 'voice', p['voice_sig'], voice):
            wav_write(voice, p['voice'])
            entry.update(voice_sig=p['voice_sig'], voice_sha256=sha(voice)); self.hashes.pop(str(voice), None)
            self.report['voice_rebuilt'].append(module)
        preview_sig = digest([entry['video_sha256'], entry['voice_sha256'], self.config['audio']['preview_filter']])
        if not self.valid(entry, 'preview', preview_sig, preview):
            media_output(preview, ['-i', str(video), '-i', str(voice), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', self.config['audio']['preview_filter'], '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', '-t', str(p['duration']), '-movflags', '+faststart'])
            entry.update(preview_sig=preview_sig, preview_sha256=sha(preview)); self.hashes.pop(str(preview), None)
            self.report['previews_rebuilt'].append(module)
        self.built.add(module); self.checkpoint()
        print('READY', module, f"{p['duration']:.2f}s", flush=True)

    def timeline(self):
        chapters = []; start = 0
        for module in self.ids:
            p = self.plan(module)
            chapters.append({'id': module, 'title': p['title'], 'label': p['label'], 'start': start, 'duration': p['duration'], 'preview': f'modules/{module}/preview.mp4', 'voice_timing': p['voice_timing'], 'clips': [{k:v for k,v in c.items() if k not in ['path', 'source_sig']} for c in p['clips']]})
            start += p['duration']
        return {'duration': start, **self.config['format'], 'chapters': chapters}

    def signatures(self):
        timeline = self.timeline()
        mix_sig = digest({'version': VERSION, 'voice': [self.plan(m)['voice_sig'] for m in self.ids], 'ambient': self.hash(self.path(self.config['audio']['ambient'])), 'audio': self.config['audio']})
        master_sig = digest({'version': VERSION, 'videos': [self.state['modules'][m]['video_sha256'] for m in self.ids], 'mix': mix_sig, 'chapters': [(c['title'], c['start'], c['duration']) for c in timeline['chapters']], 'format': self.config['format']})
        return timeline, mix_sig, master_sig

    def assemble(self):
        for module in self.ids: self.build(module)
        timeline, mix_sig, master_sig = self.signatures()
        duration = timeline['duration']; audio = self.config['audio']
        mix = self.root / 'cache/master-mix.m4a'
        if not self.valid(self.state, 'mix', mix_sig, mix):
            voice = self.root / 'cache/master-voice.wav'
            wav_write(voice, np.concatenate([self.plan(m)['voice'] for m in self.ids]))
            # Loop the quiet ambient source if future edits make the film longer.
            af = f"[0:a]{audio['voice_filter']}[v];[1:a]volume={audio['ambient_gain']}[m];[v][m]amix=inputs=2:normalize=0,alimiter=limit={audio['limiter']}:level=false,afade=t=out:st={duration-1}:d=1[a]"
            media_output(mix, ['-i', str(voice), '-stream_loop', '-1', '-i', str(self.path(audio['ambient'])), '-filter_complex', af, '-map', '[a]', '-t', str(duration), '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k'])
            self.state.update(mix_sig=mix_sig, mix_sha256=sha(mix)); self.report['mix_rebuilt'] = True; self.checkpoint()
        master = self.path(self.config['output'])
        if not self.valid(self.state, 'master', master_sig, master):
            meta = [';FFMETADATA1', 'title=Space Devlog | Three Worlds, Three Machines', 'artist=EntropyDrop']
            for c in timeline['chapters']:
                title = c['title'].replace('\\', '\\\\').replace('=', '\\=').replace(';', '\\;').replace('#', '\\#').replace('\n', ' ')
                meta += ['[CHAPTER]', 'TIMEBASE=1/1000', f"START={round(c['start']*1000)}", f"END={round((c['start']+c['duration'])*1000)}", 'title=' + title]
            metadata = self.root / 'cache/chapters.ffmetadata'; atomic_text(metadata, '\n'.join(meta) + '\n')
            concat = self.root / 'cache/concat.txt'
            def quoted(p): return str(p).replace("'", "'\\''")
            atomic_text(concat, ''.join("file '" + quoted(self.directory(m)/'video.mp4') + "'\n" for m in self.ids))
            media_output(master, ['-f', 'concat', '-safe', '0', '-i', str(concat), '-i', str(mix), '-i', str(metadata), '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '2', '-map_chapters', '2', '-c', 'copy', '-t', str(duration), '-movflags', '+faststart'])
            self.state.update(master_sig=master_sig, master_sha256=sha(master)); self.report['master_rebuilt'] = True; self.checkpoint()
        save(self.root / 'current-timeline.json', timeline)
        atomic_text(self.root / 'current-chapters.txt', '\n'.join(f"{int(c['start']//60):02d}:{int(c['start']%60):02d} {c['label']} | {c['title']}" for c in timeline['chapters']) + '\n')
        rows = ['Space 视频模块目录（当前全片时间码）', '', '编号 | 模块 ID | 内容 | 全片时间 | 时长']
        for i, c in enumerate(timeline['chapters'], 1):
            rows.append(f"{i:02d} | {c['id']} | {c['label']} | {int(c['start']//60):02d}:{int(c['start']%60):02d} | {c['duration']:.2f}s")
        atomic_text(self.root / '模块目录.txt', '\n'.join(rows) + '\n')
        print('MASTER', master, f'{duration:.2f}s', flush=True)

    def index(self):
        items = []
        for module in self.ids:
            d = self.directory(module); m = read(d/'module.json')
            items.append({'id': module, 'title': m['title'], 'label': m['label'], 'text': (d/'script.en.txt').read_text(), 'video': f'modules/{module}/preview.mp4'})
        payload = json.dumps(items, ensure_ascii=False).replace('<', '\\u003c')
        page = '''<!doctype html><meta charset="utf-8"><title>Space 视频模块</title>
<style>body{margin:28px;background:#111a1d;color:#e5eee9;font:17px/1.6 system-ui;max-width:1300px}a{color:#a5d380}button,select{font:inherit;padding:8px;background:#233134;color:inherit;border:1px solid #547065}video{width:100%;max-height:67vh;background:#000}pre{white-space:pre-wrap;font:inherit;color:#bbc9c5}header{display:flex;gap:15px;align-items:center}h1{font-size:25px}small{color:#a7bbb0}</style>
<h1>Space · 固定模块化视频工程</h1><p>选择模块可独立回看（英文旁白，无字幕）；全片包含背景音乐。修改时告诉我模块编号、内容和时间点。</p>
<header><select id="pick"></select><a href="EXPORT">播放当前全片</a><a href="README-模块化工程.txt">编辑说明</a></header><h2 id="title"></h2><video id="player" controls preload="metadata"></video><p id="files"></p><small>对应英文文案</small><pre id="script"></pre>
<script>const modules=PAYLOAD;const pick=document.querySelector('#pick');for(const m of modules){const o=document.createElement('option');o.value=m.id;o.textContent=m.id+' · '+m.label;pick.append(o)}function show(){const m=modules.find(m=>m.id===pick.value);document.querySelector('#title').textContent=m.label+' — '+m.title;document.querySelector('#player').src=m.video;document.querySelector('#script').textContent=m.text;const f=document.querySelector('#files');f.textContent='';for(const name of ['module.json','script.en.txt','voice.json']){const a=document.createElement('a');a.href='modules/'+m.id+'/'+name;a.textContent=name;f.append(a,'　')}location.hash=m.id}pick.onchange=show;if(modules.some(m=>m.id===location.hash.slice(1)))pick.value=location.hash.slice(1);show();</script>'''
        atomic_text(self.root/'模块预览.html', page.replace('PAYLOAD', payload).replace('EXPORT', html.escape(self.config['output'], quote=True)))

    def status(self):
        ready = True
        for module in self.ids:
            p = self.plan(module); e = self.state['modules'].get(module, {}); d = self.directory(module)
            video = self.valid(e, 'video', p['video_sig'], d/'video.mp4')
            voice = self.valid(e, 'voice', p['voice_sig'], d/'voice.wav')
            ready = ready and video and voice
            print(module, p['label'], f"{p['duration']:.2f}s", 'video=' + ('cached' if video else 'CHANGED'), 'voice=' + ('cached' if voice else 'CHANGED'), 'dependencies=' + ','.join(p['dependencies']))
        if ready:
            _, mix_sig, master_sig = self.signatures()
            ready = self.valid(self.state, 'mix', mix_sig, self.root/'cache/master-mix.m4a') and self.valid(self.state, 'master', master_sig, self.path(self.config['output']))
        print('MASTER', 'current' if ready else 'NEEDS ASSEMBLE')

    def tts(self, module):
        import urllib.request
        import io
        d = self.directory(module); lock = read(d/'voice.json'); old = {x['text']:x for x in lock['chunks']}; chunks = []
        cfg = self.config['tts']
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for i, text in enumerate(paragraphs(d/'script.en.txt')):
            settings = read(d/'module.json')
            seed = settings.get('tts_seeds', {}).get(str(i+1), 42+i)
            parts = settings.get('tts_segments', {}).get(str(i+1), [text])
            import re
            if re.findall(r'\w+', ' '.join(parts)) != re.findall(r'\w+', text):
                raise ValueError(f'{module}: TTS segmentation must preserve every source word')
            requests = [{**cfg['request'], 'input': part, 'seed': seed+j} for j,part in enumerate(parts)]
            payload = requests[0] if len(requests)==1 else {'segmentation':'phrase-boundaries', 'requests':requests, 'gap_seconds':0.10}
            previous = old.get(text)
            if previous and previous.get('request_sha256') == digest(payload) and self.path(previous['file']).is_file() and sha(self.path(previous['file'])) == previous['sha256']:
                chunks.append(previous); continue
            cached_name = f'modules/{module}/audio/{digest(payload)[:20]}.wav'
            cached = self.path(cached_name)
            if cached.is_file() and cached.with_suffix('.request.json').is_file() and read(cached.with_suffix('.request.json')) == payload:
                try:
                    wav_read(cached)
                    chunks.append({'text':text,'file':cached_name,'sha256':sha(cached),'request_sha256':digest(payload)})
                    print('TTS CACHED', module, 'paragraph', i+1, flush=True)
                    continue
                except (ValueError, wave.Error, EOFError):
                    pass
            print('TTS', module, 'paragraph', i+1, flush=True)
            pieces = []
            for request_payload in requests:
                req = urllib.request.Request(cfg['url'], data=json.dumps(request_payload).encode(), headers={'Content-Type':'application/json'})
                with opener.open(req, timeout=180) as response:
                    if response.headers.get('x-synthetic-audio','').lower() != 'true':
                        raise ValueError('TTS response missing synthetic-audio marker')
                    data = response.read()
                with wave.open(io.BytesIO(data)) as w:
                    if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1,2,24000): raise ValueError('Invalid TTS WAV format')
                    if w.getnframes() == 0: raise ValueError('Empty TTS WAV')
                    if w.getnframes()/24000 > len(request_payload['input'].split())*.8+3:
                        raise ValueError(f'{module}: abnormally long TTS output; revise seed or phrase segmentation')
                    pieces.append(w.readframes(w.getnframes()))
            if len(pieces)>1:
                buffer=io.BytesIO()
                with wave.open(buffer,'wb') as w:
                    w.setparams((1,2,24000,0,'NONE','not compressed'))
                    w.writeframes((b'\x00'*4800).join(pieces))
                data=buffer.getvalue()
            # Content-addressed files preserve the current good audio if a later paragraph fails.
            name = f'modules/{module}/audio/{digest(payload)[:20]}.wav'; path = self.path(name); path.parent.mkdir(parents=True,exist_ok=True)
            fd,tmp=tempfile.mkstemp(dir=path.parent,suffix='.wav')
            try:
                with os.fdopen(fd,'wb') as f:f.write(data)
                os.replace(tmp,path)
            finally:Path(tmp).unlink(missing_ok=True)
            save(path.with_suffix('.request.json'),payload)
            chunks.append({'text':text,'file':name,'sha256':sha(path),'request_sha256':digest(payload)})
        save(d/'voice.json', {'chunks':chunks})
        print('VOICE READY', module)

    def check(self, full=False):
        timeline = self.timeline(); results=[]
        for module in self.ids:
            p=self.plan(module); d=self.directory(module); v,length=video_info(d/'preview.mp4')
            e=self.state['modules'].get(module,{})
            assert self.valid(e,'video',p['video_sig'],d/'video.mp4'),f'{module}: stale video'
            assert self.valid(e,'voice',p['voice_sig'],d/'voice.wav'),f'{module}: stale voice'
            preview_sig=digest([e['video_sha256'],e['voice_sha256'],self.config['audio']['preview_filter']])
            assert self.valid(e,'preview',preview_sig,d/'preview.mp4'),f'{module}: stale preview'
            assert (v['width'],v['height'],v['r_frame_rate'])==(self.config['format']['width'],self.config['format']['height'],f'{self.fps}/1')
            assert abs(length-p['duration'])<.08,(module,length,p['duration'])
            assert int(v['nb_frames'])==round(p['duration']*self.fps)
            results.append({'id':module,'duration':length,'frames':int(v['nb_frames'])})
        master=self.path(self.config['output']);data=probe(master)
        _,mix_sig,master_sig=self.signatures()
        assert self.valid(self.state,'mix',mix_sig,self.root/'cache/master-mix.m4a'),'stale master mix'
        assert self.valid(self.state,'master',master_sig,master),'stale master export'
        v=next(s for s in data['streams'] if s['codec_type']=='video')
        assert int(v['nb_frames'])==round(timeline['duration']*self.fps)
        assert not any(s['codec_type']=='subtitle' for s in data['streams'])
        assert abs(float(data['format']['duration'])-timeline['duration'])<.08
        if full:run(['ffmpeg','-nostdin','-v','error','-i',str(master),'-f','null','-'])
        save(self.root/'review/modular-check.json',{'passed':True,'modules':results,'duration':timeline['duration'],'master_sha256':sha(master),'full_decode':full})
        print('CHECK PASSED',len(results),'modules',flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['list','status','build','assemble','tts','check','index'])
    parser.add_argument('modules',nargs='*')
    parser.add_argument('--full',action='store_true',help='decode entire master during check')
    args=parser.parse_args()
    project=Project();(project.root/'cache').mkdir(exist_ok=True)
    with open(project.root/'cache/project.lock','w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('Another project command is running; wait for it to finish')
        ids=args.modules or project.ids
        if args.command=='list':
            for m in project.ids:
                d=read(project.directory(m)/'module.json');print(m,d['label'],d['title'])
        elif args.command=='status':project.status()
        elif args.command=='build':
            for m in ids:project.build(m)
            project.index()
        elif args.command=='assemble':
            if args.modules:raise ValueError('assemble uses the complete project order; use build for individual modules')
            project.assemble();project.index()
        elif args.command=='tts':
            if not args.modules:raise ValueError('Specify module IDs for tts; avoid accidental whole-film voice regeneration')
            for m in ids:project.tts(m)
        elif args.command=='check':project.check(args.full)
        elif args.command=='index':project.index()
        if args.command in ['build','assemble']:
            save(project.root/'review/last-modular-build.json',project.report)
            print(json.dumps(project.report,ensure_ascii=False),flush=True)

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,IndexError,AssertionError,FileNotFoundError,subprocess.CalledProcessError) as e:
        print('ERROR:',str(e),file=sys.stderr);sys.exit(1)
