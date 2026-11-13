Space 三地图 Vlog · 固定模块化工程

今后始终使用本目录。目录名中的 r3 是沿用旧名称，不再创建 r4/r5 或整份项目副本。
当前中英文已按确认内容同步：英文13分11.27秒，中文13分21.57秒；1080p30、entropydrop配音，成片无内嵌字幕。中文版另有独立SRT/VTT字幕。原R3只作为保留基线。

先看这里
模块预览.html：在浏览器打开，选择23个模块，独立播放带英文旁白的预览。
模块目录.txt：中文内容、模块编号、全片时间和时长。
exports/space_three_worlds_latest.mp4：今后始终更新的当前成片。
exports/space_three_worlds_agent_build_1080p_en_r3.mp4：这次模块化前的保留基线。
project.json：章节顺序、1080p输出、声音设置、TTS服务和固定导出路径。
current-timeline.json、current-chapters.txt：当前模块化导出的时间线；旧 timeline.json/narration.json/chapters.txt 是 R3 参考快照。

以后直接这样告诉我
“只修改22号：空中环顾镜头再慢一点，其他片段保持。”
“重录07号的勺子操作，配音沿用现有版本，先给我看这一段。”
“16号越野车倒车多停两秒，更新文案和配音，再组合全片。”
“把21和22号合成后的版本给我，其余不用重录。”
无需你亲自改配置；编号、片段内容或全片时间码都可以定位。

每个模块
modules/<ID>/module.json：名称、镜头来源、入点、出点、剪辑锚点与变速方式。
modules/<ID>/script.en.txt：本段英文文案，空行分隔段落。
modules/<ID>/voice.json：每段文案对应的音频文件与校验值。
modules/<ID>/video.mp4：当前画面缓存，无音轨。
modules/<ID>/voice.wav：按文案时序拼好的旁白。
modules/<ID>/preview.mp4：本段独立预览，带标准化旁白，无背景音乐。
新生成的配音保存在同一模块的 audio/，只保留小型音频文件，不复制整套工程。
源视频沿用 footage/，静态画面沿用 stills/。补录可使用固定名字 footage/replacements/<ID>.mp4，并在对应模块中引用。

常用命令（先进入本项目目录；依赖 Python3、numpy、ffmpeg、ffprobe）
python3 scripts/video.py list
python3 scripts/video.py status
python3 scripts/video.py build 22_drone_flight_b
python3 scripts/video.py tts 22_drone_flight_b
python3 scripts/video.py assemble
python3 scripts/video.py check --full

标准修改流程
1. 修改目标模块的文案或镜头配置；补录只保存相关素材。
2. 只有文案或声音设置变化时才运行 tts <ID>，只生成受影响段落。TTS仍使用192.168.0.10:8008上的entropydrop音色。
3. build <ID> 生成该模块预览，检查后运行 assemble。assemble 会自动更新所有真正过期的模块及其依赖，再重新封装全片；不重复编码未变化的画面。
4. check --full 检查模块时长、帧数、当前缓存、全片解码；随后回看改动段和衔接。继续使用原目录和固定 latest 文件名。

剪辑配置约定
source 是相对于工程根目录的文件路径；module:<ID> 表示引用另一个模块的当前画面。结尾23号引用10、17、22号，因此改动相关模块后，结尾会自动更新。
in/out 是源素材秒数。out=auto 按需要的长度截取。
end_at=end 延续到本模块配音结束；voice:2 对齐第二段旁白起点；数字表示本模块内的秒数。
mode=realtime 保持真实运动速度，不允许偷偷拉伸物理演示；mode=fit 是明确允许的画面变速。
旁白变长而素材不足、文案与旁白文本不匹配、依赖成环、素材损坏，均报错；不会用静止尾帧掩盖问题或覆盖已有正常成片。
英文文案变化后若未生成对应配音，build/assemble 会提示先运行 tts，避免画面更新而仍播放旧文案。

增量与保留
使用文件内容哈希，不靠“文件已存在”判断是否完成；同时校验输出，损坏或被外部修改的缓存会重建。
输出先写临时文件，成功后原子替换。初次迁移复用了R3视频数据，后续替换不会破坏原基线。
cache/ 仅存构建状态和全片混音；不按修改次数新建工程文件夹。不要手动覆盖或修改 R3 参考成片。
旧 scripts/generate_audio.py、qa_revision.py、review_video.py 等仅用于原R3快照。当前入口统一为 scripts/video.py；assemble_revision.py 已兼容转发到新入口。
回归检查：scripts/test_video_pipeline.py 使用临时小型测试素材，验证局部重建、依赖更新、配音变化、错误时保留成片，不改真实镜头。
review/modular-migration.json、modular-check.json、modular-incremental-tests.json 记录本次迁移与测试。

