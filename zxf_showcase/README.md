# ZXF Showcase

参考 `../techno_showcase/` 的独立 FFmpeg 视频项目：原型图与成品照作为一组居中开场、整体左移且原型图渐隐、居中实拍贴皮、按音乐节拍硬切、最终组装与成品收尾。全屏铺满，无叠加文字、边框、模糊背景、旁白或原片环境音。

| 版本 | 输出 | 分辨率 | 时长 | 镜头 |
| --- | --- | --- | --- | --- |
| 横屏 | `renders/zxf-showcase.mp4` | 1920 × 1080 / 30 fps | 98.667 秒 | 34 |
| 竖屏 | `renders/zxf-showcase-portrait.mp4` | 1080 × 1920 / 30 fps | 64 秒 | 25 |

源素材来自 `~/Downloads/shipin/zxf/VID_20261028_155752.mp4`，时长约 31 分 51 秒，已独立复制到 `sources/`。新增的 11 张照片已独立复制到 `sources/photos/`；本次从中选用 4 张，替换旧的首尾视频静帧。

## Night Sky Hip Hop 配乐

2026-10-29 按用户选择，使用 **Michael Ramir C. — Night Sky Hip Hop**，来自 [Mixkit 官方曲目页](https://mixkit.co/free-stock-music/)。原始 MP3 为 256 kbps，长 257.143 秒，保存为 `sources/music-candidates/night-sky-hip-hop.mp3`。

该曲采用 [Mixkit Stock Music Free License](https://mixkit.co/license/modal/musicFree/)，允许免费用于商业／非商业网络视频、社交媒体帖子和网络广告，无需署名。它是有免费授权的音乐，不是公版曲目；不适用于电视／广播、CD／DVD、电子游戏或单独分发音乐等许可外用途。`music-source.json` 保存具体音源、下载链接、SHA-256 和授权范围；`licenses/mixkit-music-free.html` 留存本次取得的官方音乐许可。曲目页及免署名说明的原始页面保存在 `sources/music-candidates/`。

两版从原曲 **24.032653 秒（检测节拍 36）** 开始连续播放，不拼接、不变速、不变调。按约 90 BPM 的实测节拍重新剪辑：横屏 148 拍，竖屏 96 拍，开场主图 6 拍，其余图片和操作镜头主要按 2、4、8 拍切换。每个切点吸附到最接近的 30 fps 视频帧，误差不超过半帧。`music-beats.json` 保存实际录音的节拍位置。

混音目标 -18 LUFS，真峰值目标 -1.5 dBTP，片尾淡出 2 秒；原片环境音不混入。两版完整配乐分别为 `audios/zxf-landscape-instrumental.wav`、`audios/zxf-portrait-instrumental.wav`，重采样后按确切样本数补齐／截断，覆盖成片全部视频帧。

## 新增照片

从 11 张原图选出 4 张，保留原始尺寸 4096 × 3072 的源文件。按用户要求用内置 image_gen 调整角色居中，并延展原有灰色摄影背景；生成的横幅照片保存在 `assets/photos-centered/`。提示词要求保留姿势、视角、眼镜、绿棕像素纹理、手工纸边与脚座。双版分别裁切，完整保留头部、双臂和双脚，等比例缩放。原图与生成图映射、哈希、裁切保存在 `photo-selection.json`；完整提示词保存在 `prompts/center-photos.json`。

| 原图 | 用途 |
| --- | --- |
| `IMG_20261029_101756.jpg` | 正面偏侧主图，开场及片尾，保留全身 |
| `IMG_20261029_101813.jpg` | 横屏开场背面角度，补充衣服与肩部结构 |
| `IMG_20261029_101748.jpg` | 开场正面全身，突出眼镜与绿棕拼色 |
| `IMG_20261029_101824.jpg` | 片尾俯拍侧前方，展示立体造型 |

横屏：3 个照片镜头开场 8 秒，29 个制作／组装镜头 82.667 秒，2 个照片镜头收尾 8 秒。共使用 4 张不同成品照片，主图首尾重复。

竖屏：2 个照片镜头开场 5.333 秒，21 个制作／组装镜头 53.333 秒，2 个照片镜头收尾 5.333 秒。共使用 3 张不同成品照片，省去背面开场图，缩短重复操作。

第一张图持续 4 秒：`sources/photos/zxf4.jpeg` 原样置于角色左侧，按参考图和角色可见轮廓的合并范围整体居中，前 2 秒停留。2–3.333 秒两者同步向左平移，参考图同时渐隐，角色停在画面正中，保持至第 4 秒切点。两层共用同一个位移表达式，整个过程保持相对间距；运动起止对齐开场后的第 3、5 拍，位置采用平滑缓动。横屏参考图宽 760 像素（较上一版增加约 46%），组合整体左移 428 像素；竖屏参考图宽 480 像素（增加 50%），首图按约 67% 等比呈现以容纳更大的并排对比，组合整体左移 256 像素。灰色照片边缘平滑延展填满画布，上下边缘分段延展以避免反射出角色，不增加边框或模糊背景。对比图的完整内容、比例与自带标记保留。

此次居中与对比修改前的成片、混音与配置备份于 `renders/revisions/before-centered-comparison-20261029/`。

改为组合居中与同步左移前的版本备份于 `renders/revisions/before-group-centered-opening-20261029/`。

放大首屏参考图前的版本备份于 `renders/revisions/before-larger-reference-20261029/`。

更换前的自编配交响版本、配置和成片备份于 `renders/revisions/before-night-sky-photos-20261029/`。更早的 litterzy 与去人声版本分别保存在 `before-own-orchestra-20261029/` 和 `before-symphonic-20261029/`。

## 剪辑与画面

按头部、眼镜、发型、躯干、棕色四肢、绿色四肢、最终组装的实际操作顺序剪辑。横屏保留更多收边细节，竖屏减少重复步骤并缩短单镜头源区间。双臂、双腿连接与成品展示留出更长观看时间。制作视频的源片区间与构图沿用已选镜头，并按新节奏调整时长；首尾改为本次挑选的照片。

竖屏直接从原片制作，每镜头独立裁切，主要选区 594 × 1056；照片裁切使用生成图中的居中区域。安装特写以当前部件和连接处为中心，照片和成品镜头保留全身。画面等比例缩放。原片全范围 BT.601 转为有限范围 BT.709，H.264 CRF 16，音轨 AAC 256 kbps / 48 kHz / 立体声。

## 调整与重新导出

```bash
cd entropydrop_media/zxf_showcase
npm run render
npm run check
npm run review
# 或分别导出
npm run render:landscape
npm run render:portrait
```

`edit.json` 保存源片入出点、两版拍数、裁切窗口和音乐混音设置。`beats` 的两个值依次为横屏／竖屏拍数，0 表示该版本省略镜头；`portraitIn` / `portraitOut` 可为竖屏单独精简动作。`music.formats` 可指定各版本独立配乐。修改后运行 `npm run render`；未改变的镜头会复用缓存。

`renders/*-manifest.json` 记录逐镜头帧数、速度、音乐位置、源片／原图映射、生成照片及对比图的哈希、动画时间与切点误差。对比图哈希参与镜头缓存，替换后会重新渲染。拼接采用精确的逐段帧时长，避免 MP4 容器毫秒时长四舍五入导致的累计偏差。审片联系表会抽取真实的开场动画状态。

渲染需要 FFmpeg / FFprobe 和 Python 3；生成取景联系表需要 Pillow。恢复音乐与重新测量节拍：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run audio:prepare
# 仅需重新分析录音时运行
npm run audio:analyze
```

`prepare_audio.py` 校验选定 MP3；文件缺失时从官方地址下载，并核对 SHA-256。普通渲染与校验完全使用本地素材，不需要乐器采样器、Swift、人声分离或音乐生成模型。旧的编配脚本与 `score/` 仅作历史记录，不属于当前构建流程。

`check_media.py` 检查两版分辨率、恒定 30 fps、准确帧数、视频／照片源文件与配置哈希、音频从零覆盖全片、切点误差、响度／真峰值，并全片解码。结果写入 `renders/validation.json`。

Git 保存脚本、配置、照片选择、图像编辑提示词、音乐来源／节拍表、许可记录与文档。原片、原图、生成照片、音频、导出、审片图、生成分谱／MIDI／转录数据、模型缓存和 Python 环境只保留在本地；重新检出后需恢复视频及照片源文件和 `assets/photos-centered/`，并运行 `npm run audio:prepare` 恢复所选配乐。渲染会自动创建音频与视频输出目录。
