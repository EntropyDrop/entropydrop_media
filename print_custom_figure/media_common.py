"""Shared output paths, export manifests and verification for both video formats."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    return digest.hexdigest()


def project_formats():
    project = json.loads((ROOT/'project.json').read_text())
    formats = project['formats']
    for variant in ('landscape','portrait'):
        output = (ROOT/formats[variant]['output']).resolve()
        if not output.is_relative_to((ROOT/'renders').resolve()):
            raise ValueError('Exports must be inside the project renders folder')
    return project['fps'], formats


def output_path(variant):
    return ROOT/project_formats()[1][variant]['output']


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format',
                                              '-of','json',str(path)]))


def audio_hash(path):
    return subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0',
                                    '-c:a','copy','-f','hash','-hash','sha256','-']).decode().strip()


def write_json(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def landscape_inputs():
    paths = {'project.json','narration.json','timeline.json','template.css','build.mjs','index.html',
             'finalize_audio.py','audios/voiceover_full.wav',
             'assets/fonts/fusion-pixel-12px-proportional-zh_hans.ttf.woff2'}
    def visit(value):
        if isinstance(value,dict):
            for child in value.values(): visit(child)
        elif isinstance(value,list):
            for child in value: visit(child)
        elif isinstance(value,str) and value.startswith(('assets/','sources/','audios/')):
            if (ROOT/value).is_file(): paths.add(value)
    visit(json.loads((ROOT/'timeline.json').read_text()))
    visit(json.loads((ROOT/'project.json').read_text()))
    return {name:sha256(ROOT/name) for name in sorted(paths)}


def write_landscape_manifest(migration=None):
    fps,formats = project_formats()
    timeline = json.loads((ROOT/'timeline.json').read_text())
    target = formats['landscape']
    path = ROOT/target['output']
    manifest = dict(variant='landscape',**target,fps=fps,frames=timeline['totalFrames'],
                    duration=timeline['duration'],output_sha256=sha256(path),source_hashes=landscape_inputs(),
                    audio_sha256=audio_hash(path),producer='Hyperframes 0.6.6 and exact-sample master audio mix')
    if migration is not None: manifest['migration'] = migration
    write_json(ROOT/'renders/landscape-manifest.json',manifest)
    return manifest


def check_export(variant):
    fps,formats = project_formats()
    target = formats[variant]
    timeline = json.loads((ROOT/'timeline.json').read_text())
    manifest = json.loads((ROOT/f'renders/{variant}-manifest.json').read_text())
    path = ROOT/target['output']
    assert manifest['output']==target['output']
    assert manifest['frames']==timeline['totalFrames'] and manifest['duration']==timeline['duration']
    assert sha256(path)==manifest['output_sha256'], f'{variant} export changed'
    for relative,expected in manifest['source_hashes'].items():
        assert sha256(ROOT/relative)==expected, f'{variant} input changed: {relative}'
    info = probe(path)
    video = next(stream for stream in info['streams'] if stream['codec_type']=='video')
    audio = next(stream for stream in info['streams'] if stream['codec_type']=='audio')
    assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
    if variant=='portrait': assert video['color_space']=='bt709'
    assert (video['width'],video['height'])==(target['width'],target['height'])
    assert video['r_frame_rate']==f'{fps}/1' and int(video['nb_frames'])==timeline['totalFrames']
    assert abs(float(video['start_time']))<.001 and abs(float(audio['start_time']))<.001
    assert abs(float(video['duration'])-timeline['duration'])<1/fps
    assert abs(float(audio['duration'])-timeline['duration'])<.03
    assert abs(float(info['format']['duration'])-timeline['duration'])<1/fps
    assert audio['codec_name']=='aac' and audio['sample_rate']=='48000' and audio['channels']==2
    if 'audio_sha256' in manifest: assert audio_hash(path)==manifest['audio_sha256']
    subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'],check=True)
    print(f"Verified {variant}: {target['width']} × {target['height']} / {fps} fps / {timeline['totalFrames']} frames",flush=True)
