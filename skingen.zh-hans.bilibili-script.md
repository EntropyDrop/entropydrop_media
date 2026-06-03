# Bilibili 视频稿：AI 能把一张图变成能玩的 Minecraft 角色吗？

Source article: `frontend/public/articles/skingen.zh-hans.md`

Based on: `skingen.en.youtube-script.md`

## 视频定位

- 工作标题：AI 能把一张图变成能玩的 Minecraft 角色吗？
- 目标时长：11 到 12 分钟
- 平台：Bilibili 横屏技术向视频
- 形式：中文配音稿、中文字幕、图像动效和技术拆解
- 受众：AI 创作者、Minecraft 玩家、扩散模型微调实践者、游戏美术和技术美术
- 核心承诺：解释为什么“把图片变成 Minecraft 皮肤”不只是风格迁移，并展示一个可复现的 image-to-skin LoRA 训练流程。
- 语气：清楚、直接、有一点讲故事感。避免像论文汇报，尽量先讲人能看懂的画面，再解释背后的技术原因。

## 标题备选

1. AI 能把一张图变成能玩的 Minecraft 角色吗？
2. 为什么 AI 生成 Minecraft 皮肤比想象中难？
3. 我训练了一个把图片变成 Minecraft 皮肤的模型
4. 从照片到 MC 皮肤：一个生成模型的完整训练过程
5. Minecraft 皮肤生成背后的 2D 到 3D 难题

## B 站简介草稿

这期视频讲的是：如何训练一个把参考图片转换成可用 Minecraft 皮肤的生成模型。

它看起来像一个很简单的图片滤镜，但真正的问题不是“画得像不像 Minecraft”，而是输出结果能不能变成游戏里可以直接使用的标准皮肤文件。Minecraft 皮肤本质上是一张固定格式的 RGBA UV 图，里面包含身体不同部位、内外层结构和透明像素信息。

视频会拆解：

- 为什么通用图像模型很难直接生成有效 MC 皮肤
- 为什么训练目标要同时包含 UV 图和 3D 渲染预览
- 数据集如何设计
- 渲染参数为什么会影响训练质量
- 训练过程中模型如何逐步学会结构
- Alpha Marker 如何帮助恢复透明像素
- 这个项目还有哪些局限和后续方向

免费在线体验：
https://entropydrop.com

模型权重、数据集和脚本已开源：
https://huggingface.co/EntropyDrop/Sking

## 前 15 秒

### 画面

- 快速展示 12 组“原图 -> 生成皮肤”对比。
- 素材可以包含写真、动漫、油画、角色设定、人类角色和动物角色。
- 最后切入 Minecraft UV map 或折叠动画，让观众意识到这不是普通图片滤镜。

### 配音

想象一下，上传一张角色图片，几秒后得到一个真的能放进 Minecraft 里使用的角色皮肤。

听起来像一个普通图片滤镜，对吧？

但 Minecraft 风格的图片，不等于可玩的 Minecraft 角色。游戏里的角色是一个 3D 方块模型，外观来自一张按固定 UV 规则展开的 2D 皮肤图。

所以真正的问题是：AI 能不能把普通参考图，转换成这张标准 UV 图，并且让它在游戏里真的对得上？

### 屏幕文字

一张图输入。一个可玩的 Minecraft 角色输出。

## 主线分镜

