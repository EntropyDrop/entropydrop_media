"""Verify actual R3 recording telemetry and preserve unchanged R2 rover checks."""
import json, math
from pathlib import Path
R=Path(__file__).resolve().parents[1]
read=lambda name:json.loads((R/'review'/name).read_text())
old=read('r2-reference-recorded-test-summary.json')
out={k:{**v,'source_revision':'R2, unchanged footage and controller'} for k,v in old.items() if k.startswith('rover-')}
for name in ['chinook-flight-a','chinook-flight-b','drone-airborne-follow','drone-airborne-orbit']:
    data=read(name+'-r3.json'); samples=data['samples']; status=data['status']
    assert len(samples)>150
    assert not any(s['error'] for s in samples)
    assert status['terrainEdits']==0
    assert all(s['perspective']=='third_person' and s['fov']==75 for s in samples)
    assert status['surface']['installed']==status['surface']['total']==128
    q={'source_revision':'R3','samples':len(samples),'errors':0,'terrain_writes':0,'fov_values':[75],
       'all_third_person':True,'loaded_ring_districts':128}
    if name.startswith('drone'):
        ys=[s['player'][1] for s in samples]
        assert all(s['isFlying'] for s in samples if s['t']>3.1)
        errors=[math.dist(s['position'],[s['player'][0]+2.5,s['player'][1]+3.2,s['player'][2]+3.5]) for s in samples]
        tilts=[math.degrees(math.acos(max(-1,min(1,1-2*(s['rotation'][0]**2+s['rotation'][2]**2))))) for s in samples]
        assert errors[-1]<.02
        assert max(tilts)>1
        q.update(player_height_range=[min(ys),max(ys)],airborne_after_takeoff=True,
          camera_orbit_degrees=math.degrees(samples[-1]['cameraYaw']-samples[0]['cameraYaw']),
          max_tracking_error_m=max(errors),settled_error_m=errors[-1],max_tilt_degrees=max(tilts))
        if name.endswith('follow'):assert max(ys)-min(ys)>8
        else:assert q['camera_orbit_degrees']>359 and max(ys)-min(ys)>3
    else:
        assert all(s['driving'] for s in samples)
        q['height_range']=[min(s['position'][1] for s in samples),max(s['position'][1] for s in samples)]
    out[name]=q
(R/'review/recorded-test-summary.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
