# YouTube Video Script: We Open-Sourced Another Image-to-Minecraft-Skin Model

## Draft Status

本稿只用于确认视频叙事。**确认前不要重新生成 Hyperframes、旁白、字幕或成片。**

英文口播采用四幕结构：**1. 开场与 20 组多风格效果；2. 网站使用说明；3. SKING_DDJ 的命名来源与两阶段原理；4. 未来展望。** 目标时长约 **8 分 20 秒**。

这次发布需要准确说明范围：**整个流水线代码已经开源**，包括从角色图到最终 64×64 皮肤的流程；但生成固定格式 Minecraft 正面与背面图的中间步骤依赖一个闭源图像模型。流水线开源不代表其中每个第三方依赖也开源，也不要暗示单个 checkpoint 就能复现完整结果。

参考来源：

- 技术文章：`../entropydrop_frontend/public/articles/skin-reconstruction.en.md`
- 网站操作：`../entropydrop_frontend/src/pages/GeneratePage.tsx`、`../entropydrop_frontend/src/components/MCModalPreview.tsx`
- 代码：https://github.com/EntropyDrop/SkingToolkit
- 模型资源：https://huggingface.co/EntropyDrop/Sking

## Video Positioning

- **Working title:** We Open-Sourced Another Image-to-Minecraft-Skin Model
- **Target length:** approximately 8:20
- **Format:** English voiceover, 20 multi-style examples, browser walkthrough, the SKING_DDJ origin story, a plain-language pipeline explanation, and a short future outlook
- **Audience:** Minecraft players, skin creators, open-source developers, and viewers interested in image-to-skin generation
- **Core promise:** Show what the pipeline produces across different input styles, teach viewers how to use it, credit DDJ for the original direction, explain the two stages, and show where the project goes next.
- **Tone:** Direct, visual, candid, and practical. Treat the comparisons as evidence instead of claiming that every result is better.

## Title Ideas

1. **We Open-Sourced Another Image-to-Minecraft-Skin Model**
2. Another Open-Source Minecraft Skin Model — 20 Results
3. From Image to Minecraft Skin: Our New Open-Source Release

推荐第一个标题。“Another”延续已有项目，也天然引出观众的问题：为什么还需要另一个模型？

## Thumbnail Copy Ideas

- ANOTHER OPEN-SOURCE MODEL
- IMAGE → MINECRAFT SKIN
- 20 INPUT STYLES

主画面使用一组辨识度高的 3D 对比，右上角放小型 GitHub / open-source 标识。不要在缩略图中堆版本号、网络名称或指标。

## YouTube Description Draft

We have open-sourced another model for turning character images into usable Minecraft skins.

This video starts with character images in different visual styles and compares each input with its 3D Minecraft skin. Then we use the model on EntropyDrop: upload a reference, generate a skin, inspect it from every angle, and download the PNG.

The complete pipeline code is open source, although one intermediate step still depends on a closed-source image model. We also explain why the model family is called SKING_DDJ: the name credits DDJ's earlier public work on the same two-stage direction. The final section shows how the two stages connect and what we want to improve next.

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
00:20 Why build another one?
01:00 Cartoon, chibi, and mascot styles
01:50 3D renders and game art
02:40 Painterly and mixed styles
03:30 Upload an image on EntropyDrop
04:10 Select a model and generate
04:45 Preview and download
05:30 Why it is called SKING_DDJ
06:15 Stage one: fixed front and back views
06:45 Stage two: reconstruct the skin
07:30 Where the project goes next

## First 20 Seconds

### Visuals

- 0:00–0:04: GitHub repository or release card appears briefly, then cut immediately to the examples.
- 0:04–0:08: `C01`, illustrated input beside its full 3D skin.
- 0:08–0:12: `C07`, cartoon or chibi input beside its result.
- 0:12–0:16: `C12`, 3D or game-art input beside its result.
- 0:16–0:20: `C17`, painterly input beside its result, with title and links appearing.

### On-Screen Text

WE OPEN-SOURCED ANOTHER MODEL

20 input styles · Live demo · Open-source pipeline

不要用代码滚屏开场。开源是新闻点，效果才是观众留下来的原因。

## Community Showcase Plan

### 展示画面的统一规则

