# YouTube Video Script: Another Open-Source Model: Image to Minecraft Skin

## Draft Status

本稿已用于当前 Hyperframes 预览、旁白和字幕。后续改文案时，以本稿的 fenced `text` 为准，同步更新对应文稿并重新生成受影响的音频。

英文口播采用四幕结构：**1. 开场与 28 组社区生成效果；2. 网站使用说明；3. 两阶段原理；4. 开源与技术细节（Open Source & Technical Details）。** 目标时长约 **6 分 48 秒**。

这次发布需要准确说明范围：**完整两阶段流水线代码已经开源，Stage Two 的皮肤重建代码与模型权重也已公开**，可以把规范化的 Minecraft 正背面图重建为最终 64×64 皮肤；但从任意角色图生成这些固定格式正背面图的 Stage One 仍需要调用兼容的闭源图像模型。可以称流水线代码为开源，但不要暗示 Stage One 的外部依赖也已开源、完整流程可以免费离线运行，或单个 checkpoint 就能复现完整结果。

参考来源：

- 技术文章：`../entropydrop_frontend/public/articles/skin-reconstruction.en.md`
- 网站操作：`../entropydrop_frontend/src/pages/GeneratePage.tsx`、`../entropydrop_frontend/src/components/MCModalPreview.tsx`
- 代码：https://github.com/EntropyDrop
- 模型资源：https://huggingface.co/EntropyDrop/Sking

## Video Positioning

- **Working title:** Another Open-Source Model: Image to Minecraft Skin
- **Target length:** approximately 6:43
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
https://github.com/EntropyDrop

Model resources:
https://huggingface.co/EntropyDrop/Sking

Technical article:
https://entropydrop.com/public/blog/skin-reconstruction

Chapters:
00:00 We open-sourced another model
00:15 Why build another one?
00:55 Community showcase: character identity
01:45 Across styles and creators
02:35 Transparent 3D results
03:25 Try it online
03:35 Upload, 3D viewer & download
04:38 How the Pipeline Works: Stage 1 Template-guided views
05:08 Stage two: reconstruct the skin
05:53 Technical details & Hugging Face repo

## Opening 15.301 Seconds

### Visuals

- 0:00–0:15.301: 首屏持续显示标题，依次轮播两组代表案例；旁白在 14.751 秒结束后立即开始 0.55 秒滑动过渡，完成后接入模型对比与 VO 02。
- 每组左侧显示原始参考图，右侧播放对应的透明背景 3D 行走视频，中间用箭头建立输入与结果的对应关系。
- 两组案例展示不同画风、配色和角色结构；每组右下角显示作者头像和用户名，不显示模型版本或链接。

### On-Screen Text

WE OPEN-SOURCED ANOTHER MODEL

Community results · Live demo · Open-source reconstruction

不要用代码滚屏开场。开源是新闻点，效果才是观众留下来的原因；画面文案避免使用 `any`、`perfect`、`flawless` 或 `high-fidelity` 等绝对化词语。

## Community Showcase Plan

### 展示画面的统一规则

- 采用**动态不固定数量**的效果展示，不刻意绑定单一主题，展示多样化的角色风格。
- 每组使用成对对比：**左侧为原始输入参考图**，**右侧为生成的 3D Minecraft 皮肤 360° 行走视频（透明背景 WebM）**。
- **右下角标注作者信息**：显示创作者头像和用户名（通过 `api.entropydrop.com/api/logs/{id}` 获取）。
- 当前共 28 组社区成果：开场 2 组，模型对比 2 组，0:55.301 至 3:25.301 的展示段轮播其余 24 组。
- 视频素材由 `skin_walk_video` 基于 `assets/skin_reconstruction/skin*` 生成透明背景 360° 步态循环，与背景自然融合。
- 文案采用前言解说，适度留白，留出纯音乐与 3D 旋转观察时间，后续可根据成片需要继续补充。

## Main Storyboard

