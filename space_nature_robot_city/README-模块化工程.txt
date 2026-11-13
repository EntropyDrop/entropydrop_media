Space 科幻无人机建城：中文版模块化工程

当前成片：exports/space_nature_robot_city_zh_latest.mp4
1080p / 30 fps / 6分53.1秒 / 中文 entropydrop 配音 / 不烧录字幕。
上一个成片保存在 exports/space_nature_robot_city_zh_previous.mp4。

以后直接在这个目录修改，不新建版本文件夹。告诉助手时间点或下列模块名，即可局部替换。

00:00  01_cold_open  五台无人机，共同建设一座城
00:35  02_nature_site  从 Nature 地形开始
01:06  03_team_design  五个独立的施工角色
01:32  04_agent_build  从提示词到参数化蓝图
02:13  05_survey_and_tools  先检查，再开工
02:46  06_road_builder  先建立城市的连接
03:13  07_overpass  立交必须真的接得通
03:45  08_parallel_builders  两台建筑无人机并行施工
04:20  09_tree_planter  从街道种到屋顶
04:50  10_pause_road  暂停一台机器，会发生什么
05:20  11_builder_handoff  把未开工的任务交给另一台
05:49  12_city_walkthrough  飞进建好的城市
06:24  13_reuse_and_close  把规则变成可复用的作品

总文案：voiceover.zh.txt
模块：modules/<模块名>/script.zh.txt、voice.zh.wav、voice.zh.json、module.json、preview.zh.mp4
module.json 中的 clips 决定该段画面；配音按内容哈希缓存在 audios/zh。
画面来源、真实控制器状态与操作事件保存在 footage/*.capture.json。

局部文案：修改 voiceover.zh.txt，运行 python3 scripts/video.py import，然后仅对目标模块执行 tts 和 build。
局部剪辑：修改目标 module.json，然后 python3 scripts/video.py build <模块名>。
整片预览：python3 scripts/video.py stage；检查 pending 成片后再替换固定 latest 文件。
scripts/robot-city/edit-scifi.py 是当前剪辑映射；若手动改 module.json，也同步这里以免后续覆盖。

重建开发场景：python3 scripts/stage-runtime.py 将固定源文件和已验证蓝图复制回 Space 的 .local/robot-city。
控制器版本：scifi-city-v9-separated-commits。五台独立四旋翼，无限资源，无运输机。
完整蓝图 4,239,627 个方块已核对；长程功能验证采用检查点恢复。
暂停实验使用三段健康的原生录制拼接。两次较长录制中的植树脚本触发了原有 50ms 限制；失败记录与恢复依据保存在 review。成片不包含异常帧，也不作为连续运行稳定性证明。
原生施工与任务消息都实际执行；成城展示镜头从验收后的蓝图恢复。AI 辅助设计，运行时没有 LLM 决策。

QA：review/final-qa.zh.json、review/scifi-native-causality.json、review/scifi-capture-final-qa.json。
当前等待中文版反馈；尚未制作本期英文版，也未发布本期机器人到 Market。