整篇文案更新
voiceover.en.txt 是完整作者稿。本次保持全部原文措辞，标题只用作章节名、不念出、不加字幕。
若直接修改完整作者稿，先运行 python3 scripts/import_voiceover.py，将23个标题段导入现有模块，再对变更模块运行 tts、assemble。若只改模块 script.en.txt，无需重新导入整篇稿。
module.json 的 tts_seeds 可覆盖个别段落的合成种子；tts_segments 可按原词序拆分难以稳定合成的长句。导入变更文案时会清理不再匹配的分段设置。
本次新增素材：footage/replacements/02-aether-full-ring.mp4、17-rover-terrain.mp4、22-drone-orbit.mp4。原地形未编辑，第三人称FOV为75度。
当前质量报告：review/current-qa.json、review/modular-check.json、review/current-voice-asr.json；当前画面逐段检视图：review/current-contact-sheets/。语音识别为本地自动核对，不等同人工听审。

本次局部修订：02号空岛环顾等待全部128个远景分区及几何生成稳定后重新录制，录制期间没有新增LOD发布或加载；05、12号配音去掉对prompt末尾放置、校验约束的专门强调。相关证明见review/current-02-aether-full-ring.json、current-prompt-revision.json。

提示词画面修订：05、12、19号使用stills/下固定命名的新卡片，三个prompt末尾的选址、地形和编译校验段落已整段删除。提示词源文件为scripts/space-source/prompts.json。配音和总时长未在这次画面修订中改变。

当前选用视频封面：stills/youtube-thumbnail-aether.png，来自用户Downloads/space_world_aether.png，上下各裁14像素为1920×1080。旧生成封面仅作备选保留。

中文配音版本与双语编辑

中文版本使用同一工程和相同模块时间码，允许独立修改中文镜头，不另建项目目录。英文成片保持原文件。
exports/space_three_worlds_zh_latest.mp4：中文配音成片，1920×1080、30fps，无字幕。
双语模块预览.html：在原有23个模块之间切换，也可切换中英文配音。
voiceover.zh.txt：完整中文稿，标题使用 [模块ID] 开头，空行分段；标题不配音。
modules/<ID>/script.zh.txt：本模块中文稿，段落与现有英文讲解节点一一对应。
modules/<ID>/voice.zh.json、audio/zh/：中文原始旁白及内容校验。
modules/<ID>/voice.zh.wav、preview.zh.mp4：对齐后的中文旁白及独立预览。
current-timeline.zh.json：中文语音时间表，包含各段原始时长和保音高语速调整值。

修改整篇中文稿后：python3 scripts/dub.py import
只为目标模块生成中文语音：python3 scripts/dub.py tts 22_drone_flight_b
仅更新中文模块预览：python3 scripts/dub.py build 22_drone_flight_b
组合中文版并刷新双语预览页：python3 scripts/dub.py assemble
全片校验：python3 scripts/dub.py check --full
查看语音时长匹配：python3 scripts/dub.py timing
需要首次全量生成时，tts/build 支持 --all；平时指定模块即可，仅变化段落会重配。

中文沿用局域网 qwen3-tts 服务与 entropydrop 音色，language=Chinese。
中文旁白按现有段落边界对齐，未修改画面直接复用；镜头替换也不改变车辆或无人机运动速度。允许有限的保音高语速调整；超过范围时报错，需改写该中文段落或调整 seeds 后重配，不会截掉正文或延长静止画面。
modules/<ID>/dub.zh.json 可选配置：{"seeds":{"1":43}}，只影响该模块第一段中文 TTS。
仅修改中文画面时，创建或编辑 modules/<ID>/module.zh.json，字段与 module.json 相同。scripts/dub.py build / assemble 会生成 video.zh.mp4 并自动更新中文依赖蒙太奇，不修改英文视频。确认后才同步到英文流程。
review/modular-check.zh.json 记录全片解码、帧数、语言、无字幕、视频与中文模块合成一致性、英文冻结文件校验。
review/current-voice-asr.zh.json 是本地中文语音识别核对，包含转写与原稿差异，不等同人工听审。
review/voiceover.zh.before-dub.txt 保留本次配音前的旧中文稿；当前稿已同步删除过时的 prompt 末段。

