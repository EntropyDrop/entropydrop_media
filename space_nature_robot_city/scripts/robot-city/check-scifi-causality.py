"""Verify observed native construction and work-button transitions in captured clips."""
from pathlib import Path
import json

ROOT = Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')

def capture(name):
    data = json.loads((ROOT / 'footage' / (name + '.mp4.capture.json')).read_text())
    assert data['state'] == 'complete' and data['frames'] == data['target'], name
    assert all(not r.get('error') for s in data['samples'] for r in s['robots']), name
    return data

def progressed(samples, role):
    values = [(s['robots'][role].get('job'), s['robots'][role].get('progress'),
               s['robots'][role].get('built'), s['robots'][role].get('planted')) for s in samples]
    return len(set(values)) > 1

checks = {}
road = capture('scifi-road-timelapse')
checks['road_actually_progresses'] = progressed(road['samples'], 1)
parallel = capture('scifi-parallel-builders')
checks['both_builders_progress'] = all(progressed(parallel['samples'], role) for role in (2, 3))
checks['different_building_owners'] = any(
    s['robots'][2].get('job', -1) >= 0 and s['robots'][3].get('job', -1) >= 0
    and s['robots'][2]['job'] != s['robots'][3]['job'] for s in parallel['samples'])
trees = capture('scifi-tree-planting')
checks['planter_actually_progresses'] = progressed(trees['samples'], 4)
pause = capture('scifi-pause-road')
checks['native_pause_and_resume_events'] = len([a for a in pause['actions']
    if a['type'] == 'work-pause' and a['role'] == 1 and a['result']]) == 2
idle = [s for s in pause['samples'] if s['robots'][1].get('paused')
        and s['robots'][1].get('job') == -1]
checks['paver_finishes_current_job_then_waits'] = bool(idle)
checks['other_work_continues_during_pause'] = any(progressed(idle, r) for r in (2, 3, 4))
checks['paver_resumes'] = any(not s['robots'][1].get('paused')
    and s['robots'][1].get('job', -1) >= 0 for s in pause['samples'] if s['frame'] >= 24 * 30)
handoff = capture('scifi-builder-handoff')
event = next((a for a in handoff['actions'] if a['type'] == 'work-pause' and a['role'] in (2, 3)), None)
checks['native_handoff_pause_event'] = bool(event and event['result'])
source = event['role'] if event else 3
destination = 5 - source
job = handoff['samples'][0]['robots'][source].get('job', -1)
checks['unstarted_job_released'] = job >= 0 and any(s['robots'][source].get('paused')
    and s['robots'][source].get('job') == -1 for s in handoff['samples'])
checks['second_builder_accepts_and_builds'] = any(s['robots'][destination].get('job', -1) == job
    and s['robots'][destination].get('progress', 0) > 0 for s in handoff['samples'])
result = {'kind': 'native-captured-causal-behavior', 'passed': all(checks.values()), 'checks': checks}
Path('/private/tmp/scifi-native-causality.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit(1)
