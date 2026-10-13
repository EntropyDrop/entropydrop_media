# Make Your Own Figure at Home

独立英文 Hyperframes 子项目，1920 × 1080 / 30 fps，当前总长 98.43 秒（2953 帧）。主题：通过网站生成皮肤或上传自己的皮肤，下载对应的 3D 文件，然后在家打印、组装并贴皮肤贴纸。网站工具与下载免费使用。

开场以全屏成品照片为主，只保留左下角小标签 **Make Your Own Figure at Home**，第一句配音为 “Let's turn your favorite skin into one of these—a figure you can hold.”，先介绍成品的吸引力；网站过程说明生成或上传皮肤，并在下载环节介绍两种选择：免费下载文件自己制作，或购买包含打印好的零件与预切贴纸的 Figure Kit。四段录屏全屏显示，取消外加的顶部品牌、步骤栏、免费角标、边框、画面字幕和进度条。

视觉参考 `../skin_reconstruction/`：相同的 FusionPixel 字体、浅色纸面背景、绿色强调色与方形面板。全片不显示字幕框，保留标题、说明文案、配音和音乐。字体保存在本项目 `assets/fonts/`。

## 内容顺序

1. **效果展示，10 秒**：原有 4 张成品照后，追加 `PXL_20261013_071428829.jpg`，共 5 张，每张 2 秒（60 帧），直接硬切。按 EXIF 拍摄时间排序，新照片固定排在本次序列的最后。照片铺满画布，只保留左下角小标题与原有配音。
2. **制作方法和过程**：`3dp1.mov` → `3dp2.mov` → `3dp3.mov` → `3dp4.mov`，保持顺序、完整内容和原速。第一段展示网站，后三段展示切片软件；旁白说明生成／上传皮肤、下载模型、导入切片、检查支撑与分层。录屏按比例放大至整个 1920 × 1080 画布，保留完整软件界面；原素材比例略有差异时，仅在两侧留窄黑边。
3. **4 秒组装衔接**：左侧以大字呈现 Let’s put it together.，绿色突出 together.；右侧使用实际安装视频中双手托着组装完成的白色人偶的静帧，画面保持静止。直接从 `sources/PXL_20261012_012814410.mp4` 的 192.4 秒截取为原尺寸 1920 × 1080 PNG，保存在 `assets/assembly/assembly-bridge-still.png`，对应安装精剪约 26 秒处。右侧满高显示，人偶居中且头脚完整；配音为 Once they’re printed, let’s put everything together.。
4. **28 秒实拍安装**：从 44.433 秒接入零件概览、两只手臂、髋部连接件、两条腿、颈部连接件、头部与组装成品；共 9 个镜头。安装视频铺满 1920 × 1080 画布，取消顶部品牌、网址、外框、步骤字幕和进度条。卡合动作与原创 120 BPM 电子配乐踩点。
5. **18 秒贴纸安装轮播**：从 72.433 秒接入 30 张照片，全屏显示并取消顶部标识、画面字幕和进度条。按 EXIF 拍摄时间及毫秒排序，每张 600 毫秒（18 帧），即原速度的 0.5 倍，直接硬切，无转场、缩放或平移动画。

6. **8 秒成品与行动引导**：从 90.433 秒接入新增成品照片 `PXL_20261013_070550776.jpg`，片尾直接使用原图，配文 YOUR SKIN. / MADE REAL.（两行全大写）；3.3 秒后显示 Try it yourself / entropydrop.com / FREE TOOLS & DOWNLOADS，配合一句完整的成品介绍与邀请。

当前版本有 7 段英文配音，使用与 `skin_reconstruction` 相同的 Qwen3-TTS 模型和 `entropydrop` 音色。前 44.43 秒保留 10 秒开场和四段素材的原速时长；完整配音字幕按实际配音时间记录在 `captions.en.srt`，全片不烧录字幕。电子音乐用于安装、贴纸轮播和成品片尾，延续播放至结尾淡出；片尾旁白时音乐降至 32% 音量。安装步骤保留在 SRT 中，主视频安装段不烧录字幕。确切时间线由 `timeline.json` 记录。

