import * as THREE from 'three';
import {writeFile,mkdir} from 'node:fs/promises';
import {ContraptionManager} from '../../engine/src/contraption/ContraptionManager.ts';
import {height,houses,roads,trees,surveyCells} from './plan.ts';
import {installTeam} from './runtime.ts';
const micro=new Map<string,{block:number,color:number,materialId:number}>(),standard=new Map<string,number>();let now=0,writes=0;
const key=(x:number,y:number,z:number)=>`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
const world:any={
 getBlock(x:number,y:number,z:number){return standard.get(key(x,y,z))??(y>=0&&y<height(x,z)?1:0)},getBlockColor(){return 0x718f61},getBlockMaterial(){return 0},
 setBlock(x:number,y:number,z:number,b:number){standard.set(key(x,y,z),b);return true},
 getMicroBlock(x:number,y:number,z:number){return micro.get(key(x,y,z))||null},
 setMicroBlock(x:number,y:number,z:number,color:number,part:any,materialId:number){micro.set(key(x,y,z),{block:1,color,materialId});writes++;return true},
 hasMicroInStandardCell(){return false},
 raycast(o:any,d:any,max:number){if(d.y>=0)return{hit:false};for(let y=Math.floor(o.y);y>=Math.max(0,o.y-max);y--)if(this.getBlock(Math.floor(o.x),y,Math.floor(o.z))){const distance=(y+1-o.y)/d.y;return{hit:true,kind:'standard',hitPos:{x:o.x,y:y+1,z:o.z},normal:{x:0,y:1,z:0},distance,block:1,color:0x718f61}}return{hit:false}},
 raycastMicro(){return{hit:false}},microVoxels:{get:()=>null,getForStdCell:()=>null,getLoadedStdCells:()=>[]},
};
const manager=new ContraptionManager(new THREE.Scene(),world,null,null),team=await installTeam(manager,{dropEvery:13});
const blocked=surveyCells[5];standard.set(blocked.join(','),1);team.start();const samples:any[]=[];let pauseAt=-1,resumeAt=-1,completeAt=-1,handoffAt=-1,blockedSeen=false;
for(let i=0;i<84000;i++){
 now=i*.05;team.setClock(now);manager.update(.05,{down:[],pressed:[],released:[]});
 if(i%20===0){
  const snap=team.snapshot();for(const s of snap){if(s.error)throw Error(s.role+': '+s.error);if(s.state.fault)throw Error(s.role+' fault: '+JSON.stringify(s.state));}
  const summary=snap.map(s=>({role:s.role,xyz:s.position.map(n=>+n.toFixed(1)),job:s.state.job,progress:s.state.progress,survey:s.state.survey,road:s.state.road,built:s.state.built,planted:s.state.planted,status:s.state.status,page:s.state.loadedPage}));samples.push({t:now,writes,robots:summary});
  if(snap[0].state.status==='SURVEY BLOCKED')blockedSeen=true;
  if(now>=10&&standard.get(blocked.join(',')))standard.set(blocked.join(','),0);
  if(handoffAt<0&&snap[2].state.job>=2&&snap[2].state.progress===0){team.pause(2);handoffAt=now;console.log('HANDOFF',now,snap[2].state.job)}
  if(pauseAt<0&&snap[1].state.road===3){team.pause(1);pauseAt=now;console.log('PAUSE ROAD',now)}
  if(pauseAt>=0&&resumeAt<0&&now-pauseAt>=30){team.pause(1);resumeAt=now;console.log('RESUME ROAD',now)}
  if(i%800===0)console.log(JSON.stringify({t:now,writes,robots:summary}));
  if(snap[4].state.planted===63){completeAt=now;break;}
 }
 if(i%4===0)await new Promise(r=>setTimeout(r,0));
}
const groups=[...roads,...houses,...trees],verified=groups.every(cells=>cells.every(([x,y,z,color,materialId])=>{const v=world.getMicroBlock(x,y,z);return v&&v.color===color&&v.materialId===materialId}));
const report={version:2,resources:'unlimited',droneCount:5,blueprintLibrary:'immutable pages only; no host job scheduling or world edits',completeAt,pauseAt,resumeAt,handoffAt,blockedSeen,verified,writes,changed:micro.size,last:team.snapshot(),samples,events:team.events};await mkdir('.local/robot-city/review',{recursive:true});await writeFile('.local/robot-city/review/simulation.json',JSON.stringify(report));console.log('RESULT',JSON.stringify({...report,last:report.last.map(s=>({role:s.role,status:s.state.status,planted:s.state.planted})),samples:undefined,events:undefined}));for(const e of team.entities)e.dispose();if(!verified||completeAt<0||!blockedSeen)process.exitCode=1;
