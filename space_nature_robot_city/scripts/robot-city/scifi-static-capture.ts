/** Film the already approved complete native city; never used as construction footage. */
export async function install(p:any){
 const root='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/';
 if(p.verification?.mismatch||p.verification?.checked!==4239627)throw Error('Complete native geometry has not passed readback');
 while(!(window as any).offlineSurfaceStatus?.complete)await new Promise(r=>setTimeout(r,200));
 await p.g.world.preloadTerrainAoi(5390,660);p.clean(true);
 const final=await(await fetch(root+'scifi-final-drone-positions.json')).json();
 for(let i=0;i<p.entities.length;i++){const e=p.entities[i];e.position.set(...final[i]);e.updateTransform();e.capturePreviousEntityTransforms();await e.scriptRuntimeClient.ready();}
 p.clock=0;p.checkpointName='approved-complete-city-native-render';p.captureRunning=false;
 const update=p.g.contraptionManager.update.bind(p.g.contraptionManager);p.g.contraptionManager.update=()=>{};
 p.stepControllers=(dt=.05)=>{if(dt!==.05)throw Error('Native step required');p.clock+=dt;update(dt,{down:[],pressed:[],released:[]});};
 const state=(e:any)=>e.getSerializableComponentStates()?.[e.rootComponentId]||{};
 p.team={entities:p.entities,state,snapshot:()=>p.entities.map((e:any,i:number)=>({role:['surveyor','road','builder_a','builder_b','planter'][i],position:e.position.toArray(),state:state(e),error:e.scriptError}))};
 (window as any).cityProduction=p;
 await(await import('./scifi-frame-capture.ts')).install(p);
 await(await import('./scifi-capture-settle.ts')).install(p);
 return {kind:'approved-complete-city-native-render',verification:p.verification};
}