## 版本控制与本地恢复

Git 保留工程脚本、剪辑与配音配置、样式、必要字体、说明文档，以及封面提示词和字体参考 HTML。原始照片与视频、转码代理、生成音频及清单、封面图片、导出视频、预览、缓存和历史备份只保留在本地；`index.html`、`meta.json`、`timeline.json`、`captions.en.srt` 由构建脚本生成，也不提交。设置忽略规则不会删除现有本地文件。

全新检出后，需要从独立素材备份恢复 `sources/`：四段录屏 `3dp1.mov` 至 `3dp4.mov`、安装原片 `PXL_20261012_012814410.mp4`、`showcase/` 内的 5 张原图，以及 `stickers/` 内的 30 张原图。照片须保留 EXIF 拍摄时间，以恢复轮播顺序。封面 PNG 和生成图片的参考图也需另行备份；提示词用于后续编辑，不保证精确重现同一张图片。

准备 Node.js 22+、FFmpeg/FFprobe，以及含 Pillow、NumPy、SciPy 的 Python 3 环境，并配置可用的 TTS 服务（使用 `ENTROPYDROP_TTS_URL` 或已忽略的 `../local_deployment/tts/config.json`；不要将真实连接配置和密钥写入受版本管理的文件）。素材恢复后，在本项目目录依次执行：

```bash
mkdir -p audios assets/ending
python3 prepare_assets.py
python3 prepare_showcase.py
python3 build_assembly.py
python3 build_stickers.py
python3 build_soundtrack.py --refresh-sections
cp sources/stickers/PXL_20261013_070550776.jpg assets/ending/
ffmpeg -hide_banner -loglevel error -y -ss 192.4 -i sources/PXL_20261012_012814410.mp4 -frames:v 1 assets/assembly/assembly-bridge-still.png
node build.mjs --without-narration
python3 regenerate_audio.py
npm run build
npm run check
npm run render
```

## 预览和导出

```bash
cd entropydrop_media/print_custom_figure
npm run build
npm run check
npm run dev
npm run render
```

导出文件：`renders/print-your-custom-figure-at-home.mp4`。输出保持 1920 × 1080 / 30 fps，使用 `--quality high --sdr`（H.264 CRF 15）；开场直接使用原图，但视频导出仍会缩放到 1080p 并编码。需要 Node.js 22+、FFmpeg 和 Hyperframes 的 Chrome 渲染环境；命令使用与仓库已有项目相同的 Hyperframes 0.6.6。动画库目前沿用其他项目的 GSAP CDN，预览和导出需要可访问该地址。

## 安装精剪与音乐

安装原片为 `~/Downloads/未命名文件夹/PXL_20261012_012814410.mp4`（约 195 秒），在 `sources/` 保存本地副本。剪辑保留安装顺序，跳过反复调整与离开画面的部分；每个镜头内按关键卡合瞬间进行分段变速，对齐 120 BPM 的节拍。末尾保留 4 秒组装成品展示。

`assembly-edit.json` 保存 9 个镜头的原片入出点、目标时长、卡合时间与字幕。`build_assembly.py` 生成剪辑视频与原创电子音乐：底鼓、军鼓、踩镲、木质打击声、低音、拨弦与柔和和弦均用振荡器／噪声合成，没有外部音乐或采样。音乐为 48 kHz 立体声，保持 120 BPM 和原有卡合重音，尾部淡出。

当前配乐使用分段编排：前 2 秒为简洁节拍；2–10 秒引入主旋律与和声变化；10–24 秒加入低音变奏、打击乐回应和短鼓花；24–28 秒成品展示改为较疏的节奏；28 秒进入贴纸轮播时换成新的问答式旋律；36–40 秒短暂减弱鼓点，使用柔和和弦与敲击声；40 秒恢复节奏，46 秒起以延音和少量旋律音收尾，配合片尾旁白降音量。这里的秒数相对于安装音乐的起点（成片 44.433 秒）。