中文版本交付记录

已完成23个模块、70段中文旁白，13分18秒。当前中文修订包括首屏匀速滚动、AI/玩法设计理念和无人机快速跟随；英文主片与英文模块未更改，等待用户确认。
质量报告：review/current-qa.zh.json（音量约-16 LUFS、最长无旁白间隔0.85秒）、review/modular-check.zh.json（整片解码、中文模块一致性和英文冻结检查）。
中文发音采用本地 small 语音识别及普通话术语提示核对，保留多次转写；同音字按音节辅助比较，不等同人工连续听审。
少数难稳定合成的句子通过 dub.zh.json 的 segments 按原文分句；segment_seeds 可为每一句指定种子，缓存成功的分句后只重试未完成的部分。
临时语音识别模型已清理以节省空间，配音源文件、文案、模块预览与检查报告均保留。再次进行语音识别检查时，临时环境需安装 faster-whisper、opencc-python-reimplemented、pypinyin。

局部语音修复：11号 Nature 开场第一段已改为自然中文连读，直接保留原声语速。仅占用句末原有停顿的0.24秒，后续段落和画面时间码不变。试听：review/nature-voice-fixed.zh.wav；核对记录：review/nature-voice-repair.zh.json。
可选 duration_overrides（按段落编号，单位秒）允许中文语音使用原有句末停顿，例如 {"duration_overrides":{"1":5.71}}；不会移动下一句起点，越界或重叠会被拒绝。语速为1时直接复制原始音频样本，避免不必要的处理。

背包与市场（中文独立新增模块）

24_backpack_market：背包、轮胎与旋翼模块复用、真实市场下载与发布说明、静态建筑分享。新增约61秒，位于22号与23号总结之间。
project.zh.json 独立控制中文版顺序；英文 project.json 不变。新增中文模块只需 module.zh.json、script.zh.txt、title.zh.json 和 voice.zh.json，按中文原声自然时长剪辑。原有共享模块继续使用既有英文时间锚点，包括11号已修复的连读。
python3 scripts/dub.py tts 24_backpack_market
python3 scripts/dub.py build 24_backpack_market
python3 scripts/dub.py assemble
python3 scripts/dub.py check --full
双语预览页会在英文模式禁用仅中文存在的模块。所有新增素材继续放在原有 footage/replacements/ 下，不新建修订工程目录。
市场片段来自实际线上界面，演示下载到背包；发布确认框只作介绍，没有提交发布。轮胎和旋翼是现有载具的真实组件，静态小屋为本次本地演示素材，原地形未修改。

当前中文版：24个模块、75段旁白，总长14分19秒。新增24号从12:37到13:38，随后进入原总结。其余23个中文模块预览和旁白校验值完全不变，143个英文冻结文件检查通过。详见模块目录.zh.txt、review/backpack-market.zh.json。

越野车涂装修剪

中文版删除14_rover_light_a、15_rover_light_b两个车灯改色模块及对应旁白，13号悬挂讲解直接接16号前进/倒车测试；17号转向测试和20号无人机改色演示保留。project.zh.json 的 excluded 显式列出两个跳过模块，原模块素材保留，便于恢复或后续同步英文。中文完整稿已移除对应章节。双语模块预览页按当前语言显示各自的有效顺序。

当前删减版：22个有效模块、69段中文旁白，总长13分20.5秒。07:57.8处悬挂讲解接驾驶测试，背包与市场移至11:38.67，12:39.63接原总结。全片解码与声音检查通过；143个英文冻结文件未变。详见review/rover-paint-removal.zh.json。

2026-11-04 中文市场风车替换
24_backpack_market 中的小屋已替换为中世纪风车，并补录背包、轮胎、旋翼和风车镜头。中文第 5 段只把“一栋小屋”改成“一座风车”，重生成 12.56 秒旁白，其他模块与英文版保持不变。
风车展示：12:26.72–12:39.63。快速预览：review/windmill-preview.zh.mp4；完整成片仍是 exports/space_three_worlds_zh_latest.mp4。
可复用素材：models/medieval-windmill.pb（可导入背包），models/medieval-windmill.json；生成与场景脚本位于 scripts/space-source。未向公开市场提交作品。
校验：review/windmill-replacement.zh.json、review/modular-check.zh.json、review/current-qa.zh.json。全片 1080p30、无字幕，13:20.5；143 个冻结英文文件均未修改。

