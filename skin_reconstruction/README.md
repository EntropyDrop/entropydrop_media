# Skin Reconstruction Hyperframes

这是 约 6:48（407.709 秒）英文视频稿对应的 Hyperframes 工程，包含 10 段口播时间线、28 组社区成果、网站录屏、技术示意图和英文草稿字幕。

技术段已同步更新：4:42.709–5:12.709 展示模板引导的正交投影视图；5:12.709–5:57.709 用像素归属、未知内层补全、重渲染检查三个陈述式环节组织画面。三个环节的面板切换依据实际句级配音的段落边界，素材采用技术文章中的同一角色中间结果。

## 使用

```bash
npm run build
npm run check
npm run dev
```

## 替换素材

`assets` 链接到共享目录 `../assets`。社区成果由其中的 `skin_reconstruction/metadata.json` 驱动，当前包含 28 组参考图、皮肤和 360° 行走视频。全屏网站段使用 `assets/placeholder-manifest.json` 的 `website.upload` 条目，当前指向同步录屏：完整展示首页、生成页和 3D 查看器，末尾回放原录屏最后约 6.976 秒动态画面，播放窗口与旁白一致为 62.709 秒；录屏未展示登录、文件选择和下载点击。技术段直接使用构建脚本中引用的 `img24_*` 与 UV 中间结果图片；它们用于说明流程，不作为版本评测。

替换网站录屏时，为 `website.upload` 的 `src` 填入相对于本工程的路径。更换技术示例时，同步替换第一、第二阶段的参考图、双视图、路由图、UV 和重渲染结果，保持角色一致。修改后执行 `npm run build`。

脚本来源为 `../skin-reconstruction.en.youtube-script.md`。构建会更新 `index.html` 和 `meta.json` 的标题、时长，不调用配音服务。

## 配音

10 段英文旁白由 Qwen3-TTS 的 `entropydrop` 参考音频克隆音色生成，见 `audios/qwen3_tts_manifest.json`。当前版本按句合成，以接近参考声音的语速统一节奏，并在句间留出短暂停顿。第 3–5 段按真实 showcase 顺序逐个点评；第 7 段已删除第二遍检查旁白，下载说明直接接在模式演示之后；末尾以最后约 6.976 秒录屏回放保持动态；第 2 段末尾提醒观众对照手腕饰品、项链和裤子纹理，第 1 段第三句已重新录制，末尾补充第三组角色的深色头发与亮粉色装饰，旁白长 19.856 秒并覆盖 20 秒开场；第 6 段保持不变。原始克隆参考保存在 `audios/reference/`，句级原始合成保存在 `audios/qwen3_sentence_sources/`，本地先前版本保存在 `audios/qwen3_first_pass/` 和 `audios/qwen3_steady_pass/`，修订备份保存在 `audios/tts_revisions/`；这些历史目录和 `renders/` 导出目录不纳入 Git。`audios/voiceover_full.wav` 按当前 407.709 秒时间线合成，页面直接播放这条音轨。

运行 `python3 regenerate_audio.py --chapters 3-5,7-10` 可重新生成选定章节并重建总音轨。连接配置通过 `--url`、`ENTROPYDROP_TTS_URL` 或本地配置文件提供；部署帮助统一保存在仓库根目录的 `local_deployment/tts/`，该目录不纳入 Git。随后运行 `npm run build`，字幕会按每句实际音频时长分配，Stage Two 面板按段落边界切换；字幕仍未进行逐词强制对齐。`audios/metadata/` 和 `audios/subtitles/` 保留的是更早配音的历史结果，不用于当前页面。
