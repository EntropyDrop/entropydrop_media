# EntropyDrop Media

Video projects are split by language while sharing the same media assets.

```text
assets/             Shared images, videos, and fonts.
skingen_en/         English Hyperframes project.
skingen_en_shorts/  English vertical Shorts project using the first 3 chapters.
skingen_zh_hans/    Simplified Chinese Hyperframes project scaffold.
generate_voiceover_audio.py
update_hyperframes_from_tts.py
minimax_tts.py
skingen.en.youtube-script.md
```

The English project owns its generated audio under `skingen_en/audios/`.
The Chinese project is intentionally scaffolded without generated voiceover or
subtitles for now.

Common commands:

```bash
cd entropydrop_media/skingen_en
npm run check
npm run dev
```

To regenerate English TTS later from `entropydrop_media/`:

```bash
python3 generate_voiceover_audio.py --only 15 --force --save-metadata --subtitle-type word
python3 update_hyperframes_from_tts.py --rebuild-combined-audio
```

For Simplified Chinese, use `skingen.zh-hans.bilibili-script.md`, then point
the same helpers at the Chinese project paths. Use `--extract-only` when you
only want to prepare transcripts without generating audio.

```bash
python3 generate_voiceover_audio.py \
  --script skingen.zh-hans.bilibili-script.md \
  --transcript-dir skingen_zh_hans/audios/transcripts \
  --output-dir skingen_zh_hans/audios \
  --subtitle-dir skingen_zh_hans/audios/subtitles \
  --metadata-dir skingen_zh_hans/audios/metadata \
  --extract-only
```
