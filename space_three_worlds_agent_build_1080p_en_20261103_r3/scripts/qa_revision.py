import json,subprocess,hashlib,wave,re
from fractions import Fraction
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parents[1];m=R/'exports/space_three_worlds_agent_build_1080p_en_r3.mp4'
t=json.loads((R/'timeline.json').read_text())
p=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-show_chapters','-of','json',str(m)]))
v=next(s for s in p['streams'] if s['codec_type']=='video');a=next(s for s in p['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'])==(1920,1080,'30/1')
assert abs(float(Fraction(v['avg_frame_rate']))-30)<.001
assert int(v['nb_frames'])==round(t['duration']*30)
assert not any(s['codec_type']=='subtitle' for s in p['streams']);assert len(p['chapters'])==23
assert abs(float(p['format']['duration'])-t['duration'])<.05
subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(m),'-f','null','-'],check=True)
with wave.open(str(R/'audios/voiceover_timeline.wav')) as w:sr=w.getframerate();samples=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)
window=round(sr*.02);rms=np.sqrt(np.mean(samples[:len(samples)//window*window].reshape(-1,window)**2,axis=1));silent=rms<100
starts=np.flatnonzero(silent & ~np.r_[False,silent[:-1]]);ends=np.flatnonzero(silent & ~np.r_[silent[1:],False])+1
silences=[{'start':float(s*.02),'duration':float((e-s)*.02)} for s,e in zip(starts,ends) if (e-s)*.02>.5]
maxsil=max((e-s)*.02 for s,e in zip(starts,ends));assert maxsil<1.5,f'Unexplained silent interval {maxsil}'
manifest=json.loads((R/'audios/manifest.json').read_text());checked=0
for c in manifest['chapters']:
 for chunk in c['chunks']:
  assert hashlib.sha256((R/chunk['file']).read_bytes()).hexdigest()==chunk['sha256'];checked+=1
report=subprocess.run(['ffmpeg','-nostdin','-v','info','-i',str(m),'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
(R/'review/audio-loudness.log').write_text(report.stderr)
loud=json.JSONDecoder().raw_decode(report.stderr[report.stderr.rfind('{'):])[0]
assert float(loud['input_tp'])<0
q={'final':{'file':str(m.relative_to(R)),'duration_seconds':t['duration'],'width':v['width'],'height':v['height'],'fps':30,'audio':a['codec_name'],'sample_rate':a['sample_rate'],'subtitles':False,'full_decode':'passed','sha256':hashlib.sha256(m.read_bytes()).hexdigest()},'audio':{'checked_tts_chunks':checked,'maximum_near_silent_voice_interval_seconds':maxsil,'threshold_dbfs':20*np.log10(100/32768),'silences_over_half_second':silences,'loudness':loud},'physics_tests':json.loads((R/'review/revision-tests.json').read_text()),'recorded_tests':json.loads((R/'review/recorded-test-summary.json').read_text()),'visual_review':{'method':'Chronological full-chapter contact sheets every two seconds, plus live native 1080p review during recording, cursor-free Aether retakes, and real airborne follow/orbit telemetry; retained R2 wheel-axis/roll checks.','human_listening_review':False,'contact_sheets':'review/contact-sheets'}}
(R/'review/qa-summary.json').write_text(json.dumps(q,indent=2));print(json.dumps(q['final'],indent=2));print('max voice silence',maxsil,'LUFS',loud['input_i'])
