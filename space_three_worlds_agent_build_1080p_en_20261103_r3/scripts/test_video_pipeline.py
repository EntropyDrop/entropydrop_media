"""Integration test of cache invalidation, dependencies and failure safety.

Uses tiny temporary generated video/audio fixtures. Never changes the real movie.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np

spec=importlib.util.spec_from_file_location('video',Path(__file__).with_name('video.py'))
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

class IncrementalVideoTest(unittest.TestCase):
    def test_changes_rebuild_only_dependencies_and_preserve_good_outputs(self):
        with tempfile.TemporaryDirectory(prefix='space-video-test-') as td:
            r=Path(td);cfg=v.read(v.ROOT/'project.json')
            cfg['order']=['a','b','close'];cfg['format'].update(width=160,height=90)
            cfg['encoder'].update(preset='ultrafast',threads=1)
            cfg['audio']['ambient']='assets/ambient.wav';cfg['output']='exports/latest.mp4'
            v.save(r/'project.json',cfg);(r/'assets').mkdir()
            def tone(path,seconds=.5,amp=1200):
                data=(np.sin(np.arange(round(seconds*24000))*2*np.pi*220/24000)*amp).astype(np.int16)
                v.wav_write(path,data)
            tone(r/'assets/ambient.wav',4,30)
            for color in ['red','green']:
                v.media_output(r/f'assets/{color}.mp4',['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=5','-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p'])
            for module in cfg['order']:
                d=r/'modules'/module;d.mkdir(parents=True);tone(d/'raw.wav')
                v.atomic_text(d/'script.en.txt','Fixture narration.\n')
                v.save(d/'voice.json',{'chunks':[{'text':'Fixture narration.','file':f'modules/{module}/raw.wav','sha256':v.sha(d/'raw.wav')}]})
                source='module:a' if module=='close' else 'assets/'+('red' if module=='a' else 'green')+'.mp4'
                v.save(d/'module.json',{'id':module,'label':module,'title':module,'clips':[{'source':source,'in':0,'out':'auto','end_at':'end','mode':'realtime'}]})
            p=v.Project(r);p.assemble();p.check(full=True)
            self.assertEqual(set(p.report['video_rebuilt']),set(cfg['order']))
            first=v.sha(r/'exports/latest.mp4');untouched=v.sha(r/'modules/b/video.mp4')
            p=v.Project(r);p.assemble()
            self.assertEqual(p.report['video_rebuilt'],[]);self.assertEqual(p.report['previews_rebuilt'],[])
            self.assertFalse(p.report['master_rebuilt']);self.assertEqual(first,v.sha(r/'exports/latest.mp4'))
            # Replacing one source invalidates that module and the closing reference.
            v.media_output(r/'assets/red.mp4',['-f','lavfi','-i','color=c=blue:s=160x90:r=30:d=5','-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p'])
            p=v.Project(r);p.assemble()
            self.assertEqual(p.report['video_rebuilt'],['a','close']);self.assertEqual(p.report['voice_rebuilt'],[])
            self.assertFalse(p.report['mix_rebuilt']);self.assertTrue(p.report['master_rebuilt'])
            self.assertEqual(untouched,v.sha(r/'modules/b/video.mp4'))
            # Same-length audio edit changes voice and mix, not any video.
            d=r/'modules/a';tone(d/'raw.wav',amp=2400);lock=v.read(d/'voice.json');lock['chunks'][0]['sha256']=v.sha(d/'raw.wav');v.save(d/'voice.json',lock)
            p=v.Project(r);p.assemble()
            self.assertEqual(p.report['video_rebuilt'],[]);self.assertEqual(p.report['voice_rebuilt'],['a'])
            self.assertEqual(p.report['previews_rebuilt'],['a']);self.assertTrue(p.report['mix_rebuilt'])
            good=v.sha(r/'exports/latest.mp4')
            # Text edits never silently keep the old spoken words.
            v.atomic_text(d/'script.en.txt','Changed narration.\n')
            with self.assertRaisesRegex(ValueError,'script changed'):v.Project(r).assemble()
            self.assertEqual(good,v.sha(r/'exports/latest.mp4'));v.atomic_text(d/'script.en.txt','Fixture narration.\n')
            # Insufficient footage fails before a bad master can replace the good one.
            tone(d/'raw.wav',10);lock['chunks'][0]['sha256']=v.sha(d/'raw.wav');v.save(d/'voice.json',lock)
            with self.assertRaisesRegex(ValueError,'ends at'):v.Project(r).assemble()
            self.assertEqual(good,v.sha(r/'exports/latest.mp4'))
            tone(d/'raw.wav');lock['chunks'][0]['sha256']=v.sha(d/'raw.wav');v.save(d/'voice.json',lock)
            m=v.read(d/'module.json');m['clips'][0]['source']='module:close';v.save(d/'module.json',m)
            with self.assertRaisesRegex(ValueError,'cycle'):v.Project(r).plan('a')
            with self.assertRaisesRegex(ValueError,'project-relative'):v.Project(r).path('../escape.mp4')
            # Failed ffmpeg does not truncate an existing export.
            with self.assertRaises(Exception):v.media_output(r/'exports/latest.mp4',['-i',str(r/'missing.mp4')])
            self.assertEqual(good,v.sha(r/'exports/latest.mp4'))
            v.save(v.ROOT/'review/modular-incremental-tests.json',{'passed':True,'checks':['initial build and full decode','unchanged assemble performs zero renders','source edit rebuilds only module and dependent closing','unrelated video unchanged','same-length voice edit performs zero video encodes','changed text requires matching TTS','short footage rejected','dependency cycle rejected','path traversal rejected','failed render preserves good export'],'fixtures':'temporary 160x90 video and generated tones; no real footage changed'})

if __name__=='__main__':unittest.main()
