# 3D Printed Mini Gundam

独立 FFmpeg 剪辑子项目，沿用 `techno_showcase` 的成品开场、制作过程与成品收尾结构，配乐为巴赫《C 大调前奏曲》BWV 846 的本地钢琴演奏。横屏为 **88 秒 / 30 fps / 2640 帧**，竖屏为 **59 秒 / 30 fps / 1770 帧**：

- 横屏：`renders/3d-printed-mini-gundam-landscape.mp4`，**1920 × 1080 / 16:9**。
- 竖屏：`renders/3d-printed-mini-gundam-portrait.mp4`，**1080 × 1920 / 9:16**。

用户指定素材 `VID_20261016_104215.mp4` 实际位于 `~/Downloads/shipin/未命名文件夹 6/`，约 38 分 40 秒。同目录还提供 6 张 4032 × 3024 成品照片。本项目在 `sources/` 和 `sources/showcase/` 保存独立原始副本，保留文件内容。

## 59 秒竖屏精剪

竖屏通过 `portrait-edit.json` 从共享镜头中独立选取片段，保留每个动作原来的播放速度，缩短准备、重复按压和展示停顿。0–2 秒使用正面成品图；2–52 秒依次保留白模、关节、眼罩与头盔、胸甲、双臂、腿部贴纸。眼罩仍是一次最终按压与放开，没有恢复反复贴合的镜头。52–54 秒为成品角度照，54–56 秒为背面照，56–59 秒回到与片头相同的正面照。

钢琴配乐使用现有巴赫演奏的第 1–4、17–35 小节，按完整小节衔接，保留原有结尾终止式。前段轻微调整到约 94.25 BPM，第 56 秒落到最终 C 大调和弦，尾音在第 59 秒淡出。独立音频为 `audios/mini-gundam-bach-prelude-v5-portrait-59s.wav` / `.m4a`，横屏继续使用完整 88 秒配乐。原竖屏成片与配置备份在 `renders/revisions/before-59s-portrait/`。

## 横屏完整剪辑

第 0–2 秒用片尾最后一张正面照片 `PXL_20261016_153825015.jpg` 开场，横竖屏均沿用片尾同一素材和取景；第 2–4 秒展示白模和关节；随后依次保留颈部与肩部关节安装、绿色眼罩、蓝色额头、红色下巴、头部侧面和背面、胸甲、手臂条纹与袖口、腿部贴纸与边缘按压。严格在 **1:15 / 第 2250 帧** 切换到照片，后面全部改为 6 张成品图：第 75、77、79、81、83 秒依次切换前 5 张，每张 2 秒；第 85–88 秒使用正面照收尾。

照片顺序为 `PXL_20261016_153602993.jpg`、`153606850`、`153705569`、`153713206`、`153839081`（背面）和 `153825015`（正面）；缩写项沿用相同的 `PXL_20261016_` 前缀和 `.jpg` 后缀。前 75 秒的画面顺序、镜头速度与 11 秒附近的眼罩简化处理保留，最后一个实拍镜头缩短到第 75 秒结束。

两种尺寸共享原素材；竖屏在下述完整剪辑上独立缩短。横屏对局部操作适度放大；竖屏直接从原始横幅视频重新取景，逐镜头设置焦点，肩部关节与眼罩贴合镜头使用水平关键帧跟随动作。局部特写以正在安装的部件为中心。

横屏照片使用内置 `image_gen` 逐张扩展灰色背景与桌面，保持完整头脚、姿态、贴纸与手部，生成结果保存为 `assets/showcase/expanded/*-wide-v1.png`；按 16:9 等比例缩放铺满画幅，不留黑边。竖屏使用原始照片，逐张设置水平焦点，保留完整头脚与肩甲。照片均静止展示、直接硬切，不加缩放动画。`showcase-ai.json` 保存完整扩图提示词、工具模式、原图与扩图的相对路径、尺寸与 SHA-256。

镜头直接硬切，不叠加文案、字幕或标识。加速段不混入原片环境音，不添加旁白。两版分别使用与各自时间线匹配的 AAC 音轨。

## 新配乐：巴赫《C 大调前奏曲》BWV 846（v5 / 钢琴）

按用户希望“更有音乐美感、参考巴赫”的方向，使用巴赫《平均律键盘曲集》第一卷《C 大调前奏曲》BWV 846，重新渲染为 **88 秒的钢琴演奏**。完整保留乐谱的 35 小节、549 个音符，以连续琶音、清楚的低音线和自然的和声变化组织音乐。第 1–34 小节约 96 BPM，加入轻微的乐句强弱、触键时差与逐小节踏板；第 35 小节的主和弦对齐 **85 秒** 的最后一张照片，保留尾音并在最后 0.8 秒淡出。画面原有 120 BPM 时间网格与镜头长度保留。