- 采用**动态不固定数量**的效果展示，不刻意绑定单一主题，展示多样化的角色风格。
- 每组使用成对对比：**左侧为原始输入参考图**，**右侧为生成的 3D Minecraft 皮肤 360° 行走视频（透明背景 WebM）**。
- **合适位置标注作者信息**：显示创作者头像、用户名（通过 `api.entropydrop.com/api/logs/{id}` 获取）、使用的模型版本（如 `SKING_DDJ_v61`）以及任务编号。
- 轮播所有可用皮肤（当前共 28 组社区生成成果），在 0:20 至 3:30（共 190 秒）的时间段内平分轮播。
- 视频素材由 `skin_walk_video` 基于 `assets/skin_reconstruction/skin*` 生成透明背景 360° 步态循环，与背景完美融合。
- 文案采用前言解说，适度留白，留出纯音乐与 3D 旋转观察时间，后续可根据成片需要继续补充。

## Main Storyboard

| Time | Segment | Visual Direction | Voiceover Focus | On-Screen Text |
| :--- | :--- | :--- | :--- | :--- |
| 0:00–0:20 | Open-source hook | 发布页快速出现，随后展示多组高辨识度生成效果 | 我们又开源了一个模型；先看社区生成效果，再解释它 | Another open-source model |
| 0:20–1:00 | Why another model? | 社区成果轮播：左原图，右 3D 透明走动，右上标注作者 | 旧路线容易把小图案当作普通缩放；新流水线先理解再做低像素表达 | Community Showcase · Creator Attribution |
| 1:00–1:50 | Character identity | 持续轮播社区皮肤，展示脸部、发型与服装还原 | 解释两阶段前言：左侧输入与右侧 3D 皮肤的结构转换 | Preserving Distinctive Structure |
| 1:50–2:40 | Diverse art styles | 覆盖插画、3D 渲染、游戏图与绘画风格，适度留白 | 风格多样性与角色辨识度，观察不同角度的颜色一致性 | All Styles & Creators |
| 2:40–3:30 | Transparent 3D results | 保留部分观察空间与音乐，平滑过渡到网站实操 | 3D 旋转观察细节还原，引出在线实操 | 3D Skins in Motion |
| 3:30–4:10 | Website: upload | 地址、登录、Upload Reference | 上传参考图，介绍 SKING DDJ 系列并区分线上限免与本地部署 | 1. Upload a reference |
| 4:10–4:50 | Viewer: modes | 切换 Voxel、Plane、Cute 模式并旋转观察 | 介绍 3D Viewer 的 Voxel、Plane、Cute 三种渲染模式 | Modes: Voxel · Plane · Cute |
| 4:50–5:30 | Viewer: actions | 切换 Idle、Walk、Dance 动作，点击 Download | 介绍三种动作动画测试，确认效果后下载 PNG | Actions: Idle · Walk · Dance |
| 5:30–6:15 | How pipeline works | DDJ 的公开演示页面、当前模型名称 | 从网站实操转入原理，致敬 DDJ 的两阶段探索与命名来源 | How the Pipeline Works |
| 6:15–6:45 | Stage one | 参考图 + 模板 → 固定格式正背面图 | 前沿图像模型先理解角色，并把外观转换到统一 Minecraft 视图 | Reference → Fixed views |
| 6:45–7:30 | Stage two | 前景抠图 → 语义路由 → 拓扑补全 → 头部解码 → 材质拟合 | 详解第二阶段：从 72 面几何与内外层解析、拓扑补全到最终 64×64 皮肤 | Fixed views → Reconstructed Skin |
| 7:30–8:20 | Future outlook | 痛点、数据积累、链接、订阅卡片 | 剖析闭源依赖缺点，展望自有模型，呼吁订阅频道未来更多模型 | What comes next · Subscribe |

## Website Recording Notes

1. 打开 `https://entropydrop.com` 并登录。
2. 点击 **Upload Reference**，上传角色参考图。
3. 选择 **SKING DDJ** 系列模型并点击生成按钮。等待部分直接跳切，展示弹出的 3D 预览器。
4. 依次切换顶部的 **Voxel**、**Plane**、**Cute** 模式，拖动旋转展示立体像素、平面贴图与 Q 版比例差异。
5. 依次点击底部的 **Idle**、**Walk**、**Dance** 动作按钮，展示站立、行走与舞蹈三种动态表现。
6. 点击 **DOWNLOAD** 保存最终的 64×64 皮肤 PNG。

