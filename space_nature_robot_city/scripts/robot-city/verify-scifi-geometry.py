"""Independent road-strip, directed connection, grade and structural-clearance audit."""
from pathlib import Path
import hashlib,json,math,runpy
root=Path(__file__).parent
runpy.run_path(str(root/'audit-road-network.py'))
m=json.loads((root/'review/scifi-city.json').read_text());q=json.loads((root/'review/road-logic-audit.json').read_text());terrain=json.loads((root/'review/road-terrain-audit.json').read_text())
structural=[];headrooms=[];radii={};selfcross=[]
for support in m['supports']:
 a,b=support['min'],support['max']
 for road in m['roads']:
  if road['id']==support['road']:continue
  for x,y,z in road['points']:
   dx=max(a[0]-x,0,x-b[0]);dz=max(a[2]-z,0,z-b[2])
   if math.hypot(dx,dz)>road['width']/2+.125:continue
   if a[1]>=y+5:headrooms.append(a[1]-y)
   elif b[1]>y-.75 and a[1]<y+5-1e-6:
    structural.append({'supportRoad':support['road'],'kind':support['kind'],'obstructedRoad':road['id'],'point':[x,y,z],'box':[a,b]});break
for p in m['roads']:
 if p['kind']=='street':continue
 vals=[]
 for a,b,c in zip(p['points'],p['points'][1:],p['points'][2:]):
  ab=math.hypot(a[0]-b[0],a[2]-b[2]);bc=math.hypot(c[0]-b[0],c[2]-b[2]);ca=math.hypot(c[0]-a[0],c[2]-a[2]);cross=abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))
  if cross>1e-9:vals.append(ab*bc*ca/(2*cross))
 radii[p['id']]=round(min(vals),3) if vals else None
 # Every path is simple. Exclude adjacent segments, then test proper centreline intersections.
 pts=p['points'][::4]+[p['points'][-1]]
 def orientation(a,b,c):return (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])
 for i,(a,b) in enumerate(zip(pts,pts[1:])):
  for j in range(i+2,len(pts)-1):
   c,d=pts[j],pts[j+1]
   if max(a[0],b[0])<min(c[0],d[0]) or max(c[0],d[0])<min(a[0],b[0]) or max(a[2],b[2])<min(c[2],d[2]) or max(c[2],d[2])<min(a[2],b[2]):continue
   if orientation(a,b,c)*orientation(a,b,d)<0 and orientation(c,d,a)*orientation(c,d,b)<0:selfcross.append({'road':p['id'],'segments':[i,j]})
q.update(schema=3,counts=m['counts'],blueprintSha256=hashlib.sha256((root/'review/scifi-city.bin').read_bytes()).hexdigest(),terrainAudit=terrain,supportCount=len(m['supports']),structuralObstructions=structural,minStructuralHeadroomMetres=round(min(headrooms),3),minimumTurnRadiiMetres=radii,selfCrossings=selfcross,gameLayoutTargets={'maxRampGrade':.08,'minimumRoadSurfaceSeparation':5.25,'minimumSupportHeadroom':5,'maxJoinAngleDegrees':1,'minimumTurnRadiusMetres':20},traffic='right-hand; 2 bidirectional mainlines, 4 bidirectional city approaches, 2 explicit one-way left-turn ramps; remaining movements via surface city grid',autonomousConstructionMigrated=False)
q['passed']=not(q['unsafeOverlaps'] or q['buildingConflicts'] or structural or selfcross) and all(v['intrusions']==0 for v in terrain) and all(v['gap']<=.3 and v['tangentAngleDeg']<1 and v['heightGap']<.01 for v in q['connections']) and all(q['maxGrades'][p['id']]<=.08001 for p in m['roads'] if p['kind']=='ramp') and min(v for v in radii.values() if v is not None)>=20
(root/'review/scifi-city-geometry-qa.json').write_text(json.dumps(q,indent=2)+'\n')
print(json.dumps({'passed':q['passed'],'structuralObstructions':len(structural),'minimumSupportHeadroom':q['minStructuralHeadroomMetres'],'minimumTurnRadii':radii,'selfCrossings':selfcross,'sha256':q['blueprintSha256']}))
assert q['passed'],'See scifi-city-geometry-qa.json for conflicts'
