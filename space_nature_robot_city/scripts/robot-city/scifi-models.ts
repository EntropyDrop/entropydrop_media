import {Grid,component} from './geometry.ts';
const colors=[0xece7cd,0xee862e,0x3e7dbc,0x4cbbb9,0x7eaa49];
const names=['Survey drone','Road drone','Builder drone A','Builder drone B','Planting drone'];
export function robot(index:number,script=''){
 const c=colors[index],g=new Grid(),dark=0x253039,metal=0xa5b0ad;
 g.box([0,0,0],[1.75,.5,2.25],dark);g.box([0,.35,0],[1.5,.375,1.875],c);
 g.box([0,.3,-1.125],[1.1,.25,.125],0x85d6e0,1);
 for(const x of [-1,1])for(const z of [-1,1]){
  for(let t=0;t<1;t+=.125)g.box([x*(.5+t*1.5),.125,z*(.5+t*1.5)],[.375,.25,.375],metal);
  g.box([x*2,.25,z*2],[.5,.5,.5],c);
 }
 for(const x of [-.875,.875]){g.box([x,-.625,0],[.125,1,.125],metal);g.box([x,-1.125,0],[.25,.125,2],dark);}
 g.box([.5,.8,.625],[.125,.75,.125],metal);g.box([.5,1.25,.625],[.25,.125,.25],c,1);
 const root=component('root',names[index],g);delete root.localPosition;root.anchorRotation=[0,0,0,1];root.script=script;root.body={type:'kinematic',mass:160,useGravity:false,collisionEnabled:true};
 const button=new Grid();button.box([0,0,0],[.5,.125,.5],0xd75345,1);root.children.push(component('work_button','Work pause / resume',button,[0,.625,.5]));
 for(let i=0;i<4;i++){
  const rotor=new Grid();rotor.box([0,0,0],[1.75,.125,.25],dark);rotor.box([0,0,0],[.25,.125,1.75],dark);rotor.box([0,0,0],[.375,.25,.375],metal);
  const n=component('rotor'+i,'Independent lift rotor',rotor,[(i%2?1:-1)*2,.625,(i<2?-1:1)*2]);n.script=`self.setSpinYAxisRPM(${i%2?-540:540});`;root.children.push(n);
 }
 const tool=new Grid();
 if(index===0){tool.box([0,0,0],[.75,.5,.75],0x5ae1d1,1);tool.box([0,-.375,0],[1,.125,1],metal);}
 if(index===1){tool.box([0,0,0],[2,.375,.75],metal);for(const x of[-.75,0,.75])tool.box([x,-.375,0],[.25,.5,.25],0xffbb66,1);}
 if(index===2||index===3){tool.box([0,0,0],[.5,1,.5],c);tool.box([0,-.5,-.375],[.75,.25,1],metal);tool.box([0,-.625,-.75],[.375,.25,.375],0x78dcf0,1);}
 if(index===4){tool.box([0,0,0],[1,.5,1],c);tool.box([0,-.5,0],[.25,.75,.25],metal);for(const x of[-.375,.375])tool.box([x,-.125,0],[.25,.25,.75],0xa3d36c,1);}
 root.children.push(component('tool',index===0?'Terrain scanner':index===1?'Road print head':index===4?'Planting head':'Microvoxel construction head',tool,[0,-.625,0]));
 const occupied=new Set<string>();
 for(const node of [...root.children,root]){
  const offset=(node.localPosition||[0,0,0]).map(v=>Math.round(v*8)),clean:any[]=[];
  for(const b of node.blocks){const micro=b.mx!==undefined;for(let mx=micro?b.mx!:0;mx<(micro?b.mx!+1:8);mx++)for(let my=micro?b.my!:0;my<(micro?b.my!+1:8);my++)for(let mz=micro?b.mz!:0;mz<(micro?b.mz!+1:8);mz++){
   const key=[b.dx*8+mx+offset[0],b.dy*8+my+offset[1],b.dz*8+mz+offset[2]].join(',');if(occupied.has(key))continue;occupied.add(key);clean.push({dx:b.dx,dy:b.dy,dz:b.dz,mx,my,mz,size:.125,color:b.color,materialId:b.materialId||0});
  }}node.blocks=clean;
 }
 return{type:'space-entity',version:8,root,constraints:[]};
}
