# Skin Walk 360 Video Generator

输入 Minecraft 皮肤 PNG，复用 frontend MCModal 的 Walk 动画，让角色旋转 **360 度**并可首尾连续循环。用于皮肤展示、重建效果对比和视频剪辑素材。

## 单个皮肤

在 `entropydrop_website` 目录运行：

```bash
node entropydrop_media/skin_walk_video/render_skin_walk_video.mjs \
  --skin /path/to/skin.png \
  --out /path/to/walk360.mp4
```

默认导出 **8 秒、30 fps、1080×1080、Plane 模式、深灰背景** 的 MP4。工具直接导入 `entropydrop_frontend/src/components/MC.tsx`，使用 MCModal 的相机、灯光和 Walk 动画。Steve / Alex 身型按 frontend 的皮肤检测逻辑识别。

默认每段完成 **6 个完整步态周期**（0.75 个周期/秒），从迈步幅度最大的姿势开始。循环接缝处的走路姿势、速度和转角连续。将播放器设为循环，或在剪辑软件中直接连续排列该片段即可。

## 调整片段规格

```bash
node entropydrop_media/skin_walk_video/render_skin_walk_video.mjs \
  --skin /path/to/skin.png \
  --out /path/to/walk360.mp4 \
  --duration 10 --fps 30 \
  --width 1920 --height 1080 \
  --mode plane --background "#1a1a1a"
```

- `--duration`：整段时长；一段完成一整圈旋转。默认自动选择整数个步态周期，使步频接近网站。
- `--fps`：固定采样帧率，循环接缝也按相同的时间间隔衔接。
- `--walk-cycles`：一段视频内的完整步态周期数，必须为正整数；8 秒片段默认 6 个周期。
- `--walk-phase`：起始步态相位，单位为度；默认 90（最大迈步幅度），0 为双腿并拢，270 为另一条腿迈出。
- `--width` / `--height`：输出尺寸，必须是偶数。
- `--mode plane|voxel|cute`：对应网站预览模式，默认 Plane。
- `--yaw`：初始角色角度，默认 0，为 MCModal 的斜前方视角。`--yaw 45` 可从正面开始。
- `--scale`：角色大小，默认 0.82（适度缩放，确保 360° 行走摆腿时画布上下均留出舒适留白）。
- `--cam-y`：相机高度，默认 18（优化俯角视角，减小头顶比例）。
- `--target-y`：相机对焦高度，默认 -0.75（精准垂直居中，消除人物偏下问题）。
- `--overwrite`：覆盖已有输出文件。

保持相同的时长、帧率和视角参数，可让不同皮肤的行走与旋转同步，便于左右对比。时长会取整到完整帧，例如 8 秒 × 30 fps = 240 帧。

调整起始姿势和步频，例如 8 秒完成 7 个周期、从双腿并拢开始：

```bash
node entropydrop_media/skin_walk_video/render_skin_walk_video.mjs \
  --skin /path/to/skin.png --out /path/to/walk360.mp4 \
  --duration 8 --walk-cycles 7 --walk-phase 0
```

循环片段保留起点、不重复终点。默认 240 帧的转角为 0°、1.5°、…、358.5°；下次播放的首帧接着走到等价的 360°，因此接缝不会多停留一帧。

## 透明背景 WebM

```bash
node entropydrop_media/skin_walk_video/render_skin_walk_video.mjs \
  --skin /path/to/skin.png \
  --out /path/to/walk360.webm \
  --background transparent
```

透明素材使用 VP9 WebM，透明背景会关闭地面阴影。MP4 使用 H.264，适合常规剪辑，但不支持透明通道。

## 批量导出一个目录

```bash
node entropydrop_media/skin_walk_video/render_skin_walk_video.mjs \
  --skin-dir /path/to/skins \
  --out-dir /path/to/clips \
  --duration 8 --fps 30 --width 1080 --height 1080
```

读取该目录下的 PNG 文件（不递归），按文件名排序，生成 `<皮肤文件名>__walk360.mp4`。批量透明素材可加 `--format webm --background transparent`。

单文件的 `--skin` 和 `--out`、批量的 `--skin-dir` 和 `--out-dir` 均相对于执行命令时的目录解析。如果不指定输出位置，写入工具的 `outputs/`。

## 运行条件

需要 **Node.js 22+、Chrome / Chromium、ffmpeg**，以及已安装的 `entropydrop_frontend/node_modules`。工具会建立本地依赖链接，复用 frontend 的包，无需再次安装。

输入要求为 **64×64 PNG 皮肤**。普通角色图片、UV 示意图和旧版 64×32 皮肤需要先转成标准皮肤。

找不到浏览器或 ffmpeg 时，可设置 `CHROME_BIN` / `FFMPEG_BIN` 为其可执行文件的路径。

## 渲染方式与检查

工具启动临时本地 Vite 服务与独立无头 Chrome，等待皮肤加载完成，然后在半开区间 `[0, duration)` 内逐帧设置 Walk 相位和角色转角，将 PNG 帧送入 ffmpeg 编码。Walk 使用整数个周期，并映射到原角色组件读取的时钟；渲染耗时不影响输出帧率。

每次导出都会额外渲染一次未写入视频的循环终点，检查它与首帧 PNG 完全一致，包含角色与地面阴影。结束后关闭临时进程并清理浏览器目录。

```bash
cd entropydrop_media/skin_walk_video
npm test
npm run check
node render_skin_walk_video.mjs --help
```