尽量使用已经出现在 20 组对比中的同一个角色，让效果展示、网站操作和技术说明形成一条完整故事线。

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
- Visual direction: 发布页只闪现一次，马上进入 C01、C11、C16。标题与链接在最后五秒出现。

```text
We have open-sourced another model for turning character images into Minecraft skins. To show what it can handle, we picked character images in very different styles. First we will look at the results, then try the pipeline online and explain how it works.
```

### VO 02 | 0:20-1:00 | why_another_model | Why Build Another One?

- Audio file: `skin_reconstruction/audios/02_why_another_model.mp3`
- Target duration: `40s`
- Visual direction: C01–C05。保持输入图可见，选择动漫、平涂、概念设计和带小装饰的插画；旁白结束后让最后两组完整转身。

```text
Why make another model? In the previous version, small decorative details were often the hardest part. A flower pattern, a butterfly hair clip, or a tiny bear on a shirt needs to be understood and redesigned with only a few pixels. Instead, these details were often handled like a simple resize, so their shapes could become blurry or disappear. The new pipeline introduces a state-of-the-art image model for this step. It can recognize what those details represent and express them again within a limited pixel resolution.
```

### VO 03 | 1:00-1:50 | community_showcase_1 | Community Showcase

- Audio file: `skin_reconstruction/audios/03_community_showcase_1.mp3`
- Target duration: `50s`
- Visual direction: 持续轮播社区皮肤。左侧输入参考图，右侧 3D 透明走动角色，右上方展示创作者与模型信息。

```text
Here are real results generated by community creators on EntropyDrop. On the left is the original reference image; on the right is the full 3D skin in motion, complete with author attribution. Notice how the key silhouette, colors, and clothing structures are preserved on the block model.
```

### VO 04 | 1:50-2:40 | community_showcase_2 | Across Styles and Creators

- Audio file: `skin_reconstruction/audios/04_community_showcase_2.mp3`
- Target duration: `50s`
- Visual direction: 持续轮播不同艺术风格作品。留出充足纯音乐与 3D 旋转观察时间。

```text
These examples span diverse art styles—from anime and illustrations to game renders and painterly art. The pipeline focuses on keeping character identity intact from every angle as each model turns.
```

### VO 05 | 2:40-3:30 | community_showcase_3 | Transparent 3D Results

- Audio file: `skin_reconstruction/audios/05_community_showcase_3.mp3`
- Target duration: `50s`
- Visual direction: 轮播最后几组皮肤，平滑过渡到网站实操演示。

```text
Take a moment to look at how these characters hold up from every angle in motion. Next, let's see how you can create and download your own skins on the website.
```

### VO 06 | 3:30-4:10 | website_upload | Upload a Reference

- Audio file: `skin_reconstruction/audios/06_website_upload.mp3`
- Target duration: `40s`
- Visual direction: 网站真实录屏。显示地址、上传动作和预览，点击之间留停顿。

```text
To try the model online, open entropydrop dot com and sign in, then upload a reference image. The model featured in this video is named the SKING DDJ series. Click the generate button, and you will get your result. For our hosted service, high server costs make continuous free access hard to sustain, so we periodically open free access on the website—if you're lucky. If you prefer local deployment, the entire pipeline and model are open source, so you can run it for free without restrictions.
```

### VO 07 | 4:10-4:50 | viewer_modes | 3D Viewer: Display Modes

- Audio file: `skin_reconstruction/audios/07_viewer_modes.mp3`
- Target duration: `40s`
- Visual direction: 打开 3D 预览器，依次点击切换顶部的 Voxel、Plane、Cute 模式，拖动旋转展示立体像素、平面贴图与 Q 版比例差异。

```text
Once the result opens in the 3D viewer, you can inspect it in three different display modes. Voxel mode extrudes every pixel into 3D volume, giving the skin physical depth. Plane mode shows the classic flat Minecraft box look, while Cute mode transforms the character into adorable chibi proportions.
```

### VO 08 | 4:50-5:30 | viewer_actions | Animations and Download

- Audio file: `skin_reconstruction/audios/08_viewer_actions.mp3`
- Target duration: `40s`
- Visual direction: 依次点击底部的 Idle、Walk、Dance 动作按钮，展示角色动态；最后点击 DOWNLOAD 按钮保存皮肤 PNG。

