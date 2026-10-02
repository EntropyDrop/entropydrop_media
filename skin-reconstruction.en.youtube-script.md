# YouTube Video Script: Another Open-Source Model: Image to Minecraft Skin

## Draft Status

本稿只用于确认视频叙事。**确认前不要重新生成 Hyperframes、旁白、字幕或成片。**

英文口播采用四幕结构：**1. 开场与 28 组社区生成效果；2. 网站使用说明；3. 两阶段原理；4. 开源与技术细节（Open Source & Technical Details）。** 目标时长约 **7 分 35 秒**。

这次发布需要准确说明范围：**完整两阶段流水线代码已经开源，Stage Two 的皮肤重建代码与模型权重也已公开**，可以把规范化的 Minecraft 正背面图重建为最终 64×64 皮肤；但从任意角色图生成这些固定格式正背面图的 Stage One 仍需要调用兼容的闭源图像模型。可以称流水线代码为开源，但不要暗示 Stage One 的外部依赖也已开源、完整流程可以免费离线运行，或单个 checkpoint 就能复现完整结果。

参考来源：

- 技术文章：`../entropydrop_frontend/public/articles/skin-reconstruction.en.md`
- 网站操作：`../entropydrop_frontend/src/pages/GeneratePage.tsx`、`../entropydrop_frontend/src/components/MCModalPreview.tsx`
- 代码：https://github.com/EntropyDrop/SkingToolkit
- 模型资源：https://huggingface.co/EntropyDrop/Sking

## Video Positioning

- **Working title:** Another Open-Source Model: Image to Minecraft Skin
- **Target length:** approximately 7:35
- **Format:** English voiceover, 28 community results, browser walkthrough, two-stage pipeline explanation, and open-source resources & technical details
- **Audience:** Minecraft players, skin creators, open-source developers, and viewers interested in image-to-skin generation
- **Core promise:** Show what the pipeline produces across different input styles, teach viewers how to use it, credit DDJ for the original direction, explain the two stages, and direct viewers to the Hugging Face repository for full technical details.
- **Tone:** Direct, visual, candid, and practical. Treat the comparisons as evidence instead of claiming that every result is better.

## Title Ideas

1. **Another Open-Source Model: Image to Minecraft Skin**
2. Another Open-Source Minecraft Skin Model — Community Results
3. From Image to Minecraft Skin: Our New Open-Source Release

推荐第一个标题。“Another”延续已有项目，也天然引出观众的问题：为什么还需要另一个模型；冒号后的关键词则直接说明模型用途。

## Thumbnail Copy Ideas

- ANOTHER OPEN-SOURCE MODEL
- IMAGE → MINECRAFT SKIN
- COMMUNITY RESULTS

主画面使用一组辨识度高的 3D 对比，右上角放小型 GitHub / open-source 标识。不要在缩略图中堆版本号、网络名称或指标。

## YouTube Description Draft

We have open-sourced another model for turning character images into usable Minecraft skins.

This video starts with character images in different visual styles and compares each input with its 3D Minecraft skin. Then we use the model on EntropyDrop: upload a reference, generate a skin, inspect it from every angle, and download the PNG.

The complete two-stage workflow code is open source, including the Stage Two skin-reconstruction code and model weights. Stage One still requires access to a compatible closed-source image model. The final section highlights our Hugging Face repository for technical architecture details, model weights, and documentation.

Try the generator:
https://entropydrop.com/skin/generate

Code:
https://github.com/EntropyDrop/SkingToolkit

Model resources:
https://huggingface.co/EntropyDrop/Sking

Technical article:
https://entropydrop.com/public/blog/skin-reconstruction

Chapters:
00:00 We open-sourced another model
00:15 Why build another one?
01:05 Cartoon, chibi, and mascot styles
01:50 3D renders and game art
02:40 Painterly and mixed styles
03:30 Try it online
03:40 Upload, 3D viewer & download
05:30 How the pipeline works: Stage 1 fixed views generation
06:00 Stage two: reconstruct the skin
06:45 Technical details & Hugging Face repo

