#!/usr/bin/env python3
"""Render both aspect ratios from a common, measured-music-beat edit decision list."""
import argparse
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = 3
COMPARISON_VERSION = 3


def run(*args):
    subprocess.run([str(x) for x in args], check=True)


def ffmpeg(*args):
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args)


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))


def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()


def write_json(path,data):
    Path(path).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')


def load():
    return json.loads((ROOT/'edit.json').read_text())


def music_config(edit,fmt):
    return {**edit['music'],**edit['music'].get('formats',{}).get(fmt,{})}


def plan(edit,fmt):
    cfg=edit['formats'][fmt]
    bi=0 if fmt=='landscape' else 1
    music=music_config(edit,fmt);beats=json.loads((ROOT/music['beatMap']).read_text())['beats']
    beat_cursor=music['startBeat'];music_start=beats[beat_cursor];frame_cursor=0;fps=edit['fps'];shots=[]
    source_info=probe(ROOT/edit['source'])
    source_duration=float(source_info['format']['duration'])
    source_video=next(s for s in source_info['streams'] if s['codec_type']=='video')
    image_sizes={}
    for original in edit['shots']:
        count=original['beats'][bi]
        if count==0:continue
        s=dict(original);s['crop']=s.pop(fmt)
        next_beat=beat_cursor+count
        end_frame=round((beats[next_beat]-music_start)*fps)
        s.update(startFrame=frame_cursor,frames=end_frame-frame_cursor,start=frame_cursor/fps,
                 duration=(end_frame-frame_cursor)/fps,beatIn=beat_cursor,beatOut=next_beat,
                 musicTime=beats[beat_cursor],beatErrorMs=1000*(frame_cursor/fps-(beats[beat_cursor]-music_start)))
        if 'comparison' in s:
            c=dict(s['comparison'])
            assert 'image' in s and 0<c['exitStartBeat']<c['exitEndBeat']<count
            c['exitStartFrame']=round((beats[beat_cursor+c['exitStartBeat']]-music_start)*fps)-frame_cursor
            c['exitEndFrame']=round((beats[beat_cursor+c['exitEndBeat']]-music_start)*fps)-frame_cursor
            c['exitStart']=c['exitStartFrame']/fps
            c['exitDuration']=(c['exitEndFrame']-c['exitStartFrame'])/fps
            s['comparison']=c
        if 'image' in s:
            path=ROOT/s['image']
            if s['image'] not in image_sizes:
                stream=probe(path)['streams'][0]
                image_sizes[s['image']]=(stream['width'],stream['height'])
            source_width,source_height=image_sizes[s['image']]
        elif 'freeze' not in s:
            if fmt=='portrait':
                s['in']=s.get('portraitIn',s['in']);s['out']=s.get('portraitOut',s['out'])
            assert 0<=s['in']<s['out']<=source_duration,s['id']
            s['speed']=(s['out']-s['in'])/s['duration']
            source_width,source_height=source_video['width'],source_video['height']
        else:
            assert 0<=s['freeze']<source_duration
            source_width,source_height=source_video['width'],source_video['height']
        x,y,w,h=s['crop']
        assert all(v%2==0 for v in [x,y,w,h]),s['id']
        assert 0<=x<=source_width-w and 0<=y<=source_height-h,s['id']
        assert w*cfg['height']==h*cfg['width'],s['id']
        assert s['frames']>0
        shots.append(s);frame_cursor=end_frame;beat_cursor=next_beat
    return dict(format=fmt,**cfg,fps=fps,source=edit['source'],musicStart=music_start,
                musicEnd=beats[beat_cursor],frames=frame_cursor,duration=frame_cursor/fps,shots=shots)


def crop_filter(shot,width,height):
    x,y,w,h=shot['crop']
    return (f'crop={w}:{h}:{x}:{y},scale={width}:{height}:flags=lanczos:'
            'in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,'
            'setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709')


