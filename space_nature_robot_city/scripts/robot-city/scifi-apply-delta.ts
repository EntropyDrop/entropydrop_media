import {apply as applyBatches} from './scifi-batch.ts';
import {reconcile} from './scifi-reconcile.ts';
const root='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/review/';
export async function apply(p:any){
 const delta=await(await fetch(root+'scifi-blueprint-delta.json',{cache:'no-store'})).json(),w=p.g.world;
 p.stage='placing';applyBatches(p);
 for(const group of ['remove','write'])for(let i=0;i<delta[group].length;){const end=Math.min(i+2000,delta[group].length);for(;i<end;i++){const[x,y,z,packed,type]=delta[group][i];if(group==='remove'){if(type)w.setBlock(x,y,z,0,true);else w.removeMicroBlock(x,y,z);}else if(type)w.setBlock(x,y,z,1,true,packed&0xffffff,packed>>>24);else w.setMicroBlock(x,y,z,packed&0xffffff,null,packed>>>24);}await new Promise(r=>requestAnimationFrame(()=>r()));}
 p.restoreImporter();p.lampFix={removed:delta.remove.length,written:delta.write.length};return reconcile(p);
}
