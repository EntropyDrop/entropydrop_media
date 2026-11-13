/** Restore an audited recording checkpoint of cells already committed by the native controllers.
 * This is scene persistence, not a construction scheduler: subsequent edits and completion remain script-owned.
 */
export async function resume(){
 const p=(window as any).city,checkpoint=await(await fetch(new URL('./review/live-checkpoint.json',import.meta.url).href)).json();
 if(checkpoint.kind!=='recording-recovery-checkpoint')throw Error('Not an audited checkpoint');
 let restored=0;for(const c of checkpoint.cells){
  const a=p.g.world.getMicroBlock(c[0],c[1],c[2]);
  if(a){if(a.color!==c[3]||(a.materialId||0)!==c[4])throw Error('Checkpoint overlaps a different cell');}
  else if(!p.g.world.setMicroBlock(c[0],c[1],c[2],c[3],null,c[4]))throw Error('Checkpoint restore rejected');
  if(++restored%2048===0)await new Promise(requestAnimationFrame);
 }
 for(let i=0;i<5;i++){
  const old=checkpoint.robots[i],e=p.team.entities[i],state=structuredClone(old.state);state.pending=[];
  e.syncComponentStatesFromWorker({root:state});e.scriptRuntimeClient.reset(e.getSerializableComponentStates());
  e.position.set(...old.position);e.updateTransform();e.capturePreviousEntityTransforms();
  e.scriptRuntime=Math.max(state.nextStatus||0,state.nextPageRequest||0,state.nextClaim||0);e.scriptError=null;e.nodeScriptErrors.clear();
 }
 p.checkpoint=checkpoint;p.experiments=checkpoint.experiments;p.samples=[];
 p.samples.push=function(v:any){Array.prototype.push.call(this,v);if(this.length>120)this.shift();};
 p.fullValidation=()=>{const counts:any[]=[];let expected=0,matched=0;for(const [kind,groups] of [['road',p.plan.roads],['house',p.plan.houses],['trees',p.plan.trees]] as any){for(let i=0;i<groups.length;i++){let count=0;for(const c of groups[i]){const a=p.g.world.getMicroBlock(c[0],c[1],c[2]);if(a&&a.color===c[3]&&(a.materialId||0)===c[4])count++;}counts.push({kind,job:i,expected:groups[i].length,matched:count});expected+=groups[i].length;matched+=count;}}return{expected,matched,passed:matched===expected,counts,robots:p.team.snapshot().map((e:any)=>({role:e.role,error:e.error,status:e.state.status,road:e.state.road,built:e.state.built,planted:e.state.planted}))};};
 p.safetyWatch=setInterval(()=>{const bad=p.team.entities.find((e:any)=>e.scriptError);if(bad){p.captureRunning=false;p.recoveryError=bad.scriptError;}},100);
 p.pose([5450,58,604],[5425,17,660]);return{restored,roles:p.team.snapshot().map((e:any)=>({role:e.role,status:e.state.status,progress:e.state.progress}))};
}
