# Skin Reconstruction Hyperframes

这是 7:35（455 秒）英文视频稿对应的 Hyperframes 工程，包含 10 段口播时间线、28 组社区成果、网站录屏、技术示意图和英文草稿字幕。

技术段已同步更新：5:30–6:00 展示模板引导的正交投影视图；6:00–6:45 用像素归属、未知内层补全、重渲染检查三个陈述式环节组织画面。三个环节的面板切换和字幕共用按段落词数分配的时间窗口，素材采用技术文章中的同一角色中间结果。

## 使用

```bash
npm run build
npm run check
npm run dev
```

## 替换素材

`assets` 链接到共享目录 `../assets`。社区成果由其中的 `skin_reconstruction/metadata.json` 驱动，当前包含 28 组参考图、皮肤和 360° 行走视频。全屏网站录屏使用 `assets/placeholder-manifest.json` 的 `website.upload` 条目。技术段直接使用构建脚本中引用的 `img24_*` 与 UV 中间结果图片；它们用于说明流程，不作为版本评测。

替换网站录屏时，为 `website.upload` 的 `src` 填入相对于本工程的路径。更换技术示例时，同步替换第一、第二阶段的参考图、双视图、路由图、UV 和重渲染结果，保持角色一致。修改后执行 `npm run build`。

脚本来源为 `../skin-reconstruction.en.youtube-script.md`。构建会更新 `index.html` 和 `meta.json` 的标题、时长，不调用配音服务。当前预览使用草稿字幕，没有接入完整旁白；正式旁白生成后还需要根据实际音频重新对齐。
