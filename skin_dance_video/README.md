# Skin Dance Video Generator

This is a copied-out version of the frontend Minecraft skin dancing renderer.
It uses the same `MC.tsx` / `utils.ts` skin model code and the same FBX dance
files, then records the WebGL canvas in headless Chrome.

## List Dances

```bash
npm run list-dances
```

## Generate A Video

```bash
npm run render -- \
  --skin /path/to/skin.png \
  --dance "Breakdance 1990" \
  --out outputs/breakdance.mp4 \
  --duration 6 \
  --fps 30 \
  --width 1080 \
  --height 1920
```

## Call From Any Directory

Use the root script so your relative `--skin` and `--out` paths are resolved
from the directory where you run the command:

```bash
/Users/ha/Documents/entropydrop_website/entropydrop_media/skin_dance_video/render_skin_dance_video.mjs \
  --skin dr_strange.png \
  --dance "BBoy Hip Hop Move" \
  --out iron_breakdance.webm \
  --background transparent \
  --format webm \
  --width 1024 \
  --height 1024 \
  --duration 10 \
  --yaw 18 \
  --scale 0.8
```

The script copies local skin files into `public/generated/`, starts a temporary
Vite server, records the canvas to WebM in headless Chrome, and converts it to
MP4 with ffmpeg.

## Generate A Walking Video

```bash
npm run render -- \
  --skin /path/to/skin.png \
  --walk \
  --out outputs/walk.mp4 \
  --duration 6 \
  --fps 30
```

## Useful Options

```bash
--dance "Twist Dance"
--walk
--mode voxel
--mode plane
--background "#12151f"
--background transparent --format webm
--spin
--yaw -18
--scale 1.1
--format both
```

MP4 does not preserve alpha. Use `--background transparent --format webm` when
you need a transparent WebM overlay asset.
