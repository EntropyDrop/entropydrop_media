# Top 5 Marvel Shorts EN

Vertical Hyperframes project for a YouTube Shorts countdown.

## Asset Slots

Place replacement images and skin dance videos in `assets/` using the filenames
in `assets/manifest.json`, or update the `data-src` / `data-bg-src` / `video src`
paths in `index.html` if you prefer different filenames.

Suggested asset type:

- Original images: portrait or square images, used full-screen first and then
  as the lower-left thumbnail.
- Minecraft skin dance videos: WebM preferred, square transparent or clean
  background render, used as the main visual during the reveal.

## Commands

```bash
npm run dev
npm run check
npm run render
```

## Timing

Total duration is 52 seconds at 1080x1920.
Each rank uses the same sequence:

1. Full-screen countdown number.
2. Full-screen original image.
3. Original image shrinks to the lower-left while the Minecraft skin becomes
   the dominant visual.
