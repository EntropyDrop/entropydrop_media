import {MicroGrid,hash,pick,type V} from './grid.ts';

export type TreeKind='oak'|'birch'|'pine'|'maple'|'cherry'|'willow';
export interface TreeOptions {kind:TreeKind;seed?:number;height?:number;crownScale?:number}
const leaves={oak:[0x526b35,0x627d3e,0x759048,0x45602f],birch:[0x829853,0x97ad65,0xa9b979,0x6e8947],pine:[0x365b48,0x416b51,0x507b5b,0x2f5141],maple:[0xad4e2d,0xc36a32,0xd28b42,0x953f2b],cherry:[0xc8839b,0xe2a7b7,0xf0c4cb,0xd795ae],willow:[0x617c41,0x789348,0x91a65a,0x56743c]};
export const treePresets:{id:string;name:string;description:string;options:TreeOptions;radius:number}[]=[
 {id:'16_oak',name:'分枝橡树',description:'粗干分叉、不对称团簇树冠，适合广场边缘与混合林。',options:{kind:'oak',seed:161,height:7.5},radius:4},
 {id:'17_birch',name:'白桦行道树',description:'带深色节纹的白色细干、疏松卵形树冠，适合道路两侧。',options:{kind:'birch',seed:172,height:8.25},radius:2.25},
 {id:'18_pine',name:'层叠松树',description:'高挑主干与分层针叶轮廓，形成树林的高度变化。',options:{kind:'pine',seed:183,height:9.25},radius:3},
 {id:'19_maple',name:'秋色红枫',description:'低位分枝、横向展开的橙红树冠，作为街角色彩重点。',options:{kind:'maple',seed:194,height:6.75},radius:4.25},
 {id:'20_cherry',name:'粉白花树',description:'弯曲枝条和粉白花簇组成伞形树冠，适合庭院和步道。',options:{kind:'cherry',seed:205,height:6.25},radius:4.25},
 {id:'21_willow',name:'垂枝柳树',description:'宽阔冠顶与长短错落的下垂枝叶，适合水边和公园。',options:{kind:'willow',seed:216,height:7.5},radius:4.5},
];
function taper(g:MicroGrid,a:V,b:V,r0:number,r1:number,color:number|((x:number,y:number,z:number)=>number)){
 const d=b.map((v,i)=>v-a[i]),length=d.reduce((s,v)=>s+v*v,0),r=Math.max(r0,r1);
 g.shape(a.map((v,i)=>Math.min(v,b[i])-r) as V,a.map((v,i)=>Math.max(v,b[i])+r) as V,(x,y,z)=>{const p=[x,y,z],t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/length));return p.reduce((s,v,i)=>s+(v-a[i]-t*d[i])**2,0)<(r0+(r1-r0)*t)**2;},color);
}
function clump(g:MicroGrid,p:V,r:V,palette:number[],seed:number){
 g.part='foliage';g.shape(p.map((v,i)=>v-r[i]) as V,p.map((v,i)=>v+r[i]) as V,(x,y,z)=>{
  const q=[x,y,z].map((v,i)=>(v-p[i])/r[i]);const rough=.89+hash(Math.floor(x*2),Math.floor(y*2),Math.floor(z*2),seed)*.17;
  return q.reduce((s,v)=>s+v*v,0)<rough;
 },(x,y,z)=>pick(palette,Math.floor(x*1.5),Math.floor(y*1.5),Math.floor(z*1.5),seed));
}
export function generateTree(options:TreeOptions){
 const preset=treePresets.find(a=>a.options.kind===options.kind)!;
 const {kind,seed=preset.options.seed!,height=preset.options.height!,crownScale=1}=options;
 if(height<4||height>11||crownScale<.65||crownScale>1.2)throw Error('Tree height must be 4..11 m; crownScale .65..1.2');
 const g=new MicroGrid(),s=height/preset.options.height!,pal=leaves[kind];
 const P=(x:number,y:number,z:number):V=>[x*s*crownScale,y*s,z*s*crownScale];
 const wood=kind==='birch'?0xd2cbb6:kind==='cherry'?0x685046:kind==='willow'?0x70674a:0x67513a;
 const bark=(x:number,y:number,z:number)=>kind==='birch'?(Math.floor(y*8)%9===0&&hash(Math.floor(x*3),Math.floor(y*2),Math.floor(z*3),seed)>.3?0x574f42:pick([0xd2cbb6,0xe5dfcd,0xbab9a3],Math.floor(x*8),Math.floor(y*2),Math.floor(z*8),seed)):pick([wood,kind==='pine'?0x806447:0x795d42],Math.floor(x*4),Math.floor(y),Math.floor(z*4),seed);
 const lean=(hash(1,2,3,seed)-.5)*.65;
 g.part='roots';for(let j=0;j<5;j++){const a=j*Math.PI*2/5+hash(j,0,0,seed);taper(g,P(0,.25,0),P(Math.cos(a)*.8,-.25,Math.sin(a)*.8),.2*s,.1*s,wood);}
 g.part='trunk';const trunkTop=kind==='pine'?8.5:kind==='birch'?6.6:kind==='willow'?5:4.75;
 taper(g,P(0,-.375,0),P(lean,2.5,0),s*(kind==='birch'?.2:.375),s*.19,bark);taper(g,P(lean,2.5,0),P(lean+.15,trunkTop,.125),.2*s,.075*s,bark);
 if(kind==='pine'){
  for(let level=0;level<7;level++){
   const y=2.5+level*.875,rr=(2.65-level*.31)*crownScale;
   g.part='branches';for(let j=0;j<6;j++){const a=j*Math.PI/3+level*.4; taper(g,P(lean,y+.5,0),P(Math.cos(a)*rr*.85,y-.125,Math.sin(a)*rr*.85),.1*s,.055*s,wood);}
   g.part='foliage';g.shape(P(-rr,y-.25,-rr),P(rr,y+2,rr),(x,b,z)=>{
    const yy=b/s-y,r=rr*Math.max(.05,1-(yy+.25)/2.25),angle=Math.atan2(z,x),scallop=1+.09*Math.sin(angle*7+level);
    return Math.hypot(x-lean*s*.3,z)/s<r*scallop;
   },(x,b,z)=>pick(pal,Math.floor(x*1.3),level,Math.floor(z*1.3),seed));
  }
 }else{
  const n=kind==='birch'?8:kind==='willow'?7:9;
  for(let j=0;j<n;j++){
   const a=j*Math.PI*2/n+(hash(j,4,2,seed)-.5)*.6;
   const reach=(kind==='birch'?1.05:kind==='willow'?2.35:kind==='cherry'?2.15:2.0)*(0.8+hash(j,2,6,seed)*.35);
   const yy=kind==='birch'?4.3+(j%4)*.8:kind==='willow'?5.3+(j%3)*.5:kind==='cherry'?4.5+(j%3)*.4:5+(j%3)*.6;
   const b=P(Math.cos(a)*reach,yy,Math.sin(a)*reach),mid=P(Math.cos(a)*reach*.5,yy-.8,Math.sin(a)*reach*.5);
   g.part='branches';taper(g,P(lean,kind==='birch'?yy-1.6:2.6+j%2*.5,0),mid,.14*s,.1*s,bark);taper(g,mid,b,.1*s,.055*s,wood);
   const crown:V=kind==='birch'?[.95,1.3,.9]:kind==='willow'?[1.45,.95,1.4]:kind==='cherry'?[1.55,.8,1.45]:[1.5,1.2,1.45];
   clump(g,b,crown.map((r,i)=>r*s*(i===1?1:crownScale)) as V,pal,seed+j*17);
   if(kind==='willow')for(let k=0;k<4;k++){
    const aa=a+(k-1.5)*.22,r=reach+1.05,drop=1.6+hash(j,k,6,seed)*2.4;
    const start=P(Math.cos(aa)*(r-.55),yy-.125,Math.sin(aa)*(r-.55)),end=P(Math.cos(aa)*r,yy-drop,Math.sin(aa)*r);
    g.part='branches';taper(g,start,end,.065*s,.045*s,wood);
    g.part='foliage';for(let t=0;t<1;t+=.2){const p=start.map((v,i)=>v+(end[i]-v)*t) as V;clump(g,p,[.24*s,.55*s,.24*s],pal,seed+j+k);}
   }
  }
  clump(g,P(lean,kind==='birch'?6.7:kind==='willow'?6.1:kind==='cherry'?5.3:6.3,0),P(kind==='birch'?1.15:1.5,kind==='birch'?1.4:.9,kind==='birch'?1.1:1.5),pal,seed+999);
 }
 return g.export(preset.id,preset.name,true);
}

