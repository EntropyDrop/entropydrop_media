Nature 城市 · 微格建筑、道路、立交与绿化风格样品

阶段：风格评审。先确认本页的建筑、道路、桥梁和绿化，再接入机器人施工、修改中文版视频。
继续使用 space_nature_robot_city 这一个模块化工程，后续原位更新本目录。

风格方向
暖灰石基、奶油色灰泥、深色木梁，搭配赭红 / 蓝灰 / 苔绿瓦顶。
六个房型改变轮廓、层数、屋顶和使用场景，而不是只更换墙面颜色。
01 石基花窗小屋；02 木构阳台排屋；03 街角工匠作坊；
04 L形乡村旅舍；05 四坡顶廊屋；06 八角角楼住宅。
07 暖灰石板直路；08 同材质弧形转角；09 赭红砖丁字街口；10 蓝灰石十字街口。

生成算法
generateHouse({ kind, seed, roof, shutters, flowers }) 返回原生 Space PortableEntity。
kind: cottage | townhouse | workshop | inn | farmhouse | tower。
roof: clay | slate | moss。seed 决定砖石和瓦片的稳定配色；更换种子不会产生闪烁噪声。
generateRoad({ kind, finish, seed, sidewalk }) 返回同一原生格式。
kind: straight | curve | tee | cross。finish: cobble | brick | slate。
房屋由地基、空心墙体、楼板/楼梯、木架、开口、玻璃、门窗细节、屋顶和附属空间组成。
所有单元为原生 0.125 米微格；只移除完全包在不透明体素内部的单元。
墙体开洞后放窗框和 60% 透明玻璃，屋面按成块瓦片着色；花箱、栏杆、工作台均为实际微格。
道路用中心线距离场统一生成车行带、排水带、路沿和人行道；交叉口取道路并集，弯道使用圆弧距离场。
道路接口约定：12 米长模块，5 米车行带，带人行道总宽 7.75 米，W/E/N/S 接口同宽同高。
砖缝齐平，避免一个微格的凹槽变成 12.5 厘米深的路面沟壑。
地基下伸 1 米用于嵌入轻微起伏的地面；本轮不是任意坡地适配器。较大高差仍需施工前勘测、台阶或坡道方案。

文件
models/architecture/：二十二个 .pb（游戏可分别导入）和对应 .json、manifest.json。
scripts/robot-city/architecture/：生成算法、导出器及开发预览代码的固定位置。
review/architecture/：同一游戏引擎内拍摄的 1080p 样品图、索引页和验证报告。
模型使用统一组件，以 part 字段区分施工阶段；接入机器人时仍需按实际写入结果验收。

重新生成（在 entropydrop_space 仓库根目录运行；Node 24 环境）
node --import ./engine/test/setup.ts ../entropydrop_media/space_nature_robot_city/scripts/robot-city/architecture/export.ts ../entropydrop_media/space_nature_robot_city/models/architecture
修改 generate.ts 中 housePresets / roadPresets 的参数即可改变样品；同一个种子会得到相同输出。
生成器会检查原生导入、确定性、微格对齐、坐标重复、65,536 体素预算和道路接口契约。

本轮边界
样品和截图用于确认风格。没有更改现有成片，没有发布市场，没有改动线上 Nature 世界。
当前的道路施工、物流路径和建筑验收仍运行旧蓝图；风格确认后再迁移，不能把本轮样品当作已经验证的新机器人施工系统。

立交桥生成算法
bridges.ts / generateBridge({ kind, seed, level })。
kind: core | ramp | street；level 为 0–3，决定引道模块的起始高度。
双层跨线桥，上下层正交分离，包含石砌桥墩、双侧纵梁、金属护栏、路沿、排水带和人行道。
6 种组件组成 11 个独立实体：1 主桥、两端各 4 段引道、2 下层衔接道路。
每段引道长 12 米、上升 1.375 米；全长 108 米，纵坡约 11.46%，几何净空 4.375 米。
这是游戏内风格原型；当前不包含上下层之间的转弯匝道。实体基础下伸 3 米。
interchange-layout.json 保存各组件相对于组合原点的坐标与 Y 轴旋转（弧度）。
overpass-kit.zip 包含原生组件与拼装表；解压后分别导入 .pb，ZIP 不是游戏的单实体导入格式。
全部新桥梁和树木使用包围盒中心作为原生 pivot，避免模块渲染中心产生错层。

树木生成算法
landscape.ts / generateTree({ kind, seed, height, crownScale })。
kind: oak | birch | pine | maple | cherry | willow。
橡树使用分枝团簇冠，白桦使用窄高冠及白色斑纹树皮，松树使用七层锥状枝叶；
红枫为秋色宽冠，花树为粉白扁冠，柳树具有下垂枝叶。
seed 同时改变分枝位置与树冠轮廓；固定种子得到相同原生模型。
height 是形态标尺（允许 4–11 米），并非严格包围盒高度；crownScale 允许 0.65–1.2。
实际尺寸、微格数量与校验值见 manifest.json。

种植算法
landscape.ts / generatePlanting({ pattern, seed, count, width, depth, exclusions, heightAt })。
pattern: avenue | grove | courtyard。
avenue：两侧错列行道树；本组 8 株白桦，中央为规划道路通道。
grove：混合树种、确定性随机分布；本组 12 株，保留中央步行走廊。
courtyard：花树、红枫与白桦围合；本组 6 株，避开中央建筑占地。
exclusions 是 minX/maxX/minZ/maxZ 矩形，clearance 控制退让距离。
通过树冠半径检查树间距离和禁种区；不会为凑数强行重叠，返回 requestedCount/placedCount 供调用方验收。
heightAt(x,z) 可接入地形采样；样品图逐株使用 Nature 真实高度放置，无新增展示平台。
种植配置保存为 planting-avenue.json、planting-grove.json、planting-courtyard.json。

额外验证（在 Space 仓库根目录运行）
node ../entropydrop_media/space_nature_robot_city/scripts/robot-city/architecture/validate-landscape.ts ../entropydrop_media/space_nature_robot_city/models/architecture
检查原生 pivot、种子对几何的影响、树冠间距、建筑/道路避让、组合重叠、连续路面和桥下几何净空。
实景取景位置、完整地形加载状态和相机记录保存在 review/architecture/landscape-render-evidence.json。
桥梁落地仍需土方和端点衔接设计；驾驶性能、任意坡地适配与机器人施工验收尚未完成。