| Time | Segment | Visual Direction | Voiceover Focus | On-Screen Text |
| :--- | :--- | :--- | :--- | :--- |
| 0:00–0:15.301 | Open-source hook | 标题 + 两组依次轮播的“参考图 → 3D 行走皮肤” | 我们又开源了一个模型；先用两组社区效果建立视觉证据，再解释它 | Another open-source model · Community results |
| 0:15.301–0:55.301 | Why another model? | 社区成果轮播：左原图，右 3D 透明走动，右上标注作者 | 旧路线容易把小图案当作普通图像细节；新流水线先转换到固定 Minecraft 视图，再进行重建 | Community Showcase · Creator Attribution |
| 0:55.301–1:45.301 | Character identity | 持续轮播社区皮肤，展示脸部、发型与服装转换 | 引导观众观察哪些轮廓、配色和服装特征得以保留，以及哪些细节因方块结构被简化 | Translating Distinctive Structure |
| 1:45.301–2:35.301 | Diverse art styles | 覆盖插画、3D 渲染、游戏图与绘画风格，适度留白 | 观察角色转身时正面、侧面和背面的视觉连贯性，不宣称所有细节都能保留 | Diverse Styles & Creators |
| 2:35.301–3:25.301 | Transparent 3D results | 保留部分观察空间与音乐，平滑过渡到网站实操 | 通过动作检查接缝、肢体贴图与背面推断，再引出在线实操 | 3D Skins in Motion |
| 3:25.301–3:35.301 | Try it online | 在线体验卡片与 3D 跳舞示例 | 免费生成器与开源部署入口 | entropydrop.com |
| 3:35.301–4:38.010 | Website walkthrough | 展示生成页、3D 查看器、Walk/Dance、Cute 和 Download 按钮；末尾回放最后约 6.976 秒动态画面 | 依次说明参考图、模型、展示模式、动作和 PNG 下载 | Upload · 3D Viewer · Download |
| 4:38.010–5:08.010 | How pipeline works | 参考图 + 模板 → 固定格式正背面图 | Stage 1 用模板引导正交投影、姿态与画面位置；生成视图仍可能偏离模板，影响后续重建 | How the Pipeline Works: Stage 1 Template-guided views |
| 5:08.010–5:53.010 | Stage two | 同一角色贯穿三个陈述式环节：像素映射到皮肤层、补全缺失内层、重渲染指导优化 | 固定几何与语义判断共同决定像素归属；只补未知内层；用双视图重渲染检查局部头部修正并优化可见头部颜色，输出 64×64 皮肤 | Pixel routing · Inner-layer completion · Re-rendering check |
| 5:53.010–6:43.010 | Technical details | Hugging Face 仓库、模型权重清单、GitHub 源码、在线生成器与订阅卡片 | 简化结尾，不谈未来规划；重点引导观众访问 Hugging Face 仓库获取模型权重、技术架构与评测细节 | Hugging Face · Open Source · Subscribe |

## Website Recording Notes

当前录屏从首页进入 Image to Skin 页面，显示上传区和 SKING DDJ 选项；登录、文件选择和生成等待没有录入。约第 12 秒直接跳到 3D 结果。查看器先展示 Voxel 下的 Idle、Walk、Dance，随后鼠标经过 Plane 并选择 Cute。右侧始终可见参考图，底部可见蓝色 Download 按钮，但录屏没有实际点击下载。旁白按这个可见顺序讲解，不把未录到的步骤说成已经操作完成。录屏末尾回放最后约 6.976 秒动态画面，配合下载说明。

尽量使用已经出现在 28 组社区成果中的同一个角色，让效果展示、网站操作和技术说明形成一条完整故事线。

## DDJ Naming and Principle Notes

- `SKING_DDJ` 中的 `DDJ` 用于致敬 DDJ 对这条路线的公开探索，并标明思路来源。
- 只陈述文章能够支持的时间线：DDJ 在 2025 年末公开演示使用 Banana 图像模型辅助 Minecraft 皮肤生成。
- 当前第一阶段提示词改编自 DDJ 推荐的版本。不要把我们的后续改进说成对整条路线的首次发明。
- 完整流水线代码已经开源，但第一阶段调用的中间图像模型仍是闭源依赖。画面可以同时展示 GitHub 流水线代码和闭源依赖标记。
- 原理只讲两步：`Reference → normalized front/back views`，再到 `front/back views → 64×64 skin → 3D check`。网络结构与训练指标留在文章中。
- 未来展望以技术文章已记录的方向为准：减少闭源模型依赖、积累经过筛选的三元组数据、改善不可见表面以及复杂头发和配件。

## Full Voiceover Draft

只有 fenced `text` 中的英文用于配音。每段口播覆盖对应画面的主要时长，仅在画面转场和完整转身处留短暂停顿。

### VO 01 | 0:00-0:15.301 | open_source_hook | Another Open-Source Model

