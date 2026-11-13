import {install} from './scifi-production.ts';
async function start(){if(!['localhost','127.0.0.1'].includes(location.hostname)||!location.search.includes('dev_offline=1'))throw Error('Local offline production only');while(!(window as any).offlineSurfaceStatus)await new Promise(r=>setTimeout(r,200));return install((window as any).game);}
start().catch(e=>{(window as any).cityProductionError=String(e);console.error(e);});
