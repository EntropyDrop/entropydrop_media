import {apply as applyBatches} from './scifi-batch.ts';
import {prepare} from './scifi-prewarm.ts';
const root='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/review/';
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
/** Add the final portal supports to the already reviewed, local-only native scene. */
export async function reconcile(p:any){
 const g=p.g,bytes=new Uint32Array(await(await fetch(root+'scifi-city.bin?final=1',{cache:'no-store'})).arrayBuffer());
 p.manifest=await(await fetch(root+'scifi-city.json?final=1',{cache:'no-store'})).json();p.total=bytes.length/5;p.stage='placing';applyBatches(p);let changed=0;
 for(let i=0;i<bytes.length;){const end=Math.min(bytes.length,i+40000*5);for(;i<end;i+=5){const x=bytes[i],y=bytes[i+1],z=bytes[i+2],packed=bytes[i+3],type=bytes[i+4],color=packed&0xffffff,mat=packed>>>24;
  if(type===1){if(g.world.getBlock(x,y,z)!==1||g.world.getBlockColor(x,y,z)!==color||g.world.getBlockMaterial(x,y,z)!==mat){g.world.setBlock(x,y,z,1,true,color,mat);changed++;}}
  else{const actual=g.world.getMicroBlock(x,y,z);if(!actual||actual.color!==color||(actual.materialId||0)!==mat){if(g.world.getBlock(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8)))g.world.setBlock(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8),0,true);g.world.setMicroBlock(x,y,z,color,null,mat);changed++;}}
 }await frame();}
 p.restoreImporter();p.stage='verifying';let mismatch=0,checked=0;const failures=[];
 for(let i=0;i<bytes.length;){const end=Math.min(bytes.length,i+40000*5);for(;i<end;i+=5){const x=bytes[i],y=bytes[i+1],z=bytes[i+2],packed=bytes[i+3],type=bytes[i+4],color=packed&0xffffff,mat=packed>>>24,actual=type===1?{color:g.world.getBlockColor(x,y,z),materialId:g.world.getBlockMaterial(x,y,z)}:g.world.getMicroBlock(x,y,z);if(!actual||actual.color!==color||(actual.materialId||0)!==mat){mismatch++;if(failures.length<20)failures.push({x,y,z,type,actual});}checked++;}await frame();}
 p.verification={checked,mismatch,failures};p.changedSupportCells=changed;await prepare(p);return p.status();
}
