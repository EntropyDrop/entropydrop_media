import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {ContraptionManager} from '../../engine/src/contraption/ContraptionManager.ts';
import {TerrainGenerator} from '../../engine/src/worldgen/TerrainGenerator.ts';
import {installTeam} from './scifi-runtime.ts';
process.on('uncaughtException',e=>{writeFileSync('.local/robot-city/review/scifi-simulation-error.json',JSON.stringify({time:new Date().toISOString(),message:String(e),stack:e.stack}));process.stderr.write('SIMULATION_ERROR '+String(e)+'\n');process.exit(1);});
const assets=JSON.parse(readFileSync('.local/robot-city/review/scifi-construction.json','utf8')),smoke=process.argv.includes('--smoke'),terrain=new TerrainGenerator(20260827,1),heightCache=new Map<string,number>();
const height=(x:number,z:number)=>{x=Math.floor(x);z=Math.floor(z);const k=x+','+z;let h=heightCache.get(k);if(h===undefined){h=terrain.sampleHeight(x,z)+1;heightCache.set(k,h);}return h;};
if(smoke){for(const j of assets.jobs){j.data=j.data.slice(0,120*5);j.runs=j.data.length/5;j.count=0;for(let i=4;i<j.data.length;i+=5)j.count+=(j.data.charCodeAt(i)-256)%2048;}for(const s of assets.survey){s.data=s.data.slice(0,18*3);s.count=s.data.length/3;}}
const micro=new Map<number,number>(),standard=new Map<number,number>(),columnMax=new Map<string,number>();let now=0,writes=0,minimumFlightClearance=Infinity;
const addHeight=(x:number,y:number,z:number)=>{const k=Math.floor(x)+","+Math.floor(z);columnMax.set(k,Math.max(y,columnMax.get(k)||0));};
const key=(x:number,y:number,z:number)=>(Math.floor(x)*2048+Math.floor(y))*65536+Math.floor(z);
const world:any={
 getBlock(x:number,y:number,z:number){const n=standard.get(key(x,y,z));return n===undefined?(y>=0&&y<height(x,z)?1:0):n===-1?0:1},getBlockColor(x:number,y:number,z:number){return (standard.get(key(x,y,z))??0x718f61)&0xffffff},getBlockMaterial(x:number,y:number,z:number){return (standard.get(key(x,y,z))??0)>>>24},
 setBlock(x:number,y:number,z:number,b:number,update:any,color:number,materialId=0){standard.set(key(x,y,z),b?(color|(materialId<<24))>>>0:-1);if(b){writes++;addHeight(x,y+1,z);}return true},
 getMicroBlock(x:number,y:number,z:number){const n=micro.get(key(x,y,z));return n===undefined?null:{block:1,color:n&0xffffff,materialId:n>>>24}},setMicroBlock(x:number,y:number,z:number,color:number,part:any,materialId=0){micro.set(key(x,y,z),(color|(materialId<<24))>>>0);writes++;addHeight(x/8,(y+1)/8,z/8);return true},hasMicroInStandardCell(){return false},
 raycast(o:any,d:any,max:number){if(d.y>=0)return{hit:false};const y=Math.max(height(o.x,o.z),columnMax.get(Math.floor(o.x)+","+Math.floor(o.z))||0);return{hit:true,kind:'standard',hitPos:{x:o.x,y,z:o.z},normal:{x:0,y:1,z:0},distance:o.y-y,block:1,color:0x718f61}},raycastMicro(){return{hit:false}},microVoxels:{get:()=>null,getForStdCell:()=>null,getLoadedStdCells:()=>[]},
};
const manager=new ContraptionManager(new THREE.Scene(),world,null,null),team=await installTeam(manager,assets,{dropEvery:13}),start=performance.now();
const source=JSON.parse(readFileSync(process.argv.includes('--rolling')?'.local/robot-city/review/scifi-resume-rolling.json':'.local/robot-city/review/scifi-resume-source.json','utf8'));
if(source.controllerRevision!==team.revision||source.blueprintSha256!==assets.blueprintSha256)throw Error('Resume source mismatch');
const checkpoints=JSON.parse(readFileSync('.local/robot-city/review/scifi-checkpoints-progress.json','utf8'));
if(checkpoints.some((c:any)=>c.controllerRevision!==team.revision))throw Error('Scenario checkpoint revision mismatch');
const masks=(key:string)=>source.robots.reduce((m:number,r:any)=>m|(r.state[key]||0),0);
const progress=assets.jobs.map((j:any)=>masks(j.family===0?'road':j.family===1?'built':'planted')&(1<<j.district)?j.count:0);
for(let i=1;i<5;i++){const s=source.robots[i].state;if(s.job>=0){const id=(i===1?0:i===4?12:6)+s.job;progress[id]=Math.max(progress[id],s.progress);}}
for(const j of assets.jobs){let left=progress[j.id];for(let i=0;i<j.data.length&&left>0;i+=5){const a=[0,1,2].map(k=>j.data.charCodeAt(i+k)-256),pi=j.data.charCodeAt(i+3)-256,code=j.data.charCodeAt(i+4)-256,axis=Math.floor(code/2048),n=Math.min(left,code%2048);for(let k=0;k<n;k++){const v=a.slice();v[axis]+=k;if(assets.types[pi])world.setBlock(...v,1,true,assets.palette[pi],assets.materials[pi]);else world.setMicroBlock(...v,assets.palette[pi],null,assets.materials[pi]);}left-=n;}if(left)throw Error('Invalid committed prefix');}
const restoredCells=writes;
for(let i=0;i<5;i++){const e=team.entities[i],old=source.robots[i],state=structuredClone(old.state);state.pendingIds='';state.pendingCells='';state.loadedJob=-1;state.loadedPage=-1;state.nextPageRequest=0;e.syncComponentStatesFromWorker({root:state});e.scriptRuntimeClient.reset(e.getSerializableComponentStates());await e.scriptRuntimeClient.ready();e.position.set(...old.position);e.updateTransform();e.capturePreviousEntityTransforms();e.scriptRuntime=source.kind==='rolling-validated-controller-checkpoint'?old.scriptRuntime||0:0;e.scriptError=null;e.nodeScriptErrors.clear();}
(globalThis as any).gc?.();team.start();
console.log('RESTORED',JSON.stringify({restoredCells,revision:team.revision,sourceTime:source.time,uninterrupted:false}));
const samples:any[]=[];let complete=false;
for(let tick=0;tick<300000;tick++){
 now=source.time+tick*.05;team.setClock(now);manager.update(.05,{down:[],pressed:[],released:[]});
 const state=team.entities.map(e=>team.state(e));
 for(let i=0;i<5;i++)if(team.entities[i].scriptError||state[i].fault)throw Error(team.entities[i].scriptError||JSON.stringify(state[i]));
 for(const e of team.entities){const p=e.position;let ground=0;for(const [dx,dz]of [[0,0],[-3,-3],[3,-3],[-3,3],[3,3]]){const x=Math.floor(p.x+dx),z=Math.floor(p.z+dz);ground=Math.max(ground,height(x,z),columnMax.get(x+','+z)||0);}minimumFlightClearance=Math.min(minimumFlightClearance,p.y-ground);if(p.y-ground<1.6)throw Error('Drone body intersects constructed terrain');}
 if(tick%1000===0){const summary={tick,t:now,wall:+((performance.now()-start)/1000).toFixed(1),writes,robots:state.map((s,i)=>({role:i,job:s.job,progress:s.progress,survey:s.survey,road:s.road,built:s.built,planted:s.planted,status:s.status}))};samples.push(summary);console.log(JSON.stringify(summary));writeFileSync('.local/robot-city/review/scifi-resume-rolling.json',JSON.stringify({kind:'rolling-validated-controller-checkpoint',controllerRevision:team.revision,blueprintSha256:assets.blueprintSha256,time:now,writes,robots:team.snapshot().map((r:any,i:number)=>({...r,scriptRuntime:team.entities[i].scriptRuntime})),originalSource:source.originalSource||source}));}
 if(state[4].planted===63){complete=true;break;}
 if(tick%50===0)(globalThis as any).gc?.();if(tick%10===0)await new Promise(r=>setTimeout(r,0));
}
const groups=[];for(const j of assets.jobs){let matched=0;for(let i=0;i<j.data.length;i+=5){const a=[0,1,2].map(k=>j.data.charCodeAt(i+k)-256),pi=j.data.charCodeAt(i+3)-256,code=j.data.charCodeAt(i+4)-256,axis=Math.floor(code/2048),n=code%2048;for(let k=0;k<n;k++){const v=a.slice();v[axis]+=k;const actual=assets.types[pi]?standard.get(key(...v as [number,number,number])):micro.get(key(...v as [number,number,number]));if(actual===((assets.palette[pi]|(assets.materials[pi]<<24))>>>0))matched++;}}groups.push({id:j.id,expected:j.count,matched});}
const cp=(name:string)=>checkpoints.find((c:any)=>c.name===name),before=cp('before_handoff'),taken=cp('handoff_taken'),pause=cp('road_paused'),parallel=cp('parallel_builders'),smokeReport=JSON.parse(readFileSync('.local/robot-city/review/scifi-simulation-smoke.json','utf8'));
const report={kind:'resumed-headless-functional-validation',controllerRevision:team.revision,uninterrupted:false,simulationStep:.05,minimumFlightClearance,clearanceScope:'Numeric minimum is for resumed segment; earlier completed ticks enforced the same 1.6 m clearance assertion.',complete,verified:groups.every(g=>g.expected===g.matched),writes,restoredCommittedCells:restoredCells,nativeWritesThisSegment:writes-restoredCells,wallSeconds:(performance.now()-start)/1000,robots:team.snapshot(),events:team.events,groups,samples,
 blockedSeen:smokeReport.controllerRevision===team.revision&&smokeReport.blockedSeen,paused:!!pause?.robots[1].state.workPaused,resumed:!!pause&&source.robots[1].state.road>pause.robots[1].state.road,
 handoff:!!before&&!!taken,handoffFrom:before?.handoffFrom,handoffTo:before?.handoffTo,handoffTakenAt:taken?.time??-1,restoredBuilder:!!before&&!!parallel&&parallel.robots[before.handoffFrom].state.job>=0&&!parallel.robots[before.handoffFrom].state.workPaused,
 parallelWrites:!!parallel&&parallel.robots[2].state.job!==parallel.robots[3].state.job&&!!parallel.robots[2].state.pendingIds&&!!parallel.robots[3].state.pendingIds,
 evidence:{obstacle:'Same-revision smoke and native survey/shovel footage',pauseAndHandoff:'Original same-revision checkpoints before accelerated-run interruption',resumption:source,performance:'The original long accelerated run hit its unchanged 50 ms execution guard. This report proves functional completion across checkpoint restoration, not uninterrupted real-time reliability.'}};
writeFileSync('.local/robot-city/review/scifi-simulation.json',JSON.stringify(report));writeFileSync('.local/robot-city/review/scifi-checkpoints.json',JSON.stringify(checkpoints));
console.log('RESULT',JSON.stringify({...report,robots:undefined,events:undefined,samples:undefined,evidence:undefined}));for(const e of team.entities)e.dispose();if(!complete||!report.verified)process.exitCode=1;