```bash
# 修改安装剪辑后重新生成；需要 Python 3、NumPy、SciPy 和 FFmpeg
npm run assembly
npm run render
```

- `assets/assembly/assembly-montage.mp4`：28 秒无声剪辑，供主项目使用。
- `audios/assembly-electro.wav`：原创电子配乐。
- `assets/assembly/manifest.json`：帧数、哈希、变速比例、节拍与源素材对应关系。
- `renders/assembly-installation.mp4`：安装段独立版本，包含音乐。
- `renders/revisions/before-assembly/`：添加安装段之前的完整视频与时间线备份。

安装段从原片结束处接入。前段旁白覆盖前 44.43 秒，片尾有一段旁白；安装和贴纸过程保留纯音乐。配音母带按完整 98.43 秒时间线补齐静音，重新生成配音不会改变安装段节拍。

`npm run render` 最后调用 `finalize_audio.py`，从无损 WAV 按采样位置混合旁白和音乐，修正 Hyperframes 0.6.6 的 AAC 封装偏移。视频直接复制，不进行二次画面压缩；若直接调用 Hyperframes CLI 导出，随后运行 `python3 finalize_audio.py`。仅调整音乐且已有完整成片时，依次运行 `npm run soundtrack`、`npm run build`、`python3 finalize_audio.py` 即可更新音频，无需重新渲染画面。

## 贴纸安装图片轮播

前 29 张原图来自 `~/Downloads/未命名文件夹 2/`，最后追加 `~/Downloads/未命名文件夹/PXL_20261013_070550776.jpg`；原件保存在 `sources/stickers/`，同一张新照片也作为片尾成品图。30 张图片均为 4:3 横图，按 EXIF 的 `DateTimeOriginal` 和 `SubSecTimeOriginal` 排序；本次与文件名时间顺序一致。照片等比例放大至画布完整高度，保留全部内容；16:9 成片两侧使用黑边，画面上不叠加品牌、步骤、字幕或进度条。

`stickers-edit.json` 设置每图时长，当前为 0.6 秒（原速度的 0.5 倍）。`build_stickers.py` 生成照片代理和严格按帧计时的硬切轮播，同时延长原创配乐，使安装动作的节拍位置保持一致。依赖 Python、Pillow、NumPy、SciPy 和 FFmpeg。

主合成直接使用逐张图片，并从整数帧位置计算显隐时间，避免视频采帧在 600 毫秒边界产生一帧偏移；独立轮播 MP4 仍单独保留。

```bash
npm run stickers
npm run render
```

- `assets/stickers/photos/`：按播放顺序编号的图片代理。
- `assets/stickers/sticker-installation.mp4`：18 秒无声轮播，540 帧。
- `assets/stickers/manifest.json`：30 张原图的拍摄时间、哈希和逐图时间线。
- `audios/assembly-and-stickers-electro.wav`：46 秒连续配乐，覆盖组装与贴纸轮播。
- `renders/sticker-installation.mp4`：带音乐的独立轮播片段。
- `audios/assembly-stickers-ending-electro.wav`：主视频使用的 54 秒连续配乐，包括音量降低的 8 秒片尾。
- `build_soundtrack.py` / `npm run soundtrack`：合成分段配乐并生成哈希清单；`--refresh-sections` 同时更新安装、贴纸的独立音乐及预览，复用已剪好的画面。修改片尾时长后先运行，再运行 `npm run audio`。
- `renders/revisions/before-stickers/`：追加轮播前的完整视频及时间线。

修改安装剪辑后运行 `npm run assembly` 会同时更新轮播配乐，再重新构建主项目。

## 配音与字幕