| Time | Segment | Visual Direction | Voiceover Focus | On-Screen Text |
| :--- | :--- | :--- | :--- | :--- |
| 0:00-0:15 | Hook | 12 组原图到皮肤的快速对比，最后推近 UV 图 | 先让观众理解：这不是普通滤镜，而是生成一个游戏可用资产 | 图片输入 -> 可玩角色 |
| 0:15-0:55 | Show the result | 原图和生成皮肤成对轮播，从右滑入、停顿、再向左滑出 | 多种风格、多种角色和动物都可以转换，但目标不是完美，而是可用 | 参考图 -> Minecraft 皮肤 |
| 0:55-1:05 | Try it free online | 预留网站录屏位置，展示 entropydrop.com | 可以在线免费体验，也可以本地训练或部署 | 免费在线生成器：entropydrop.com |
| 1:05-2:00 | What a skin really is | 先特写 UV map，再特写 layer 图，最后播放 UV 折叠成 3D 模型的视频 | 解释固定 UV、overlay、alpha 和 2D 到 3D 的关系 | 标准 2D UV 图包住 3D 方块身体 |
| 2:00-2:55 | Why this is hard | 继续播放折叠动画，配三条规则卡片 | 像素位置、2D 到 3D 映射、透明通道 | 一个像素错位，也可能破坏皮肤 |
| 2:55-3:45 | General model failures | 展示通用模型失败案例和正确皮肤对比 | 好看的图不等于合规的游戏资产 | 通用图像模型不会强制遵守皮肤格式 |
| 3:45-4:35 | Fine-tuning strategy | Monadical 复合目标布局 | 同时训练 UV 图和 3D 渲染，让模型学会对应关系 | 训练结构，而不只是训练风格 |
| 4:35-5:15 | Why image-to-skin | 从文本生成方案切换到图像输入方案 | Monadical 主要从文本生成，我们希望从图片直接生成皮肤 | 文本输入 -> 图片输入 |
| 5:15-6:30 | Dataset design | Control image 和 Target image 并排展示，逐步高亮 UV、渲染视角和细节区域 | 控制图提供参考，目标图教会结构 | 数据集决定模型能学到什么 |
| 6:30-7:35 | Rendering decisions | 分组展示 plane/voxel、ortho/perspective、lighting、layer views | 渲染不是装饰，而是训练信号 | 渲染方式会影响模型理解 3D 结构 |
| 7:35-8:40 | Training convergence | 训练 checkpoint 时间线 | 从噪声到结构，再到细节和 Alpha Marker | 训练过程是逐步变清楚的 |
| 8:40-9:25 | Dataset expansion | 两种数据扩展方法：反向推断、自演化数据循环 | 难点是高质量配对数据，不只是更多图片 | 数据集也可以持续进化 |
| 9:25-10:15 | Post-processing | Alpha Marker 图和检测示意 | 扩散模型输出 RGB，透明像素需要后处理恢复 | Alpha Marker 把透明恢复变成特征检测 |
| 10:15-11:15 | Limitations | 第一屏讲局限，第二屏讲后续方向和 sub-style control | 可用但不完美，未来可以提升质量、风格控制和数据循环 | 可用，但还没到生产级完美 |
| 11:15-11:50 | Closing | 结尾资源页：在线生成器、Hugging Face、订阅提示 | 总结关键点和开源信息 | 免费体验、开源模型、欢迎关注 |

## Full Voiceover Draft

下面的章节是机器可读结构。`generate_voiceover_audio.py` 可以提取每个 `Voiceover text`，写入对应的 transcript，并在需要时生成音频。中文版本暂时可以先用 `--extract-only`，不要生成音频。

### VO 01 | 0:00-0:15 | hook | Hook

- Audio file: `skingen_zh_hans/audios/01_hook.mp3`
- Target duration: `15s`

**Voiceover text:**

```text
想象一下，上传一张角色图片，几秒后得到一个真的能放进 Minecraft 里使用的角色皮肤。

听起来像一个普通图片滤镜，对吧？

但 Minecraft 风格的图片，不等于可玩的 Minecraft 角色。游戏里的角色是一个 3D 方块模型，外观来自一张按固定 UV 规则展开的 2D 皮肤图。

所以真正的问题是：AI 能不能把普通参考图，转换成这张标准 UV 图，并且让它在游戏里真的对得上？
```

### VO 02 | 0:15-0:55 | results_first | Results First

- Audio file: `skingen_zh_hans/audios/02_results_first.mp3`
- Target duration: `40s`

**Voiceover text:**

```text
先看一些现在的生成结果。

输入可以是真人写真、动漫角色、油画风格、角色设定图，也可以是人类角色，甚至是动物。每一组都是同一个流程：参考图输入，生成一个 Minecraft 皮肤输出。

这些结果还不是完美的，但它们说明了这个模型真正想做的事：保留输入图片里的身份特征，把它压缩进很小的皮肤纹理空间里。

最后，还要让这张纹理真的能套到 Minecraft 的角色模型上。

这个组合，比普通的图片风格化要难得多。
```

