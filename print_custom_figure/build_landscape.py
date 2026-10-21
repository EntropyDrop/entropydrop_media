#!/usr/bin/env python3
"""Build the landscape composition and publish its synchronized final export."""
import subprocess

from media_common import ROOT, check_export, output_path, write_landscape_manifest
from finalize_audio import finalize


def main():
    subprocess.run(['node','build.mjs'],cwd=ROOT,check=True)
    target = output_path('landscape')
    target.parent.mkdir(parents=True,exist_ok=True)
    staging = target.with_name(target.stem+'.rendering.mp4')
    subprocess.run(['npx','--yes','hyperframes@0.6.6','render','--fps','30','--quality','high','--sdr',
                    '-o',str(staging)],cwd=ROOT,check=True)
    finalize(staging,write_manifest=False)
    staging.replace(target)
    write_landscape_manifest()
    check_export('landscape')


if __name__=='__main__':
    main()
