"""Hand-built reusable medieval mill; portable native voxel model, no terrain edits."""
from pathlib import Path
import math,json
S=8
class Grid:
 def __init__(self):self.c={}
 def shape(self,lo,hi,test,color):
  for x in range(math.floor(lo[0]*S),math.ceil(hi[0]*S)):
   for y in range(math.floor(lo[1]*S),math.ceil(hi[1]*S)):
    for z in range(math.floor(lo[2]*S),math.ceil(hi[2]*S)):
     a,b,c=(x+.5)/S,(y+.5)/S,(z+.5)/S
     if test(a,b,c):self.c[x,y,z]=color(a,b,c) if callable(color) else color
 def box(self,lo,hi,col):self.shape(lo,hi,lambda *p:True,col)
 def line(self,a,b,r,col):
  vec=[b[i]-a[i] for i in range(3)];l=sum(v*v for v in vec)
  def test(x,y,z):
   p=[x,y,z];t=max(0,min(1,sum((p[i]-a[i])*vec[i] for i in range(3))/l)) if l else 0
   return sum((p[i]-a[i]-t*vec[i])**2 for i in range(3))<r*r
  self.shape([min(a[i],b[i])-r for i in range(3)],[max(a[i],b[i])+r for i in range(3)],test,col)
 def blocks(self):
  groups={}
  for k,v in self.c.items():groups.setdefault(tuple(a//8 for a in k),[]).append((k,v))
  out=[]
  for base,items in groups.items():
   if len(items)==512 and len({v for k,v in items})==1:out.append(dict(zip(('dx','dy','dz'),base))|{'color':items[0][1],'materialId':0});continue
   for (x,y,z),v in items:
    if all((x+a,y+b,z+c) in self.c for a,b,c in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]):continue
    out.append({'dx':base[0],'dy':base[1],'dz':base[2],'mx':x-base[0]*8,'my':y-base[1]*8,'mz':z-base[2]*8,'size':.125,'color':v,'materialId':0})
  return out
wood=0x4e3022;edge=0x70462b;gold=0xd2a469;plaster=0xe0d0ad;slate=0x344b59
g=Grid();octagon=lambda x,z:max(abs(x),abs(z),(abs(x)+abs(z))/math.sqrt(2))
def radius(y):return 3.55 if y<3.8 else 3.3-(y-3.8)*.085
def door(x,y,z):return z<-2.5 and abs(x)<.9 and .25<y<2.4+math.sqrt(max(0,.9**2-x*x))
def win(x,y,z):
 return (5.0<y<6.45 or 8.2<y<9.55) and ((abs(x)<.57 and abs(z)>2.4) or (abs(z)<.57 and abs(x)>2.4))
def wall(x,y,z):
 r=radius(y);return r-.48<octagon(x,z)<r and not door(x,y,z) and not win(x,y,z)
def wallcolor(x,y,z):
 if y<3.8:
  course=math.floor(y*2);brick=math.floor((x+z)*1.15+(course%2)*.5)
  if y*2%1<.14:return 0x716e63
  return [0x969280,0xa9a18d,0x8b897c,0xb2aa96][(course*7+brick*11)%4]
 return [plaster,0xdbcbab,0xe5d7ba][(math.floor(x*2)+math.floor(z*2)+math.floor(y*2))%3]
g.shape([-3.6,0,-3.6],[3.6,10.9,3.6],wall,wallcolor)
# Slightly projecting stone plinth and timber cornices; all belong to the model.
for y,r,h,col in [(0,3.8,.45,0x807d70),(3.65,3.55,.3,wood),(4.0,3.4,.25,edge),(7.35,3.25,.28,wood),(10.45,3.03,.4,wood)]:
 g.shape([-r,y,-r],[r,y+h,r],lambda x,b,z,r=r: r-.42<octagon(x,z)<r,col)
# Half-timbered octagonal upper stories, with a diagonal brace in every panel.
for j in range(8):
 a=j*math.pi/4;nx,nz=math.sin(a),math.cos(a);tx,tz=nz,-nx
 for y0,y1 in [(4.2,7.32),(7.65,10.48)]:
  for u in [-1.13,1.13]:
   g.line([nx*radius(y0)+tx*u,y0,nz*radius(y0)+tz*u],[nx*radius(y1)+tx*u,y1,nz*radius(y1)+tz*u],.12,wood)
  # Leave the cardinal window face open and brace its outer edges.
  for side in [-1,1]:
   lo=side*.68;hi=side*1.1
   g.line([nx*radius(y0)+tx*lo,y0,nz*radius(y0)+tz*lo],[nx*radius(y1)+tx*hi,y1,nz*radius(y1)+tz*hi],.11,edge)
 # Framed glowing leaded windows, inset from the wall.
 if j%2==0:
  for y0 in [5.0,8.2]:
   r=radius(y0)-.12
   for u0,u1,v0,v1,col in [(-.63,.63,y0-.1,y0+.12,wood),(-.63,.63,y0+1.35,y0+1.55,wood),(-.63,-.47,y0,y0+1.4,wood),(.47,.63,y0,y0+1.4,wood),(-.47,.47,y0+.12,y0+1.35,0xc49b52),(-.07,.07,y0,y0+1.4,wood)]:
    g.shape([-3.6,v0,-3.6],[3.6,v1,3.6],lambda x,y,z,u0=u0,u1=u1,r=r: u0<x*tx+z*tz<u1 and r-.1<x*nx+z*nz<r+.06,col)
# Arched oak entry with iron straps and stone archivolt.
g.box([-.85,.35,-3.44],[.85,2.55,-3.28],edge)
g.shape([-.9,2.2,-3.46],[.9,3.35,-3.25],lambda x,y,z: x*x+(y-2.35)**2<.9**2,edge)
for x in [-.65,-.35,0,.35,.65]:g.box([x,.4,-3.48],[x+.055,2.8,-3.4],wood)
for y in [.9,1.8]:g.box([-.84,y,-3.51],[.84,y+.13,-3.4],0x343c3b)
g.box([.5,1.35,-3.56],[.66,1.55,-3.4],gold)
for x in [-1.08,.94]:g.box([x,.3,-3.7],[x+.25,2.6,-3.25],0xb2aa96)
g.shape([-1.2,2.35,-3.7],[1.2,3.55,-3.25],lambda x,y,z: .92**2<x*x+(y-2.35)**2<1.2**2,0xb2aa96)
# Wooden gallery ring, railings and supported brackets.
g.shape([-4,7.1,-4],[4,7.35,4],lambda x,y,z:2.9<octagon(x,z)<3.95,0x90603c)
for j in range(16):
 a=2*math.pi*j/16;x,z=3.87*math.sin(a),3.87*math.cos(a)
 if z<-3.4:continue
 g.line([x,7.25,z],[x,8.2,z],.085,wood)
 if j%2==0:g.line([x*.8,6.4,z*.8],[x,7.15,z],.13,edge)
for y in [7.65,8.15]:g.shape([-4,y,-4],[4,y+.1,4],lambda x,b,z:3.77<math.hypot(x,z)<3.96 and z>-3.45,edge)
# Layered slate cap with projecting eaves and copper finial.
for row in range(14):
 y=10.8+row*.25;r=4.0-row*.245
 g.shape([-r,y,-r],[r,y+.32,r],lambda x,b,z,r=r:r-.44<octagon(x,z)<r,
  lambda x,b,z,row=row:[0x344b59,0x3d5663,0x49616b,0x304652][(row+int((math.atan2(x,z)+math.pi)*9))%4])
g.shape([-.7,14.2,-.7],[.7,14.65,.7],lambda x,y,z:math.hypot(x,z)<.65,0x756142)
g.line([0,14.4,0],[0,15.15,0],.12,gold)
# Low miller's annex at the left, timber walls, pitched roof and chimney.
g.box([-6.5,.15,-1.5],[-3.1,.5,2.3],0x807d70)
for y in [i*.25+.5 for i in range(12)]:
 g.box([-6.5,y,-1.5],[-6.18,y+.22,2.3],0x9c7950 if int(y*4)%2 else 0xab8659)
 g.box([-6.5,y,1.98],[-3.1,y+.22,2.3],0x9c7950)
 g.box([-6.5,y,-1.5],[-3.1,y+.22,-1.2],0xad8b60)
for x in [-6.5,-3.35]:
 for z in [-1.5,2.05]:g.box([x,.45,z],[x+.25,3.65,z+.25],wood)
for i in range(16):
 z=-1.85+i*.28;y=3.25+max(0,1.6-abs(z-.4)*.8)
 g.box([-6.85,y,z],[-2.9,y+.22,z+.32],0x5b554a if i%3 else 0x716453)
g.box([-5.9,3.8,1.3],[-5.2,5.8,2],0x89816e);g.box([-6,5.65,1.2],[-5.1,5.9,2.1],0x4c4a44)
# Barrel staves with iron hoops and grain sacks by the front entry.
for cx,cz in [(2.1,-4.25),(3.0,-4.0)]:
 g.shape([cx-.5,.05,cz-.5],[cx+.5,1.45,cz+.5],lambda x,y,z,cx=cx,cz=cz:math.hypot(x-cx,z-cz)<.38+.08*math.sin(y/1.4*math.pi),lambda x,y,z:0x343d3d if .27<y<.39 or 1.1<y<1.22 else edge)
for cx,cz in [(-2,-4.1),(-2.65,-4.0)]:
 g.shape([cx-.5,.1,cz-.4],[cx+.5,1.15,cz+.4],lambda x,y,z,cx=cx,cz=cz:((x-cx)/.42)**2+((y-.6)/.55)**2+((z-cz)/.35)**2<1,0xb7a77d)
# Four balanced lattice-and-canvas sails in a separate reusable component.
rot=Grid()
for j in range(4):
 a=j*math.pi/2+math.pi/4;ux,uy=math.sin(a),math.cos(a);vx,vy=uy,-ux
 def pt(r,w=0,z=0):return [ux*r+vx*w,uy*r+vy*w,z]
 rot.line(pt(.15),pt(7.7),.14,wood)
 # Rectangular cloth panels separated by visible horizontal battens.
 for k in range(8):
  r0=2+k*.65;r1=r0+.55
  rot.shape([-9,-9,-.12],[9,9,.03],lambda x,y,z,r0=r0,r1=r1,ux=ux,uy=uy,vx=vx,vy=vy:r0<x*ux+y*uy<r1 and .18<x*vx+y*vy<1.45,0xe0d2b0 if k%3 else 0xd3c29e)
  rot.line(pt(r0,.08,-.14),pt(r0,1.56,-.14),.075,edge)
 rot.line(pt(1.9,1.5,-.14),pt(7.35,1.5,-.14),.095,wood)
 rot.line(pt(1.9,.1,-.14),pt(7.35,1.5,-.14),.07,edge)
rot.shape([-.55,-.55,-.4],[.55,.55,.4],lambda x,y,z:math.hypot(x,y)<.5,wood)
rot.shape([-.28,-.28,-.55],[.28,.28,-.35],lambda x,y,z:math.hypot(x,y)<.26,0x9d8256)
root={'id':'mill','name':'OAK & STONE | Medieval windmill','pivot':[0,0,0],'body':{'type':'kinematic','mass':5000,'useGravity':False,'collisionEnabled':True},'blocks':g.blocks(),'children':[],'seats':[],'decorations':[],'scriptLanguage':'assemblyscript'}
root['children']=[{'id':'sails','name':'Four canvas sails','pivot':[0,0,0],'localPosition':[0,9.75,-4.5],'body':{'type':'kinematic','mass':50,'useGravity':False,'collisionEnabled':False},'blocks':rot.blocks(),'children':[],'seats':[],'decorations':[],'scriptLanguage':'assemblyscript','script':'self.setLocalSpin([0,0,1], 0.8);'}]
model={'type':'space-entity','version':8,'root':root,'constraints':[]}
out=Path(__file__).with_name('medieval-windmill.json');out.write_text(json.dumps(model,separators=(',',':')))
print(json.dumps({'file':str(out),'tower_voxels':len(root['blocks']),'sail_voxels':len(root['children'][0]['blocks']),'bytes':out.stat().st_size}))