### VO 03 | 0:55-1:05 | try_it_online | Try It Online

- Audio file: `skingen_zh_hans/audios/03_try_it_online.mp3`
- Target duration: `10s`
- Visual placeholder: 预留网站使用录屏位置，展示在线生成器的上传、生成、下载流程。

**Voiceover text:**

```text
如果你想先自己试一下，可以访问 entropydrop.com，使用免费的在线 Minecraft 皮肤生成器。我们也开源了训练细节和模型权重，你可以本地训练，也可以本地部署。
```

### VO 04 | 1:05-2:00 | what_a_minecraft_skin_really_is | What a Minecraft Skin Really Is

- Audio file: `skingen_zh_hans/audios/04_what_a_minecraft_skin_really_is.mp3`
- Target duration: `55s`
- Visual plan: 三段画面。第一段特写 `skingen_uv_map.png`，解释固定 UV 区域和 overlay 区域。第二段特写 `skingen_layers.png`，解释内层、外层、透明和不同身体部位的外层尺度。第三段播放 `skingen_zh_hans/assets/transform.mp4` 或同名循环视频，把平面 UV 图折叠到 3D 方块身体上。

**Voiceover text:**

```text
Minecraft 皮肤不是一张普通的角色图片。它是一张游戏按照固定坐标读取的纹理图。

UV 图告诉游戏：每一个矩形应该贴到哪里，比如头、身体、手臂和腿。如果某个区域移动了，纹理就会贴到 3D 模型的错误面上。

这里还有一个很重要的概念：overlay，也就是第二层纹理。很多身体部位都有两层。内层是基础身体，外层用来表现凸起的细节，比如头发、帽子、袖子、外套、盔甲或者配饰。

外层仍然存在同一张 2D 皮肤文件里，但 Minecraft 会把它渲染到稍微更大的外层方块上。透明的外层像素保持不可见，不透明的外层像素就会变成凸起细节。

所以 RGBA 很重要。颜色还不够，alpha 通道决定哪些外层像素真的存在。

layer 图还暴露出另一个细节：头部外层大约会向每个方向凸出半个像素，而身体、手臂和腿又有各自的缩放方式。所以外层几何本身也不是完全统一的。

折叠动画可以把核心问题直接展示出来：一张扁平的 UV 图，会被包到 3D 方块模型上，而且基础层和外层都必须落到正确的面上。

所以，生成一个可用的 Minecraft 皮肤，意味着模型要生成准确的 2D UV 布局，还要生成 3D 角色能够读取的外层和透明信息。
```

### VO 05 | 2:00-2:55 | why_the_structure_is_difficult | Why the Structure Is Difficult

- Audio file: `skingen_zh_hans/audios/05_why_the_structure_is_difficult.mp3`
- Target duration: `55s`
- Visual plan: 继续使用 VO 04 的 UV 到 3D 折叠动画，正常速度循环播放。右侧或下方用三张规则卡解释映射难点。

**Voiceover text:**

```text
严格的映射关系带来了三个问题。

第一，每个像素都有精确的空间意义。如果手臂纹理偏移了哪怕一个像素，3D 角色看起来就可能是坏的。

第二，模型必须理解 2D UV 图和 3D 身体之间的关系。围巾、外套或者一缕头发，可能会跨过多个身体部件。如果模型不理解几何关系，这些细节就可能出现在错误的面上，或者直接消失。

第三，Minecraft 皮肤依赖透明通道。alpha 决定外层哪些像素应该可见。大多数扩散图像模型默认生成的是 RGB 图片，而不是干净的 RGBA 纹理文件。

所以，模型并不是只在学习“Minecraft 风格”。它是在学习一个受约束的 2D 到 3D 编码系统。
```

### VO 06 | 2:55-3:45 | why_general_image_models_fail | Why General Image Models Fail

- Audio file: `skingen_zh_hans/audios/06_why_general_image_models_fail.mp3`
- Target duration: `50s`

**Voiceover text:**