`narration.json` 保存完整英文稿、各句对应场景、起始偏移和可用时长；`slicing` 跨越三段切片录屏，让一句旁白连续播放。`regenerate_audio.py` 复用 `skin_reconstruction/regenerate_audio_whole_clip.py` 的请求方法，服务地址从 `--url`、`ENTROPYDROP_TTS_URL` 或仓库的 `local_deployment/tts/config.json` 读取；部署配置不写入音频清单。

```bash
# 修改 narration.json 后，生成并重新构建画面；会先更新无配音时间线
npm run audio

# 只重新抽样指定句子；其他句子复用已生成的原始音频
python3 regenerate_audio.py --only 01_hook,06_assemble
npm run build
```

使用 seed 42、目标 175 WPM，沿用参考项目音色。按完整场景段落生成，网站预览与切片步骤合并朗读，保留句内连贯语气；各段只去掉首尾静音，语速调整限制在 0.8–1.1 倍，留出看画面的停顿。若某段超过可用时长，脚本报错，避免截断话语。SRT 字幕文件保持句级对齐，仅作为独立文件保留，不在视频中显示。合成后的整条旁白统一响度，文件为 `audios/voiceover_full.wav`（24 kHz 单声道 PCM）。

`audios/voiceover-preview.mp3` 为去掉长段静音的配音试听版。

`audios/qwen3_sentence_sources/` 保留服务原始输出及缓存校验；`audios/sentences/` 保留处理后的逐句 WAV；`audios/qwen3_tts_manifest.json` 记录每句起始时间、实际时长、语速和哈希。生成脚本沿用已有服务音色，不修改服务器的克隆参考。

## 开场成品轮播

前 4 张原照片来自 `~/Downloads/未命名文件夹 4/`，最后追加 `~/Downloads/未命名文件夹/PXL_20261013_071428829.jpg`；原件保存在 `sources/showcase/`。`prepare_showcase.py` 按拍摄时间排序，逐字节复制 4032 × 3024 原图（不缩图、不重存 JPEG，保留 EXIF 与色彩信息），生成 `assets/showcase/manifest.json`；总计 300 帧，五张各 60 帧。主合成使用图片节点在整数帧边界直接切换，没有淡入淡出或图片移动。首屏以 16:9 铺满显示，裁去部分上下背景，保留所有人偶；只显示左下角 `Make Your Own Figure at Home` 单行小标题（30px），不显示进度条。免费信息由旁白及片尾的 FREE TOOLS & DOWNLOADS 说明。

```bash
# 重新复制原始照片、生成时间线并同步配音位置
npm run showcase
npm run render
```

第一张照片单独调整取景：显示宽度为画布的 105.6%，`object-position: left 12%`，裁去多余右侧和下方背景，使两个人偶整体的中心接近画布中心，头顶与脚下保留接近的留白。仅改变合成中的构图，原图文件保持原样。

`project.json` 的 `showcase.manifest` 指向照片清单。开头为 10 秒。贴纸轮播从 72.433 秒开始；每张延长为 0.6 秒后，片尾及其旁白从 90.433 秒接入。开场时长由 `project.json` 的 `showcase.duration` 控制，后续场景及音频随时间线顺延。

如要改用视频：移除 `showcase.manifest`，把视频放到 `assets/showcase.mp4`，将 `showcase.src` 设为该路径，设置 `showcase.mediaStart`，然后运行 `npm run build`。视频须从起点起至少覆盖 `showcase.duration`（当前为 10 秒）。移除清单并将 `src` 设为空字符串可恢复占位。

## 视频封面

当前封面为 `covers/figure-at-home-cover-v8.png`（1672 × 941），使用内置 ImageGen 以用户重新上传的浅色封面为底，仅将标题改为上一版的像素风格，FIGURE 使用加粗像素笔画。保留浅米色背景、黑色 MAKE YOUR OWN、深绿色 FIGURE 及手持角色构图，无 Logo。底图保存在 `covers/ivory-cover-edit-reference.png`，提示词为 `covers/figure-at-home-cover-v8.prompt.txt`。

