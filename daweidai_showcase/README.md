# Daweidai Showcase

独立 FFmpeg 视频项目，参考 `../techno_showcase/` 的成品照开场、制作过程、成品收尾与 120 BPM 电子配乐风格。镜头与照片直接硬切，画面铺满，不叠加文字；原片环境音不混入加速镜头。

- 横屏：`renders/daweidai-showcase-landscape.mp4`，1920 × 1080，30 fps，96 秒（2880 帧）。
- 竖屏：`renders/daweidai-showcase-portrait.mp4`，1080 × 1920，30 fps，67 秒（2010 帧）。

当前封面为 `covers/daweidai-cover-v3.jpg`（1920 × 1080），内置 imagegen 生成的原始 PNG 为 `covers/daweidai-cover-v3.png`。使用用户提供的 `dwd.jpeg` 和当前横屏成片 00:02.000（30 fps 下第 60 帧，从 0 开始编号）的画面；左侧真人缩小取景以尽量展示原照中可见的完整坐姿，右侧手办按参考造型 AI 重渲染为独立站立产品图，已去掉托举的真人手，并加入一个简洁白色箭头。背景为中性深灰，不加文字与金色光效。完整编辑提示词、输入来源与输出哈希分别保存在 `covers/cover-v3.prompt.txt` 和 `covers/cover-v3.json`；此前版本与原始输入副本分别保留在 `covers/` 和 `review/cover-inputs/`。

用户提供的目录名称为“新建文件夹8”，实际找到的素材目录为 `~/Downloads/shipin/未命名文件夹 8/`。项目在 `sources/` 保存独立本地副本，不修改下载目录中的文件：

- `PXL_20261019_021114421.mp4`：1920 × 1080 HEVC 原片，约 25 分 31.48 秒。
- `sources/showcase/PXL_20261019_023723373.jpg`：正面成品照。
- `sources/showcase/PXL_20261019_023726026.jpg`：侧面成品照。
- `sources/showcase/PXL_20261019_023747384.jpg`：背面成品照。
- `sources/VID_20261027_105759.mp4`：新增转台实拍，约 13.49 秒，原始本地副本保留文件内容。

横屏第 0–6 秒依次使用 3 张成品照，每张 2 秒；第 6–84 秒为 22 段白模关节、面部与头发、上衣、双臂、双腿和完成后转身展示；第 84–88 秒回到正面成品照，随后第 88–96 秒接入新的完整旋转展示。竖屏第 0–2 秒使用正面照，第 2–56 秒精剪上述过程，第 56–59 秒回到同一正面照，第 59–67 秒为同一圈旋转展示。竖屏的镜头内裁剪保留横屏相应动作的播放速度，缩短准备和重复按压。

开场前 2 秒增加真人与手办对照：`sources/showcase/dwd.png` 是用户新增真人照的本地副本，按完整比例显示在左侧；调色后的正面手办图在横屏先向右移 360 px，竖屏先向右移 160 px。真人照从 0.65 秒开始渐隐，在 1.55 秒消失；手办从 0.65–1.75 秒平滑向左回到原来的居中取景。竖屏在完整原图范围内平移，横屏向左的画面边缘延续中性背景，保留完整头脚。此效果仅应用于开场第一张图，首图在片尾的复用保持原样；两版时长和配乐不变。`edit.json` 的 `opening_01.comparison` 保存布局与动画时间，`opening_comparison.py` 生成 FFmpeg 合成滤镜；导出清单同时记录真人照与合成代码哈希。修改前快照保存在 `renders/revisions/before-opening-comparison-v1/`。

## 新增居中匀速旋转片尾

`build_turntable.py` 从新增原片的第 120–220 帧（约 4–7.35 秒）提取一圈正向旋转，去掉原片头尾静止及转动中的停顿。通过头顶平面的局部特征光流跟踪估计角度，再用正面、侧面、背面等每 45° 的视觉锚点校正累计漂移，将一圈重定时为 8 秒，目标转速约 45°/秒。用运动补偿插帧输出连续的 30 fps 画面。

每帧根据角色轮廓计算中心与高度，平滑校正横向、纵向漂移及拍摄距离的变化，再分别适配横竖屏。角色完整高度分别约为画幅的 76% 和 74%，保留头部、双臂和双脚；画面边缘少量超出原始灰色背景时延续边缘背景，不添加黑边。原片环境音不混入成片，电子配乐延长到新时长，并在旋转片尾收束淡出。

`turntable-edit.json` 保存源文件、选用帧、头顶特征初始位置、角度锚点及目标构图。`renders/turntable/` 保存跟踪数据、逐帧取景、横竖屏补间视频及哈希；`review/turntable/prepared/` 保存半尺寸预览与等时间间隔联系表。修改前的成片、音轨与工程文件保存在 `renders/revisions/before-turntable-v1/`。

