from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,math
root=Path(__file__).parent;m=json.loads((root/'review/scifi-city.json').read_text());q=json.loads((root/'review/scifi-city-geometry-qa.json').read_text())
im=Image.new('RGB',(1920,1080),'#142129');d=ImageDraw.Draw(im)
font='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
f=lambda n:ImageFont.truetype(font,n)
xy=lambda x,z:(int(530+x*1.9),int(578+z*1.9))
d.text((55,28),'立交道路逻辑 / NATURE CITY',font=f(35),fill='#edf2e8')
d.text((55,78),'由同一份游戏蓝图生成 · 俯视路网与行驶方向',font=f(22),fill='#a7bac0')
for b in m['buildings']:
 a=xy(b['x']-b['width']/2,b['z']-b['depth']/2);c=xy(b['x']+b['width']/2,b['z']+b['depth']/2);d.rectangle((*a,*c),fill='#3b4c53',outline='#69787c')
colors={'street':'#6d817f','highway':'#e7ce78','ramp':'#94aeb5'}
for p in sorted(m['roads'],key=lambda p:sum(v[1] for v in p['points'])/len(p['points'])):
 col=colors[p['kind']]
 if p['id']=='southbound-to-eastbound-loop':col='#73dcc3'
 if p['id']=='eastbound-to-northbound-flyover':col='#c89aed'
 points=[xy(v[0],v[2]) for v in p['points']]
 d.line(points,fill='#10191e',width=max(5,round(p['width']*1.9+5)),joint='curve');d.line(points,fill=col,width=max(3,round(p['width']*1.9)),joint='curve')
 if p['kind']=='street':continue
 s=0;nextarrow=18
 for a,b in zip(p['points'],p['points'][1:]):
  l=math.hypot(b[0]-a[0],b[2]-a[2]);s+=l
  if s<nextarrow:continue
  nextarrow+=40;tx,tz=(b[0]-a[0])/l,(b[2]-a[2])/l
  for u,sign in ([(0,1)] if p.get('direction')=='forward' else [(p['width']/4,1),(-p['width']/4,-1)]):
   x,z=a[0]-tz*u,a[2]+tx*u;tip=xy(x+tx*3*sign,z+tz*3*sign);left=xy(x-tx*2*sign-tz*1.5,z-tz*2*sign+tx*1.5);right=xy(x-tx*2*sign+tz*1.5,z-tz*2*sign-tx*1.5);d.polygon([tip,left,right],fill='#18282f')
d.line([(1080,130),(1080,1000)],fill='#38515c',width=2)
items=[('01  两条主线，分层直行','#e7ce78',['东西主线 28 m，南北主线 35 m。','右侧通行；每个方向一条车道。']),('02  环形单向匝道','#73dcc3',['南行 → 东行，30 m 转弯半径。','同向分流、顺向合流，接入口保持等高。']),('03  上层单向匝道','#c89aed',['东行 → 北行，跨越主线处高 42 m。','转向过程中逐渐升降，末端沿北向车道合流。']),('04  四条城区接入道路','#94aeb5',['四个主线端部都接回城区地面路网。','其余转向经城区道路完成。'])]
y=155
for title,col,lines in items:
 d.text((1130,y),title,font=f(29),fill=col)
 for j,line in enumerate(lines):d.text((1130,y+47+j*36),line,font=f(23),fill='#cedadd')
 y+=165
d.rounded_rectangle((1120,835,1860,994),radius=12,fill='#223a42')
for i,line in enumerate(['接入方向 / 路面相交 / 桥墩 / 地形：检查通过',f"匝道最大坡度 {max(q['maxGrades'][p['id']] for p in m['roads'] if p['kind']=='ramp')*100:.2f}% · 最小转弯半径 24.81 m",'最小结构净空 5.0 m · 非合流处路面至少相隔 7 m']):d.text((1140,854+i*40),line,font=f(22),fill='#cfe6db')
d.text((70,970),'N ↑   （上北下南；高度为游戏世界坐标）',font=f(21),fill='#a7bac0')
d.text((70,1018),'道路逻辑示意图；实机材质、地形和体素细节请看游戏截图。',font=f(20),fill='#80979e')
im.save(root/'review/sci-fi-city-road-plan.png')
