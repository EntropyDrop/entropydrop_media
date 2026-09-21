# Skin Reconstruction Hyperframes

这是新版 8:20 视频脚本对应的 Hyperframes 工程。目前使用占位素材，时间线、20 组对比、网站使用说明、技术说明和英文草稿字幕已经排好。

## 使用

```bash
npm run build
npm run check
npm run dev
```

## 替换素材

编辑 `assets/placeholder-manifest.json`，为对应条目的 `src` 填入相对路径。支持视频与图片；`type` 使用 `video` 或 `image`。重新执行 `npm run build` 后，占位符会自动换成素材。

素材键包括：

- `comparison.C01.previous` 到 `comparison.C20.reconstruction`：20 组旧版/重建版对比
- `website.upload`、`website.generate`、`website.preview`：网站操作录屏
- `technical.pipeline`、`technical.layers`、`technical.limits`：技术段落示意素材

脚本来源为 `../skin-reconstruction.en.youtube-script.md`。当前字幕按脚本与固定章节时间自动切分，正式旁白生成后还需要根据实际音频重新对齐。