## First 20 Seconds

### Visuals

- 0:00–0:20: 首屏持续显示标题与 3×3 九宫格，从后续社区成果中抽取九组代表案例。
- 每格左侧显示原始参考图，右侧同步播放对应的透明背景 3D 行走视频，中间用箭头建立输入与结果的对应关系。
- 九组案例覆盖不同画风、配色和角色结构；首屏只保留 `IMAGE` / `SKIN` 标签，不显示作者、版本或链接，避免信息过密。

### On-Screen Text

WE OPEN-SOURCED ANOTHER MODEL

Community results · Live demo · Open-source reconstruction

不要用代码滚屏开场。开源是新闻点，效果才是观众留下来的原因；画面文案避免使用 `any`、`perfect`、`flawless` 或 `high-fidelity` 等绝对化词语。

## Community Showcase Plan

### 展示画面的统一规则

- 采用**动态不固定数量**的效果展示，不刻意绑定单一主题，展示多样化的角色风格。
- 每组使用成对对比：**左侧为原始输入参考图**，**右侧为生成的 3D Minecraft 皮肤 360° 行走视频（透明背景 WebM）**。
- **合适位置标注作者信息**：显示创作者头像、用户名（通过 `api.entropydrop.com/api/logs/{id}` 获取）、使用的模型版本（如 `SKING_DDJ_v61`）以及任务编号。
- 轮播所有可用皮肤（当前共 28 组社区生成成果），在 0:20 至 3:30（共 190 秒）的时间段内平分轮播。
- 视频素材由 `skin_walk_video` 基于 `assets/skin_reconstruction/skin*` 生成透明背景 360° 步态循环，与背景自然融合。
- 文案采用前言解说，适度留白，留出纯音乐与 3D 旋转观察时间，后续可根据成片需要继续补充。

## Main Storyboard

| Time | Segment | Visual Direction | Voiceover Focus | On-Screen Text |
| :--- | :--- | :--- | :--- | :--- |
| 0:00–0:20 | Open-source hook | 标题 + 九组“参考图 → 3D 行走皮肤”九宫格 | 我们又开源了一个模型；先用九组社区效果建立视觉证据，再解释它 | Another open-source model · Community results |
| 0:20–1:00 | Why another model? | 社区成果轮播：左原图，右 3D 透明走动，右上标注作者 | 旧路线容易把小图案当作普通图像细节；新流水线先转换到固定 Minecraft 视图，再进行重建 | Community Showcase · Creator Attribution |
| 1:00–1:50 | Character identity | 持续轮播社区皮肤，展示脸部、发型与服装转换 | 引导观众观察哪些轮廓、配色和服装特征得以保留，以及哪些细节因方块结构被简化 | Translating Distinctive Structure |
| 1:50–2:40 | Diverse art styles | 覆盖插画、3D 渲染、游戏图与绘画风格，适度留白 | 观察角色转身时正面、侧面和背面的视觉连贯性，不宣称所有细节都能保留 | Diverse Styles & Creators |
| 2:40–3:30 | Transparent 3D results | 保留部分观察空间与音乐，平滑过渡到网站实操 | 通过动作检查接缝、肢体贴图与背面推断，再引出在线实操 | 3D Skins in Motion |
| 3:30–4:10 | Website: upload | 地址、登录、Upload Reference | 上传参考图，介绍 SKING DDJ 系列并区分线上限免与本地部署 | 1. Upload a reference |
| 4:10–4:50 | Viewer: modes | 切换 Voxel、Plane、Cute 模式并旋转观察 | 介绍 3D Viewer 的 Voxel、Plane、Cute 三种渲染模式 | Modes: Voxel · Plane · Cute |
| 4:50–5:30 | Viewer: actions | 切换 Idle、Walk、Dance 动作，点击 Download | 用动作检查接缝与肢体贴图对齐，确认效果后下载 PNG | Actions: Idle · Walk · Dance |
| 5:30–6:00 | How pipeline works | 参考图 + 模板 → 固定格式正背面图 | 两阶段管线架构：Stage 1 图像模型理解角色，转换到统一 Minecraft 正背面视图 | How the Pipeline Works |
| 6:00–6:45 | Stage two | 用三个问题组织画面：像素属于哪里？不可见区域怎么补？重渲染后是否更匹配？ | 以三个问题解释可见像素路由、保守补全与重渲染校验，最终得到 64×64 皮肤 | Fixed views → Reconstructed Skin |
| 6:45–7:35 | Technical details | Hugging Face 仓库、模型权重清单、GitHub 源码、在线生成器与订阅卡片 | 简化结尾，不谈未来规划；重点引导观众访问 Hugging Face 仓库获取模型权重、技术架构与评测细节 | Hugging Face · Open Source · Subscribe |

