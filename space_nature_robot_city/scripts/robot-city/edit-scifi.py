"""Build module manifests only from the current approved sci-fi-city footage."""
from pathlib import Path
import json
import subprocess
import sys

R = Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')
def clip(name, duration, start=0):
    return {'file': 'footage/'+name+'.mp4', 'start': start, 'duration': duration}
def duration(mid):
    return json.loads((R/'modules'/mid/'voice.zh.json').read_text())['duration']

edits = {
 '01_cold_open': [clip('scifi-city-hero',9),clip('scifi-road-close',7),clip('scifi-parallel-builders',9),clip('scifi-interchange',10.5)],
 '02_nature_site': [clip('scifi-nature-site',duration('02_nature_site'))],
 '03_team_design': [clip('scifi-team-design',2.4),clip('scifi-survey-and-tools',3.8),clip('scifi-road-close',1.8),clip('scifi-builder-handoff',2.5),clip('scifi-tree-planting',2),clip('scifi-builder-handoff',duration('03_team_design')-22.5),clip('scifi-road-close',4,3),clip('scifi-parallel-builders',6,9)],
 '04_agent_build': [clip('scifi-agent-build-panel',6.5),clip('scifi-prompt-example',12.4333333333),clip('scifi-city-designs',duration('04_agent_build')-18.9333333333)],
 '05_survey_and_tools': [clip('scifi-survey-and-tools',duration('05_survey_and_tools'))],
 '06_road_builder': [clip('scifi-road-close',7),clip('scifi-road-timelapse',11),clip('scifi-road-details',9.5)],
 '07_overpass': [clip('scifi-interchange',duration('07_overpass'))],
 '08_parallel_builders': [clip('scifi-parallel-builders',15),clip('scifi-city-designs',duration('08_parallel_builders')-15,21.4)],
 '09_tree_planter': [clip('scifi-tree-planting',10),clip('scifi-tree-varieties',duration('09_tree_planter')-10)],
 '10_pause_road': [clip('scifi-pause-road',duration('10_pause_road'))],
 '11_builder_handoff': [clip('scifi-builder-handoff',17.3666666667),clip('scifi-city-designs',duration('11_builder_handoff')-17.3666666667)],
 '12_city_walkthrough': [clip('scifi-city-walkthrough',duration('12_city_walkthrough'))],
 '13_reuse_and_close': [clip('scifi-reuse-details',4.5),clip('scifi-city-designs',duration('13_reuse_and_close')-23.5,21.4),clip('scifi-reuse-details',9,9),clip('scifi-city-hero',10,20)],
}

ids=sys.argv[1:] or list(edits)
for mid in ids:
    clips=edits[mid]
    assert abs(sum(c['duration'] for c in clips)-duration(mid))<.002,mid
    for c in clips:
        p=R/c['file']
        assert p.exists(),p
        report=json.loads(Path(str(p)+'.capture.json').read_text())
        assert report['state']=='complete' and report['frames']==report['target'],p
        native=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
        assert c['start']+c['duration'] <= native+.035,(mid,p,native)
    (R/'modules'/mid/'module.json').write_text(json.dumps({
        'schema_version':1,'id':mid,'language':'zh','clips':clips,'burned_subtitles':False,
        'editing_notes':'Approved sci-fi city; native fixed-time frames. Construction and work-button events are controller-driven. Prompt example is explicitly authored documentary material.',
        'blueprint_sha256':'7e27f4c0a19ceda654d8bc3a60920a042f947ab9147199ce944a1cc4ee7abff0',
    },ensure_ascii=False,indent=2)+'\n')
    print('EDITED',mid)
