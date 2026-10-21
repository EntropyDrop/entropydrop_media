#!/usr/bin/env python3
"""Check both exports and verify their shared timeline and AAC audio."""
from build_vertical import ROOT, check, load_config
from media_common import audio_hash, check_export, output_path


def main():
    check_export('landscape')
    check(load_config(),ROOT)
    assert audio_hash(output_path('landscape'))==audio_hash(output_path('portrait'))
    print('Both formats verified: one timeline and identical AAC audio.',flush=True)


if __name__=='__main__':
    main()