```text
我们用通用多模态图像模型做过测试，也给过明确提示、UV 说明和参考图片。

请求听起来并不过分：请为这个角色生成一张 64 乘 64 的 Minecraft 皮肤 UV 图。

但一个可用皮肤，不能只看风格像不像。每一个可见像素都必须严格落到 64 乘 64 的标准网格里。

前两个输出乍一看有点像皮肤，但像素并没有严格对齐 Minecraft 的布局。它们可能会凭空生成区域、移动脸的位置、模糊结构边界、忽略内外层关系，或者无法输出可用的透明信息。

所以问题不是这些模型不会画好看的图。它们当然会。问题是它们不能稳定遵守 Minecraft 皮肤的精确格式。

对普通图片来说，结构近似可能能接受。但对一个有严格 UV 坐标的游戏纹理来说，近似就意味着资产不可用。
```

### VO 07 | 3:45-4:35 | the_fine_tuning_direction | The Fine-Tuning Direction

- Audio file: `skingen_zh_hans/audios/07_the_fine_tuning_direction.mp3`
- Target duration: `50s`

**Voiceover text:**

```text
只靠 prompt engineering 不够，所以我们转向微调。

一个很有启发的来源，是 Cory Spencer 在 Monadical 写的 Minecraft 皮肤生成系列文章。里面的关键想法是 composite target image，也就是复合目标图：输出的一部分是 UV 图，另一部分是同一张皮肤的 3D 渲染图。

这很重要，因为只训练 UV 图，模型看不到足够的 3D 结构。只训练渲染预览，又得不到真正能用的皮肤文件。

把两者放在一起，目标图就会告诉模型：这张扁平纹理，对应的是这个 3D 角色。

在我们的测试里，这种复合目标比单独训练其中任何一部分都稳定得多。
```

### VO 08 | 4:35-5:15 | why_image_to_skin_matters | Why Image-to-Skin Matters

- Audio file: `skingen_zh_hans/audios/08_why_image_to_skin_matters.mp3`
- Target duration: `40s`

**Voiceover text:**

```text
不过，我们和 Monadical 的方案还有一个重要区别。

Monadical 的流程主要是 text-to-skin，也就是从文本生成皮肤。它学习很多 prompt 和 target 的配对：文本输入，结构化的 Minecraft 皮肤目标输出。

我们保留这种配对训练思路，但换掉输入端。

我们的训练对是 control image 和 target image。control image 是视觉参考图。target image 是结构化输出：一张 UV 图，加上多个 3D 渲染视角。

这样模型学到的是一种转换规则：给一张新的参考图，生成同样格式的目标图。

之后，再通过后处理提取真正可用的 64 乘 64 Minecraft 皮肤。

这就是 image-to-skin 的意义：对大多数创作者来说，最自然的输入往往已经是一张图片，而不是一段文字描述。
```

### VO 09 | 5:15-6:30 | dataset_design | Dataset Design

- Audio file: `skingen_zh_hans/audios/09_dataset_design.mp3`
- Target duration: `75s`

**Voiceover text:**

```text
重新设计后的数据集，由成对的 control image 和 target image 组成。

control image 是输入。理想情况下，它包含一个正面的全身参考和一个背面的全身参考。这样模型能获得服装、发型、颜色和配饰的信息。

推理时，即使只有正面图，模型有时也能推断出一个合理的背面。但 control image 越完整，训练信号就越强。

target image 是模型要学习生成的输出。它包含一张完整的皮肤 UV 图，以及多个 3D 渲染视角。

左上区域是真正的 UV 纹理。右上区域包含主预览和放大的细节。底部区域包含从多个方向渲染的内层、外层视图，以及头部特写。

这里需要说清楚：Minecraft UV 布局本身是固定为标准皮肤格式的，这样我们才能可靠地提取出可用的皮肤文件。

灵活的是，训练目标图里面不同面板怎么摆放。

模型并不太在意 UV 图到底放在左上角还是别的位置。它更在意 target image 里包含了多少有用信息：UV 纹理、渲染视角、视角覆盖，以及清晰的 UV 到 3D 对应关系。
```

### VO 10 | 6:30-7:35 | rendering_choices | Rendering Choices

- Audio file: `skingen_zh_hans/audios/10_rendering_choices.mp3`
- Target duration: `65s`

**Voiceover text:**