- Audio file: `skin_reconstruction/audios/01_open_source_hook.mp3`
- Target duration: `15.301s`（旁白 14.751 秒，随后滑动转场 0.55 秒）
- Visual direction: 全段保持标题并依次轮播两组“参考图 → 3D 行走皮肤”；第一组保持 10 秒，第二组展示至 14.751 秒旁白结束后立即开始滑动转场，不等待角色旋转视频播完；0.55 秒动画完成后，在 15.301 秒接入 VO 02 模型对比和旁白。右下角显示作者头像和用户名，不显示模型版本和链接。原第三组 Célular 角色移至 VO 05 最后。

```text
We have open-sourced another model for turning character images into Minecraft skins. To show the range of community results, we picked character images in very different styles. First we will look at those results, then try the pipeline online and explain how it works.
```

### VO 02 | 0:15.301-0:55.301 | why_another_model | Why Build Another One?

- Audio file: `skin_reconstruction/audios/02_why_another_model.mp3`
- Target duration: `40s`
- Visual direction: 依次展示两组“参考图、旧模型、新模型”并列对照。第二组出现后，引导观众对照手腕饰品、项链和裤子纹理；参考图与两个皮肤预览保持可见。

```text
Why make another model? In previous versions, small decorative details were often the hardest part. A flower pattern, a butterfly hair clip, or a tiny bear on a shirt has to be translated into only a few pixels. When those features are treated as ordinary image detail, their contours can blur, their colors can mix, or their shapes can disappear. The new pipeline first reinterprets the character in a fixed Minecraft view, giving the reconstruction stage clearer structure to work with. Look closely at the wrist accessories, the necklace, and the textures on the trousers. Compare those small details in the reference image with the previous and new skin previews.
```

### VO 03 | 0:55.301-1:45.301 | community_showcase_1 | Community Showcase

- Audio file: `skin_reconstruction/audios/03_community_showcase_1.mp3`
- Target duration: `50s`
- Visual direction: 按当前八组案例的顺序逐个点评：蓝金外套、白发与黑色袖纹、皇冠与蓝金长裙、蓝色格纹袖子与紫色内衬、半身参考图、粉发与面罩、双色羽织、红白服装。每句旁白对应一张卡片，左侧输入参考图，右侧 3D 透明走动角色，右下方展示创作者头像与用户名。

```text
Here are more community creations, starting with the blue jacket, gold sleeve trim, and white collar wrapped around the shoulders. The white-haired character keeps the open jacket and bare chest, with the sleeve pattern reduced to chunky black pixels. The crowned character keeps her long brown hair and blue-and-gold colors; the flowing skirt becomes trousers and red boots. The dark coat has a blue checkered sleeve; its purple lining becomes small patches of color on the legs. The close-up gives us pale hair, purple eyes, and a hoodie; everything below the shoulders has to be invented. Then there's the pink hair and black face covering, with purple arm markings and yellow details on the trousers. The next character keeps the two-tone coat: burgundy on one side, green-and-yellow checks on the other, plus white leg wraps. Finally, white hair and red sleeve markings, with black cuffs framing the wrists.
```

### VO 04 | 1:45.301-2:35.301 | community_showcase_2 | Across Styles and Creators

- Audio file: `skin_reconstruction/audios/04_community_showcase_2.mp3`
- Target duration: `50s`
- Visual direction: 开头接续红白服装的袖口细节，然后依次点评青绿色发束与黑夹克、紫色连帽衫的袖口和背部图案、小鲨鱼的项圈与吊牌、紫白制服的红色眼部和胸前图案、蓝绿格纹衬衫、浅色衬衫与背带、蓝色发尾与红外套；段尾随棕色西装角色登场作简短引入。每句对齐相应卡片的显示时间。

```text
The cuffs have red edging, too. The ice cream is gone, but the teal hair streaks, amber eyes, and black jacket are all still there. The purple hoodie has cyan sleeve bands and matching trouser accents, plus the big wave graphic across the back. The shark becomes a blue character with a white belly, toothy grin, pink collar, and gold tag at the neck. This purple-and-white suit keeps the red eye shapes and wrist bands, though the thin chest emblem gets much simpler. Here we've got the plaid shirt, black glasses, and dark jeans; the blue-and-green checks continue around the back, too. The next shirt comes out much paler than the reference, with narrow suspenders, black glasses, and a checked trouser pattern. The blond hair ends in blue, with yellow trim on the red jacket and blue markings down one forearm. Next, a brown blazer and tie.
```

### VO 05 | 2:35.301-3:25.301 | community_showcase_3 | Transparent 3D Results

