from pathlib import Path
from collections import defaultdict
import math,json,sys
root=Path(__file__).parent
m=json.loads((root/'review'/('road-network-candidate.json' if '--candidate' in sys.argv else 'scifi-city.json')).read_text())
roads=m['roads']; byid={p['id']:p for p in roads}
for p in roads:
 p['_s']=[0.]
 for a,b in zip(p['points'],p['points'][1:]):p['_s'].append(p['_s'][-1]+math.hypot(b[0]-a[0],b[2]-a[2]))
 p['_t']=[]
 for i,v in enumerate(p['points']):
  a=p['points'][max(0,i-1)];b=p['points'][min(len(p['points'])-1,i+1)];dx,dz=b[0]-a[0],b[2]-a[2];l=math.hypot(dx,dz);p['_t'].append((dx/l,dz/l))
connections=[]
for p in roads:
 for c in p.get('links',[]):
  q=byid[c['road']];idx=0 if c['end']=='start' else len(p['points'])-1;e=p['points'][idx];offset=0 if c['lane']=='both' else q['width']/4*(1 if c['lane']=='forward' else -1)
  candidates=[]
  for i,a in enumerate(q['points']):
   tx,tz=q['_t'][i];v=[a[0]-tz*offset,a[1],a[2]+tx*offset];candidates.append((math.dist(v,e),i,v))
  gap,j,target=min(candidates);t=p['_t'][idx];v=q['_t'][j];dot=sum(a*b for a,b in zip(t,v))
  dot=abs(dot) if c['lane']=='both' else dot*(1 if c['lane']=='forward' else -1)
  angle=math.degrees(math.acos(max(-1,min(1,dot))))
  connections.append({'fromRoad':p['id'],**c,'gap':round(gap,4),'tangentAngleDeg':round(angle,3),'heightGap':round(abs(target[1]-e[1]),5)})
collisions=[];crossings=[]
for pi,p in enumerate(roads):
 for q in roads[pi+1:]:
  if p['kind']==q['kind']=='street':continue
  radius=(p['width']+q['width'])/2+.25;size=10.;grid=defaultdict(list)
  for j,b in enumerate(q['points']):grid[(math.floor(b[0]/size),math.floor(b[2]/size))].append((j,b))
  invalid=[];clear=[];merges=0
  for i,a in enumerate(p['points']):
   cx,cz=math.floor(a[0]/size),math.floor(a[2]/size)
   for dx in [-1,0,1]:
    for dz in [-1,0,1]:
     for j,b in grid[(cx+dx,cz+dz)]:
      distance=math.hypot(a[0]-b[0],a[2]-b[2])
      if distance>=radius:continue
      ta,tb=p['_t'][i],q['_t'][j];delta=(b[0]-a[0],b[2]-a[2]);dot=sum(x*y for x,y in zip(ta,tb));cross=abs(ta[0]*tb[1]-ta[1]*tb[0])
      ha=((p['_s'][min(i+1,len(p['_s'])-1)]-p['_s'][max(0,i-1)])/4)
      hb=((q['_s'][min(j+1,len(q['_s'])-1)]-q['_s'][max(0,j-1)])/4)
      ra,rb=p['width']/2+.125,q['width']/2+.125
      if abs(sum(x*y for x,y in zip(delta,ta)))>ha+hb*abs(dot)+rb*cross:continue
      if abs(sum(x*y for x,y in zip(delta,tb)))>hb+ha*abs(dot)+ra*cross:continue
      if abs(delta[0]*ta[1]-delta[1]*ta[0])>ra+hb*cross+rb*abs(dot):continue
      if abs(delta[0]*tb[1]-delta[1]*tb[0])>rb+ha*cross+ra*abs(dot):continue
      gap=abs(a[1]-b[1]);angle=math.degrees(math.acos(min(1,abs(sum(x*y for x,y in zip(p['_t'][i],q['_t'][j]))))))
      linked=False
      for one,other,k in [(p,q,i),(q,p,j)]:
       for link in one.get('links',[]):
        if link['road']!=other['id']:continue
        d=one['_s'][k] if link['end']=='start' else one['_s'][-1]-one['_s'][k]
        if d<100 and gap<=.14 and angle<35:linked=True
      # The mainline / surface street junction at the end of a two-way approach is also covered by the explicit links above.
      if linked:merges+=1;continue
      record=(gap,round(a[0],2),round(a[2],2),round(distance,2),round(angle,1))
      if gap<5.25:invalid.append(record)
      else:clear.append(record)
  if invalid:collisions.append({'a':p['id'],'b':q['id'],'min':min(invalid),'overlapSamples':len(invalid)})
  if clear:crossings.append({'a':p['id'],'b':q['id'],'minSurfaceSeparation':round(min(x[0] for x in clear),3)})
buildings=[]
for p in roads:
 for b in m['buildings']:
  hits=[v for v in p['points'] if abs(v[0]-b['x'])<b['width']/2+p['width']/2+.5 and abs(v[2]-b['z'])<b['depth']/2+p['width']/2+.5 and b['base']-1<=v[1]<=b['roof']+4]
  if hits:buildings.append({'road':p['id'],'building':[b['x'],b['z']],'roof':b['roof'],'height':round(min(v[1] for v in hits),2),'at':hits[len(hits)//2]})
grades={p['id']:round(max(abs(b[1]-a[1])/max(.0001,math.hypot(b[0]-a[0],b[2]-a[2])) for a,b in zip(p['points'],p['points'][1:])),5) for p in roads}
report={'connections':connections,'unsafeOverlaps':collisions,'separatedCrossings':crossings,'buildingConflicts':buildings,'maxGrades':grades}
(root/'review/road-logic-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
