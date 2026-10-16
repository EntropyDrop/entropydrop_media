# Techno Showcase

独立 Hyperframes / FFmpeg 子项目，剪辑节奏参考 `../print_custom_figure/`。成片为 **1920 × 1080 / 30 fps / 98 秒**：8 张成品照共 16 秒，21 个实拍镜头共 78 秒，最后接入 4 秒全屏成品照片。照片与实拍均直接硬切，使用从参考项目改编的原创 120 BPM 电子配乐。

原片为 `~/Downloads/shipin/VID_20261014_114829.mp4`，约 59 分 45 秒。原文件保持原样；项目在 `sources/` 保存了独立本地副本。素材内容是给已打印的人偶贴皮肤、处理关节周围的贴纸并重新装回四肢。

## 剪辑内容

最前面的 8 张成品照片来自 `~/Downloads/shipin/未命名文件夹 5/`，按 EXIF 拍摄时间及毫秒排序，每张 2 秒，直接硬切，不加文字、转场或缩放动画。原图保存在 `sources/showcase/`，保留完整分辨率、EXIF 与色彩信息；视频改用内置 `image_gen` 逐张扩展背景的横幅版本，位于 `assets/showcase/expanded/001-ai-v1.png` 至 `008-ai-v1.png`。AI 扩图延续灰色背景、桌面纹理与光影，要求保留人偶造型、姿势、衣服、王冠、头脚，以及手持照片中的手部；所有照片铺满 16:9，不留黑边，也不使用模糊复制背景。

AI 输出为 1672 × 941，编码时等比例缩放并仅裁去不到两像素的上下边缘以匹配 1920 × 1080。完整生成提示词、使用的内置工具、原图与扩图的 SHA-256、文件对应关系保存在 `showcase-ai.json`。安装过程从 16 秒开始，成品片尾从 94 秒开始。

用户指定的首尾图片已从上传附件逐字节保存到 `assets/showcase/selected/user-opening-ending.png`。片头第一张使用此文件展示 2 秒，片尾使用同一文件全屏静止展示 4 秒，不加文字。照片为正面偏侧的站立造型，无手部遮挡，王冠、脸部、红色外套和靴子均完整可见。首尾明确引用上传文件，其余 7 张片头照片继续使用已保存的 AI 扩图；片头顺序、安装过程和音乐保持原有安排。

按原片的实际顺序保留零件与皮肤纸概览、脸部与头部包裹、王冠、躯干正面／侧面／背面、双臂、双腿、头部与腿部连接，以及完成后的正面与侧面展示。去掉长时间准备、重复调整、寻找贴纸、空桌面和不适合观看的镜头。

优先选择人偶或正在安装的部件位于画面中间的片段。部分重要动作使用固定的 16:9 裁切，将偏右或偏下的操作区域重新放到画面中间；局部镜头保留双手、贴纸边缘与相关连接部位，成品展示保留完整人偶。裁切范围为原画幅、1600 × 900、1440 × 810，袖口特写为 1280 × 720，不增加平移、缩放动画或转场。

安装过程全屏显示，镜头直接硬切，切点位于 120 BPM 的节拍上。已去掉原来的左下角开场标题，以及片尾左下角的说明和网址。全片不叠加文字或进度条，片尾也使用纯照片。原片的环境音不混入加速剪辑，不添加旁白。配乐为振荡器／噪声合成的原创音乐，原安装段配乐保持不变，前面增加 16 秒音乐，片尾收束并淡出。`captions.en.srt` 仅为可选的步骤说明，不烧录到视频，并随照片开场顺延 16 秒。

## 编辑与导出

需要 Node.js 22+、FFmpeg / FFprobe，以及包含 Pillow、NumPy、SciPy 的 Python 3。像素字体已随工程保存，无需在线下载。Hyperframes 预览沿用参考项目的 GSAP CDN。

```bash
cd entropydrop_media/techno_showcase
npm run render
npm run check
npm run dev
```

- `assembly-edit.json`：开场照片清单与逐图时长、每个镜头的原片入点／出点、成片时长、固定裁切与说明；可独立调整。变速由原片时长与成片时长计算。
- `prepare_showcase.py`：导入原图、按 EXIF 排序、校验 AI 扩图、生成无黑边照片开场及清单。
- `showcase-ai.json`：内置 `image_gen` 的完整扩图提示词、素材路径、图像尺寸、原图与扩图哈希，以及片尾选图依据。
- `build_video.py`：精确转码、颜色范围与色彩矩阵转换、照片开场、全屏剪辑、成品片尾、音乐混合；画面使用 H.264 CRF 16，拼接时直接复制视频流，音频为 AAC 192 kbps。单镜头缓存避免重复剪辑未修改的片段。
- `build_soundtrack.py`：从参考项目改编的原创电子音乐合成，保持 120 BPM。
- `build.mjs` / `template.css` / `hyperframes.json`：生成 Hyperframes 可编辑预览、元数据、时间线与独立 SRT。
- `check_media.py`：检查素材哈希、1080p / 30 fps、精确帧数、音频覆盖、音频起点与全片解码。
- `inspect_source.py`：生成带原片时间码的选片联系表；`review/` 保存本次逐步筛选的预览。

