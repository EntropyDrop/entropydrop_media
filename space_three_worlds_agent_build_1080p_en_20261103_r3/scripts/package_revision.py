import json,os,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1]
old=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_three_worlds_agent_build_1080p_en_20261103')
t=json.loads((R/'timeline.json').read_text());reused=R/'footage/reused';reused.mkdir(exist_ok=True)
for c in t['chapters']:
 for e in c['edits']:
  p=Path(e['file'])
  if p.is_relative_to(old):
   dst=reused/p.name
   if not dst.exists():os.link(p,dst)
   e['file']=str(dst.relative_to(R))
  else:e['file']=str(p.relative_to(R))
(R/'timeline.json').write_text(json.dumps(t,indent=2))
ambient=R/'audios/ambient_original.wav'
if not ambient.exists():os.link(old/'audios/ambient_original.wav',ambient)
p=R/'scripts/assemble_revision.py';s=p.read_text().replace("def old(n):return OLD/'footage'/f'{n}.mp4'","def old(n):return R/'footage/reused'/f'{n}.mp4'").replace("ambient=OLD/'audios/ambient_original.wav'","ambient=R/'audios/ambient_original.wav'");p.write_text(s)
# Keep unchanged baseline receipts and references with the revised models.
for name in ['chinook','rover','drone']:
 for suffix in ['-create-receipt.json','-create-request.json']:
  p=old/'models'/(name+suffix)
  if p.exists() and not (R/'models'/p.name).exists():shutil.copy2(p,R/'models'/p.name)
repo=Path('/Users/ha/Documents/entropydrop_website/entropydrop_space')
(R/'scripts/vlog-chinook-r04').mkdir(exist_ok=True)
shutil.copy2(repo/'.local/vlog-chinook-r04/model.ts',R/'scripts/vlog-chinook-r04/model.ts')
q=json.loads((R/'review/qa-summary.json').read_text());duration=t['duration'];minutes=int(duration//60);seconds=round(duration%60)
text=f'''Space 三地图开发 Vlog · 第二版

成片：exports/space_three_worlds_agent_build_1080p_en_r2.mp4
时长：{minutes} 分 {seconds:02d} 秒；1920×1080 / 30fps；英文 entropydrop TTS，无字幕。

本次修改
1. 越野车：修正本地负 Z 前进方向对应的轮轴旋转符号。补录前进、刹停、倒车测试；原地前轮左转、回正、右转、回正；行驶中的左右转弯和刹停。后轮不参与转向。
2. 四旋翼：读取真实角色的 feetPosition 和 velocity，在其上方、侧后方保持偏移；通过局部上向推力和姿态力矩追踪。角色停止时悬停；目标消失时保持最后目标。两段测试均使用标准角色第三人称镜头，慢步行走、横移、返回和停步都由角色物理输入产生。
3. 声音：新增游览、飞行和行为测试的英文讲解，去掉原版按画面长度拉长的配音空档，按语音重新剪辑等待和重复展示。全片最长接近静音的语音间隔为 {q['audio']['maximum_near_silent_voice_interval_seconds']:.2f} 秒。驾驶与无人机测试保留原速；部分工具展示、静态检查和地图游览按旁白调整时长，剪辑速度记录在 timeline.json。

内容与目录
保持原有 Space intro → Agent Build / 工具栏 → Aether 支奴干 → Nature 悬挂越野车 / 单侧车灯改色 → Copper 四旋翼的结构。三张地图保留环视镜头。
exports/ 最终视频；footage/ 新录屏；footage/reused/ 复用的上一版源片；footage/outtakes/ 未采用的机位试录。
audios/ 配音原始片段、逐章 WAV、完整时间线及混音；voiceover.en.txt 和 narration.json 为新版英文稿。
models/ JSON、可导入 EDPB、控制器源码、在线更新请求与回执；*-refined.edpb 为手动改色后的完整模型。
review/ 物理测试、实际录制遥测、全片每两秒截图和技术音轨检查报告。
scripts/ 剪辑、音频、检查及生成源码；TypeScript helpers 的相对导入基于 Space 仓库 .local/vlog-three-worlds，依赖同仓库 engine/client。vlog-chinook-r04/model.ts 是复用的支奴干模型生成器。
timeline.json 给出每段源文件、裁切、播放速度、旁白位置。chapters.txt 为章节定位。

回看与验证
全部 23 章按时间顺序检查每 2 秒画面，并在补录时检查原生 1080p 的车轮和角色跟随；整片解码通过。车轮测试验证前进/倒车接地点方向、左/右/回正、后轮不转向，以及轮子滚动时转向轴保持正确；跟随测试验证移动、停步、目标丢失和倾角。
实际录制无脚本错误，地形写入为零，FOV 始终 75 度。完整环形地形 128/128 分区加载后录制。四旋翼最大实录倾角约 7.65 度。
音频通过有效波形、{q['audio']['checked_tts_chunks']} 个原始片段哈希、完整解码、静音间隔和响度检查；未作独立人工听审。最终响度 {q['audio']['loudness']['input_i']} LUFS，真峰值 {q['audio']['loudness']['input_tp']} dBFS。

开发录屏与线上实体
游戏画面录自本地开发客户端，最高画质，包含前次完整环形加载、Spoon 灰色 STD 框及固定 FOV 修复。原有真实线上 intro 和 Agent Build 说明镜头保留。
越野车 25dd5778-8ea1-4f93-92aa-02f0af0fcbe9（Nature）与四旋翼 4a23309f-1a48-4640-9af1-1e6ca195c0e2（Copper）的控制器已通过原授权连接更新到 revision 2，并读回验证；均保持 stopped。模型外观的手工修补以本地 refined 导出为准。
这些是简化刚体物理原型。跟随四旋翼没有自动避障，应在空旷处运行。偏移基于世界轴及起始朝向，并非随角色转身旋转的编队偏移。
提示词页面是教学请求展示；无伪造聊天或生成进度。原版成片保留。没有部署、发布或提交 Git。凭据不包含在素材中。
'''
(R/'README-请先读.txt').write_text(text)
print('PACKAGED',len(t['chapters']),minutes,seconds)