照片在原图范围内分别裁出 16:9 与 9:16，保留人偶完整头脚。正面、侧面两张照片使用调色后的 PNG，背面照片使用原始 JPG。实拍竖屏直接从原片裁切，每个镜头独立设置焦点；白模连接与手臂连接镜头使用水平关键帧跟随动作。所有视频统一转换为 BT.709、有限范围、H.264 CRF 16，音频为 48 kHz 双声道 AAC 192 kbps。

正面与侧面照片通过内置 imagegen 进行颜色校正，以横屏当前片尾 95.5 秒的实拍帧为颜色参考，改善裤子偏黑、偏绿的问题，并匹配肤色、金色与炭黑色。图像保留原有角度、手部与构图；按原图 4032 × 3024 画布导出，沿用既有横竖裁切坐标。首张正面照在片尾的复用同步替换，成片时长及配乐保持原样。调色图位于 `assets/showcase/color-match/01-front-v1.png` 和 `02-side-v1.png`，原生生成结果也保存在同一目录。`photo-color-match.json` 记录参考帧、完整提示词、原图与调色图哈希，独立提示词保存在 `prompts/color-match-{front,side}-v1.txt`。修改前的成片和工程快照保存在 `renders/revisions/before-photo-color-v1/`。

## 锐度修复 v1

针对原片偏软的画面，两个版本均从原片重新处理所选实拍镜头：先做低强度时空降噪 `hqdn3d=1.0:1.4:1.5:2.1`，再在源裁切尺寸上以 `unsharp=7:7:0.85:3:3:0` 增强亮度边缘；Lanczos 缩放后再做亮度通道 CAS 锐化，横屏强度为 0.25，竖屏为 0.20。参数保存在 `edit.json` 的 `enhancement` 中，逐镜头缓存和导出清单同时记录实际滤镜。

此处理改善边缘的视觉清晰度，不生成皮肤图案或纹理，无法恢复原片已经丢失的失焦与运动细节。照片、镜头时序、取景与音乐沿用原版。修复前的两版视频、清单、配置和构建脚本保存在 `renders/revisions/before-sharpness-v1/`；试验与最终对比位于 `review/sharpness/`。

配乐从 `techno_showcase/build_soundtrack.py` 改编，使用本地振荡器与噪声合成，沿用 120 BPM 电子节奏。两版分别按照各自时间线安排镜头重音、段落变化和结尾淡出，文件为 `audios/daweidai-electro-{landscape,portrait}.wav` 及 `.m4a`。未导入外部音乐录音。

需要 FFmpeg、FFprobe（含 `minterpolate` 滤镜）、Python 3，以及 Pillow、NumPy、SciPy、OpenCV；npm 仅提供命令别名，无需安装 Node 依赖或访问网络。

```bash
cd entropydrop_media/daweidai_showcase
npm run review             # 逐镜头首、中、尾取景联系表
npm run turntable:review   # 转台居中与匀速旋转预览
npm run render             # 两版视频与独立配乐
npm run render:landscape   # 只导出横屏
npm run render:portrait    # 只导出竖屏
npm run check              # 核对两版导出与完整解码
npm run sharpness:review   # 核对原版与修复版，生成同帧锐度对比
```

`edit.json` 保存全部入点、出点、横屏时长、竖屏时长、取景及配乐段落。`edit_timeline.py` 根据逐镜头时长生成竖屏精剪，保持动作速度并同步裁剪取景关键帧。`build_video.py` 生成联系表、逐镜头缓存、独立配乐和成片；`build_soundtrack.py` 合成音轨。`inspect_source.py` 按原片时间码抽帧，支持 `--times`、`--start`、`--end` 和 `--step`。

`check_media.py` 核对源片、照片、剪辑配置、配乐与成片哈希，检查分辨率、帧数、时长、取景、音视频起点与覆盖，以及封装音轨与独立 AAC 的一致性，再完整解码成片。`renders/{landscape,portrait}-manifest.json` 保存逐镜头时序、源片范围、速度所需时长、裁切关键帧、帧数与哈希。

代码、剪辑配置、提示词和说明文档保留在 Git；`sources/`、`assets/showcase/color-match/`、`audios/`、`review/`、`renders/` 和 Python 缓存仅保留在本地。重新检出时，把制作原片与新增转台原片放回 `sources/`，3 张照片放回 `sources/showcase/`，恢复本地调色 PNG 与参考帧，再执行构建。调整编码或颜色转换逻辑时递增 `build_video.py` 的 `RENDER_VERSION`，使逐镜头缓存失效。