```text
At the bottom, you can test three different animation types. Idle lets you inspect details in a calm standing pose, Walk shows how the clothing and limbs move naturally, and Dance brings the character to life with fun moves. Once you are satisfied with the preview, click Download to save the skin as a PNG.
```

### VO 09 | 5:30-6:15 | how_pipeline_works | How the Pipeline Works

- Audio file: `skin_reconstruction/audios/09_how_pipeline_works.mp3`
- Target duration: `45s`
- Visual direction: 从网站操作平滑切入架构图；显示 DDJ 的 2025 演示，再回到 `SKING_DDJ` 名称与两阶段概述。页面日期和作者需要可读。

```text
Now that you've seen how to use it, let's look at how the pipeline actually works—and why the model is named SKING_DDJ. The name gives credit to DDJ, who publicly explored this two-stage direction before us. In late 2025, DDJ demonstrated using the Banana image model to help create Minecraft skins. Our first-stage prompt is also adapted from his version. We kept DDJ in the name to honor that origin, while building a redesigned reconstruction pipeline on top of it. Now, let's break down how those two stages work.
```

### VO 10 | 6:15-6:45 | stage_one | Stage One: Create Fixed Views

- Audio file: `skin_reconstruction/audios/10_stage_one.mp3`
- Target duration: `30s`
- Visual direction: 使用同一角色展示 `Reference + three layout examples → normalized front/back views`。只突出视角、姿势和画面位置统一。

```text
The pipeline has two stages. In stage one, the image model receives the character reference together with Minecraft examples that share the same camera, pose, and layout. It then creates a front and back view in that fixed format. The examples are there to keep the geometry stable, not to add new character details. This stage is where the pipeline uses a closed-source image model, while the surrounding workflow code is open source.
```

### VO 11 | 6:45-7:30 | stage_two | Stage Two: Reconstruct the Skin

- Audio file: `skin_reconstruction/audios/11_stage_two.mp3`
- Target duration: `45s`
- Visual direction: 固定正背面图 → 前景抠图与几何对齐 → Dense UV Parser 内外层路由 → 拓扑内部补全 → 头部解码与材质拟合 → 最终 64×64 皮肤。

```text
Stage two turns those fixed views into the actual skin file. A Minecraft skin is a flat sixty-four by sixty-four texture wrapped around 72 cube faces across an inner base and outer layer. First, the pipeline extracts the character silhouette, then our Dense UV Parser routes every pixel to its correct body part, cube face, and layer. Hidden surfaces—like the inner arms and legs—are completed through topological inpainting, while a dedicated head decoder resolves complex hair and accessories across 3D seams. Finally, the colors are refined to produce the finished skin.
```

### VO 12 | 7:30-8:20 | future_outlook | What Comes Next

- Audio file: `skin_reconstruction/audios/12_future_outlook.mp3`
- Target duration: `50s`
- Visual direction: 先显示闭源依赖的痛点（格式不稳导致生成失败、发型头饰多样性欠缺），再切到数据积累与未来自有模型；最后展示网站、GitHub 与频道关注订阅卡片。

```text
This release is one step, not the end of the project. The largest dependency is still the closed-source image model in stage one, and relying on it has real downsides. It cannot guarantee a valid fixed format every time, which can cause skin generation to fail, and its diversity for hairstyles and head accessories is still limited. We want to collect reviewed examples connecting the character, fixed views, and final skin to reduce that dependency. For now, you can try the pipeline on EntropyDrop. All code, model weights, and our technical article are linked below. If you enjoyed this, subscribe to the channel—we'll have many more interesting models to share soon. Thanks for watching!
```

## Production Handoff

- 本稿确认前，保留现有 `skin_reconstruction/index.html`、占位素材清单、字幕和音频文件，不重新生成。
- 确认后，Hyperframes 按四幕重排：第 1–5 场为开场和多风格效果，第 6–8 场为网站教程，第 9–11 场为 DDJ 命名与两阶段原理，第 12 场为未来展望和链接。
- 网站教程缩短到 3:30–5:30；DDJ 与原理占 5:30–7:30；未来展望占 7:30–8:20。
- 生成新旁白时使用本稿的新文件名，避免误用旧 MP3。
- 20 组素材接入后，根据真实输入修改每个 case 的风格标签；不要让旁白描述素材中看不到的特征。
- 录制 DDJ 资料、GitHub 和 Hugging Face 页面前，再次核对作者、发布日期、公开内容和链接。最终时码以实际配音与操作节奏为准。