def comparison_filter(shot,manifest):
    """Translate a centered pair left as one group while fading the reference."""
    c=shot['comparison'];layout=c[manifest['format']]
    width,height,fps=manifest['width'],manifest['height'],manifest['fps']
    x,y,w,h=shot['crop']
    shift=layout['groupShiftX']
    figure_height=layout['figureHeight']
    figure_width=figure_height*width//height
    assert figure_width*height==figure_height*width,'Figure must scale proportionally'
    assert all(v%2==0 for v in [shift,figure_width,figure_height])
    assert 0<figure_width<=width and 0<figure_height<=height and shift>0
    left=(width-figure_width)//2+shift
    right=width+shift-left-figure_width
    top=(height-figure_height)//2
    bottom=height-top-figure_height
    p=f"clip((t-{c['exitStart']:.9f})/{c['exitDuration']:.9f},0,1)"
    ease=f"(({p})*({p})*(3-2*({p})))"
    # A single displacement drives both layers, so their spacing is constant.
    displacement=f'{shift}*{ease}'
    slide=f"{layout['photoX']}-({displacement})"
    repeat=f'loop=loop=-1:size=1:start=0,setpts=N/({fps}*TB)'
    # Extend only nearby neutral backdrop rows. Reflecting a tall border in one
    # pass can copy the figure's head into the top margin at smaller scales.
    vertical_extension=''
    remaining_top,remaining_bottom=top,bottom
    while remaining_top or remaining_bottom:
        extra_top,extra_bottom=min(64,remaining_top),min(64,remaining_bottom)
        vertical_extension+=(f'pad=iw:ih+{extra_top+extra_bottom}:0:{extra_top},'
                             f'fillborders=top={extra_top}:bottom={extra_bottom}:mode=reflect,')
        remaining_top-=extra_top;remaining_bottom-=extra_bottom
    return (
        f"[0:v]crop={w}:{h}:{x}:{y},scale={figure_width}:{figure_height}:flags=lanczos,"
        f"setsar=1,format=gbrp,pad={width+shift}:{figure_height}:{left}:0,"
        f"fillborders=left={left}:right={right}:mode=smear,"
        f"{vertical_extension}"
        f"{repeat},crop={width}:{height}:x='{displacement}':y=0,format=rgb24[figure];"
        f"[1:v]scale={layout['photoWidth']}:-2:flags=lanczos,setsar=1,format=rgba,{repeat},"
        f"fade=t=out:st={c['exitStart']:.9f}:d={c['exitDuration']:.9f}:alpha=1[reference];"
        f"[figure][reference]overlay=x='{slide}':y={layout['photoY']}:format=rgb:shortest=1,"
        f"scale={width}:{height}:flags=lanczos:in_range=pc:out_range=tv:out_color_matrix=bt709,"
        "format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[picture]"
    )


def comparison_hashes(manifest):
    return {s['comparison']['image']:sha256(ROOT/s['comparison']['image'])
            for s in manifest['shots'] if 'comparison' in s}