修改剪辑配置后运行 `npm run render`。若需要修改画质或转码方式，递增 `build_video.py` 的 `VERSION`，使单镜头缓存失效。

导出文件：`renders/techno-showcase.mp4`。另保留 78 秒无声纯安装剪辑 `assets/assembly/assembly-montage.mp4`、98 秒完整无损配乐 `audios/techno-electro.wav`、原安装与片尾配乐 `audios/assembly-electro.wav`，以及照片开场／安装开场／成品／片尾预览 JPG。`assets/showcase/manifest.json` 记录逐图时序与原图 SHA-256；`assets/assembly/manifest.json` 与 `timeline.json` 记录完整时间线、镜头与原片的对应关系、变速、裁切、帧数和 SHA-256。

Git 保留代码、剪辑配置、字体、AI 提示词清单与说明文档。原片、原图、AI 扩图、用户指定图片、代理、生成音乐、导出视频、联系表、预览和生成的 HTML／清单均只保留在本地；重新检出后须恢复 `sources/VID_20261014_114829.mp4`、`sources/showcase/`、`assets/showcase/expanded/` 与 `assets/showcase/selected/`，再运行构建命令。若原图本地副本尚未恢复，脚本尝试从剪辑配置中的 `showcase.importDirectory` 导入。扩图从默认生成目录复制到本项目，构建不依赖默认目录，也不自动重新调用 AI。提示词用于后续编辑，恢复当前画面须使用保存的扩图 PNG。

加照片之前的 82 秒版本及时间线保存在 `renders/revisions/before-photo-opening/`；有黑边的 98 秒版本、当时的剪辑配置与时间线保存在 `renders/revisions/before-ai-expansion/`。

## 抖音竖屏版本

独立导出为 **1080 × 1920 / 9:16 / 30 fps / 98 秒**，文件为 `renders/techno-showcase-douyin.mp4`。横屏导出与原来的剪辑配置保持独立。

竖屏版保留原有照片顺序、21 个安装镜头、逐镜头时长和节拍。用户指定的图片仍作首尾：片头 2 秒、片尾 4 秒，取景保留完整王冠与双脚；其余成品照也使用完整人偶的竖屏取景。最后一张工具与贴纸合照偏向人偶重新取景。所有画面铺满竖屏，不叠加文案。

安装段直接从原始 1920 × 1080 录像重新裁切与转码，每个镜头单独设置水平焦点；默认选区为 594 × 1056，头部、袖口与装腿等细节镜头选区为 450 × 800。头部与躯干连接镜头使用水平取景关键帧，跟随动作移动。完成后统一缩放为 1080 × 1920，保持人物比例。音乐直接复制横屏成片的 AAC 流，保持音质、节拍与音画同步。

```bash
npm run douyin:review
npm run render:douyin
npm run check:douyin
```

- `douyin-edit.json`：竖屏尺寸、逐镜头焦点、裁切窗口、水平取景关键帧与照片焦点。
- `build_vertical.py`：竖屏选景联系表、按镜头缓存的转码、完整时间线拼接与原音频复制。
- `check_vertical.py`：校验首尾图片、裁切与时序、1080 × 1920 / 30 fps、完整帧数、视频解码，以及与横屏成片完全相同的 AAC 音频。
- `review/douyin-framing/`：照片与安装镜头的竖屏取景预览，仅用于检查，不烧录进视频。
- `renders/douyin-manifest.json`：竖屏场景、原片入出点、裁切窗口、焦点关键帧、帧数和哈希。
- `renders/douyin-work/`：逐镜头缓存；修改 `douyin-edit.json` 后重新运行导出，仅重新处理受到影响的镜头。

竖屏版本需要已构建的横屏清单、源视频与本地图片素材。若主时间线已经修改，先运行 `npm run render` 更新横屏清单，再导出竖屏版。两种版本均只提交脚本、配置与文档，导出视频与缓存由忽略规则留在本地。

```bash
# 重新查看整条原片：每分钟一帧
python3 inspect_source.py --end 3540 --step 60

# 查看局部动作：每两秒一帧
python3 inspect_source.py --start 3540 --end 3578 --step 2 --name final-assembly
```
