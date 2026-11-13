import {MicroGrid,hash,pick,type V} from './grid.ts';
export type HouseKind='cottage'|'townhouse'|'workshop'|'inn'|'farmhouse'|'tower';
export type RoadKind='straight'|'curve'|'tee'|'cross';
export type RoadFinish='cobble'|'brick'|'slate';
export interface HouseOptions {kind:HouseKind;seed?:number;roof?:'clay'|'slate'|'moss';shutters?:number;flowers?:boolean;widthScale?:number;depthScale?:number;heightScale?:number;roofRiseScale?:number;variation?:number}
export interface RoadOptions {kind:RoadKind;finish?:RoadFinish;seed?:number;sidewalk?:boolean;moduleLength?:number;carriagewayWidth?:number;sidewalkWidth?:number;crown?:number;paverLength?:number;paverWidth?:number}
const C={wood:0x503c2c,oak:0x86623e,lightOak:0xae8956,iron:0x414a48,mortar:0x827f71,plaster:0xd8c6a1,cream:0xe6d5b3,stone:[0xa8a38e,0xb4ad96,0x969582,0xbcb39e],clay:[0x9d5141,0xad5b47,0xb66850,0x95493d],slate:[0x435766,0x4c626f,0x526b78,0x3d5260],moss:[0x596a55,0x65765e,0x708168,0x53634f],leaf:0x556d38};
const snap=(v:number)=>Math.round(v*8)/8;
const mod=(n:number,d:number)=>((n%d)+d)%d;
const stone=(seed:number)=>(x:number,y:number,z:number)=>{const row=Math.floor(y*2),u=Math.floor((x+z)*8)+row%2*4;return mod(Math.floor(y*8),4)===0||mod(u,8)===0?C.mortar:pick(C.stone,Math.floor(u/8),row,0,seed);};
type Face={cx:number;cz:number;u:V;n:V};
function face(cx:number,cz:number,side:number,w:number,d:number):Face {const ns:V[]=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];const n=ns[side];return {cx:cx+n[0]*(side%2?w:d)/2,cz:cz+n[2]*(side%2?w:d)/2,u:[-n[2],0,n[0]],n};}
function point(f:Face,u:number,y:number,n=0):V{return [f.cx+f.u[0]*u+f.n[0]*n,y,f.cz+f.u[2]*u+f.n[2]*n];}
function fbox(g:MicroGrid,f:Face,u0:number,u1:number,y0:number,y1:number,n0:number,n1:number,col:number,mat=0){const a=point(f,u0,y0,n0),b=point(f,u1,y1,n1);g.box(a.map((v,i)=>Math.min(v,b[i])) as V,a.map((v,i)=>Math.max(v,b[i])) as V,col,mat);}
function fl(g:MicroGrid,f:Face,a:V,b:V,r:number,col:number){g.line(point(f,...a),point(f,...b),r,col);}
function window(g:MicroGrid,f:Face,u:number,y:number,shutter:number,flowers:boolean){
 const a=point(f,u-.625,y,-.5),b=point(f,u+.625,y+1.375,.4);g.erase(a.map((v,i)=>Math.min(v,b[i])) as V,a.map((v,i)=>Math.max(v,b[i])) as V);
 fbox(g,f,u-.625,u+.625,y,y+1.375,-.125,0,C.wood);
 fbox(g,f,u-.5,u+.5,y+.125,y+1.25,-.125,0,0x9ebbb6,61);
 fbox(g,f,u-.0625,u+.0625,y,y+1.375,0,.125,C.wood);fbox(g,f,u-.625,u+.625,y+.625,y+.75,0,.125,C.wood);
 fbox(g,f,u-.75,u+.75,y-.125,y+.125,-.125,.375,C.stone[1]);
 fbox(g,f,u-.75,u+.75,y+1.375,y+1.5,-.125,.25,C.oak);
 for(const sign of [-1,1]){const x=u+sign*.875;fbox(g,f,x-.1875,x+.1875,y+.125,y+1.25,0,.125,shutter);for(const yy of [y+.375,y+1])fbox(g,f,x-.1875,x+.1875,yy,yy+.125,.125,.25,C.wood);}
 if(flowers){fbox(g,f,u-.625,u+.625,y-.375,y-.125,.125,.5,C.oak);for(let i=0;i<5;i++){const pp=point(f,u-.5+i*.25,y-.0625,.375);g.sphere(pp,.18,C.leaf);if(i%2===0)g.sphere([pp[0],pp[1]+.125,pp[2]],.13,i%4?0xd29b58:0xa95d65);}}
}
function door(g:MicroGrid,f:Face,u=0,width=1.5,base=.375){
 const r=width/2,archBase=base+1.75;
 const a=point(f,u-r-.25,base,-.5),b=point(f,u+r+.25,archBase+r+.25,.5);
 const lo=a.map((v,i)=>Math.min(v,b[i])) as V,hi=a.map((v,i)=>Math.max(v,b[i])) as V;
 const local=(x:number,z:number)=>(x-f.cx)*f.u[0]+(z-f.cz)*f.u[2]-u;
 g.erase(lo,hi,(x,y,z)=>Math.abs(local(x,z))<r&&(y<archBase||local(x,z)**2+(y-archBase)**2<r*r));
 g.shape(lo,hi,(x,y,z)=>{const t=local(x,z),n=(x-f.cx)*f.n[0]+(z-f.cz)*f.n[2];return n>-.25&&n<.25&&(y<archBase?Math.abs(t)>=r&&Math.abs(t)<r+.25:t*t+(y-archBase)**2>=r*r&&t*t+(y-archBase)**2<(r+.25)**2);},stone(37));
 // Open leaf against the inner jamb: the opening remains traversable.
 fbox(g,f,u-r,u-r+.125,base,base+2,-1.125,-.25,C.oak);
 fbox(g,f,u-r-.25,u+r+.25,base-.125,base,-.375,.5,C.stone[1]);
 for(let i=0;i<6;i++)fbox(g,f,u-r-.375,u+r+.375,-1,base-i*.25,.5+i*.375,.875+i*.375,C.stone[i%4]);
}
function roof(g:MicroGrid,cx:number,cz:number,w:number,d:number,eave:number,rise:number,palette:number[],seed:number,kind:'gable'|'hip'='gable'){
 g.part='roof';const W=w+.875,D=d+.875;
 const height=(x:number,z:number)=>{const v=kind==='hip'?Math.min(1-Math.abs(x-cx)/(W/2),1-Math.abs(z-cz)/(D/2)):1-Math.abs(x-cx)/(W/2);return snap(eave+Math.max(0,v)*rise);};
 for(let ix=Math.floor((cx-W/2)*8);ix<Math.ceil((cx+W/2)*8);ix++)for(let iz=Math.floor((cz-D/2)*8);iz<Math.ceil((cz+D/2)*8);iz++){
  const x=(ix+.5)/8,z=(iz+.5)/8,yy=Math.round(height(x,z)*8),row=Math.floor(Math.abs(x-cx)*8/3),tile=Math.floor((z*8+(row%2)*2)/5);
  const color=pick(palette,tile,row,x>cx?1:0,seed);
  for(let iy=yy;iy<yy+2;iy++)g.set(ix,iy,iz,color);
 }
 if(kind==='gable'){
  for(const z of [cz-D/2,cz+D/2])for(const s of [-1,1])g.line([cx+s*W/2,eave,z],[cx,eave+rise+.125,z],.13,C.wood);
  g.box([cx-.125,eave+rise+.125,cz-D/2],[cx+.125,eave+rise+.375,cz+D/2],palette[1]);
 }else for(const sx of [-1,1])for(const sz of [-1,1])g.line([cx+sx*W/2,eave,cz+sz*D/2],[cx,eave+rise+.125,cz],.13,palette[1]);
 for(const sx of [-1,1])g.box([cx+sx*W/2-.125,eave-.125,cz-D/2],[cx+sx*W/2+.125,eave+.125,cz+D/2],C.wood);
}
function chimney(g:MicroGrid,x:number,z:number,y:number,seed:number){g.part='details';g.box([x-.375,y-1.75,z-.375],[x+.375,y,z+.375],stone(seed));g.box([x-.5,y,z-.5],[x+.5,y+.25,z+.5],C.stone[1]);g.box([x-.25,y+.25,z-.25],[x+.25,y+.375,z+.25],0x353834);}
function barrel(g:MicroGrid,x:number,z:number){g.part='foundation';g.shape([x-.375,-1,z-.375],[x+.375,0,z+.375],(a,y,b)=>Math.hypot(a-x,b-z)<.375,stone(77));g.part='details';g.shape([x-.375,0,z-.375],[x+.375,.875,z+.375],(a,y,b)=>Math.hypot(a-x,b-z)<.3+.06*Math.sin(y/.875*Math.PI),(a,y,b)=>y<.25||y>.625?C.iron:pick([C.oak,C.lightOak],Math.floor(Math.atan2(a-x,b-z)*4),0,0));}
function shell(g:MicroGrid,cx:number,cz:number,w:number,d:number,h:number,seed:number,upper=true){
 g.part='foundation';g.box([cx-w/2-.125,-1,cz-d/2-.125],[cx+w/2+.125,.375,cz+d/2+.125],stone(seed));
 g.part='walls';g.shape([cx-w/2,.375,cz-d/2],[cx+w/2,h,cz+d/2],(x,y,z)=>Math.abs(x-cx)>w/2-.25||Math.abs(z-cz)>d/2-.25,(x,y,z)=>y<1.25?stone(seed)(x,y,z):upper?C.plaster:C.stone[Math.floor(hash(Math.floor((x+z)*2),Math.floor(y*2),1,seed)*C.stone.length)]);
 if(h>4){
  g.part='floor';g.box([cx-w/2,3.125,cz-d/2],[cx+w/2,3.375,cz+d/2],C.oak);
  // A real stairwell, not a sealed upper-floor slab.
  const sx=cx+w/2-1.5,sz=cz-d/2+.5;g.erase([sx,3.125,sz],[sx+1.125,3.375,sz+3.375]);
  g.part='stairs';for(let i=0;i<12;i++)g.box([sx,.375,sz+i*.25],[sx+1.125,.625+i*.25,sz+(i+1)*.25],C.oak);
 }
 g.part='frame';
 g.shape([cx-w/2,h,cz-d/2],[cx+w/2,h+.375,cz+d/2],(x,y,z)=>Math.abs(x-cx)>w/2-.25||Math.abs(z-cz)>d/2-.25,C.oak);
 for(let side=0;side<4;side++){
  const f=face(cx,cz,side,w,d),fw=side%2?d:w;
  for(const y of [.375,1.25,h-.25,...(h>4?[3.125,3.375]:[])])fbox(g,f,-fw/2,fw/2,y,y+.125,0,.125,C.wood);
  for(const u of [-fw/2+.125,fw/2-.125])fbox(g,f,u-.125,u+.125,.375,h,0,.125,C.wood);
  if(h>4)for(const u of [-fw/2+.125,fw/2-.125]){const end=u+(u<0?.75:-.75);fl(g,f,[u,3.5,.125],[end,4.625,.125],.1,C.oak);}
 }
}
function gableFill(g:MicroGrid,cx:number,cz:number,w:number,d:number,h:number,rise:number){g.part='walls';for(const sz of [-1,1])g.shape([cx-w/2,h,cz+sz*d/2-.125],[cx+w/2,h+rise,cz+sz*d/2+.125],(x,y)=>y<h+rise*(1-Math.abs(x-cx)/((w+.875)/2))+.125,C.cream);for(const sz of [-1,1]){const f=face(cx,cz,sz<0?0:2,w,d);fl(g,f,[0,h,0],[0,h+rise,0],.125,C.wood);for(const s of [-1,1])fl(g,f,[s*w/2,h,.125],[0,h+rise,.125],.13,C.wood);}}
function facadeWindows(g:MicroGrid,cx:number,cz:number,w:number,d:number,h:number,shutters:number,flowers:boolean,frontDoor=true,skipFront=false){
 g.part='details';for(let side=0;side<4;side++){
  if(side===0&&skipFront)continue;
  const f=face(cx,cz,side,w,d),fw=side%2?d:w;
  const us=fw>=5?[-1.5,1.5]:[0];
  for(const u of us)if(!(side===0&&frontDoor&&Math.abs(u)<1))window(g,f,u,1.5,shutters,flowers&&side===0);
  if(h>4)for(const u of us)window(g,f,u,4.25,shutters,flowers&&side===0);
 }if(frontDoor)door(g,face(cx,cz,0,w,d));
}
function porch(g:MicroGrid,f:Face,width:number,y:number,depth:number,roofPalette:number[],seed:number,rail=false){
 g.part='details';fbox(g,f,-width/2,width/2,y-.25,y,0,depth,C.oak);
 for(const s of [-1,1]){const u=s*(width/2-.125);fbox(g,f,u-.125,u+.125,-1,y+2.25,depth-.25,depth,C.wood);fl(g,f,[u,y+1.625,depth-.125],[u-s*.5,y+2.25,depth-.125],.1,C.oak);}
 for(let u=-width/2;u<width/2;u+=.125)for(let n=0;n<depth+.25;n+=.125)fbox(g,f,u,u+.125,y+2.5-n*.25,y+2.625-n*.25,n,n+.125,pick(roofPalette,Math.floor(u*2),Math.floor(n*2),0,seed));
 if(rail){for(const s of [-1,1]){for(let n=.25;n<depth;n+=.375)fbox(g,f,s*(width/2-.125)-.0625,s*(width/2-.125)+.0625,y,y+.875,n,n+.125,C.oak);fbox(g,f,s*(width/2-.125)-.125,s*(width/2-.125)+.125,y+.875,y+1,0,depth,C.wood);}}
}
export const housePresets:{id:string;name:string;description:string;options:HouseOptions}[]=[
 {id:'01_cottage',name:'石基花窗小屋',description:'单层暖灰石基、赭红双坡瓦顶、拱门、百叶窗与花箱。',options:{kind:'cottage',seed:101,roof:'clay',shutters:0x617c65,flowers:true}},
 {id:'02_townhouse',name:'木构阳台排屋',description:'窄面双层、外露木梁、挑出阳台与蓝灰高屋顶。',options:{kind:'townhouse',seed:202,roof:'slate',shutters:0x6b8790,flowers:true}},
 {id:'03_workshop',name:'街角工匠作坊',description:'宽门工作间、布篷、露天工作台和木料，区别于住宅。',options:{kind:'workshop',seed:303,roof:'clay',shutters:0x9b7550,flowers:false}},
 {id:'04_inn',name:'L形乡村旅舍',description:'双层主屋连接低矮侧翼，入口凹院、悬挂牌和烟囱。',options:{kind:'inn',seed:404,roof:'slate',shutters:0x7d604b,flowers:true}},
 {id:'05_farmhouse',name:'四坡顶廊屋',description:'绿色四坡屋顶、带护栏的前廊、石阶和暖色窗框。',options:{kind:'farmhouse',seed:505,roof:'moss',shutters:0x7b8b62,flowers:true}},
 {id:'06_tower',name:'八角角楼住宅',description:'八角石木塔身、锥形瓦顶、低矮侧屋，作为街区地标。',options:{kind:'tower',seed:606,roof:'clay',shutters:0x667c72,flowers:false}},
];
export function generateHouse(options:HouseOptions){
 const {kind,seed=1,roof:finish='clay',shutters=0x617c65,flowers=true}=options;const g=new MicroGrid(),pal=C[finish];
 let w=5.5,d=5.5,h=3.25,rise=1.875;
 if(kind==='townhouse'){w=5;d=5.5;h=6;rise=2.25;}
 if(kind==='workshop'){w=6.5;d=4.5;h=3.25;rise=1.625;}
 if(kind==='inn'){w=5;d=5.5;h=5.75;rise=2;}
 if(kind==='farmhouse'){w=6;d=5.5;h=3.25;rise=2.25;}
 rise*=options.roofRiseScale??1;
 if(kind!=='tower'){
  shell(g,0,0,w,d,h,seed);if(kind!=='farmhouse')gableFill(g,0,0,w,d,h,rise-.125);
  roof(g,0,0,w,d,h,rise,pal,seed,kind==='farmhouse'?'hip':'gable');facadeWindows(g,0,0,w,d,h,shutters,flowers,kind!=='workshop',kind==='workshop');
  chimney(g,-w/2+1,d/2-1,h+rise+.5,seed);
 }
 if(kind==='cottage'){barrel(g,2.25,-3.5);g.part='interior';g.box([-.75,.375,0],[.75,1.125,.75],C.oak);}
 if(kind==='townhouse'){
  const f=face(0,0,0,w,d);g.part='balcony';fbox(g,f,-1.875,1.875,3.25,3.5,0,1.25,C.oak);
  for(let u=-1.75;u<=1.75;u+=.5)fbox(g,f,u-.0625,u+.0625,3.5,4.375,1.125,1.25,C.wood);
  fbox(g,f,-1.875,1.875,4.25,4.5,1.125,1.375,C.wood);
  for(const s of [-1,1]){fbox(g,f,s*1.75-.125,s*1.75+.125,4.25,4.5,0,1.25,C.wood);fl(g,f,[s*1.5,2.5,.125],[s*1.5,3.25,1.125],.125,C.wood);}
 }
 if(kind==='workshop'){
  const f=face(0,0,0,w,d);door(g,f,-.5,2.5);g.part='awning';
  for(let u=-2.75;u<2.75;u+=.125)for(let n=0;n<1.875;n+=.125){const col=Math.floor((u+2.75)*2)%2?0xb47b4f:0xd6c9a6;fbox(g,f,u,u+.125,3.125-n*.25,3.25-n*.25,n,n+.125,col);}
  for(const u of [-2.625,2.625])fbox(g,f,u-.0625,u+.0625,-1,2.875,1.75,1.875,C.wood);
  fbox(g,f,.875,2.25,1.125,1.375,.875,1.625,C.lightOak);for(const u of [1,2.125])fbox(g,f,u-.0625,u+.0625,-1,1.125,1,1.5,C.wood);
  barrel(g,-2.75,-3.875);for(const z of [-.75,.75])g.box([3.375,-1,z],[3.875,.375,z+.25],C.wood);for(let i=0;i<3;i++)g.box([3.375,.375+i*.25,-1],[3.875,.625+i*.25,1.125],i%2?C.oak:C.lightOak);
 }
 if(kind==='inn'){
  const x=3.875,z=1.125,ww=3.25,dd=3.5,hh=3.125;shell(g,x,z,ww,dd,hh,seed+1);gableFill(g,x,z,ww,dd,hh,1.375);roof(g,x,z,ww,dd,hh,1.5,pal,seed+1);facadeWindows(g,x,z,ww,dd,hh,shutters,false,false);
  g.part='details';const f=face(0,0,0,w,d);fl(g,f,[2,3.5,0],[2,3.5,1.5],.125,C.iron);fbox(g,f,1.875,2.125,2.625,3.375,.625,1.375,C.oak);g.sphere(point(f,2,3,1.5),.19,0xc9ac64);barrel(g,4.5,-1.5);
 }
 if(kind==='farmhouse')porch(g,face(0,0,0,w,d),4.75,.375,1.75,pal,seed,true);
 if(kind==='tower'){
  const radius=2.375,hh=5.75,oct=(x:number,z:number)=>Math.max(Math.abs(x),Math.abs(z),(Math.abs(x)+Math.abs(z))/Math.SQRT2);
  g.part='foundation';g.shape([-2.625,-1,-2.625],[2.625,.375,2.625],(x,y,z)=>oct(x,z)<2.625,stone(seed));
  g.part='walls';g.shape([-radius,.375,-radius],[radius,hh,radius],(x,y,z)=>oct(x,z)<radius&&oct(x,z)>radius-.25,(x,y,z)=>y<2?stone(seed)(x,y,z):C.plaster);
  g.part='frame';for(let j=0;j<8;j++){const a=Math.PI*j/4+Math.PI/8,rr=radius/Math.cos(Math.PI/8);g.line([Math.sin(a)*rr,.375,Math.cos(a)*rr],[Math.sin(a)*rr,hh,Math.cos(a)*rr],.125,C.wood);}for(const yy of [2,3.25,hh-.25])g.shape([-2.5,yy,-2.5],[2.5,yy+.125,2.5],(x,y,z)=>oct(x,z)>2.25&&oct(x,z)<2.5,C.wood);
  for(let side=0;side<4;side++){window(g,face(0,0,side,radius*2,radius*2),0,3.875,shutters,false);if(side!==0)window(g,face(0,0,side,radius*2,radius*2),0,1.375,shutters,false);}door(g,face(0,0,0,radius*2,radius*2));
  g.part='roof';for(let row=0;row<18;row++){const rr=2.875-row*.15625,yy=hh+row*.125;g.shape([-rr,yy,-rr],[rr,yy+.25,rr],(x,y,z)=>oct(x,z)<rr&&oct(x,z)>Math.max(0,rr-.375),(x,y,z)=>pick(pal,Math.floor(Math.atan2(x,z)*5),row,0,seed));}g.sphere([0,8.125,0],.1875,0xbca16a);
  const x=-3.75,z=.625,ww=3.5,dd=3.75,ah=3;shell(g,x,z,ww,dd,ah,seed+1);gableFill(g,x,z,ww,dd,ah,1.25);roof(g,x,z,ww,dd,ah,1.375,pal,seed+1);facadeWindows(g,x,z,ww,dd,ah,shutters,false,true);chimney(g,x-.625,1.5,4.875,seed);barrel(g,1.5,-3.125);
 }
 const variation=options.variation??.1;if(variation<0||variation>.2)throw Error('variation must be 0..0.2');
 const scales=[options.widthScale??(1+(hash(1,0,0,seed)-.5)*variation*2),options.heightScale??(1+(hash(0,1,0,seed)-.5)*variation),options.depthScale??(1+(hash(0,0,1,seed)-.5)*variation*2)];g.scale(scales[0],scales[1],scales[2]);
 const preset=housePresets.find(p=>p.options.kind===kind)!;return g.export(preset.id,preset.name,true);
}
/** Shared centreline distance makes straight, junction and curved boundaries compatible. */
export function roadDistance(x:number,z:number,kind:RoadKind){
 if(kind==='curve')return Math.abs(Math.hypot(x+6,z-6)-6);
 if(kind==='straight')return Math.abs(z);
 if(kind==='tee')return Math.min(Math.abs(z),Math.hypot(x,Math.max(0,z)));
 return Math.min(Math.abs(z),Math.abs(x));
}
export function roadPorts(kind:RoadKind){return kind==='curve'?['W','S']:kind==='tee'?['W','E','N']:kind==='cross'?['W','E','N','S']:['W','E'];}
export const roadPresets:{id:string;name:string;description:string;options:RoadOptions}[]=[
 {id:'07_cobble_straight',name:'暖灰石板主路',description:'5米车行带、拱形路面、石砖人行道、排水槽与分段路沿。',options:{kind:'straight',finish:'cobble',seed:71}},
 {id:'08_cobble_curve',name:'石板弧形转角',description:'与直路同宽同标高的四分之一圆转弯。',options:{kind:'curve',finish:'cobble',seed:71}},
 {id:'09_brick_tee',name:'赭红砖丁字街口',description:'交替铺向的砖石面与连续的人行道，适合工坊街区。',options:{kind:'tee',finish:'brick',seed:72}},
 {id:'10_slate_cross',name:'蓝灰石十字街口',description:'冷灰细石铺地，适合旅舍、广场和街区中心。',options:{kind:'cross',finish:'slate',seed:73}},
];
export function generateRoad(options:RoadOptions){
 const {kind,finish='cobble',seed=1,sidewalk=true}=options,g=new MicroGrid();const stones=finish==='brick'?[0x92634f,0xa17156,0x8d5a48,0xa77a5d]:finish==='slate'?[0x64767b,0x708087,0x596a70,0x78878a]:[0x989685,0xa5a08d,0x8d9183,0xaaa38f];
 const L=options.moduleLength??12,W=options.carriagewayWidth??5,S=options.sidewalkWidth??.875,half=W/2,crown=Math.round((options.crown??.25)*8),pl=options.paverLength??7,pw=options.paverWidth??5;
 if(L<10||L>16||W<4||W>6||S<.5||S>1.5||![L,W,S].every(v=>Number.isInteger(v*8))||pl<3||pw<3)throw Error('Invalid road profile');
 const edge=half+.5+(sidewalk?S:0),N=L*4;
 for(let ix=-N;ix<N;ix++)for(let iz=-N;iz<N;iz++){
  const x=(ix+.5)/8,z=(iz+.5)/8,dist=roadDistance(x*12/L,z*12/L,kind)*L/12;if(dist>edge)continue;
  let color:number,top:number;g.part='road';
  if(dist<half){
   let u=ix,v=iz;
   if(finish==='brick'&&(Math.floor((ix+48)/8)+Math.floor((iz+48)/8))%2){u=iz;v=ix;}
   const course=Math.floor(v/pw),offset=mod(course,2)*Math.floor(pl/2),stoneX=Math.floor((u+offset)/pl),joint=mod(v,pw)===0||mod(u+offset,pl)===0;
   color=joint?0x858679:pick(stones,stoneX,course,0,seed);top=dist<half/2?crown:Math.max(0,crown-1);
   // Flush joints prevent 12.5 cm deep grooves at the native micro resolution.
  }else if(dist<half+.25){g.part='drain';color=mod(ix+iz,7)===0?0x454e49:0x657169;top=0;}
  else if(dist<half+.5){g.part='curb';const joint=kind==='straight'?mod(ix,8)===0:mod(Math.floor(Math.atan2(x+6,z-6)*36),6)===0;color=joint?0x8b8c7d:C.stone[1];top=3;}
  else{g.part='sidewalk';color=(mod(ix,4)===0||mod(iz,4)===0)?0x929181:pick([0xb7ae97,0xafa891,0xc0b49d],Math.floor(ix/4),Math.floor(iz/4),0,seed);top=2;}
  for(let yy=-8;yy<=top;yy++)g.set(ix,yy,iz,yy<0?0x858576:color);
 }
 const preset=roadPresets.find(p=>p.options.kind===kind)!;return g.export(preset.id,preset.name,true);
}