`covers/figure-at-home-cover-v7.png` 保留为深紫色渐变背景版本，MAKE YOUR OWN 为白色，FIGURE 为加粗亮绿色像素字体。提示词为 `covers/figure-at-home-cover-v7.prompt.txt`，背景颜色参考为 `covers/deep-purple-background-reference.png`。

`covers/figure-at-home-cover-v6.png` 保留为柔和淡紫色背景版本，提示词保存在同名 `.prompt.txt` 文件中。

`covers/figure-at-home-cover-v5.png` 保留为浅米色背景版本。其标题参考由视频实际的 FusionPixel 字体文件渲染为 `covers/fusion-pixel-title-reference.png`，参考源文件为 `covers/fusion-pixel-title-reference.html`，提示词为 `covers/figure-at-home-cover-v5.prompt.txt`。`covers/figure-at-home-cover-v4.png` 保留为早期像素字体版本。

`covers/figure-at-home-cover-v3.png` 为相同手持构图的普通粗体标题版本；提示词保存在同名 `.prompt.txt` 文件中。

`covers/figure-at-home-cover-v2.png` 为无手部版本，文案为 YOUR SKIN. / MADE REAL.；提示词保存在同名 `.prompt.txt` 文件中。早期版本保留供比较。

`covers/figure-at-home-cover-v1.png` 为独立视频封面，使用内置 ImageGen 参考 0:09 画面及对应的原始照片 `assets/showcase/photos/005.jpg` 生成。封面以手持绿紫色人偶为主体，使用浅色背景和 MAKE YOUR OWN / FIGURE / AT HOME 三行标题；实际输出尺寸为 1672 × 941。生成提示词保存在 `covers/figure-at-home-cover-v1.prompt.txt`，视频参考帧保存在 `covers/reference-at-00-09.png`。

## 素材与编辑

- `project.json`：标题、开场素材、视频顺序、字幕、组装衔接时长、成品片尾与安装素材清单。
- `narration.json`：当前配音稿及句级时间窗；有配音时以此生成字幕，`project.json` 的字幕仅用于无配音回退。
- `template.css`：视觉样式。
- `build.mjs`：读取实际视频帧数，生成 HTML、元数据、时间线和 SRT。
- `assets/3dp1.mp4` 至 `3dp4.mp4`：H.264 / 30 fps / 宽 1920、每秒一个关键帧的预览与渲染素材，保留全画幅。帧率转换只有帧级舍入，不做加速或慢放。
- `assets/sources.json`：原始视频参数及 SHA-256。
- 网站录屏 `3dp1.mov` 在标准化为 1920 像素宽后，左裁 10、上裁 6、右裁 22、下裁 14 像素，去掉右侧窗口白边和底部圆角；输出为 1888 × 1074，时长和帧数不变。裁边由 `project.json` 中的 `cropPixels` 控制，三段切片软件录屏不裁切。仅重新处理网站录屏：`python3 prepare_assets.py --force --only 3dp1.mov`。
- `assets/ending/PXL_20261013_070550776.jpg`：新增片尾成品原图，逐字节复制，保留原始分辨率。
- `sources/`：本地保存原始 MOV、安装 MP4 与贴纸照片，因体积较大不纳入 Git；原下载文件保持原样。
- `renders/revisions/initial-dark-silent.mp4`：本地保留的上一版无声视频，不纳入 Git。

首次导入使用 `npm run prepare:assets`，默认读取 `~/Downloads/3dp1.mov` 至 `3dp4.mov`；后续优先使用 `sources/` 中保留的原片。需要重新转换时运行 `python3 prepare_assets.py --force`，再执行 `npm run build`。已有代理文件可独立预览和导出，无需 Downloads 目录。
