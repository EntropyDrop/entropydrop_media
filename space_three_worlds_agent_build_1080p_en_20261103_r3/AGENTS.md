# Space vlog editing workflow

This is the persistent modular project. Never create a new dated/revision project directory for a local edit unless the user explicitly requests a separate copy.

- Read README-模块化工程.txt first. English inputs are project.json and modules/<id>/{module.json,script.en.txt,voice.json}. Chinese inputs are project.zh.json and the corresponding *.zh files.
- Keep both languages at 1920x1080, 30fps, entropydrop narration, without subtitles unless the user requests otherwise. Physical demonstrations stay in real time.
- English: scripts/video.py tts/build <id>, assemble, check --full. Fixed output: exports/space_three_worlds_latest.mp4.
- Chinese: scripts/dub.py tts/build <id>, assemble, check --full. Fixed output: exports/space_three_worlds_zh_latest.mp4.
- Regenerate only changed narration. Keep content-addressed audio, source footage, and omitted modules for reuse. Never use the legacy whole-film generators for local edits.
- Both workflows use content hashes and atomic output replacement. Validate changed previews, adjacent cuts, script/source correspondence, narration quality, and the assembled movie before delivery.
- The intro/closing montage references current vehicle modules. Preserve the closing dependencies on modules 10, 17, and 22.
- Retained R3 reference artifacts and earlier review reports are historical snapshots; do not overwrite them.

## Confirmed bilingual synchronization

The user explicitly approved synchronizing the Chinese edits into English on 2026-11-04. The old English freeze in review/english-frozen-for-chinese-review.json is a historical approval-stage manifest, not a current block on English work.

Both active orders contain 22 modules. Modules 14_rover_light_a and 15_rover_light_b are omitted in both languages, with their assets retained. Module 24_backpack_market appears before 23_close in both languages.

Chinese timing and video are independent of the English base:
- project.zh.json has independent=true. Existing shared chapters use modules/<id>/timing.zh.json to preserve approved timing anchors; these are timing metadata, not the current English author script.
- natural_timing_modules contains 24_backpack_market, whose Chinese timing follows its own narration.
- module.zh.json and video.zh.mp4 exist for all active Chinese modules. Source footage remains shared. Initial identical caches were hardlinked, and atomic output replacement keeps later language edits independent.
- The historical English reference hash identifies the original timing reference. Changing English no longer invalidates Chinese outputs.
- Do not rebuild or re-time approved Chinese audio just because English phrasing changes. Use dub.zh.json duration_overrides only when needed and keep paragraph boundaries valid.
- 双语模块预览.html shows each language's active order and independent preview/master files.

Before another synchronization, compare semantic revisions and preserve the other language's approved files. Review/english-sync-before.json records the state immediately before this synchronization. scripts/test_dub_pipeline.py verifies independent timing, footage, order changes, and preservation of the other language's movie.

## Standalone Chinese subtitles

The user requested Chinese subtitle files on 2026-11-04. Fixed exports are exports/space_three_worlds_zh_latest.srt and .vtt; the approved movies remain without burned-in captions. Run python3 scripts/subtitles_zh.py after Chinese assembly. It verifies script/timeline agreement and aligns known text against the rendered voice.zh.wav, with per-paragraph content hashes in modules/<id>/subtitles.zh.alignment.json. Module-local subtitles.zh.srt/.vtt are reusable. Existing alignment caches require only the standard library and ffprobe; changed narration requires faster-whisper 1.2.1, numpy, scipy and jieba 0.42.1. Keep subtitle timecodes tied to current-timeline.zh.json, never to the English timeline. See review/subtitles.zh.json for coverage, timestamp and format validation.
