import {install} from './scifi-preview.ts';
async function start(){
 if(!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local scene review only');
 if(!location.search.includes('dev_offline=1')){location.replace(location.pathname+'?world=nature&dev_offline=1&dev_lod=full&dev_dpr=1&dev_msaa=1&dev_seed=20260827&dev_spawn=5390,80,660');return;}
 while(!(window as any).offlineSurfaceStatus)await new Promise(r=>setTimeout(r,200));
 await install((window as any).game);
}
start().catch(e=>{(window as any).scifiError=String(e);console.error(e);});
