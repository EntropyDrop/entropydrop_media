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
const blockData=assets.survey[0].data,blocked=[0,1,2].map(i=>blockData.charCodeAt(i)-256);standard.set(key(...blocked as [number,number,number]),0xffcc44);team.start();
let blockedSeen=false,paused=false,resumed=false,handoff=false,complete=false,pauseIdleAt=-1,handoffJob=-1,handoffTakenAt=-1,handoffFrom=-1,handoffTo=-1,restoredBuilder=false,parallelWrites=false;const samples:any[]=[],checkpoints:any[]=[];const checkpoint=(name:string)=>{if(smoke||checkpoints.some(c=>c.name===name))return;checkpoints.push({name,kind:'headless-as-controller-checkpoint',controllerRevision:team.revision,blueprintSha256:assets.blueprintSha256,time:now,writes,handoffFrom,handoffTo,robots:team.snapshot()});if(!smoke)writeFileSync('.local/robot-city/review/scifi-checkpoints-progress.json',JSON.stringify(checkpoints));};
for(let tick=0;tick<(smoke?28000:1100000);tick++){
 now=tick*.05;team.setClock(now);manager.update(.05,{down:[],pressed:[],released:[]});
 const state=team.entities.map(e=>team.state(e));
 for(let i=0;i<5;i++){if(team.entities[i].scriptError||state[i].fault)throw Error(roles(i)+': '+(team.entities[i].scriptError||JSON.stringify(state[i])));}
 for(const e of team.entities){const p=e.position;let ground=0;for(const [dx,dz]of [[0,0],[-3,-3],[3,-3],[-3,3],[3,3]]){const x=Math.floor(p.x+dx),z=Math.floor(p.z+dz);ground=Math.max(ground,height(x,z),columnMax.get(x+","+z)||0);}minimumFlightClearance=Math.min(minimumFlightClearance,p.y-ground);if(p.y-ground<1.6)throw Error('Drone body intersects constructed terrain');}
 if(state[0].status==='SURVEY BLOCKED')blockedSeen=true;
 if(now>=2&&standard.get(key(...blocked as [number,number,number]))===0xffcc44)standard.set(key(...blocked as [number,number,number]),-1);
 if(!paused&&state[1].job===2&&state[1].progress>Math.max(0,assets.jobs[2].count-3000)&&state[1].progress<assets.jobs[2].count){checkpoint('road_before_pause');team.pause(1);paused=true;}
 if(paused&&!resumed&&state[1].job<0){if(pauseIdleAt<0){pauseIdleAt=now;checkpoint('road_paused');}if(now-pauseIdleAt>=30){team.pause(1);resumed=true;}}
 if(state[1].job===0&&state[1].progress>0&&state[1].progress<10000)checkpoint('early_road');
 if(state[2].job>=0&&state[3].job>=0&&state[2].job!==state[3].job&&state[2].pendingIds?.length&&state[3].pendingIds?.length&&state[2].progress<assets.jobs[6+state[2].job].count&&state[3].progress<assets.jobs[6+state[3].job].count){parallelWrites=true;checkpoint('parallel_builders');}
 if(state[4].job>=0&&state[4].progress>500)checkpoint('tree_planting');
 if(!handoff)for(const i of [2,3]){const other=5-i;if(!handoff&&state[i].job>=0&&state[i].progress===0&&!state[i].pendingIds?.length&&state[other].job<0){handoffFrom=i;handoffTo=other;checkpoint('before_handoff');handoffJob=state[i].job;team.pause(i);handoff=true;}}
 if(handoff&&handoffTakenAt<0&&state[handoffTo].job===handoffJob&&state[handoffTo].progress>0){handoffTakenAt=now;checkpoint('handoff_taken');}
 if(handoffTakenAt>=0&&!restoredBuilder&&now-handoffTakenAt>30){team.pause(handoffFrom);restoredBuilder=true;}
 if(tick%1000===0){const summary={tick,t:now,wall:+((performance.now()-start)/1000).toFixed(1),writes,robots:state.map((s,i)=>({role:i,job:s.job,progress:s.progress,survey:s.survey,road:s.road,built:s.built,planted:s.planted,status:s.status}))};samples.push(summary);console.log(JSON.stringify(summary));}
 if(state[4].planted===63){complete=true;break;}
 if(tick%50===0)(globalThis as any).gc?.();if(tick%10===0)await new Promise(r=>setTimeout(r,0));
}
const verify=[];for(const j of assets.jobs){let matched=0;for(let i=0;i<j.data.length;i+=5){const x=j.data.charCodeAt(i)-256,y=j.data.charCodeAt(i+1)-256,z=j.data.charCodeAt(i+2)-256,pi=j.data.charCodeAt(i+3)-256,code=j.data.charCodeAt(i+4)-256,axis=Math.floor(code/2048),n=code%2048;for(let k=0;k<n;k++){const c=[x,y,z];c[axis]+=k;const actual=assets.types[pi]?standard.get(key(...c as [number,number,number])):micro.get(key(...c as [number,number,number]));if(actual===((assets.palette[pi]|(assets.materials[pi]<<24))>>>0))matched++;}}verify.push({id:j.id,expected:j.count,matched});}
if(!smoke)writeFileSync('.local/robot-city/review/scifi-checkpoints.json',JSON.stringify(checkpoints));
const report={kind:smoke?'controller-smoke':'controller-construction-checkpoint',controllerRevision:team.revision,simulationStep:.05,minimumFlightClearance,complete,blockedSeen,paused,resumed,handoff,handoffFrom,handoffTo,handoffTakenAt,restoredBuilder,parallelWrites,verified:verify.every(v=>v.expected===v.matched),writes,wallSeconds:(performance.now()-start)/1000,robots:team.snapshot(),events:team.events,groups:verify,samples};writeFileSync('.local/robot-city/review/scifi-simulation'+(smoke?'-smoke':'')+'.json',JSON.stringify(report));console.log('RESULT',JSON.stringify({...report,robots:undefined,events:undefined,samples:undefined}));for(const e of team.entities)e.dispose();if(!complete||!report.verified||!blockedSeen||!paused||!resumed||!handoff||handoffTakenAt<0||!restoredBuilder||(!smoke&&!parallelWrites))process.exitCode=1;
function roles(i:number){return ['surveyor','road','builder_a','builder_b','planter'][i];}