- Audio file: `skin_reconstruction/audios/05_community_showcase_3.mp3`
- Target duration: `50s`
- Visual direction: 开头接续棕色西装的格纹与白色袖口，然后依次点评青紫长外套、绿紫头发与白色大领口、白发蒙眼角色、粉色衣裙人偶、花纹长袍人偶、青色角与白色连帽衫、浅色服装和深色靴子的冒险者；最后展示从 VO 01 移来的 Célular 角色，关注深色头发与亮粉色装饰。每句对齐对应卡片，保留作者信息，本段仍为 50 秒。

```text
The brown blazer gets a checked pattern, with white cuffs and dark trousers. This pixel reference keeps dark hair, a black coat, cyan sleeves, and purple leg panels. The wavy green-and-purple hair becomes straight stripes, over a wide white collar, purple jacket, and boots with green toes. The swordsman keeps the white hair and blue blindfold; the blade is gone, while blue patterns cover the sleeves. This doll keeps long blond hair and a pink outfit, with the dress's stitched flowers reduced to pale patches. Another doll, now in a floral robe: pink-and-green sleeve patterns, a pale sash, and dark trim at the ankles. The white hoodie and cyan horns carry over, with black trousers and matching shoe accents. Next come the goggles, a pale outfit, and a pair of dark boots. The final skin keeps the dark hair and bright pink accents from the character sheet.
```

### VO 06 | 3:25.301-3:35.301 | try_it_online | Try It Online

- Audio file: `skin_reconstruction/audios/06_try_it_online.mp3`
- Target duration: `10s`
- Visual direction: 插入和 skingen VO 03 一样的在线体验画面（在线体验卡片，右侧浏览器线框显示 entropydrop.com 并播放生成的 skin_P8NBZUTB 3D 跳舞视频）。

```text
Try the free generator at entropydrop dot com. Training details and model weights are open source, so you can deploy it locally.
```

### VO 07 | 3:35.301-4:38.010 | website_walkthrough | Upload, 3D Viewer & Download

- Audio file: `skin_reconstruction/audios/07_website_walkthrough.mp3`
- Target duration: `62.709s`
- Visual direction: 保留 55.733 秒网站真实录屏：进入 Generate 界面，展示 SKING DDJ 选项、上传区和跳切后的 3D 查看器操作。末尾回放原录屏最后约 6.976 秒动态画面，覆盖下载说明；全段按旁白时长播放 62.709 秒，然后切入原理讲解。

```text
Open Entropydrop dot com and enter the skin generator. In Image to Skin mode, upload a character reference and select the SKING DDJ model.

The recording jumps over the processing wait and opens the result in the 3D viewer. The reference remains beside the result as the character turns. Now Walk shows the moving arms and legs. Check whether sleeves and trouser colors stay aligned at the joints. Dance makes the movement larger, exposing any gaps in the outer layer or mismatched patches. Then use the display controls along the top. The menu offers Voxel, Plane, and Cute; here Cute changes the figure's proportions. As the smaller figure moves, compare its face and outfit with the reference at the right. Turn it toward the side to check whether hair and clothing colors continue around the body. Changing display mode changes the preview, while the downloaded skin PNG stays the same. The source stays visible beside it.

When it looks good, the blue Download button saves a standard sixty-four by sixty-four PNG. That file is the finished skin you can use in Minecraft.
```

### VO 08 | 4:38.010-5:08.010 | how_pipeline_works | How the Pipeline Works: Stage 1 Template-guided views

- Audio file: `skin_reconstruction/audios/08_how_pipeline_works.mp3`
- Target duration: `30s`
- Visual direction: 从网站操作平滑切入两阶段架构图：左侧角色参考图（Character Reference）+ 中间固定模板（Fixed Layout Templates）作为输入，经由带有 Google Gemini 图标的 NanoBanana 模型节点处理，右侧输出规范化正背面图（Normalized Dual Views）。叠加模板轮廓说明正交投影、姿态与画面位置的引导作用，标注 `Template-guided views`；讲到偏差时展示轮廓错位如何影响后续对应关系，避免把模板画成能严格锁定生成结果的几何约束。

```text
How the Pipeline Works? Stage One starts with the character reference and several fixed layout templates. NanoBanana uses them to produce front and back Minecraft views with a similar camera, pose, and placement. The templates guide the image model; they cannot force exact geometry. A shifted arm or tilted camera can make later pixel mapping less reliable. The output here is a pair of normalized views, not yet a skin. The image model is a closed-source dependency, while the surrounding workflow code is open source.
```

### VO 09 | 5:08.010-5:53.010 | stage_two | Stage Two: Reconstruct the Skin

