export const PAGE_RUNS=96;
export const CONTROLLER_REVISION='scifi-city-v9-separated-commits';
const q=JSON.stringify;
const decode=(run='ri',offset='off')=>`const at:i32=(${run}-pageBase)*5,code:i32=data.charCodeAt(at+4)-256,len:i32=code%2048,axis:i32=code/2048;let x:i32=data.charCodeAt(at)-256,y:i32=data.charCodeAt(at+1)-256,z:i32=data.charCodeAt(at+2)-256;if(axis==0)x+=${offset};if(axis==1)y+=${offset};if(axis==2)z+=${offset};const pi:i32=data.charCodeAt(at+3)-256;const standard:bool=types[pi]==1,scale:f64=standard?1:8;const cell:f64[]=[Math.floor(f64(x)/scale),Math.floor(f64(y)/scale),Math.floor(f64(z)/scale)],micro:f64[]=[f64(x)%8,f64(y)%8,f64(z)%8];`;
export function controller(role:number,ids:string[],libraryId:string,assets:any){
 const jobs=role===0?assets.survey:assets.jobs.slice(role===1?0:role===4?12:6,role===1?6:role===4?18:12);
 const packed={data:jobs.map((j:any)=>({length:(j.runs||j.count)*5})),palette:assets.palette,materials:assets.materials,counts:jobs.map((j:any)=>j.count)};
 const nav=assets.navigation;if(!nav||nav.blueprintSha256!==assets.blueprintSha256)throw Error('Missing validated flight envelope');
 const origin=assets.center,scan='',plots=[[-55,-55],[55,-55],[-55,25],[55,25],[-55,95],[55,95]].map((a,i)=>({x:origin[0]+a[0],z:origin[1]+a[1],y:30,segment:i}));
 const bases=[-30,-18,-6,6,18].map((z,i)=>[origin[0]-122,40+i*2,origin[1]+z]);
 return `// @space-initial-memory-pages: 16
// Drone City v9. Five independent controllers; unlimited resources; native standard and microvoxel writes; approved sci-fi blueprint.
const state=self.state,voxels=ctx.world.voxels,microVoxels=ctx.world.microVoxels,commands=ctx.commands,messages=ctx.messages;
const now:f64=ctx.time,dt:f64=ctx.deltaTime;const pos:f64[]=ctx.position,rot:f64[]=ctx.rotation;
const navHeights:string=${q(nav.heights)};const navX:f64=${nav.origin[0]},navZ:f64=${nav.origin[1]},navSize:f64=${nav.cellSize};const navWidth:i32=${nav.width};
const role:i32=${role};const peers:string[]=${q(ids)};const library:string=${q(libraryId)};const runCounts:i32[]=${q(packed.data.map(d=>d.length/5))};const palette:i32[]=${q(packed.palette)},materials:i32[]=${q(packed.materials)},counts:i32[]=${q(packed.counts)};
const types:i32[]=${q(assets.types)};const scanCounts:i32[]=${q(assets.survey.map((j:any)=>j.count))};const roadOrder:i32[]=[0,2,3,1,4,5];const bx:f64[]=${q(assets.buildings.map((b:any)=>b.x))},bz:f64[]=${q(assets.buildings.map((b:any)=>b.z))},bw:f64[]=${q(assets.buildings.map((b:any)=>b.width))},bd:f64[]=${q(assets.buildings.map((b:any)=>b.depth))};const px:f64[]=${q(plots.map(p=>p.x))},py:f64[]=${q(plots.map(p=>p.y))},pz:f64[]=${q(plots.map(p=>p.z))};const segments:i32[]=${q(plots.map(p=>p.segment))};
if(!state.getBoolean("initialized")){state.setBoolean("initialized",true);state.setNumber("job",-1);state.setNumber("releaseJob",-1);state.setNumber("tx",pos[0]);state.setNumber("tz",pos[2]);}
let paused:bool=state.getBoolean("workPaused");if(!ctx.clickedBlock.isNull&&ctx.clickedBlock.getString("nodeId")=="work_button"){paused=!paused;state.setBoolean("workPaused",paused);ctx.log(paused?"Pause after current task; messaging remains active":"Work resumed");}
let survey:i32=i32(state.getNumber("survey")),road:i32=i32(state.getNumber("road")),built:i32=i32(state.getNumber("built")),planted:i32=i32(state.getNumber("planted"));
let job:i32=i32(state.getNumber("job",-1)),progress:i32=i32(state.getNumber("progress")),run:i32=i32(state.getNumber("run")),offset:i32=i32(state.getNumber("offset"));
const incoming=messages.received;
for(let m:i32=0;m<incoming.length;m++){
 const msg=incoming.at(m),source=msg.getString("sourceId"),kind=msg.getString("type"),parts=msg.getString("payload").split("|");if(source==library&&kind=="blue.page.v2"&&parts.length==6&&parts[0]=="2"&&I32.parseInt(parts[1])==role&&I32.parseInt(parts[2])==i32(state.getNumber("wantedJob",-1))&&I32.parseInt(parts[3])==i32(state.getNumber("wantedPage",-1))){state.setString("pageData",parts[5]);state.setNumber("loadedJob",I32.parseInt(parts[2]));state.setNumber("loadedPage",I32.parseInt(parts[3]));continue;}
 let sender:i32=-1;for(let k:i32=0;k<5;k++)if(peers[k]==source)sender=k;if(sender<0||parts.length<2||parts[0]!="2")continue;
 if(kind=="status.v2"&&parts.length==6){if(sender==0)survey|=I32.parseInt(parts[2]);if(sender==1)road|=I32.parseInt(parts[3]);if(sender==2||sender==3)built|=I32.parseInt(parts[4]);if(sender==4)planted|=I32.parseInt(parts[5]);messages.send(source,"ack.v2","2|"+parts[1]);}
 if(kind=="ack.v2")state.setNumber("ack"+sender.toString(),I32.parseInt(parts[1]));
 if(role==0&&kind=="claim.v2"&&(sender==2||sender==3)){
  let chosen:i32=-1;for(let k:i32=0;k<6;k++)if(i32(state.getNumber("owner"+k.toString()))==sender&&(built&(1<<k))==0)chosen=k;
  if(chosen<0)for(let k:i32=0;k<6;k++)if(chosen<0&&survey==63&&(road&(1<<segments[k]))!=0&&(built&(1<<k))==0&&state.getNumber("owner"+k.toString())==0)chosen=k;
  if(chosen>=0){state.setNumber("owner"+chosen.toString(),sender);messages.send(source,"grant.v2","2|"+chosen.toString());}
 }
 if(role==0&&kind=="release.v2"&&(sender==2||sender==3)){const released=I32.parseInt(parts[1]);if(released>=0&&released<6){const owner=state.getNumber("owner"+released.toString());if(owner==sender)state.setNumber("owner"+released.toString(),0);messages.send(source,"released.v2","2|"+released.toString());}}
 if((role==2||role==3)&&sender==0&&kind=="released.v2"&&state.getNumber("releaseJob",-1)==I32.parseInt(parts[1]))state.setNumber("releaseJob",-1);
 if((role==2||role==3)&&sender==0&&kind=="grant.v2"){const granted=I32.parseInt(parts[1]);if(job<0&&granted>=0&&granted<6&&(built&(1<<granted))==0){job=granted;progress=0;run=0;offset=0;state.setNumber("verifyRun",0);state.setNumber("verifyOffset",0);ctx.log("Plot claimed: "+job.toString());}}
}
let tx:f64=state.getNumber("tx"),tz:f64=state.getNumber("tz"),ty:f64=40,work:bool=false;
if(role==0){
 let district:i32=i32(state.getNumber("surveyDistrict")),cursor:i32=i32(state.getNumber("surveyCell"));
 if(survey!=63&&!paused){
  const page:i32=cursor/${PAGE_RUNS};
  if(i32(state.getNumber("loadedJob",-1))==district&&i32(state.getNumber("loadedPage",-1))==page){
   const scan=state.getString("pageData");let blocked:bool=false;
   for(let n:i32=0;n<24&&cursor<scanCounts[district]&&cursor/${PAGE_RUNS}==page;n++){
    const at:i32=(cursor%${PAGE_RUNS})*3,x=scan.charCodeAt(at)-256,y=scan.charCodeAt(at+1)-256,z=scan.charCodeAt(at+2)-256;
    const actual=voxels.get([f64(x),f64(y),f64(z)]);
    if(actual.getNumber("block")!=0){blocked=true;state.setVector("blockedCell",[f64(x),f64(y),f64(z)]);break;}cursor++;
   }
   state.setString("status",blocked?"SURVEY BLOCKED":"SURVEYING FOOTPRINTS");
   if(cursor>=scanCounts[district]){survey|=1<<district;district++;cursor=0;ctx.log("Survey district accepted");}
  }else if(now>=state.getNumber("nextPageRequest")){
   state.setNumber("wantedJob",district);state.setNumber("wantedPage",page);messages.send(library,"blue.get.v2","2|0|"+district.toString()+"|"+page.toString());state.setNumber("nextPageRequest",now+.3);
  }
  state.setNumber("surveyDistrict",district);state.setNumber("surveyCell",cursor);
 }
 if(survey==63){state.setString("status","PLAN APPROVED / DISPATCH");const a=now*.08;tx=${origin[0]}+Math.cos(a)*125;tz=${origin[1]}+Math.sin(a)*100;}
}

if(role==1){
 if(job<0&&survey==63&&!paused){for(let n:i32=0;n<6;n++){const k=roadOrder[n];if(job<0&&(road&(1<<k))==0){job=k;progress=0;run=0;offset=0;state.setNumber("verifyRun",0);state.setNumber("verifyOffset",0);}}}
 if(job>=0){work=true;state.setString("status",paused?"FINISH CURRENT ROAD":job==5?"BUILDING OVERPASS":"PRINTING MICRO ROAD");}
 else state.setString("status",road==63?"ROAD NETWORK VERIFIED":paused?"NEW ROADS PAUSED":"WAIT SURVEY");
}
if(role==2||role==3){
 if(paused&&job>=0&&progress==0&&state.getString("pendingIds").length==0){state.setNumber("releaseJob",job);state.setNumber("releaseRetry",0);job=-1;}
 if(state.getNumber("releaseJob",-1)>=0&&now>=state.getNumber("releaseRetry")){messages.send(peers[0],"release.v2","2|"+i32(state.getNumber("releaseJob")).toString());state.setNumber("releaseRetry",now+1);}
 if(job<0&&!paused&&state.getNumber("releaseJob",-1)<0&&now>=state.getNumber("nextClaim")){messages.send(peers[0],"claim.v2","2|-1");state.setNumber("nextClaim",now+1);}
 if(job>=0){tx=px[job]-9;tz=pz[job]+(job%2==0?8:-8);work=(road&(1<<segments[job]))!=0;state.setString("status",work?progress<counts[job]/4?"FOUNDATION & OPENINGS":progress<counts[job]*3/4?"WALLS & DETAILS":"ROOF / FINAL CHECK":"WAIT ROAD");}
 else{state.setString("status",paused?"NEW TASKS PAUSED":built==63?"BUILDINGS VERIFIED":"WAIT ROAD / CLAIM");if(paused){tx=${bases[role][0]};tz=${bases[role][2]};}}
}
if(role==4){
 if(job<0&&!paused){for(let k:i32=0;k<6;k++)if(job<0&&(built&(1<<k))!=0&&(planted&(1<<k))==0){job=k;progress=0;run=0;offset=0;state.setNumber("verifyRun",0);state.setNumber("verifyOffset",0);}}
 if(job>=0){tx=px[job]+10;tz=pz[job]+(job%2==0?-12:12);work=true;state.setString("status","PLANTING PARAMETRIC TREES");}else state.setString("status",planted==63?"LANDSCAPE VERIFIED":"WAIT BUILDING");
}
let data:string="",pageBase:i32=0,pageEnd:i32=0;
if(job>=0&&role!=0){
 const wantedRun:i32=progress<counts[job]?run:i32(state.getNumber("verifyRun"));const wantedPage:i32=wantedRun/${PAGE_RUNS};
 if(i32(state.getNumber("loadedJob",-1))==job&&i32(state.getNumber("loadedPage",-1))==wantedPage){data=state.getString("pageData");pageBase=wantedPage*${PAGE_RUNS};pageEnd=pageBase+data.length/5;}
 else{work=false;if(now>=state.getNumber("nextPageRequest")){state.setNumber("wantedJob",job);state.setNumber("wantedPage",wantedPage);messages.send(library,"blue.get.v2","2|"+role.toString()+"|"+job.toString()+"|"+wantedPage.toString());state.setNumber("nextPageRequest",now+.3);}}
 if(data.length>0&&progress<counts[job]){
  const at:i32=i32(Math.max(0,Math.min((run-pageBase)*5,data.length-5))),pi:i32=data.charCodeAt(at+3)-256;const scale:f64=types[pi]==1?1:8;
  const axis:i32=(data.charCodeAt(at+4)-256)/2048;const wx=f64(data.charCodeAt(at)-256+(axis==0?offset:0))/scale,wy=f64(data.charCodeAt(at+1)-256+(axis==1?offset:0))/scale,wz=f64(data.charCodeAt(at+2)-256+(axis==2?offset:0))/scale;
  if(role==2||role==3){let closest:i32=0,best:f64=1e12;for(let k:i32=0;k<bx.length;k++){const d=Math.hypot(wx-bx[k],wz-bz[k]);if(d<best){best=d;closest=k;}}tx=bx[closest]-bw[closest]/2-8;tz=bz[closest]+bd[closest]/2+8;}
  else{tx=Math.floor(wx/16)*16+8;tz=Math.floor(wz/16)*16+8;}
  ty=wy+9;state.setNumber("workY",ty);
 }else ty=state.getNumber("workY",40);

}
let dx:f64=tx-pos[0],dz:f64=tz-pos[2],dist:f64=Math.hypot(dx,dz);const speed:f64=role==0?12:18;
if(dist>.2&&role!=0&&now>state.getNumber("avoidUntil")){const nearby=ctx.world.entities(pos,7);for(let k:i32=0;k<nearby.length;k++){const other=nearby.at(k);let priority:i32=-1;for(let p:i32=1;p<5;p++)if(peers[p]==other.getString("id"))priority=p;if(priority<0||priority==role)continue;const otherPos=other.get("position").asVector();if(otherPos.length!=3)continue;const ox=otherPos[0]-pos[0],oz=otherPos[2]-pos[2];if(ox*dx+oz*dz>0&&Math.hypot(ox,oz)<6&&role>priority){const len=Math.max(.1,Math.hypot(ox,oz));state.setNumber("avoidX",pos[0]-oz/len*5);state.setNumber("avoidZ",pos[2]+ox/len*5);state.setNumber("avoidUntil",now+1.2);break;}}}
if(now<state.getNumber("avoidUntil")){dx=state.getNumber("avoidX")-pos[0];dz=state.getNumber("avoidZ")-pos[2];dist=Math.hypot(dx,dz);work=false;state.setString("status","YIELD AIR CORRIDOR");}
let heading:f64=rot[1];if(dist>.2)heading=Math.atan2(-dx,-dz);const step=Math.min(dist,speed*dt);let nx=pos[0]+(dist>.01?dx/dist*step:0),nz=pos[2]+(dist>.01?dz/dist*step:0);
// Reserve a rotor footprint against the complete approved blueprint and native terrain.
// The envelope is immutable navigation data: it never writes or unveils city geometry.
let ground:f64=0;const rx:f64[]=[0,-3,3,-3,3],rz:f64[]=[0,-3,-3,3,3];
for(let r:i32=0;r<5;r++){const ix=i32(Math.floor((nx+rx[r]-navX)/navSize)),iz=i32(Math.floor((nz+rz[r]-navZ)/navSize));if(ix<0||iz<0||ix>=navWidth||iz>=navWidth){state.setBoolean("fault",true);ground=190;}else ground=Math.max(ground,f64(navHeights.charCodeAt(iz*navWidth+ix)-256)/8);}
if(pos[1]<ground+6.5){nx=pos[0];nz=pos[2];work=false;state.setString("status","CLIMB TO CLEAR OBSTACLE");}
let desiredY:f64=Math.max(ground+7,role==0?120:ty);desiredY+=Math.sin(now*1.4+f64(role))*.08;const ny=pos[1]+Math.max(-dt*12,Math.min(dt*12,desiredY-pos[1]));
if(ny<ty-2&&role!=0)work=false;
self.setLocalPosition([nx,ny,nz]);self.setLocalEuler([dist<1.5?0:-Math.min(.16,dist*.025),heading,0]);state.setNumber("tx",tx);state.setNumber("tz",tz);
if(state.getBoolean("fault")){work=false;state.setString("status","OCCUPIED / WRITE FAILED: HOLD");}
  let committedThisTick:bool=false;const pendingText=state.getString("pendingIds");
  if(pendingText.length>0){
   const ids=pendingText.split(","),cells=state.getString("pendingCells");let done:bool=true,valid:bool=true;
   for(let i:i32=0;i<ids.length;i++){
    const result=commands.result(ids[i]);if(result.isNull){done=false;continue;}if(!result.getBoolean("ok")){valid=false;state.setString("failureReason",result.getString("reason"));continue;}
    const at=i*4,x=cells.charCodeAt(at)-256,y=cells.charCodeAt(at+1)-256,z=cells.charCodeAt(at+2)-256,pi=cells.charCodeAt(at+3)-256;
    const standard:bool=types[pi]==1,scale:f64=standard?1:8,cell:f64[]=[Math.floor(f64(x)/scale),Math.floor(f64(y)/scale),Math.floor(f64(z)/scale)],micro:f64[]=[f64(x)%8,f64(y)%8,f64(z)%8];
    const actual=standard?voxels.get(cell):microVoxels.get(cell,micro);
    if(actual.getNumber("block")==0||actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi])valid=false;
   }
   if(done){if(valid){committedThisTick=true;run=i32(state.getNumber("nextRun"));offset=i32(state.getNumber("nextOffset"));progress=i32(state.getNumber("nextProgress"));state.setString("pendingIds","");state.setString("pendingCells","");}else{state.setBoolean("fault",true);ctx.log("Final commit/readback failed; completion withheld");}}
  }

if(job>=0&&progress>=counts[job]&&(state.getNumber("verifyRun")<pageBase||state.getNumber("verifyRun")>=pageEnd))work=false;
if(work&&job>=0&&!committedThisTick&&dist<(role==1||role==4?20:5)){
 const total=counts[job];
 if(progress<total){
  if(state.getString("pendingIds").length==0&&!state.getBoolean("fault")){
   let ri:i32=run,off:i32=offset,nextProgress:i32=progress;const queue:string[]=[];let queueCells:string="";
   for(let n:i32=0;n<12&&ri<pageEnd;n++){
    ${decode()}
    const cellValue=Value.vector(cell),args=Value.array().push(cellValue);if(!standard)args.push(Value.vector(micro));const actual=standard?voxels.call("get",args):microVoxels.call("get",args);if(actual.getNumber("block")!=0){if(actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi]){state.setBoolean("fault",true);state.setVector("blockedCell",[f64(x)/scale,f64(y)/scale,f64(z)/scale]);break;}}
    else{if(!standard&&voxels.call("get",Value.array().push(cellValue)).getNumber("block")!=0){state.setBoolean("fault",true);break;}const options=Value.object().setNumber("color",palette[pi]).setNumber("materialId",materials[pi]);args.push(options);const result=standard?voxels.call("set",args):microVoxels.call("set",args);if(!result.getBoolean("ok")){state.setBoolean("fault",true);state.setString("failureReason",result.getString("reason"));break;}queue.push(result.getString("commandId"));queueCells+=String.fromCharCode(x+256)+String.fromCharCode(y+256)+String.fromCharCode(z+256)+String.fromCharCode(pi+256);}
    off++;nextProgress++;if(off>=len){ri++;off=0;}
   }
   if(queue.length>0){state.setString("pendingIds",queue.join(","));state.setString("pendingCells",queueCells);state.setNumber("nextRun",ri);state.setNumber("nextOffset",off);state.setNumber("nextProgress",nextProgress);}else{run=ri;offset=off;progress=nextProgress;}
  }
  if(run<pageEnd){let ri:i32=run,off:i32=offset;${decode()}
   const ex=f64(x)/scale+.0625-pos[0],ey=f64(y)/scale+.0625-pos[1],ez=f64(z)/scale+.0625-pos[2],lx=Math.cos(heading)*ex-Math.sin(heading)*ez,lz=Math.sin(heading)*ex+Math.cos(heading)*ez,by=ey+1.5,length=Math.max(.01,Math.sqrt(lx*lx+by*by+lz*lz)),qx=-by/length,qy=lx/length,qw=1+lz/length,qn=Math.max(.001,Math.sqrt(qx*qx+qy*qy+qw*qw));const rotation=Value.array().push(Value.number(qx/qn)).push(Value.number(qy/qn)).push(Value.number(0)).push(Value.number(qw/qn));self.decorations.upsert("fabrication_beam",Value.object().setVector("position",[lx/2,(ey-1.5)/2,lz/2]).set("rotation",rotation).setVector("scale",[.04,.04,length]).setNumber("color",role==4?0x9fc95b:role==1?0xffbc68:0x74cce5).setNumber("materialId",1));state.setBoolean("beamActive",true);
  }
 }else{
  let ri:i32=i32(state.getNumber("verifyRun")),off:i32=i32(state.getNumber("verifyOffset"));let valid:bool=true;
  for(let n:i32=0;n<24&&ri<pageEnd;n++){${decode()}const actual=standard?voxels.get(cell):microVoxels.get(cell,micro);if(actual.getNumber("block")==0||actual.getNumber("color")!=palette[pi]||actual.getNumber("materialId")!=materials[pi]){valid=false;state.setBoolean("fault",true);break;}off++;if(off>=len){ri++;off=0;}}
  state.setNumber("verifyRun",ri);state.setNumber("verifyOffset",off);state.setString("status","VERIFYING EVERY MICRO CELL");
  if(valid&&ri>=runCounts[job]){if(role==1)road|=1<<job;if(role==2||role==3)built|=1<<job;if(role==4)planted|=1<<job;ctx.log("Verified complete: "+job.toString()+" / "+total.toString()+" micro cells");job=-1;run=0;offset=0;progress=0;}
 }
}
if((!work||job<0)&&state.getBoolean("beamActive")){self.decorations.remove("fabrication_beam");state.setBoolean("beamActive",false);}
state.setNumber("job",job);state.setNumber("progress",progress);state.setNumber("run",run);state.setNumber("offset",offset);state.setNumber("survey",survey);state.setNumber("road",road);state.setNumber("built",built);state.setNumber("planted",planted);
if(now>=state.getNumber("nextStatus")){let peer:i32=i32(state.getNumber("peer"));if(peer==role)peer=(peer+1)%5;const seq=i32(state.getNumber("sequence"))+1;messages.send(peers[peer],"status.v2","2|"+seq.toString()+"|"+survey.toString()+"|"+road.toString()+"|"+built.toString()+"|"+planted.toString());state.setNumber("peer",(peer+1)%5);state.setNumber("sequence",seq);state.setNumber("nextStatus",now+.35);}
`;
}