## Website Recording Notes

1. 打开 `https://entropydrop.com` 并登录。
2. 点击 **Upload Reference**，上传角色参考图。
3. 选择 **SKING DDJ** 系列模型并点击生成按钮。等待部分直接跳切，展示弹出的 3D 预览器。
4. 依次切换顶部的 **Voxel**、**Plane**、**Cute** 模式，拖动旋转展示立体像素、平面贴图与 Q 版比例差异。
5. 依次点击底部的 **Idle**、**Walk**、**Dance** 动作按钮，展示站立、行走与舞蹈三种动态表现。
6. 点击 **DOWNLOAD** 保存最终的 64×64 皮肤 PNG。

尽量使用已经出现在 28 组社区成果中的同一个角色，让效果展示、网站操作和技术说明形成一条完整故事线。

## DDJ Naming and Principle Notes

- `SKING_DDJ` 中的 `DDJ` 用于致敬 DDJ 对这条路线的公开探索，并标明思路来源。
- 只陈述文章能够支持的时间线：DDJ 在 2025 年末公开演示使用 Banana 图像模型辅助 Minecraft 皮肤生成。
- 当前第一阶段提示词改编自 DDJ 推荐的版本。不要把我们的后续改进说成对整条路线的首次发明。
- 完整流水线代码已经开源，但第一阶段调用的中间图像模型仍是闭源依赖。画面可以同时展示 GitHub 流水线代码和闭源依赖标记。
- 原理只讲两步：`Reference → normalized front/back views`，再到 `front/back views → 64×64 skin → 3D check`。网络结构与训练指标留在文章中。
- 未来展望以技术文章已记录的方向为准：减少闭源模型依赖、积累经过筛选的三元组数据、改善不可见表面以及复杂头发和配件。

## Full Voiceover Draft

只有 fenced `text` 中的英文用于配音。章节时间包含展示、点击和静默观察时间；口播不需要填满整个槽位。

### VO 01 | 0:00-0:20 | open_source_hook | Another Open-Source Model

- Audio file: `skin_reconstruction/audios/01_open_source_hook.mp3`
- Target duration: `20s`
- Visual direction: 全段保持标题与九组“参考图 → 3D 行走皮肤”九宫格；不显示作者、版本和链接，后续单案例轮播再补充完整署名。

```text
We have open-sourced another model for turning character images into Minecraft skins. To show the range of community results, we picked character images in very different styles. First we will look at those results, then try the pipeline online and explain how it works.
```

### VO 02 | 0:20-1:00 | why_another_model | Why Build Another One?

- Audio file: `skin_reconstruction/audios/02_why_another_model.mp3`
- Target duration: `40s`
- Visual direction: C01–C05。保持输入图可见，选择动漫、平涂、概念设计和带小装饰的插画；旁白结束后让最后两组完整转身。