```text
渲染参数最后变成了数据集质量里非常关键的一部分。

Plane mode 和 voxel mode 会用不同方式展示外层。Plane mode 把外层渲染成漂浮的平面。Voxel mode 把外层像素渲染成小方块。对于 Minecraft 风格的几何，voxel mode 往往能更清楚地展示凸起结构。

透视投影和正交投影也不一样。正交投影会保持尺寸不变。透视投影会让近处和远处的部分出现大小差异，这能提供额外的深度线索。

光照也很重要。关闭光照时，每个像素保留原始颜色，但相邻的同色方块会很难区分。打开光照后，阴影能揭示形体，让模型更容易学习映射关系，虽然局部高光可能影响颜色准确性。

实际经验很简单：渲染不是装饰，它本身就是训练信息。
```

### VO 11 | 7:35-8:40 | training_convergence | Training Convergence

- Audio file: `skingen_zh_hans/audios/11_training_convergence.mp3`
- Target duration: `65s`
- Visual plan: 用训练输出时间线展示 checkpoint。先展示 500、1000、1500、2000 steps 的四宫格，再切换到 2500 到 4000，接着展示 6000、8000、12000、16K，最后展示 18K 大图。

**Voiceover text:**

```text
理解这个训练过程，一个很直观的方式是看中间 checkpoint。

一开始，大约 500 到 2000 steps，输出基本还是模糊色块和混乱线条。到 2000 steps 左右，粗略的复合结构开始出现：一个区域像 UV 图，其他区域像角色渲染视图。

大约 2500 到 4000 steps 之间，结构变得更容易识别。头、身体、手臂和腿开始分离成更清楚的部件，主要服装颜色也开始落到正确的身体区域。

从 6000 到 16K steps，更多细节开始出现：五官、配饰、头发层、外套边缘，还有外层几何。Alpha Marker 的图案也变得更规律，这对后面的透明恢复很重要。

到 18K steps 之后，图像明显更清晰。像素边界更干净，角色细节更贴近参考图，marker 网格也更容易检测。

这些 checkpoint 并不能证明模型一定按固定顺序学习，但它们能让进展变得可见：输出先从噪声结构开始，然后布局、身体部件、纹理细节和 marker 图案逐步清楚起来。
```

### VO 12 | 8:40-9:25 | building_more_data | Building More Data

- Audio file: `skingen_zh_hans/audios/12_building_more_data.mp3`
- Target duration: `45s`

**Voiceover text:**

```text
一旦已经有皮肤 UV 图，target image 相对容易生成。用脚本把它们渲染出来就可以。

更难的是获得匹配的真实参考图。

一种策略是反向推断。从已有 Minecraft 皮肤出发，让多模态图像模型推断它可能对应的真实全身正面和背面参考图。

另一种策略是自演化数据合成循环。

第一步，用 LLM 生成多样化的角色描述。第二步，用文生图模型生成真实感参考图。第三步，用当前的 image-to-skin 模型生成目标图。然后筛选、修复并验证这些输出。高质量配对进入下一轮训练集，有缺陷的输出则尽可能修复，或者被用来分析问题、设计针对性改进。

这样，数据集构建就不再是一次性收集，而是一个持续进化的系统。
```

### VO 13 | 9:25-10:15 | post_processing_and_alpha_marker | Post-Processing and Alpha Marker

- Audio file: `skingen_zh_hans/audios/13_post_processing_and_alpha_marker.mp3`
- Target duration: `50s`

**Voiceover text:**

```text
生成之后，还有最后一个问题：怎么提取真正的 64 乘 64 皮肤文件。

扩散模型通常输出 RGB 图片，而不是干净的 RGBA 纹理。但 Minecraft 的外层需要透明信息。

简单的背景色阈值并不可靠。如果背景是灰色，而角色本身也有灰色像素，算法就可能把前景和背景混在一起。生成出来的边缘也可能被模糊成渐变。

为了解决这个问题，我们用了 Alpha Marker 策略。

在构建数据集时，UV 图里的透明像素会在中心放一个很小的白色 marker。模型会学习复现这些 marker。后处理时，提取算法检测这些小白点特征锚点，并把对应像素分类为透明。

它的局限是只能处理两种状态：完全透明和不透明。像玻璃或者面纱这种半透明材质，还需要更好的处理方式。
```

