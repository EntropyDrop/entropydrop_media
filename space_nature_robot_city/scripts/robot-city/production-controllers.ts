import {origin,plots,roads,houses,trees,bases,surveyCells,type Cell} from './plan.ts';
const q=JSON.stringify,baseX=origin[0]*8-128,baseZ=origin[1]*8-512;
export function pack(groups:Cell[][]){
 const palette:number[]=[],materials:number[]=[],lookup=new Map<string,number>();
 const data=groups.map(cells=>{
  const runs:number[][]=[];let last:number[]|null=null;
  for(let index=0;index<cells.length;index++){const c=cells[index],key=c[3]+':'+c[4];let pi=lookup.get(key);if(pi===undefined){pi=palette.length;lookup.set(key,pi);palette.push(c[3]);materials.push(c[4]);}
   if(last){const axis=Math.floor(last[4]/2048),len=last[4]%2048;const next=last.slice(0,3);next[axis]+=len;
    if(len<2047&&last[3]===pi&&next.every((v,i)=>v===c[i])){last[4]++;continue;}}
   const next=cells[index+1];let axis=0;if(next&&next[0]===c[0]&&next[1]===c[1]&&next[2]===c[2]+1)axis=2;
   last=[c[0],c[1],c[2],pi,axis*2048+1];runs.push(last);
  }
  return runs.map(r=>String.fromCharCode(r[0]-baseX+256,r[1]+256,r[2]-baseZ+256,r[3]+256,r[4]+256)).join('');
 });return {palette,materials,data,counts:groups.map(g=>g.length)};
}
const decode=(run='ri',offset='off')=>`const at:i32=(${run}-pageBase)*5,code:i32=data.charCodeAt(at+4)-256,len:i32=code%2048,axis:i32=code/2048;let x:i32=data.charCodeAt(at)-256+${baseX},y:i32=data.charCodeAt(at+1)-256,z:i32=data.charCodeAt(at+2)-256+${baseZ};if(axis==0)x+=${offset};if(axis==1)y+=${offset};if(axis==2)z+=${offset};const pi:i32=data.charCodeAt(at+3)-256;const cell:f64[]=[Math.floor(f64(x)/8),Math.floor(f64(y)/8),Math.floor(f64(z)/8)],micro:f64[]=[f64(x)%8,f64(y)%8,f64(z)%8];`;
export const PAGE_RUNS=200;
export function controller(role:number,ids:string[],libraryId:string){
 const packed=pack(role===1?roads:role===2||role===3?houses:role===4?trees:[]);
 const scan=role===0?surveyCells.map(p=>String.fromCharCode(p[0]-origin[0]+272,p[1]+256,p[2]-origin[1]+320)).join(''):'';
 return `// Drone City v2. Five independent controllers; unlimited resources; native microvoxel writes.
const role:i32=${role};const peers:string[]=${q(ids)};const library:string=${q(libraryId)};const runCounts:i32[]=${q(packed.data.map(d=>d.length/5))};const palette:i32[]=${q(packed.palette)},materials:i32[]=${q(packed.materials)},counts:i32[]=${q(packed.counts)};
const scan:string=${q(scan)};const px:f64[]=${q(plots.map(p=>p.x))},py:f64[]=${q(plots.map(p=>p.y))},pz:f64[]=${q(plots.map(p=>p.z))};const segments:i32[]=${q(plots.map(p=>p.segment))};
if(!self.state.getBoolean("initialized")){self.state.setBoolean("initialized",true);self.state.setNumber("job",-1);self.state.setNumber("releaseJob",-1);self.state.setNumber("tx",ctx.position[0]);self.state.setNumber("tz",ctx.position[2]);}
let paused:bool=self.state.getBoolean("workPaused");if(!ctx.clickedBlock.isNull&&ctx.clickedBlock.getString("nodeId")=="work_button"){paused=!paused;self.state.setBoolean("workPaused",paused);ctx.log(paused?"Pause after current task; messaging remains active":"Work resumed");}
let survey:i32=i32(self.state.getNumber("survey")),road:i32=i32(self.state.getNumber("road")),built:i32=i32(self.state.getNumber("built")),planted:i32=i32(self.state.getNumber("planted"));
let job:i32=i32(self.state.getNumber("job",-1)),progress:i32=i32(self.state.getNumber("progress")),run:i32=i32(self.state.getNumber("run")),offset:i32=i32(self.state.getNumber("offset"));
const incoming=ctx.messages.received;
for(let m:i32=0;m<incoming.length;m++){
 const msg=incoming.at(m),source=msg.getString("sourceId"),kind=msg.getString("type"),parts=msg.getString("payload").split("|");if(source==library&&kind=="blue.page.v2"&&parts.length==6&&parts[0]=="2"&&I32.parseInt(parts[1])==role&&I32.parseInt(parts[2])==i32(self.state.getNumber("wantedJob",-1))&&I32.parseInt(parts[3])==i32(self.state.getNumber("wantedPage",-1))){self.state.setString("pageData",parts[5]);self.state.setNumber("loadedJob",I32.parseInt(parts[2]));self.state.setNumber("loadedPage",I32.parseInt(parts[3]));continue;}
 let sender:i32=-1;for(let k:i32=0;k<5;k++)if(peers[k]==source)sender=k;if(sender<0||parts.length<2||parts[0]!="2")continue;
 if(kind=="status.v2"&&parts.length==6){if(sender==0)survey|=I32.parseInt(parts[2]);if(sender==1)road|=I32.parseInt(parts[3]);if(sender==2||sender==3)built|=I32.parseInt(parts[4]);if(sender==4)planted|=I32.parseInt(parts[5]);ctx.messages.send(source,"ack.v2","2|"+parts[1]);}
 if(kind=="ack.v2")self.state.setNumber("ack"+sender.toString(),I32.parseInt(parts[1]));
 if(role==0&&kind=="claim.v2"&&(sender==2||sender==3)){
  let chosen:i32=-1;for(let k:i32=0;k<6;k++)if(i32(self.state.getNumber("owner"+k.toString()))==sender&&(built&(1<<k))==0)chosen=k;
  if(chosen<0)for(let k:i32=0;k<6;k++)if(chosen<0&&survey==63&&(road&(1<<segments[k]))!=0&&(built&(1<<k))==0&&self.state.getNumber("owner"+k.toString())==0)chosen=k;
  if(chosen>=0){self.state.setNumber("owner"+chosen.toString(),sender);ctx.messages.send(source,"grant.v2","2|"+chosen.toString());}
 }
 if(role==0&&kind=="release.v2"&&(sender==2||sender==3)){const released=I32.parseInt(parts[1]);if(released>=0&&released<6){const owner=self.state.getNumber("owner"+released.toString());if(owner==sender)self.state.setNumber("owner"+released.toString(),0);if(owner==sender||owner==0)ctx.messages.send(source,"released.v2","2|"+released.toString());}}
 if((role==2||role==3)&&sender==0&&kind=="released.v2"&&self.state.getNumber("releaseJob",-1)==I32.parseInt(parts[1]))self.state.setNumber("releaseJob",-1);
 if((role==2||role==3)&&sender==0&&kind=="grant.v2"){const granted=I32.parseInt(parts[1]);if(job<0&&granted>=0&&granted<6&&(built&(1<<granted))==0){job=granted;progress=0;run=0;offset=0;self.state.setNumber("verifyRun",0);self.state.setNumber("verifyOffset",0);ctx.log("Plot claimed: "+job.toString());}}
}
let tx:f64=self.state.getNumber("tx"),tz:f64=self.state.getNumber("tz"),work:bool=false;
if(role==0){
 let cursor:i32=i32(self.state.getNumber("surveyCell"));
 if(survey!=63&&!paused){let blocked:bool=false;for(let n:i32=0;n<180&&cursor<scan.length/3;n++){const at=cursor*3,x=scan.charCodeAt(at)-272+${origin[0]},y=scan.charCodeAt(at+1)-256,z=scan.charCodeAt(at+2)-320+${origin[1]};const actual=ctx.world.voxels.get([f64(x),f64(y),f64(z)]);if(actual.getNumber("block")!=0){blocked=true;self.state.setVector("blockedCell",[f64(x),f64(y),f64(z)]);break;}cursor++;}self.state.setNumber("surveyCell",cursor);self.state.setString("status",blocked?"SURVEY BLOCKED":"SURVEYING FOOTPRINTS");if(cursor>=scan.length/3){survey=63;ctx.log("Terrain and occupied standard cells checked; builders check every micro cell again");}}
 if(survey==63){self.state.setString("status","PLAN APPROVED / DISPATCH");const a=ctx.time*.08;tx=${origin[0]+36}+Math.cos(a)*28;tz=${origin[1]}+Math.sin(a)*25;}
}
if(role==1){
 if(job<0&&survey==63&&!paused){for(let k:i32=0;k<6;k++)if(job<0&&(road&(1<<k))==0){job=k;progress=0;run=0;offset=0;self.state.setNumber("verifyRun",0);self.state.setNumber("verifyOffset",0);}}
 if(job>=0){work=true;self.state.setString("status",paused?"FINISH CURRENT ROAD":job==5?"BUILDING OVERPASS":"PRINTING MICRO ROAD");}
 else self.state.setString("status",road==63?"ROAD NETWORK VERIFIED":paused?"NEW ROADS PAUSED":"WAIT SURVEY");
}
if(role==2||role==3){
 if(paused&&job>=0&&progress==0&&self.state.get("pending").length==0){self.state.setNumber("releaseJob",job);self.state.setNumber("releaseRetry",0);job=-1;}
 if(self.state.getNumber("releaseJob",-1)>=0&&ctx.time>=self.state.getNumber("releaseRetry")){ctx.messages.send(peers[0],"release.v2","2|"+i32(self.state.getNumber("releaseJob")).toString());self.state.setNumber("releaseRetry",ctx.time+1);}
 if(job<0&&!paused&&self.state.getNumber("releaseJob",-1)<0&&ctx.time>=self.state.getNumber("nextClaim")){ctx.messages.send(peers[0],"claim.v2","2|-1");self.state.setNumber("nextClaim",ctx.time+1);}
 if(job>=0){tx=px[job]-9;tz=pz[job]+(job%2==0?8:-8);work=(road&(1<<segments[job]))!=0;self.state.setString("status",work?progress<counts[job]/4?"FOUNDATION & OPENINGS":progress<counts[job]*3/4?"WALLS & DETAILS":"ROOF / FINAL CHECK":"WAIT ROAD");}
 else{self.state.setString("status",paused?"NEW TASKS PAUSED":built==63?"BUILDINGS VERIFIED":"WAIT ROAD / CLAIM");if(paused){tx=${bases[role][0]};tz=${bases[role][2]};}}
}
if(role==4){
 if(job<0&&!paused){for(let k:i32=0;k<6;k++)if(job<0&&(built&(1<<k))!=0&&(planted&(1<<k))==0){job=k;progress=0;run=0;offset=0;self.state.setNumber("verifyRun",0);self.state.setNumber("verifyOffset",0);}}
 if(job>=0){tx=px[job]+10;tz=pz[job]+(job%2==0?-12:12);work=true;self.state.setString("status","PLANTING PARAMETRIC TREES");}else self.state.setString("status",planted==63?"LANDSCAPE VERIFIED":"WAIT BUILDING");
}
let data:string="",pageBase:i32=0,pageEnd:i32=0;
if(job>=0&&role!=0){
 const wantedRun:i32=progress<counts[job]?run:i32(self.state.getNumber("verifyRun"));const wantedPage:i32=wantedRun/${PAGE_RUNS};
 if(i32(self.state.getNumber("loadedJob",-1))==job&&i32(self.state.getNumber("loadedPage",-1))==wantedPage){data=self.state.getString("pageData");pageBase=wantedPage*${PAGE_RUNS};pageEnd=pageBase+data.length/5;}
 else{work=false;if(ctx.time>=self.state.getNumber("nextPageRequest")){self.state.setNumber("wantedJob",job);self.state.setNumber("wantedPage",wantedPage);ctx.messages.send(library,"blue.get.v2","2|"+role.toString()+"|"+job.toString()+"|"+wantedPage.toString());self.state.setNumber("nextPageRequest",ctx.time+.3);}}
 if(role==1&&data.length>0){const at:i32=i32(Math.max(0,Math.min((run-pageBase)*5,data.length-5)));tx=f64(data.charCodeAt(at)-256+${baseX})/8;const z=f64(data.charCodeAt(at+2)-256+${baseZ})/8;tz=Math.abs(z-${origin[1]})>7?z-4:${origin[1]-7};}
}
let dx:f64=tx-ctx.position[0],dz:f64=tz-ctx.position[2],dist:f64=Math.hypot(dx,dz);const speed:f64=role==0?6:8;
if(dist>.2&&role!=0&&ctx.time>self.state.getNumber("avoidUntil")){const nearby=ctx.world.entities(ctx.position,7);for(let k:i32=0;k<nearby.length;k++){const other=nearby.at(k);let priority:i32=-1;for(let p:i32=1;p<5;p++)if(peers[p]==other.getString("id"))priority=p;if(priority<0||priority==role)continue;const pos=other.get("position").asVector();if(pos.length!=3)continue;const ox=pos[0]-ctx.position[0],oz=pos[2]-ctx.position[2];if(ox*dx+oz*dz>0&&Math.hypot(ox,oz)<6&&role>priority){const len=Math.max(.1,Math.hypot(ox,oz));self.state.setNumber("avoidX",ctx.position[0]-oz/len*5);self.state.setNumber("avoidZ",ctx.position[2]+ox/len*5);self.state.setNumber("avoidUntil",ctx.time+1.2);break;}}}
if(ctx.time<self.state.getNumber("avoidUntil")){dx=self.state.getNumber("avoidX")-ctx.position[0];dz=self.state.getNumber("avoidZ")-ctx.position[2];dist=Math.hypot(dx,dz);work=false;self.state.setString("status","YIELD AIR CORRIDOR");}
let heading:f64=ctx.rotation[1];if(dist>.2)heading=Math.atan2(-dx,-dz);const step=Math.min(dist,speed*ctx.deltaTime),nx=ctx.position[0]+(dist>.01?dx/dist*step:0),nz=ctx.position[2]+(dist>.01?dz/dist*step:0);
const hit=ctx.world.raycast([nx,64,nz],[0,-1,0],64);let ground:f64=ctx.position[1]-12;if(!hit.isNull)ground=64-hit.getNumber("distance");let desiredY:f64=ground+(role==0?17:role==1?10:role==2?12:role==3?14:12);desiredY+=Math.sin(ctx.time*1.4+f64(role))*.08;const ny=ctx.position[1]+Math.max(-ctx.deltaTime*6,Math.min(ctx.deltaTime*6,desiredY-ctx.position[1]));
self.setLocalPosition([nx,ny,nz]);self.setLocalEuler([dist<1.5?0:-Math.min(.16,dist*.025),heading,0]);self.state.setNumber("tx",tx);self.state.setNumber("tz",tz);
if(self.state.getBoolean("fault")){work=false;self.state.setString("status","OCCUPIED / WRITE FAILED: HOLD");}
if(work&&job>=0&&dist<1.5){
 const total=counts[job];
 if(progress<total){
  const pending=self.state.get("pending");
  if(pending.length>0){
   let done:bool=true,valid:bool=true;for(let i:i32=0;i<pending.length;i++){const p=pending.at(i),result=ctx.commands.result(p.getString("id"));if(result.isNull){done=false;continue;}if(!result.getBoolean("ok")){valid=false;self.state.setString("failureReason",result.getString("reason"));continue;}const xyz=p.get("m").asVector(),cell:f64[]=[Math.floor(xyz[0]/8),Math.floor(xyz[1]/8),Math.floor(xyz[2]/8)],micro:f64[]=[xyz[0]%8,xyz[1]%8,xyz[2]%8];const actual=ctx.world.microVoxels.get(cell,micro),pi=i32(p.getNumber("p"));if(actual.getNumber("block")==0||actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi])valid=false;}
   if(done){if(valid){run=i32(self.state.getNumber("nextRun"));offset=i32(self.state.getNumber("nextOffset"));progress=i32(self.state.getNumber("nextProgress"));self.state.set("pending",Value.array());}else{self.state.setBoolean("fault",true);ctx.log("Final commit/readback failed; completion withheld");}}
  }if(self.state.get("pending").length==0&&!self.state.getBoolean("fault")){
   let ri:i32=run,off:i32=offset,nextProgress:i32=progress;const queue=Value.array();
   for(let n:i32=0;n<8&&ri<pageEnd;n++){
    ${decode()}
    const actual=ctx.world.microVoxels.get(cell,micro);if(actual.getNumber("block")!=0){if(actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi]){self.state.setBoolean("fault",true);self.state.setVector("blockedCell",[f64(x)/8,f64(y)/8,f64(z)/8]);break;}}
    else{if(ctx.world.voxels.get(cell).getNumber("block")!=0){self.state.setBoolean("fault",true);break;}const result=ctx.world.microVoxels.set(cell,micro,Value.object().setNumber("color",palette[pi]).setNumber("materialId",materials[pi]));if(!result.getBoolean("ok")){self.state.setBoolean("fault",true);self.state.setString("failureReason",result.getString("reason"));break;}queue.push(Value.object().setString("id",result.getString("commandId")).setVector("m",[f64(x),f64(y),f64(z)]).setNumber("p",pi));}
    off++;nextProgress++;if(off>=len){ri++;off=0;}
   }
   if(queue.length>0){self.state.set("pending",queue);self.state.setNumber("nextRun",ri);self.state.setNumber("nextOffset",off);self.state.setNumber("nextProgress",nextProgress);}else{run=ri;offset=off;progress=nextProgress;}
  }
  if(run<pageEnd){let ri:i32=run,off:i32=offset;${decode()}
   const ex=f64(x)/8+.0625-ctx.position[0],ey=f64(y)/8+.0625-ctx.position[1],ez=f64(z)/8+.0625-ctx.position[2],lx=Math.cos(heading)*ex-Math.sin(heading)*ez,lz=Math.sin(heading)*ex+Math.cos(heading)*ez,by=ey+1.5,length=Math.max(.01,Math.sqrt(lx*lx+by*by+lz*lz)),qx=-by/length,qy=lx/length,qw=1+lz/length,qn=Math.max(.001,Math.sqrt(qx*qx+qy*qy+qw*qw));const rotation=Value.array().push(Value.number(qx/qn)).push(Value.number(qy/qn)).push(Value.number(0)).push(Value.number(qw/qn));self.decorations.upsert("fabrication_beam",Value.object().setVector("position",[lx/2,(ey-1.5)/2,lz/2]).set("rotation",rotation).setVector("scale",[.04,.04,length]).setNumber("color",role==4?0x9fc95b:role==1?0xffbc68:0x74cce5).setNumber("materialId",1));self.state.setBoolean("beamActive",true);
  }
 }else{
  let ri:i32=i32(self.state.getNumber("verifyRun")),off:i32=i32(self.state.getNumber("verifyOffset"));let valid:bool=true;
  for(let n:i32=0;n<24&&ri<pageEnd;n++){${decode()}const actual=ctx.world.microVoxels.get(cell,micro);if(actual.getNumber("block")==0||actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi]){valid=false;self.state.setBoolean("fault",true);break;}off++;if(off>=len){ri++;off=0;}}
  self.state.setNumber("verifyRun",ri);self.state.setNumber("verifyOffset",off);self.state.setString("status","VERIFYING EVERY MICRO CELL");
  if(valid&&ri>=runCounts[job]){if(role==1)road|=1<<job;if(role==2||role==3)built|=1<<job;if(role==4)planted|=1<<job;ctx.log("Verified complete: "+job.toString()+" / "+total.toString()+" micro cells");job=-1;run=0;offset=0;progress=0;}
 }
}
if((!work||job<0)&&self.state.getBoolean("beamActive")){self.decorations.remove("fabrication_beam");self.state.setBoolean("beamActive",false);}
self.state.setNumber("job",job);self.state.setNumber("progress",progress);self.state.setNumber("run",run);self.state.setNumber("offset",offset);self.state.setNumber("survey",survey);self.state.setNumber("road",road);self.state.setNumber("built",built);self.state.setNumber("planted",planted);
if(ctx.time>=self.state.getNumber("nextStatus")){let peer:i32=i32(self.state.getNumber("peer"));if(peer==role)peer=(peer+1)%5;const seq=i32(self.state.getNumber("sequence"))+1;ctx.messages.send(peers[peer],"status.v2","2|"+seq.toString()+"|"+survey.toString()+"|"+road.toString()+"|"+built.toString()+"|"+planted.toString());self.state.setNumber("peer",(peer+1)%5);self.state.setNumber("sequence",seq);self.state.setNumber("nextStatus",ctx.time+.35);}
`;
}