def review(edit,manifest):
    from PIL import Image,ImageDraw,ImageFont
    fmt=manifest['format'];folder=ROOT/'review'/fmt;folder.mkdir(parents=True,exist_ok=True)
    size=(480,270) if fmt=='landscape' else (270,480)
    tasks=[]
    for s in manifest['shots']:
        for k,u in enumerate([0.08,0.5,0.92]):
            t=s.get('freeze',s.get('in',0)+(s.get('out',0)-s.get('in',0))*u)
            out=folder/f"{s['id']}-{k}.jpg"
            tasks.append((s,t,out))
    def extract(task):
        s,t,out=task
        if 'comparison' in s:
            # Review actual moving comparison states rather than the base still.
            u=[0.08,0.5,0.92][int(out.stem.rsplit('-',1)[-1])]
            ffmpeg('-threads',1,'-framerate',manifest['fps'],'-i',ROOT/s['image'],
                   '-framerate',manifest['fps'],'-i',ROOT/s['comparison']['image'],
                   '-filter_complex_threads',1,'-filter_complex',comparison_filter(s,manifest),
                   '-map','[picture]','-ss',u*s['duration'],'-frames:v',1,'-s',f'{size[0]}x{size[1]}',
                   '-q:v',3,'-threads',1,out)
            return
        input_args=['-i',ROOT/s['image']] if 'image' in s else ['-ss',t,'-i',ROOT/edit['source']]
        ffmpeg('-threads',1,*input_args,'-vf',crop_filter(s,*size),'-frames:v',1,'-q:v',3,'-threads',1,out)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(extract,tasks))
    font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',16)
    per_page=5 if fmt=='landscape' else 3
    for offset in range(0,len(manifest['shots']),per_page):
        selected=manifest['shots'][offset:offset+per_page]
        sheet=Image.new('RGB',(size[0]*3,(size[1]+36)*len(selected)),'#f4f4ef');draw=ImageDraw.Draw(sheet)
        for row,s in enumerate(selected):
            for col in range(3):
                with Image.open(folder/f"{s['id']}-{col}.jpg") as im:sheet.paste(im,(col*size[0],row*(size[1]+36)))
            draw.text((10,row*(size[1]+36)+size[1]+8),f"{s['id']} | {s['start']:.2f}s | {s['duration']:.2f}s | {s.get('speed',0):.2f}x",font=font,fill='#25382b')
        sheet.save(folder/f'sheet-{offset//per_page+1:02}.jpg',quality=92)
    write_json(folder/'plan.json',manifest)
    print(f'Review: {folder}',flush=True)


def soundtrack(edit,manifest):
    music=music_config(edit,manifest['format']);source=ROOT/music['instrumental']
    if not source.exists():raise FileNotFoundError(f'Prepare the instrumental first: {source}')
    out=ROOT/'audios'/f"zxf-{manifest['format']}-instrumental.wav"
    out.parent.mkdir(parents=True,exist_ok=True)
    duration=manifest['duration'];fade=min(music['fadeOut'],manifest['shots'][-1]['duration'])
    samples=round(duration*48000)
    filters=(f"atrim=start={manifest['musicStart']:.9f}:duration={duration:.9f},asetpts=PTS-STARTPTS,"
             f"loudnorm=I={music['targetLUFS']}:TP={music['truePeak']}:LRA={music.get('loudnessRange',11)},"
             f"afade=t=in:d={music['fadeIn']},afade=t=out:st={duration-fade:.9f}:d={fade},"
             f"aresample=48000,apad=whole_len={samples},atrim=end_sample={samples},asetpts=N/SR/TB")
    ffmpeg('-i',source,'-af',filters,'-ar',48000,'-ac',2,'-c:a','pcm_s24le',out)
    assert int(probe(out)['streams'][0]['duration_ts'])==samples,'Incomplete soundtrack sample coverage'
    return out


