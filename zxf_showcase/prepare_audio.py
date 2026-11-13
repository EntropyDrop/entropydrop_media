#!/usr/bin/env python3
"""Prepare the user's selected, licensed Night Sky Hip Hop recording."""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--analyze',action='store_true');args=parser.parse_args()
    meta=json.loads((ROOT/'music-source.json').read_text());source=ROOT/meta['sourceFile']
    source.parent.mkdir(parents=True,exist_ok=True)
    if not source.exists():
        temporary=source.with_suffix('.downloading')
        request=urllib.request.Request(meta['downloadUrl'],headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request,timeout=60) as response:temporary.write_bytes(response.read())
        assert hashlib.sha256(temporary.read_bytes()).hexdigest()==meta['sourceSha256'],'Downloaded music differs from licensed source record'
        temporary.replace(source)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==meta['sourceSha256'],'Music source changed'
    if args.analyze:
        env=dict(os.environ,NUMBA_CACHE_DIR=str(ROOT/'.cache/numba'))
        subprocess.run([sys.executable,str(ROOT/'analyze_music.py'),'--input',str(source),'--start-bpm','90'],check=True,env=env)
        (ROOT/'music-beats.json').write_text((ROOT/'audios/beat-analysis.json').read_text())
    print(source)


if __name__=='__main__':main()