2026-11-04 风车结尾与总结衔接配音修复
“回顾这次旅程”之前的24号第5段原文保持不变，整段更换TTS种子为47，原始语音13.63秒，不变速。分句试音未通过核对，没有进入成片。
现有风车环绕自然延长约1.07秒，总结现在从12:40.70开始；全片13:21.57。其余21个中文模块、其余68段原声和143个英文冻结文件均未更改。
试听：review/closing-join-fixed.zh.mp3；风车短预览也已更新。详见review/closing-join-repair.zh.json；无原文提示的本地语音核对、衔接核对、全片解码和音频检查通过。

2026-11-04 已确认中文版同步至英文
已同步开场匀速滚动、空岛AI与目标驱动设计理念、真实大圈飞行与无人机跟随、删除越野车车灯改色、新增背包/市场/组件复用及中世纪风车。英文仍使用entropydrop音色，不变速处理物理演示。两种语言现在均为22个有效模块；共重生成13段英文旁白，复用56段原声，6个画面模块更新。
英文成片仍为 exports/space_three_worlds_latest.mp4（13:11.27）；中文版原文件校验值保持不变。双语模块预览.html 已更新，两种语言可继续独立局部修改。
中文独立时间锚点位于 modules/<id>/timing.zh.json，画面配置/缓存为module.zh.json与video.zh.mp4；24号中文采用原声自然时长。英文改稿不再联动改变中文版时长，完整依赖关系仍保留。旧English冻结清单仅为审核阶段历史记录，用户现已授权同步。
检查记录：review/english-sync.json、review/current-qa.json、review/modular-check.json、review/english-sync-timing.json。新英文全文：voiceover.en.txt。源码与原始录制素材继续共享，不另建工程文件夹。

2026-11-04 独立中文字幕
exports/space_three_worlds_zh_latest.srt：适用于YouTube、播放器和剪辑软件的UTF-8中文字幕。
exports/space_three_worlds_zh_latest.vtt：相同内容与时间码的WebVTT版本。
字幕匹配当前13:21.57中文版，覆盖22个有效模块、69段已确认旁白，共219条；最多两行。使用已确认中文原稿，按实际拼接及变速后的voice.zh.wav逐词对齐，不用语音识别结果替换正文。两种成片均未修改，没有烧录字幕。
modules/<id>/subtitles.zh.srt、subtitles.zh.vtt：模块内从零开始的局部时间码。
modules/<id>/subtitles.zh.alignment.json：按段落文本与实际PCM内容哈希缓存的逐词对齐及中文分词边界。
更新方法：先按原流程完成中文assemble，再运行 python3 scripts/subtitles_zh.py。只改模块顺序或字幕断句时复用已有对齐缓存；文案与timeline不一致会停止，避免给旧成片错误配字。
变更旁白需在所用Python环境安装faster-whisper==1.2.1、numpy、scipy、jieba==0.42.1，自动只对齐变化段落。可用--model-cache指定模型缓存目录。全部段落已有缓存时只需Python3和ffprobe。
检查报告：review/subtitles.zh.json，含成片哈希、字幕哈希、全文覆盖、非重叠时间码、阅读速度和SRT/VTT实际解析校验。临时模型和环境在交付后清理，工程中的小型对齐缓存永久保留。字幕和视频继续使用原工程与固定文件名。

2026-11-04 视频作品发布线上市场
用户确认按AGPL-3.0-only发布四件完整作品，发布账号Husky。控制脚本和组件结构保留；越野车与跟随无人机的发布包启用了录制时暂停的脚本，原视频模型与素材未更改。
AETHER 47 | Chinook Transport Helicopter：YM16NPQ6XZ5BV4T5
NATURE TRAIL | Independent Suspension Rover：C9JGB892NDCFUHET
COPPER SCOUT | Player-Following Quadcopter：GF9N14CS222M37V7
OAK & STONE | Medieval Windmill：X2YJKDHYLBZCJVFV
发布包为models/market-{chinook,rover,drone,windmill}.pb。准备脚本留存在scripts/space-source/prepare-market.ts（复用时放回Space工作区.local/vlog-three-worlds/运行，其相对导入指向工作区engine/client源码）。
review/market-publication.json记录线上ID、公共下载地址和核验结果；review/market-publication-receipts.json为发布回执，review/market-publication-preflight.json为格式与脚本编译校验。四件作品均出现在公开市场，未登录下载均返回200，SHA-256与本地发布包完全一致。以后更新前先核对这些ID，避免重复发布。