```text
Why make another model? In previous versions, small decorative details were often the hardest part. A flower pattern, a butterfly hair clip, or a tiny bear on a shirt has to be translated into only a few pixels. When those features are treated as ordinary image detail, their contours can blur, their colors can mix, or their shapes can disappear. The new pipeline first reinterprets the character in a fixed Minecraft view, giving the reconstruction stage clearer structure to work with.
```

### VO 03 | 1:00-1:50 | community_showcase_1 | Community Showcase

- Audio file: `skin_reconstruction/audios/03_community_showcase_1.mp3`
- Target duration: `50s`
- Visual direction: 持续轮播社区皮肤。左侧输入参考图，右侧 3D 透明走动角色，右上方展示创作者与模型信息。

```text
Here are real results generated by community creators on EntropyDrop. Notice how different silhouettes, colors, and clothing details carry over into the block geometry—and where complex shapes had to be simplified.
```

### VO 04 | 1:50-2:40 | community_showcase_2 | Across Styles and Creators

- Audio file: `skin_reconstruction/audios/04_community_showcase_2.mp3`
- Target duration: `50s`
- Visual direction: 持续轮播不同艺术风格作品。留出充足纯音乐与 3D 旋转观察时间。

```text
These examples span diverse art styles—from anime and illustrations to game renders and painterly art. As each model turns, check whether the front, sides, and back remain visually coherent. Some details translate cleanly, while others are simplified or inferred where the original image provides no direct view.
```

### VO 05 | 2:40-3:30 | community_showcase_3 | Transparent 3D Results

- Audio file: `skin_reconstruction/audios/05_community_showcase_3.mp3`
- Target duration: `50s`
- Visual direction: 轮播最后几组皮肤，平滑过渡到网站实操演示。

```text
Take a moment to compare the seams, limb textures, and inferred back details as these characters move. Not every detail survives the conversion, so the 3D turn is an important check. Next, let's see how you can create and download your own skins on the website.
```

### VO 06 | 3:30-3:40 | try_it_online | Try It Online

- Audio file: `skin_reconstruction/audios/06_try_it_online.mp3`
- Target duration: `10s`
- Visual direction: 插入和 skingen VO 03 一样的在线体验画面（在线体验卡片，右侧浏览器线框显示 entropydrop.com 并播放生成的 skin_P8NBZUTB 3D 跳舞视频）。

```text
Want to try it yourself? Visit entropydrop.com for the free online generator. We also open-sourced the training details and model weights, so you can train or deploy it locally.
```

### VO 07 | 3:40-5:30 | website_walkthrough | Upload, 3D Viewer & Download

- Audio file: `skin_reconstruction/audios/07_website_walkthrough.mp3`
- Target duration: `110s`
- Visual direction: 网站真实录屏全屏展示。涵盖首页探索、进入 Generate 界面并保持停顿观察 5 秒（清晰展示 SKING DDJ 模型选项、生成参数与上传区），随后平滑衔接 3D 查看器实机操作：测试 Idle、Walk、Dance 动态，切换 Plane、Cute 等展示模式，最后点击 Download 下载皮肤 PNG。

```text
To try the model online, open entropydrop dot com and sign in, then upload a reference image. The model featured in this video is named the SKING DDJ series. Click the generate button, and after processing, the result opens directly in the 3D viewer. Once the result opens, you can test the character with three different motions: Idle, Walk, and Dance. Idle lets you inspect fine details in a steady pose, Walk checks limb articulation and joint alignment during movement, while Dance puts the model through full dynamic choreography. Next, you can inspect the skin in different display modes. Voxel mode adds visible depth to the skin texture, Plane mode shows the classic flat Minecraft box look, and Cute mode changes the character to chibi proportions, giving you another way to inspect how the design reads at a different scale. Once you are satisfied with the preview, click Download to save the skin as a PNG.
```

### VO 08 | 5:30-6:00 | how_pipeline_works | How the Pipeline Works: Stage 1 Fixed Views Generation

