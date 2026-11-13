# Rick and Morty Showcase

参考 `../techno_showcase/` 的全屏照片开场、制作过程卡点硬切、原创 120 BPM 电子配乐与纯成品照片收尾。两个角色各选 14 个镜头，去除长时间准备和重复操作；无旁白、烧录字幕、标题、进度条、转场特效或照片缩放动画。

| 版本 | 画幅 | 帧率 | 时长 | 导出 |
| --- | --- | --- | --- | --- |
| 横屏 | 1920 × 1080 / 16:9 | 30 fps | 94 秒 | `renders/rick-and-morty-showcase-landscape.mp4` |
| 竖屏 | 1080 × 1920 / 9:16 | 30 fps | 59 秒 | `renders/rick-and-morty-showcase-portrait.mp4` |

## 素材与剪辑

素材目录实际为 `~/Downloads/shipin/未命名文件夹 7/`。原始文件逐字节复制到 `sources/`，导入时校验 SHA-256；保留全部 11 张原照片及 EXIF，不修改下载目录。

- `VID_20261016_123013.mp4`：Rick，约 53 分 31 秒，1920 × 1080。
- `VID_20261020_145224.mp4`：Morty，约 31 分 51 秒，1920 × 1080。
- 首尾双人合照：`PXL_20261021_012201689.jpg`。
- 横屏 Rick 单人照：`PXL_20261016_122308891.jpg`。
- 横屏 Morty 单人照：`PXL_20261021_012224465.jpg`。

横屏第 0–6 秒依次展示双人、Rick、Morty 成品照；第 6–48 秒为 Rick 制作，第 48–90 秒为 Morty 制作；第 90–94 秒回到双人合照。每个角色保留白模、脸部、头发、上衣、袖口、裤腿、关节调整与完成展示。白模镜头使用原片第 0 秒的静帧。

竖屏第 0–2 秒展示双人合照；第 2–29 秒为 Rick，第 29–56 秒为 Morty；第 56–59 秒以同一张双人合照收尾。竖屏直接从原视频重新取景，逐镜头设置焦点，部分关节和转身镜头使用水平取景关键帧；缩短镜头时保持横屏版本的播放速度。

首尾双人合照使用内置 `image_gen`，以第二张 Rick 横屏照片为质感参考，统一灰色背景、柔光、白色高光、边缘清晰度与真实手工材质细节。横屏使用 `assets/showcase/duo-landscape-matched-v1.png`；竖屏在同一修图基础上适配 9:16，使用 `assets/showcase/duo-portrait-matched-v2.png`。两种画幅各自的开场与结尾共用同一修图，双人完整居中。

Rick 横屏照保存在 `assets/showcase/rick-landscape-v1.png`。横屏第 4–6 秒的 Morty 单人照经 AI 重渲染并居中，保存在 `assets/showcase/morty-landscape-centered-v1.png`。完整提示词、原图、风格与构图参考、生成图路径、尺寸及 SHA-256 保存于 `showcase-ai.json`，本次提示词另存于 `prompts/`。构建不调用图像生成服务，重新检出后需恢复 `edit.json` 引用的本地生成图片。

横屏第 15–18 秒替换为 Rick 原片第 867–873 秒的头部贴合后转动展示，避开揭起贴纸的返工动作。竖屏第 7.5–9.5 秒同步使用原片第 868–872 秒，并通过水平取景关键帧跟随头部。

两版配乐分别按自己的时间线合成，使用参考项目的振荡器、噪声与和声编排；切点落在 120 BPM 节拍上，片尾和弦收束并淡出。原始录像的环境声不混入成片。音频保存在 `audios/`，WAV 为 48 kHz 双声道，成片为 AAC 192 kbps。

## 构建与校验

需要 FFmpeg / FFprobe、Python 3，以及 Pillow、NumPy、SciPy。npm 仅提供命令别名，无需安装 Node 依赖。

```bash
cd entropydrop_media/rick_and_morty_showcase
npm run prepare
npm run review
npm run render
npm run check

# 单独重建一个画幅
npm run render:landscape
npm run render:portrait
```

`edit.json` 保存两段原片、每个镜头入出点、时长、横屏裁切、竖屏焦点与关键帧。`edit_timeline.py` 解析竖屏精简时间线。`prepare_assets.py` 导入本地素材；已有项目副本可脱离下载目录重建。

`build_video.py` 使用 H.264 CRF 16、yuv420p、BT.709 输出，正确转换原片全范围 BT.601 色彩。逐镜头缓存避免重复转码；最终通过直接复制视频流拼接。生成的两个 manifest 保存时间线、裁切参数、源素材哈希、图片哈希、音乐哈希和导出哈希。

`check_media.py` 校验素材与剪辑一致性、两个画幅、帧率、精确帧数（2820 / 1770）、完整音频覆盖、零起点、音乐一致性及全片音视频解码。`review/framing/` 为逐镜头开始、中间与结尾取景联系表；不会烧录进成片。

`inspect_source.py` 可继续抽样原片，例如：

```bash
python3 inspect_source.py --source sources/VID_20261020_145224.mp4 --start 1860 --end 1908 --step 2 --name morty-final-assembly
```

Git 保存脚本、剪辑配置、扩图提示词清单和说明。原片、原照片、扩图、音乐、导出、缓存和审片图片均留在本地并被忽略。
