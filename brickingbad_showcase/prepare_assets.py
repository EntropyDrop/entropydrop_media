#!/usr/bin/env python3
"""Import source files once, preserving original bytes and photo metadata."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def prepare_assets(edit):
    directory = Path(edit['importDirectory']).expanduser()
    for folder in ('sources', 'sources/showcase'):
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
    targets = {Path(path).name: ROOT / path for path in edit['sources'].values()}
    if directory.is_dir():
        targets.update({p.name: ROOT / 'sources/showcase' / p.name for p in directory.glob('*.jpg')})
    for shot in edit['shots']:
        if 'image' in shot:
            targets.setdefault(Path(shot['image']).name, ROOT / shot['image'])
    for name, target in targets.items():
        if target.exists():
            continue
        source = directory / name
        if not source.is_file():
            raise FileNotFoundError(f'Restore {target} or {source}')
        staging = target.with_suffix(target.suffix + '.importing')
        cloned = sys.platform == 'darwin' and subprocess.run(
            ['cp', '-c', '-p', str(source), str(staging)], capture_output=True).returncode == 0
        if not cloned:
            shutil.copy2(source, staging)
        if sha256(source) != sha256(staging):
            raise ValueError(f'Import hash mismatch: {name}')
        staging.replace(target)
        print(f'Imported {name}', flush=True)


if __name__ == '__main__':
    prepare_assets(json.loads((ROOT / 'edit.json').read_text()))
