#!/usr/bin/env python3
import io,json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
t=json.loads((ROOT/'timeline.json').read_text())
out=ROOT/'review/contact-sheets';out.mkdir(exist_ok=True)
for c in t['chapters']:
    if (out/(c['id']+'.jpg')).exists():continue
    raw=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(ROOT/c['footage']),'-vf','fps=1/2,scale=480:270','-f','image2pipe','-vcodec','mjpeg','-q:v','4','pipe:1'])
    frames=[]
    while True:
        a=raw.find(b'\xff\xd8');b=raw.find(b'\xff\xd9',a+2)
        if a<0 or b<0:break
        frames.append(Image.open(io.BytesIO(raw[a:b+2])).convert('RGB'));raw=raw[b+2:]
    sheet=Image.new('RGB',(1920,48+298*((len(frames)+3)//4)),(16,20,23));d=ImageDraw.Draw(sheet)
    d.text((12,16),c['id']+' | '+c['title']+' | every 2 seconds, full chapter',fill='white')
    for i,im in enumerate(frames):
        x=(i%4)*480;y=48+(i//4)*298;sheet.paste(im,(x,y));sec=c['start']+i*2
        d.text((x+8,y+274),f'{int(sec//60):02d}:{int(sec%60):02d} | take +{i*2:02d}s',fill='white')
    sheet.save(out/(c['id']+'.jpg'),quality=88)
    print(c['id'],len(frames),flush=True)