### VO 14 | 10:15-11:15 | limitations_and_future_work | Limitations and Future Work

- Audio file: `skingen_zh_hans/audios/14_limitations_and_future_work.mp3`
- Target duration: `60s`

**Voiceover text:**

```text
当前方法已经能生成可用例子，但还不完美。

多级透明还没有解决。复杂装饰可能会变模糊、断裂、错位，或者左右不对称。

后续方向很清楚。

一个方向是在 LoRA 之上加入 Direct Preference Optimization，也就是 DPO，让模型更偏向稳定、高质量的生成结果。

更大的基础模型，也可能提升质量和泛化能力。

Sub-style control 可以让同一张参考图生成不同风格的 Minecraft 皮肤。比如，我们可以控制输出从抽象到细节丰富，或者从写实风格到科幻风格。

更强的自演化数据循环，可以自动发现失败案例，修复能修复的输出，并把反复出现的问题转化成有针对性的改进。
```

### VO 15 | 11:15-11:50 | closing | Closing

- Audio file: `skingen_zh_hans/audios/15_closing.mp3`
- Target duration: `35s`

**Voiceover text:**

```text
Minecraft 皮肤生成看起来很小，但真正的挑战非常密集：模型必须同时理解 2D UV 图、3D 方块身体、内外层结构、透明像素，以及参考图里的角色身份。

这次实验里最有用的三个部分，是复合 target image、高质量数据构建流程，以及用于透明像素的 Alpha Marker。

如果这些部分继续改进，Minecraft 皮肤生成就不再像一次性的图片魔法，而更像一个可持续迭代的工程 pipeline。

我们已经开源了模型、数据集和脚本。你可以本地训练、本地部署，也可以直接在 entropydrop.com 使用免费的在线生成器。模型权重可以在 Hugging Face 的 EntropyDrop 组织下面找到。

欢迎关注，我们后面还会开源更多有趣的 AI 项目、创作工具和实验。感谢观看，我们下个实验见。
```

## 屏幕短字幕 Pass

这些是剪辑时可以穿插的短字幕。每屏只保留一到两句。

- 64x64 并不简单。
- 免费在线 Minecraft 皮肤生成器：entropydrop.com。
- 模型、数据集和脚本都已开源。
- 关注我们，后面会开源更多有趣项目。
- Minecraft 皮肤是 3D 身体的 2D 地图。
- UV 布局必须严格对齐。
- 外层结构依赖透明通道。
- 通用图像模型会画好看的图，但不一定能生成有效资产。
- 训练结构，而不只是训练风格。
- 复合目标：UV 图 + 3D 渲染。
- Monadical 从文本开始；这个项目从图片开始。
- 基础模型：Flux2 Klein 4B Base。
- 重新设计的数据集决定训练质量。
- 渲染参数也是训练信号。
- Checkpoint 能看到训练过程。
- Step 500：混乱。Step 18K：可用结构。
- Alpha Marker 在训练后期更容易被检测。
- Alpha Marker 把透明恢复变成特征检测。
- 现在可用，但还没有到生产级完美。

## 视觉素材清单