- Audio file: `skin_reconstruction/audios/09_stage_two.mp3`
- Target duration: `45s`
- Visual direction: 使用同一角色的真实中间结果，依次点亮三个陈述式卡片，按实际配音安排切换：`1. Pixels map to skin layers` 展示前景分离和可见像素到身体部位、表面及皮肤层的映射，配合文字解释固定几何候选与头部语义判断。`2. Missing inner pixels are filled` 对照已观测 UV 与内层补全后的 UV，说明仅填充未知内层像素；已知内层与完整外层在这一步保持不变。`3. Rendered views guide refinement` 对比输入与重渲染的正背面图，配合文字说明有证据支持的局部头部修正与可见头部颜色优化，并标示最终输出为 64×64 RGBA 皮肤。
- Technical guardrails: 以 v101/v101c 技术文章为准。前景分离不负责重塑网格；头部语义分支不表述为通用复杂发型或配件接缝修复器。内层补全不生成新外层像素。若展示王冠几何修正，只展示重渲染证据支持的外层头顶像素移除；可见材质拟合只更新头部颜色、固定 alpha 与身体贴图，并仅接受降低重建误差的更新。三个环节是叙事分组，不暗示所有局部修正共用一个损失或构成三个独立网络。

```text
Stage Two first separates the character from the background. Fixed geometry lists the body parts, cube faces, and skin layers that could own each visible pixel. The Dense UV Parser uses evidence from both views to choose a supported route, with special decisions around hair and headwear.

Some inner-layer pixels are never visible in two views. The pipeline fills only those unknown cells, preferring a mirror or a nearby color from the same body part. Known inner pixels and the outer layer stay unchanged.

Finally, re-rendered front and back views test targeted head corrections. Visible head colors update only when they reduce reconstruction error; alpha and the body texture stay fixed. The result is a standard sixty-four by sixty-four skin, ready for inspection in motion.
```

### VO 10 | 5:53.010-6:43.010 | technical_details | Open Source & Technical Details

- Audio file: `skin_reconstruction/audios/10_technical_details.mp3`
- Target duration: `50s`
- Visual direction: 聚焦核心开源成果与链接。页面精简展示三大核心入口卡片（GitHub 仓库源码、Hugging Face 模型权重与架构文档、YouTube 频道订阅），去除冗余信息卡、体验卡与文字说明，画面清爽聚焦。

```text
Here are the three places to continue. GitHub contains the workflow code and inference tools. The code covers both stages, but generating the normalized front and back views still requires a compatible closed-source image model. On Hugging Face, you can find the Stage Two weights, configuration, and documentation for local reconstruction. The technical article linked below explains how geometry constrains pixel routing, how missing inner-layer pixels are filled, and how re-rendering checks the result. They also document remaining limits, including occluded surfaces and complicated hair or accessories. The video description also links the online generator if you want to try your own character image. Compare the reference with the skin from front, side, and back before downloading. We will keep documenting the limits as well as the improvements. Subscribe to EntropyDrop for more open-source Minecraft projects. Thanks for watching!
```

## Production Handoff

- 当前旁白已按本稿生成，并由 `skin_reconstruction/audios/qwen3_tts_manifest.json` 记录句级时长。第一段第三句已重新录制；第二段末尾提醒观众对照手腕饰品、项链和裤子纹理。
- 确认后，Hyperframes 按四幕重排：第 1–5 场为开场和多风格效果，第 6 场为在线体验卡片，第 7 场为网站完整教程，第 8–9 场为两阶段原理（Stage 1 模板引导的规范视角生成与 Stage 2 像素归属、内层补全和重渲染检查），第 10 场为开源与技术细节（Open Source & Technical Details）。
- 网站教程占 3:35.301–4:38.010；两阶段原理占 4:38.010–5:53.010；开源与技术细节占 5:53.010–6:43.010（总长 6:43.010 / 403.010s）。
- 网站录屏采用 `assets/website/vo07_website_walkthrough_synced_keyframes.mp4`，完整保留原录屏，末尾回放最后约 6.976 秒动态画面，播放时长与旁白一致为 62.709 秒；没有展示登录、文件选择或实际下载点击。后续章节紧接音频结束，总长 6:43.010 / 403.010s。字幕和 Stage Two 面板切换按句级音频时长对齐。

- 28 组素材接入后，根据真实输入修改每个 case 的风格标签；不要让旁白描述素材中看不到的特征。
- 录制 GitHub 和 Hugging Face 页面前，再次核对发布内容和链接。最终时码以实际配音与操作节奏为准。
