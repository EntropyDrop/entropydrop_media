from pathlib import Path
import json,html,math,sys
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[1]); model_root=Path(sys.argv[2]).parent;manifest=json.loads(Path(sys.argv[2]).read_text());all_assets=manifest['assets']
labels={'house':'房屋','road':'道路','bridge':'桥梁','tree':'树木','planting':'种植方案'}
houses=[a for a in all_assets if a['category']=='house'];roads=[a for a in all_assets if a['category']=='road'];trees=[a for a in all_assets if a['category']=='tree']
core=next(a for a in all_assets if a['id']=='11_overpass_core').copy();core['label']='B2'
for i,a in enumerate(trees):a['label']='T'+str(i+1)
layout=json.loads((model_root/'interchange-layout.json').read_text());by_id={a['id']:a for a in all_assets}
bridge={'id':'overpass','label':'B1','category':'bridge','name':'双层跨线立交 · 组合','description':'上层跨越下层街道，两端由分段缓坡引道接回地面；主桥、引道和下层道路可分别替换。','voxels':sum(by_id[a['assetId']]['voxels'] for a in layout['parts']),'metric':'11 件原生模块组合','download':'overpass-kit.zip','downloadText':'下载桥梁组件包 ↗'}
plantings=[]
for i,p in enumerate(json.loads((model_root/'planting-layouts.json').read_text())):
 plantings.append({'id':'planting_'+p['id'],'label':'P'+str(i+1),'category':'planting','name':p['name'],'description':{'avenue':'两侧错列，中央保留道路通道；树冠与道路边缘保持间距。','grove':'多树种混合，按树冠半径留出间隔，保留中央通行走廊。','courtyard':'花树、红枫与白桦围合中心留白，避开庭院建筑占地。'}[p['id']],'voxels':sum(by_id[a['assetId']]['voxels'] for a in p['recipe']['placements']),'metric':str(p['recipe']['placedCount'])+' 株 · 可复现种植规则','download':'planting-'+p['id']+'.json','downloadText':'下载种植配置 ↗'})