export type PlantingPattern='avenue'|'grove'|'courtyard';
export interface Exclusion {minX:number;maxX:number;minZ:number;maxZ:number;clearance?:number}
export interface PlantingOptions {pattern:PlantingPattern;seed?:number;count?:number;width?:number;depth?:number;exclusions?:Exclusion[];heightAt?:(x:number,z:number)=>number}
export function generatePlanting(options:PlantingOptions){
 const {pattern,seed=1,count=12,width=48,depth=36,exclusions=[],heightAt=()=>0}=options;
 const placed:{assetId:string;kind:TreeKind;position:V;rotationY:number;crownRadius:number}[]=[];
 const fits=(x:number,z:number,r:number)=>Math.abs(x)+r<=width/2&&Math.abs(z)+r<=depth/2&&exclusions.every(b=>Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))>=r+(b.clearance??.75))&&placed.every(p=>Math.hypot(x-p.position[0],z-p.position[2])>=r+p.crownRadius+.75);
 function put(x:number,z:number,t:typeof treePresets[number],n:number){x=Math.round(x*8)/8;z=Math.round(z*8)/8;if(!fits(x,z,t.radius))return;const y=heightAt(x,z);if(!Number.isFinite(y))return;placed.push({assetId:t.id,kind:t.options.kind,position:[x,Math.ceil(y*8)/8,z],rotationY:Math.floor(hash(n,2,8,seed)*4)*Math.PI/2,crownRadius:t.radius});}
 if(pattern==='avenue'){
  const rows=Math.ceil(count/2);for(let i=0;i<rows;i++)for(const side of [-1,1]){if(placed.length>=count)break;const x=(i-(rows-1)/2)*10+side*1.5;put(x,side*7.25,treePresets[1],i*2+(side>0?1:0));}
 }else if(pattern==='courtyard'){
  for(let i=0;i<count;i++){const a=i*2*Math.PI/count;put(Math.sin(a)*(width/2-4.25),Math.cos(a)*(depth/2-4.25),treePresets[[4,3,1][i%3]],i);}
 }else{
  for(let i=0;i<1000&&placed.length<count;i++){const t=treePresets[Math.floor(hash(i,1,1,seed)*treePresets.length)];put((hash(i,3,7,seed)-.5)*width,(hash(i,8,2,seed)-.5)*depth,t,i);}
 }
 return {pattern,seed,requestedCount:count,placedCount:placed.length,bounds:{width,depth},exclusions,placements:placed};
}
export const plantingPresets=[
 {id:'avenue',name:'错列行道树',options:{pattern:'avenue' as const,seed:801,count:8,width:48,depth:28,exclusions:[{minX:-24,maxX:24,minZ:-3.875,maxZ:3.875,clearance:.75}]}},
 {id:'grove',name:'疏密混合林',options:{pattern:'grove' as const,seed:802,count:12,width:48,depth:40,exclusions:[{minX:-3,maxX:3,minZ:-20,maxZ:20,clearance:.75}]}},
 {id:'courtyard',name:'庭院留白组团',options:{pattern:'courtyard' as const,seed:803,count:6,width:34,depth:34,exclusions:[{minX:-5,maxX:5,minZ:-5,maxZ:5,clearance:1}]}},
];
