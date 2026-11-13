# Bricking Bad Showcase

沿用 `../techno_showcase/` 与 `../rick_and_morty_showcase/` 的成品照开场、制作过程卡点硬切、120 BPM 电子配乐和成品照收尾。挑选脸部、眼镜、胡子、衣服、袖口、裤腿及关节连接等 22 个过程镜头，去掉等待与反复拆装。无旁白、字幕、标题、进度条、转场特效或照片缩放动画。

| 版本 | 画幅 | 帧率 | 时长 | 导出 |
| --- | --- | --- | --- | --- |
| 横屏 | 1920 × 1080 / 16:9 | 30 fps | 87 秒 | `renders/brickingbad-showcase-landscape.mp4` |
| 竖屏 | 1080 × 1920 / 9:16 | 30 fps | 59 秒 | `renders/brickingbad-showcase-portrait.mp4` |

## 素材与剪辑

素材目录实际为 `~/Downloads/shipin/未命名文件夹 9/`。原片 `VID_20261021_152118.mp4` 约 42 分钟，1920 × 1080、30 fps。原始录像及三张照片逐字节复制到项目 `sources/`，导入时校验 SHA-256；下载目录中的原文件不变。

- 正面成品照：`sources/showcase/PXL_20261021_191135915.jpg`。
- 两侧角度照：`sources/showcase/PXL_20261021_191206103.jpg`、`PXL_20261021_191235152.jpg`。

横屏第 0–6 秒依次展示三张成品照，第 6–83 秒为制作过程，第 83–87 秒回到正面成品照。过程镜头各 3.5 秒，白模与皮肤纸使用原片第 0 秒的静帧。

竖屏第 0–2 秒为正面成品照，第 2–56 秒为制作过程，第 56–59 秒以同一张成品照收尾。白模镜头 1.5 秒，其余过程镜头各 2.5 秒。竖屏从原片单独裁切，逐镜头设置焦点，头部转动、躯干及关节操作使用水平取景关键帧；缩短过程镜头时保持横屏版播放速度。

手臂连接选取原片 2068.2–2071.7 秒的最后一次装入，避开前面的拔出重装。脸部选取 97–100.5 秒压合动作，避免后面的近距离移动切到脸部边缘。镜头取舍与精确入出点保存在 `edit.json`。

## 成品照片与配乐

三张横屏成品照使用内置 `image_gen` 统一修图，以上一项目第二张 Rick 棚拍照片为质感参考，保留方块眼镜、胡须、服装图案及真实手工材质，统一灰色背景、柔光、清晰度与自然接触阴影，完整角色居中。竖屏首尾使用单独适配的 9:16 正面图。

- `assets/showcase/hero-landscape-v1.png`：横屏首尾。
- `assets/showcase/angle-a-landscape-v1.png`、`angle-b-landscape-v1.png`：横屏两侧角度。
- `assets/showcase/hero-portrait-v1.png`：竖屏首尾。

完整提示词、输入照片、参考图、生成图片路径、尺寸及 SHA-256 保存于 `showcase-ai.json`；提示词另存于 `prompts/`。构建不会再次调用图像生成服务，重新检出项目后需恢复这些本地生成图片。

两版配乐分别按自己的时间线合成，使用参考项目的振荡器、噪声及和声编排。切点对齐 120 BPM 节拍，片尾和弦收束并淡出，不混入原片环境声。WAV 为 48 kHz 双声道，成片为 AAC 192 kbps。

## 构建与校验

需要 FFmpeg / FFprobe、Python 3，以及 Pillow、NumPy、SciPy。npm 仅提供命令别名，无需安装 Node 依赖。

```bash
cd entropydrop_media/brickingbad_showcase
npm run prepare
npm run review
npm run render
npm run check

# 单独重建一个画幅
npm run render:landscape
npm run render:portrait
```

`prepare_assets.py` 导入素材，已有项目副本可脱离下载目录重建。`edit_timeline.py` 解析竖屏时间线。`build_video.py` 输出 H.264 CRF 16、yuv420p、BT.709，正确转换原片全范围 BT.601 色彩，并缓存逐镜头结果。两个 manifest 保存时间线、裁切、源文件与成品照哈希、音乐哈希及导出哈希。

`check_media.py` 校验素材与剪辑一致性、画幅、30 fps、精确帧数（2610 / 1770）、零起点、完整音频覆盖、配乐一致性及全片音视频解码。`review/framing/` 保存逐镜头开始、中间、结尾的取景联系表；`review/` 中也保留原片筛选联系表。

```bash
python3 inspect_source.py --start 2460 --end 2500 --step 2 --name final-assembly
```

Git 保存脚本、剪辑配置、提示词清单和说明。导入的原片、照片、AI 修图、音乐、成片、缓存与审片图片留在本地并被忽略。