| Asset | Purpose |
| :--- | :--- |
| `assets/girl3_original.jpg` | 结果展示 |
| `assets/girl3_gen.jpg` | 结果展示 |
| `assets/cat2_original.jpg` | 结果展示 |
| `assets/cat2_gen.jpg` | 结果展示 |
| `assets/boy_original.jpg` | 结果展示 |
| `assets/boy_gen.jpg` | 结果展示 |
| `assets/girl_original.jpg` | 结果展示 |
| `assets/girl_gen.jpg` | 结果展示 |
| `assets/zx_original.jpg` | 结果展示 |
| `assets/zx_gen.jpg` | 结果展示 |
| `assets/boy2_original.jpg` | 结果展示 |
| `assets/boy2_gen.jpg` | 结果展示 |
| `assets/linux_original.jpg` | 结果展示 |
| `assets/linux_gen.jpg` | 结果展示 |
| `assets/pink_original.jpg` | 结果展示 |
| `assets/pink_gen.jpg` | 结果展示 |
| `assets/beethoven_original.jpg` | 结果展示 |
| `assets/beethoven_gen.jpg` | 结果展示 |
| `assets/boy3_original.jpg` | 结果展示 |
| `assets/boy3_gen.jpg` | 结果展示 |
| `assets/dog_original.jpg` | 结果展示 |
| `assets/dog_gen.jpg` | 结果展示 |
| `assets/cat_original.jpg` | 结果展示 |
| `assets/cat_gen.jpg` | 结果展示 |
| `assets/skingen_uv_map.png` | 解释 UV 结构 |
| `assets/skingen_layers.png` | 解释内外层结构 |
| `assets/transform_1x_vo04_loop.mp4` | UV 图折叠成 3D 模型 |
| `assets/gemini_pro_nano_banana2.png` | 通用模型失败案例 |
| `assets/gpt5_5_image2.png` | 通用模型失败案例 |
| `assets/perfect_dracula.png` | 正确 64x64 皮肤示例 |
| `assets/monadical_20260519.png` | Monadical 复合目标启发 |
| `assets/8880005_control_img.png` | control image 示例 |
| `assets/8880005.png` | target image 示例 |
| `assets/8880005_plane.png` | 渲染方式对比 |
| `assets/8880005_voxel.png` | 渲染方式对比 |
| `assets/8880005_ortho.png` | 投影方式对比 |
| `assets/8880005_perspective.png` | 投影方式和光照对比 |
| `assets/8880005_light_off.png` | 光照对比 |
| `assets/8880005_inner.png` | 内层渲染 |
| `assets/8880005_overlay.png` | 外层渲染 |
| `assets/8880005_both.png` | 内外层合并渲染 |
| `assets/train_500.jpg` | 训练 checkpoint |
| `assets/train_1000.jpg` | 训练 checkpoint |
| `assets/train_1500.jpg` | 训练 checkpoint |
| `assets/train_2000.jpg` | 训练 checkpoint |
| `assets/train_2500.jpg` | 训练 checkpoint |
| `assets/train_3000.jpg` | 训练 checkpoint |
| `assets/train_3500.jpg` | 训练 checkpoint |
| `assets/train_4000.jpg` | 训练 checkpoint |
| `assets/train_6000.jpg` | 训练 checkpoint |
| `assets/train_8000.jpg` | 训练 checkpoint |
| `assets/train_12000.jpg` | 训练 checkpoint |
| `assets/train_16000.jpg` | 训练 checkpoint |
| `assets/train_18000.jpg` | 训练 checkpoint |
| `assets/8880005_alpha.png` | Alpha Marker 解释 |
| `assets/fox_lowpoly_skin.png` | sub-style control 示例 |
| `assets/fox_realistic_skin.png` | sub-style control 示例 |
| `assets/fox_surreal_skin.png` | sub-style control 示例 |

## 推荐章节时间戳

- 0:00 - 为什么 Minecraft 皮肤生成不是普通滤镜
- 0:15 - 先看生成结果
- 0:55 - 免费在线体验
- 1:05 - Minecraft 皮肤到底是什么
- 2:00 - 为什么这个结构难生成
- 2:55 - 为什么通用图像模型会失败
- 3:45 - 用复合目标微调
- 4:35 - 为什么要做 image-to-skin
- 5:15 - 数据集设计
- 6:30 - 渲染参数为什么重要
- 7:35 - 从 checkpoint 看训练过程
- 8:40 - 如何继续扩展数据
- 9:25 - 用 Alpha Marker 恢复透明
- 10:15 - 局限和后续方向
- 11:15 - 开源资源和结尾

## B 站切片想法

### 切片 1：为什么 64x64 不简单

开头：Minecraft 皮肤只有 64 乘 64，但这不代表它简单。

节奏：

1. 展示 UV 图。
2. 折叠到 3D 身体。
3. 展示内外层。
4. 结尾：一个像素错位，也可能破坏整个资产。

### 切片 2：为什么通用 AI 生成不了合规 MC 皮肤

开头：通用图像模型可以画 Minecraft 风格角色，但很难生成真正可用的皮肤文件。

节奏：

1. 展示失败 UV 输出。
2. 高亮错位区域。
3. 解释透明通道缺失。
4. 结尾：它需要学习的是结构，不只是风格。
