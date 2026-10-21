# EntropyDrop Media

Video projects are split by language while sharing the same media assets.

```text
assets/             Shared images, videos, and fonts.
print_custom_figure/ Make Your Own Figure at Home; shared assets and timeline, with landscape (1920 × 1080) and portrait (1080 × 1920) exports.
techno_showcase/    Techno figure showcase; 8-photo opening + centered skin installation + beat-synced cuts + finished-figure ending; landscape and 9:16 Douyin exports.
daweidai_showcase/  Daweidai figure; 3-photo opening + skin installation + 120 BPM electronic soundtrack; 88-second landscape and 59-second portrait exports.
3d_printed_mini_gundam/ Mini Gundam; 75-second assembly and skin application montage + 13-second photo ending, with landscape and portrait exports.
skin_walk_video/    MCModal Walk animation with a full 360-degree turn; MP4/WebM CLI.
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

Git stores code, edit configurations, documentation, prompts, and small source
dependencies. Generated audio (including transcripts, subtitles and API response
metadata), imported recordings/photos, renders, review files, caches and local
credentials stay on disk and are ignored. Existing source assets larger than
5 MiB are also ignored by explicit path; restore those assets locally before
building projects that use them. Audio can be regenerated with the commands below.

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