assets=houses+roads+[bridge,core]+trees+plantings
root.mkdir(parents=True,exist_ok=True)
font='/System/Library/Fonts/STHeiti Medium.ttc'
def board(items,name,title,subtitle,cols):
    W=2400; gap=24; margin=32; cw=(W-margin*2-gap*(cols-1))//cols
    ih=round(cw*1080/1920);ch=ih+86;rows=math.ceil(len(items)/cols)
    im=Image.new('RGB',(W,150+rows*ch+(rows-1)*gap+36),'#edeae2');draw=ImageDraw.Draw(im)
    draw.text((margin,28),title,font=ImageFont.truetype(font,45),fill='#25362c')
    draw.text((margin,91),subtitle,font=ImageFont.truetype(font,25),fill='#647063')
    for i,a in enumerate(items):
        x=margin+(i%cols)*(cw+gap);y=150+(i//cols)*(ch+gap)
        source=Image.open(root/(a['id']+'.png')).convert('RGB');assert source.size==(1920,1080)
        im.paste(source.resize((cw,ih),Image.Resampling.LANCZOS),(x,y))
        draw.rectangle((x,y+ih,x+cw,y+ch),fill='#f9f7f1')
        draw.text((x+18,y+ih+14),a.get('label',a['id'][:2])+'  '+a['name'],font=ImageFont.truetype(font,28),fill='#25362c')
        draw.text((x+18,y+ih+51),a.get('metric',labels[a['category']]+' · 原生微格模型 · '+f"{a['voxels']:,}"+' 格'),font=ImageFont.truetype(font,18),fill='#747b6b')
    im.save(root/name,quality=94,subsampling=0)
board(houses,'houses-overview.jpg','Nature / 六种房屋生成样品','暖灰石基 × 木构 × 瓦顶  ·  Space 游戏内实景  ·  风格确认后再制作视频',3)
board(roads,'roads-overview.jpg','Nature / 四种道路生成样品','统一接口  ·  石板 / 砖石 / 蓝灰铺地  ·  排水槽与人行道',2)
board(trees,'trees-overview.jpg','Nature / 六种微格树木','不同分枝、树冠与季节配色  ·  Space 游戏内实景  ·  固定种子可复现',3)
board([bridge,core],'bridge-overview.jpg','Nature / 双层跨线立交','石砌桥墩 × 金属护栏  ·  分段引道  ·  桥下几何净空 4.375 米',2)
board(plantings,'planting-overview.jpg','Nature / 三种种植规则','道路与建筑避让  ·  按树冠半径控制间距  ·  中央留白为规划通道 / 地块',3)
cards=[]
for i,a in enumerate(assets):
    esc=lambda x:html.escape(str(x),quote=True)
    cards.append(f'''<article class="card" data-kind="{a['category']}">
      <button class="image" data-index="{i}" aria-label="放大 {esc(a['name'])}"><img loading="lazy" src="{a['id']}.png" alt="{esc(a['name'])}的 Space 实景截图"></button>
      <div class="copy"><div class="top"><span class="number">{a.get('label',a['id'][:2])}</span><h2>{esc(a['name'])}</h2></div>
      <p>{esc(a['description'])}</p><div class="meta"><span>{a.get('metric',format(a['voxels'],',')+' 微格')}</span><a href="../../models/architecture/{a.get('download',a['id']+'.pb')}" download>{a.get('downloadText','下载原生模型 ↗')}</a></div></div></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nature · 微格建筑与道路风格评审</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f0eee7;color:#29382f;font:16px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1440px;padding:64px 40px 80px;margin:auto}.eyebrow{font-size:13px;letter-spacing:2px;color:#71816e}h1{font-weight:580;font-size:clamp(28px,4vw,48px);line-height:1.25;margin:18px 0}header p{max-width:770px;color:#647060;margin:18px 0}.bar{display:flex;justify-content:space-between;gap:20px;align-items:center;border-top:1px solid #d3d8cc;margin:32px 0 28px;padding-top:24px}.filters{display:flex;gap:8px}button{font:inherit;cursor:pointer}.filters button{border:1px solid #cbd3c5;border-radius:30px;padding:7px 23px;background:transparent;color:#53644d}.filters button[aria-pressed=true]{background:#314c39;border-color:#314c39;color:#fff}.hint{font-size:13px;color:#6c7768}a{color:#526f4c;text-decoration:none}a:hover{text-decoration:underline}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.card{background:#faf9f4;border:1px solid #dbe0d5;overflow:hidden;border-radius:9px}.image{display:block;width:100%;padding:0;border:0;background:#b9c1a6;line-height:0}.image img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}.copy{padding:22px 26px}.top{display:flex;gap:15px;align-items:baseline}.number{font:13px ui-monospace,monospace;color:#8d947d}h2{margin:0;font-size:22px;font-weight:550}.copy p{margin:11px 0 22px;color:#6e7667;font-size:15px;min-height:25px}.meta{display:flex;justify-content:space-between;border-top:1px solid #e2e5db;padding-top:13px;font-size:12px;color:#8a9180}footer{color:#7d8475;font-size:13px;max-width:850px;margin:42px 0 0}.card[hidden]{display:none}dialog{padding:0;border:1px solid #6b7560;border-radius:12px;width:min(96vw,1800px);background:#20271f;color:#fff;max-height:95vh}dialog::backdrop{background:#132014dd}dialog img{width:100%;max-height:80vh;object-fit:contain;display:block}.dialogbar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;gap:15px}.dialogbar button{border:1px solid #7b8b75;border-radius:7px;background:transparent;color:white;padding:5px 15px}.dialogbar span{margin-right:auto} .links{display:flex;gap:20px;margin:20px 0;color:#586b50;font-size:14px}@media(max-width:720px){main{padding:28px 18px}.grid{grid-template-columns:1fr}.bar{align-items:start;flex-direction:column}.filters button{padding:6px 18px}.copy{padding:18px}.hint{display:none}.dialogbar{flex-wrap:wrap}}
</style><main><header><div class="eyebrow">ENTROPYDROP SPACE / NATURE</div><h1>城市的细节，从一块微格开始。</h1><p>六种房屋、四种道路。石基、木梁、瓦片、窗框、花箱和路沿均为真实的 0.125 米微格。先看轮廓、比例和材质搭配，确认后再让机器人按新蓝图施工。</p><div class="links"><a href="houses-overview.jpg">房屋总览</a><a href="roads-overview.jpg">道路总览</a><a href="../../scripts/robot-city/architecture/README.zh.txt">生成算法与使用说明</a></div></header>
<div class="bar"><div class="filters" role="group" aria-label="筛选样品"><button data-filter="all" aria-pressed="true">全部 10</button><button data-filter="house" aria-pressed="false">房屋 6</button><button data-filter="road" aria-pressed="false">道路 4</button></div><span class="hint">点击图片查看完整 1080p 实景 · 按编号提出修改即可</span></div><section class="grid">CARDS</section>
<footer>当前处于风格评审阶段，已检查原生模型导入、微格对齐、重复坐标和道路接口。房屋、道路预览拍摄于本地 Nature 场景；未更改线上世界或现有视频。地基支持轻微高差，较大坡地仍需施工前勘测和专门坡道设计。</footer></main>
<dialog><img alt="放大的样品"><div class="dialogbar"><span></span><button id="prev" aria-label="上一张">←</button><button id="next" aria-label="下一张">→</button><button id="close">关闭 · Esc</button></div></dialog>
<script>const assets=ASSETS;let active=0;const dialog=document.querySelector('dialog');function show(i){active=(i+assets.length)%assets.length;const a=assets[active];dialog.querySelector('img').src=a.id+'.png';dialog.querySelector('img').alt=a.name;dialog.querySelector('span').textContent=a.id.slice(0,2)+' / '+a.name;if(!dialog.open)dialog.showModal();}document.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>show(+b.dataset.index));document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b));document.querySelectorAll('.card').forEach(c=>c.hidden=b.dataset.filter!=='all'&&c.dataset.kind!==b.dataset.filter);});document.querySelector('#close').onclick=()=>dialog.close();document.querySelector('#prev').onclick=()=>show(active-1);document.querySelector('#next').onclick=()=>show(active+1);document.addEventListener('keydown',e=>{if(dialog.open&&e.key==='ArrowRight')show(active+1);if(dialog.open&&e.key==='ArrowLeft')show(active-1);});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});</script></html>'''
page=page.replace('六种房屋、四种道路。','六种房屋、四种道路、一套立交桥、六种树木和三种种植规则。')
page=page.replace('石基、木梁、瓦片、窗框、花箱和路沿均为真实的 0.125 米微格。','建筑、桥梁和树木均为真实的 0.125 米微格。')
page=page.replace('<a href="roads-overview.jpg">道路总览</a>','<a href="roads-overview.jpg">道路总览</a><a href="bridge-overview.jpg">立交桥</a><a href="trees-overview.jpg">树木总览</a><a href="planting-overview.jpg">种植规则</a>')
page=page.replace('全部 10','全部 '+str(len(assets))).replace('>道路 4</button>','>道路 4</button><button data-filter="bridge" aria-pressed="false">桥梁 2</button><button data-filter="tree" aria-pressed="false">树木 6</button><button data-filter="planting" aria-pressed="false">种植 3</button>')
page=page.replace('.filters{display:flex;gap:8px}', '.filters{display:flex;gap:8px;flex-wrap:wrap}').replace('.links{display:flex;gap:20px;', '.links{display:flex;gap:20px;flex-wrap:wrap;')
page=page.replace('房屋、道路预览拍摄于本地 Nature 场景；','所有预览拍摄于本地 Nature 场景；')
page=page.replace('地基支持轻微高差，较大坡地仍需施工前勘测和专门坡道设计。','桥梁已检查组合接缝、重叠和几何净空；种植已检查树冠间距及占地避让。车辆实测、坡地土方和机器人施工仍待风格确认后接入。')
page=page.replace("a.id.slice(0,2)+' / '+a.name", "(a.label||a.id.slice(0,2))+' / '+a.name")
page=page.replace('CARDS',''.join(cards)).replace('ASSETS',json.dumps(assets,ensure_ascii=False))
(root/'index.html').write_text(page)
print(root/'index.html')