乐谱和 MIDI 来自 [Mutopia Project，作品编号 5](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5)，该版标注为 Public Domain。`score_sources/bach-bwv846/` 保存完整 LilyPond 乐谱、MIDI、授权元数据和来源哈希。作曲者为 **Johann Sebastian Bach**；本项目制作演奏时值、力度、踏板和音频渲染，不将巴赫作品标注为本项目原创作曲。

钢琴音色使用 macOS 自带的 General MIDI 乐器库，通过 AVFoundation 离线演奏，再做轻微厅堂混响和响度归一化。没有导入第三方音乐录音；系统乐器库只从本机读取，不复制或重新分发。没有执行平台上传检测。母带目标为 -18 LUFS、-2 dBTP，横屏使用完整演奏，竖屏使用上述短版乐句。

- `audios/mini-gundam-bach-prelude-v5.wav`：48 kHz 双声道无损音轨。
- `audios/mini-gundam-bach-prelude-v5.m4a`：横屏成片使用的 192 kbps AAC 配乐。
- `audios/mini-gundam-bach-prelude-v5.json`：作品署名、来源、音符、踏板、演奏速度及依赖文件哈希。
- `score_sources/bach-bwv846/source.json`：下载链接、版本、授权标注与源文件 SHA-256。

上一个科幻电子版本保存在 `renders/revisions/before-baroque-v5/`；其中 `video-stream-hashes.json` 保存视频流指纹。更早的 8-bit、木琴拨弦和电子配乐分别保存在 `before-scifi-v4/`、`before-8bit-v3/` 和 `before-music-v2/`。

第 10–12 秒的眼罩镜头仅保留原片第 157.5–160.5 秒的一次最终按压与放开，省去反复揭起、移动和重新对齐的过程。修改前的 90 秒成片、配置、清单和配乐保存在 `renders/revisions/before-visor-simplify/`。

替换照片前的 88 秒版本、配置、清单和配乐保存在 `renders/revisions/before-photo-ending/`。

## 生成

需要 FFmpeg / FFprobe、Python 3 和 Pillow；本版钢琴渲染还使用 macOS 的 Swift、AVFoundation 与系统 General MIDI 乐器库。npm 仅用于命令别名，不需要安装 Node 依赖。乐谱已保存在项目中，重新生成不需要访问网络。

```bash
npm run review             # 横竖屏取景预览
npm run render             # 生成两个版本
npm run render:landscape   # 只生成横屏
npm run render:portrait    # 只生成竖屏
npm run check              # 检查两个成片
```

- `portrait-edit.json` / `portrait_edit.py`：59 秒竖屏的镜头内裁剪、成品图选择与钢琴乐句拼接。
- `edit.json`：原片路径、全部镜头、静帧时间点、变速时长、照片顺序与时长、横竖裁切与配乐分段。
- `build_video.py`：取景预览、逐镜头缓存、精确变速、BT.709 颜色转换、音乐生成与两个成片的封装。
- `build_soundtrack.py`：读取巴赫 MIDI 乐谱，安排演奏速度、力度与踏板，调用钢琴渲染并归一化响度。
- `render_piano.swift`：使用 AVFoundation 与系统乐器库逐事件离线渲染钢琴。
- `score_sources/bach-bwv846/`：公开乐谱、MIDI、授权和来源记录；这些小型源文件保留在版本控制中。
- `check_media.py`：检查源文件、照片、扩图、配置和音乐哈希、横屏 1:15／竖屏 0:52 照片切入点、时间线、尺寸、帧率、完整帧数、音视频起点与覆盖、各版对应的 AAC 音频，以及完整解码。
- `showcase-ai.json`：内置 `image_gen` 模式、完整扩图提示词、原图与扩图路径、尺寸和哈希。
- `inspect_source.py`：按时间码抽帧并生成原片选片联系表。
- `review/`：原片筛选、横竖屏取景与成片检查图片。
- `audios/`：无损 WAV、AAC 配乐与生成缓存。
- `renders/work/`：逐镜头转码缓存；调整单个镜头时只重新处理受影响片段。
- `renders/landscape-manifest.json`、`renders/portrait-manifest.json`：各版镜头起点、原片入出点、裁切与关键帧、帧数、音乐信息和 SHA-256。

修改画质、颜色转换或编码方法时，递增 `build_video.py` 的 `RENDER_VERSION` 以使旧编码缓存失效。原片、原图、AI 扩图、音频、预览、缓存、生成清单和导出视频均由本项目 `.gitignore` 排除；版本控制保存脚本、配置、AI 提示词清单、说明文档以及本版公开乐谱和 MIDI 源文件。重新检出后，将指定原片恢复到 `sources/VID_20261016_104215.mp4`，恢复 `sources/showcase/` 和 `assets/showcase/expanded/` 中的图片，再运行生成命令。构建只读取已保存的扩图，不自动重新调用 AI。