def render(edit,manifest):
    fmt=manifest['format'];work=ROOT/'renders'/f'{fmt}-work';work.mkdir(parents=True,exist_ok=True)
    source=ROOT/edit['source'];source_hash=sha256(source);fps=edit['fps']
    image_hashes={s['image']:sha256(ROOT/s['image']) for s in manifest['shots'] if 'image' in s}
    references=comparison_hashes(manifest)
    def cut(s):
        out=work/f"{s['id']}.mp4";cache=out.with_suffix('.json')
        input_hash=image_hashes[s['image']] if 'image' in s else source_hash
        signature=dict(version=VERSION,sourceSha256=input_hash,width=manifest['width'],height=manifest['height'],fps=fps,shot=s)
        if 'comparison' in s:
            signature['comparisonSha256']=references[s['comparison']['image']]
            signature['comparisonVersion']=COMPARISON_VERSION
        if out.exists() and cache.exists() and json.loads(cache.read_text())==signature:return out
        if 'image' in s:
            input_args=['-framerate',fps,'-i',ROOT/s['image']]
            # Cache one cropped frame, then repeat it without repeatedly decoding the JPEG.
            filters=crop_filter(s,manifest['width'],manifest['height'])+f',loop=loop=-1:size=1:start=0,setpts=N/({fps}*TB)'
        elif 'freeze' in s:
            input_args=['-ss',s['freeze'],'-t',1/fps,'-i',source]
            timing=f"setpts=PTS-STARTPTS,fps={fps},tpad=stop_mode=clone:stop_duration={s['duration']+1}"
        else:
            input_args=['-ss',s['in'],'-t',s['out']-s['in'],'-i',source]
            timing=f"setpts=(PTS-STARTPTS)/{s['speed']:.12f},fps={fps},tpad=stop_mode=clone:stop_duration=0.1"
        if 'image' not in s:filters=timing+','+crop_filter(s,manifest['width'],manifest['height'])
        filter_args=['-map','0:v:0','-vf',filters]
        if 'comparison' in s:
            input_args+=['-framerate',fps,'-i',ROOT/s['comparison']['image']]
            filter_args=['-filter_complex_threads',1,'-filter_complex',comparison_filter(s,manifest),'-map','[picture]']
        ffmpeg('-threads',2,*input_args,*filter_args,'-an','-frames:v',s['frames'],
               '-c:v','libx264','-preset','fast','-crf',16,'-threads',2,'-g',fps,'-keyint_min',fps,'-sc_threshold',0,
               '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
               '-video_track_timescale',15360,'-movflags','+faststart',out)
        assert int(probe(out)['streams'][0]['nb_frames'])==s['frames'],s['id']
        write_json(cache,signature);print(f"{fmt}: {s['id']} ({s['duration']:.2f}s)",flush=True)
        return out
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:parts=list(pool.map(cut,manifest['shots']))
    concat=work/'parts.txt';concat.write_text(''.join(f"file '{p.name}'\nduration {shot['frames']/fps:.12f}\n" for p,shot in zip(parts,manifest['shots'])))
    picture=work/'picture.mp4'
    ffmpeg('-f','concat','-safe',0,'-i',concat,'-map','0:v:0','-c','copy','-movie_timescale',15360,'-movflags','+faststart',picture)
    music=soundtrack(edit,manifest)
    final=ROOT/manifest['output'];stage=final.with_name(final.stem+'-rendering.mp4')
    ffmpeg('-i',picture,'-i',music,'-map','0:v:0','-map','1:a:0','-t',manifest['duration'],
           '-c:v','copy','-c:a','aac','-b:a','256k','-ar',48000,'-movie_timescale',15360,'-movflags','+faststart',stage)
    assert int(probe(stage)['streams'][0]['nb_frames'])==manifest['frames']
    stage.replace(final)
    music_cfg=music_config(edit,fmt)
    manifest.update(sourceSha256=source_hash,imageSourceHashes=image_hashes,comparisonSourceHashes=references,editSha256=sha256(ROOT/'edit.json'),
                    beatMapSha256=sha256(ROOT/music_cfg['beatMap']),musicSource=music_cfg['instrumental'],
                    musicSourceSha256=sha256(ROOT/music_cfg['instrumental']),music=str(music.relative_to(ROOT)),
                    musicSha256=sha256(music),renderSha256=sha256(final),renderVersion=VERSION,
                    comparisonVersion=COMPARISON_VERSION)
    write_json(ROOT/'renders'/f'{fmt}-manifest.json',manifest)
    assembly=next(s for s in manifest['shots'] if 'image' not in s and 'freeze' not in s)
    for name,t in [('opening',.5),('assembly',assembly['start']+.5),('ending',manifest['duration']-1)]:
        ffmpeg('-ss',t,'-i',final,'-frames:v',1,'-q:v',2,ROOT/'renders'/f'{fmt}-{name}.jpg')
    print(f"Rendered {final}: {manifest['duration']:.3f}s / {manifest['frames']} frames",flush=True)
    return manifest


def main():
    p=argparse.ArgumentParser();p.add_argument('--format',choices=['all','landscape','portrait'],default='all');p.add_argument('--review',action='store_true');a=p.parse_args()
    edit=load();formats=list(edit['formats']) if a.format=='all' else [a.format]
    for fmt in formats:
        manifest=plan(edit,fmt)
        if a.review:review(edit,manifest)
        else:render(edit,manifest)


if __name__=='__main__':main()
