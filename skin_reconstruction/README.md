# Skin Reconstruction Hyperframes

这是新版 8:20 视频脚本对应的 Hyperframes 工程。目前使用占位素材，时间线、28 组社区成果、网站使用说明、技术说明和英文草稿字幕已经排好。

## 使用

```bash
npm run build
npm run check
npm run dev
```

## 替换素材

社区成果由 `../assets/skin_reconstruction/metadata.json` 驱动，当前包含 28 组参考图、皮肤和 360° 行走视频。网站录屏和技术示意图仍通过 `assets/placeholder-manifest.json` 配置；为对应条目的 `src` 填入相对路径，并将 `type` 设为 `video` 或 `image`。重新执行 `npm run build` 后，占位符会自动换成素材。

素材键包括：

- `website.upload`、`website.generate`、`website.preview`：网站操作录屏
- `technical.pipeline`、`technical.layers`：技术段落示意素材

脚本来源为 `../skin-reconstruction.en.youtube-script.md`。当前字幕按脚本与固定章节时间自动切分，正式旁白生成后还需要根据实际音频重新对齐。
