"""Audit the recorded headless run without overstating native/render validation."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
report = json.loads((root / 'review/scifi-simulation.json').read_text())
checkpoints = json.loads((root / 'review/scifi-checkpoints.json').read_text())
assets = json.loads((root / 'review/scifi-construction.json').read_text())
required = {'early_road', 'road_before_pause', 'road_paused',
            'before_handoff', 'handoff_taken', 'parallel_builders', 'tree_planting'}
names = {c['name'] for c in checkpoints}
checks = {
    'complete': report['complete'],
    'native_simulation_step': report.get('simulationStep') == .05,
    'flight_clearance': report.get('minimumFlightClearance', 0) >= 1.6,
    'reserved_navigation_matches_blueprint': assets['navigation']['blueprintSha256'] == assets['blueprintSha256'],
    'simultaneous_builder_writes': report.get('parallelWrites', False),
    'all_cells_match': report['verified'] and all(g['expected'] == g['matched'] for g in report['groups']),
    'exact_blueprint_cell_count': sum(g['matched'] for g in report['groups']) == assets['total'],
    'obstacle_hold_observed': report['blockedSeen'],
    'pause_and_resume_observed': report['paused'] and report['resumed'],
    'unstarted_task_handoff_observed': report['handoff'] and report['handoffTakenAt'] >= 0 and report['restoredBuilder'],
    'checkpoint_coverage': required <= names,
    'checkpoint_blueprint_matches': all(c['blueprintSha256'] == assets['blueprintSha256'] for c in checkpoints),
    'all_five_controllers_healthy': len(report['robots']) == 5 and all(not r['error'] and not r['state'].get('fault') for r in report['robots']),
    'message_loss_exercised': any(not e.get('ok', True) or e['type'] == 'blueprint-drop' for e in report['events']),
}
for c in checkpoints:
    if c['name'] == 'parallel_builders':
        a, b = c['robots'][2]['state'], c['robots'][3]['state']
        checks['different_builder_owners'] = a['job'] >= 0 and b['job'] >= 0 and a['job'] != b['job']

result = {
    'kind': 'headless-controller-validation',
    'passed': all(checks.values()),
    'checks': checks,
    'cells': assets['total'],
    'wall_seconds': report['wallSeconds'],
    'wall_seconds_scope': 'resumed segment only' if report.get('uninterrupted') is False else 'single run',
    'validation_mode': report['kind'],
    'uninterrupted': report.get('uninterrupted', True),
    'restored_committed_cells': report.get('restoredCommittedCells', 0),
    'blueprint_sha256': assets['blueprintSha256'],
    'checkpoints': sorted(names),
    'artifacts_sha256': {name: hashlib.sha256((root / 'review' / name).read_bytes()).hexdigest()
                        for name in ['scifi-simulation.json', 'scifi-checkpoints.json', 'scifi-construction.json']},
    'limitations': [
        'Real AssemblyScript controllers and command execution; lightweight map-backed voxel storage, actual constructed-column clearance checks and conservative reserved flight airspace.',
        'The headless validation uses the native 0.05 second simulation step.',
        'This headless report does not certify an uninterrupted full native-world run. Native capture and camera checks are reported separately.',
        'See scifi-native-causality.json, scifi-capture-final-qa.json and final-qa.zh.json for footage and export evidence.',
        *(['Original accelerated validation hit the unchanged 50 ms execution guard; functional completion was resumed from committed progress. This is not an uninterrupted performance pass.'] if report.get('uninterrupted') is False else []),
    ],
}
(root / 'review/scifi-controller-preflight.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit(1)
