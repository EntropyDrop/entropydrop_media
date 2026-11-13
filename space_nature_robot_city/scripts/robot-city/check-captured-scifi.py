from pathlib import Path
import subprocess,json,hashlib,sys
R=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')
files=[Path(s) for s in sys.argv[1:]] if len(sys.argv)>1 else sorted((R/'footage').glob('scifi-*.mp4'))
results=[]
for p in files:
 capture=json.loads(Path(str(p)+'.capture.json').read_text())
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
 stream=next(s for s in probe['streams'] if s['codec_type']=='video')
 decoded=subprocess.run(['ffmpeg','-threads','1','-v','error','-i',str(p),'-map','0:v:0','-f','framehash','-hash','md5','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,check=True)
 hashes=[s.rsplit(',',1)[-1].strip() for s in decoded.stdout.splitlines() if s and not s.startswith('#')]
 duplicates=[i+1 for i,(a,b) in enumerate(zip(hashes,hashes[1:])) if a==b]
 duplicate=len(duplicates)
 # Intentional fixed first-person inspection of the survey obstruction before the shovel click.
 allowed=lambda i:p.name=='scifi-survey-and-tools.mp4' and 114<=i<=410
 unexpected=[i for i in duplicates if not allowed(i)]
 healthy=all(not r.get('error') for s in capture.get('samples',[]) for r in s.get('robots',[]))
 checks={'completed':capture['state']=='complete','all_frames':len(hashes)==capture['target']==capture['frames'],
 '1080p':(stream['width'],stream['height'])==(1920,1080),'30fps':stream['avg_frame_rate']=='30/1',
 'healthy_controllers':healthy,'no_unexplained_repeated_frames':not unexpected,'no_decode_errors':not decoded.stderr}
 results.append({'file':p.name,'duration':float(probe['format']['duration']),'frames':len(hashes),'duplicate_adjacent':duplicate,'unexplained_duplicate_frames':unexpected,'intentional_fixed_inspection':p.name=='scifi-survey-and-tools.mp4','checks':checks,'passed':all(checks.values()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 print(p.name,results[-1]['passed'],len(hashes),flush=True)
report={'kind':'native-capture-file-validation','passed':all(r['passed'] for r in results),'files':results}
Path('/private/tmp/scifi-capture-final-qa.json').write_text(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
