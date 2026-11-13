当前入口：README-模块化工程.txt 与 模块预览.html。
本目录已成为固定模块化工程；今后局部修改直接更新 modules/，不再新建版本文件夹。
当前成片固定为 exports/space_three_worlds_latest.mp4。
下面的说明是模块化前 R3 基线记录，旧 timeline.json、narration.json 和R3检查报告继续保留作参考。

Space 三地图开发 Vlog · R3 完成版

成片：exports/space_three_worlds_agent_build_1080p_en_r3.mp4
规格：1920×1080，30 fps，12分47秒，英文 entropydrop TTS，AAC 48 kHz，无字幕。

本次修改
空岛七个游戏镜头重新录制：地形环顾、工具栏、支奴干检查、Spoon/Brush 修补、控制与登机、两段第三人称飞行。系统鼠标隐藏，游览时隐藏准星与第一人称手持工具；操作教学保留工具反馈。第一条被塔楼遮挡的飞行镜头已淘汰，改为岛外转向。
铜城两段无人机演示重新录制：角色由现有屋顶起飞约9.1米，向前移动、悬停；随后第三人称镜头转满360度，角色侧移并再次升高。无人机读取真实角色位置与速度，通过力和姿态力矩追踪，不是播放预设位置动画。FOV全程75度。
更新相关英文旁白与 Agent Build 请求画面，重新混音；保留 R2 越野车轮向修复、前进倒退和左右转向测试。

画面来源与限制
使用本地 Space 开发客户端、最高光照/阴影与原生1080p。新镜头近处地形429/429就绪，远景128/128分区从匹配的完整环形世界缓存装载；后台重新生成计数单独保存在录制状态中。没有新建平台，没有修改地形。本次没有改动线上实体或发布网站。无人机原型没有自动避障，旁白已说明。

验证
全部新镜头已按时间顺序逐章抽帧回看（每2秒一帧），并检查关键剪辑衔接；录制时查看原生1080p画面。全片解码通过；23章；72段TTS哈希通过；最长近静音旁白间隔0.76秒；综合响度-16.04 LUFS，真峰值-4.04 dBTP。没有进行人工全片听审。
review/qa-summary.json 是本版最终检查；review/recorded-test-summary.json 记录真实录制飞行、跟随和固定FOV；R2引用证据明确标注来源。

目录
footage/：新补录及保留素材；outtakes/内镜头未用于成片。
audios/：原始TTS、时间线旁白、混音及生成请求；narration.json、voiceover.en.txt：英文稿。
models/、scripts/space-source/、agent-prompts.en.txt：模型、控制逻辑与示例请求。
scripts/assemble_revision.py：从原始素材和音频重建；scripts/review_video.py：生成联系表；scripts/qa_revision.py：技术校验。
scripts/space-source/：供 Space 仓库本地开发环境使用的录制、模型与测试源文件。
timeline.json：逐章入点、出点、时长与配音时序；chapters.txt：时间码。
stills/：教学请求与补录证明画面；review/：联系表、回看记录和检验报告。

原版及R2成片保留；本目录是独立R3交付目录。