- Audio file: `skin_reconstruction/audios/08_how_pipeline_works.mp3`
- Target duration: `30s`
- Visual direction: 从网站操作平滑切入两阶段架构图，展示 Stage 1 固定视角生成机制：左侧角色参考图（Character Reference）+ 中间固定模板（Fixed Layout Templates）作为输入，经由中间带有 Google Gemini 图标的 NanoBanana 模型节点处理，右侧输出规范化正背面图（Normalized Dual Views）。

```text
The pipeline has two stages. In Stage One, Fixed Views Generation, NanoBanana receives the character reference alongside fixed layout templates that enforce an orthogonal dual-view camera and pose. By conditioning on these structural templates, NanoBanana synthesizes standardized front and back Minecraft views while preserving the character's identity and outfit. This stage relies on the closed-source NanoBanana model, while the surrounding pipeline workflow is fully open source.
```

### VO 09 | 6:00-6:45 | stage_two | Stage Two: Reconstruct the Skin

- Audio file: `skin_reconstruction/audios/09_stage_two.mp3`
- Target duration: `45s`
- Visual direction: 用三个连续问题组织画面：`1. Where does each visible pixel belong?`（前景、固定几何、内外层路由）→ `2. What fills the unseen surfaces?`（仅补全缺失的内层 texel）→ `3. Does it still match when rendered?`（头部与配件重渲染、材质校正）→ 最终 64×64 皮肤。

```text
Stage two turns those fixed views into the actual skin file by solving three problems. First: where does each visible pixel belong? Fixed geometry narrows the possibilities, and the Dense UV Parser chooses the body part, cube face, and inner or outer layer. Second: what should fill the surfaces that neither view can see? The pipeline completes only missing inner-layer texels with nearby or mirrored colors, without inventing new outer-layer geometry. Third: does the reconstructed head still match when rendered? The system renders it back into both views and keeps a material correction only when the visible match improves. The result is a standard sixty-four by sixty-four Minecraft skin.
```

### VO 10 | 6:45-7:35 | technical_details | Open Source & Technical Details

- Audio file: `skin_reconstruction/audios/10_technical_details.mp3`
- Target duration: `50s`
- Visual direction: 聚焦开源成果与深度技术细节获取渠道。不谈未来规划与路线图，重点展示 Hugging Face 仓库（EntropyDrop/Sking）界面、Stage Two 模型权重文件（`parser.pt`、`foreground.pt`、`pipeline.json`）、架构文档与评测指标；同步展示 GitHub 源码与网站在线体验链接，最后留出频道关注与链接卡片。

```text
You can try the pipeline directly on entropydrop.com. The complete two-stage workflow code is open source on GitHub, and all Stage Two model weights—including the Dense UV Parser and foreground segmentation model—are available on Hugging Face. For in-depth technical details on the geometry-driven UV reconstruction, semantic routing architecture, and full benchmarks, visit our Hugging Face repository at huggingface.co/EntropyDrop/Sking, or check out our technical article linked below. If you enjoyed this video, subscribe to the channel and leave a star on GitHub. Thanks for watching!
```

## Production Handoff

- 本稿确认前，保留现有 `skin_reconstruction/index.html`、占位素材清单、字幕和音频文件，不重新生成。
- 确认后，Hyperframes 按四幕重排：第 1–5 场为开场和多风格效果，第 6 场为在线体验卡片，第 7 场为网站完整教程，第 8–9 场为两阶段原理（Stage 1 规范视角生成与 Stage 2 几何解算重建），第 10 场为开源与技术细节（Open Source & Technical Details）。
- 网站教程占 3:40–5:30；两阶段原理占 5:30–6:45；开源与技术细节占 6:45–7:35（总长 7:35 / 455s）。
- 生成新旁白时使用本稿的新文件名，避免误用旧 MP3。

- 28 组素材接入后，根据真实输入修改每个 case 的风格标签；不要让旁白描述素材中看不到的特征。
- 录制 GitHub 和 Hugging Face 页面前，再次核对发布内容和链接。最终时码以实际配音与操作节奏为准。
