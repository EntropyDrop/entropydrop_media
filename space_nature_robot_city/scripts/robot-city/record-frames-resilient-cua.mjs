/** Run only inside cua_repl; `cdp` must be the documented tab capability. */
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {once} from 'node:events';

function camera(shot,t){
 if(shot.segments){let at=t*shot.seconds;for(const s of shot.segments){if(at<s.seconds||s===shot.segments.at(-1))return {...camera(s,Math.min(1,at/s.seconds)),fov:s.fov??shot.fov,controllerRate:s.controllerRate??shot.controllerRate};at-=s.seconds;}}
 const lerp=(a,b)=>a.map((v,i)=>v+(b[i]-v)*t);
 if(shot.followRole!==undefined)return {followRole:shot.followRole,followOffset:shot.followOffset,lookOffset:shot.lookOffset,position:shot.position?.[0],target:shot.target?.[0]};
 if(shot.path){const n=t*(shot.path.length-1),i=Math.min(shot.path.length-2,Math.floor(n)),f=n-i,a=shot.path[i],b=shot.path[i+1];return {position:a.position.map((v,k)=>v+(b.position[k]-v)*f),target:a.target.map((v,k)=>v+(b.target[k]-v)*f)};}
 if(shot.orbit){const a=shot.orbit.start+shot.orbit.turn*t,target=shot.orbit.target;
  return {position:[target[0]+Math.sin(a)*shot.orbit.radius,shot.orbit.height,target[2]+Math.cos(a)*shot.orbit.radius],target};}
 return {position:lerp(shot.position[0],shot.position[1]),target:lerp(shot.target[0],shot.target[1])};
}
export function createFrameCapture(cdp,output,shot){
 const report={output,shot,mode:shot.mode??'native-fixed-time-frames',width:1920,height:1080,fps:30,frames:0,target:Math.round(shot.seconds*30),state:'ready',errors:'',samples:[],actions:[],started:new Date().toISOString()};
 const pending=output.replace(/\.mp4$/,'.pending.mp4');
 const encoder=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',pending],{stdio:['pipe','ignore','pipe']});
 encoder.stderr.on('data',b=>report.errors+=b.toString());encoder.stdin.on('error',e=>{report.errors+=String(e);});
 const exited=once(encoder,'exit');
 const save=()=>fs.writeFile(output+'.capture.json',JSON.stringify(report,null,2));
 report.cancel=async(reason)=>{report.state='failed';report.errors+=String(reason);report.failureAfterFrame=report.frames;try{encoder.stdin.end();const [code]=await exited;if(code===0&&report.frames>0){report.partialOutput=output.replace(/\.mp4$/,'.partial.mp4');await fs.rename(pending,report.partialOutput);}}catch(e){report.errors+=' Partial finalization: '+String(e);}report.finished=new Date().toISOString();await save();};
 report.advance=async(maxFrames=180)=>{
  if(report.state==='complete'||report.state==='failed')return {state:report.state,frames:report.frames,errors:report.errors};
  const until=Date.now()+40000,end=Math.min(report.target,report.frames+maxFrames);report.state='recording';
  try{
   while(report.frames<end&&Date.now()<until){
    const i=report.frames,pose=camera(shot,i/Math.max(1,report.target-1)),options={...pose,fov:pose.fov??shot.fov,controllerRate:pose.controllerRate??shot.controllerRate??0,frameIndex:i,shotTime:i/30};
    for(const action of shot.actions||[])if(Math.round(action.at*30)===i){
     let expression;
     if(action.type==='work-pause'&&Number.isInteger(action.role)&&action.role>=0&&action.role<=4)expression='window.cityProduction.pause('+action.role+')';
     else if(action.type==='shovel-remove')expression='window.cityProduction.removeSurveyObstacle()';
     else if(action.type==='tool-demo')expression='window.cityProduction.setToolDemo('+!!action.show+')';
     else throw Error('Unsupported capture action');
     const response=await cdp.send('Runtime.evaluate',{expression,returnByValue:true});
     if(response.exceptionDetails||response.result.value===false)throw Error('Native work-button event was not accepted');
     report.actions.push({frame:i,...action,result:response.result.value});
    }
    const result=await cdp.send('Runtime.evaluate',{expression:'window.cityProduction.captureFrame('+JSON.stringify(options)+')',awaitPromise:true,returnByValue:true},{timeoutMs:45000});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    if(i%30===0)report.samples.push({frame:i,...result.result.value});
    const screenshot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:95,fromSurface:true,captureBeyondViewport:false});
    if(!encoder.stdin.write(Buffer.from(screenshot.data,'base64')))await once(encoder.stdin,'drain');
    report.frames++;
   }
   if(report.frames===report.target){encoder.stdin.end();const [code]=await exited;if(code!==0)throw Error('Encoder exit '+code+': '+report.errors);await fs.rename(pending,output);report.state='complete';report.finished=new Date().toISOString();}
   else report.state='paused-between-batches';
   await save();
  }catch(error){await report.cancel(error);}
  return {state:report.state,frames:report.frames,target:report.target,errors:report.errors};
 };
 return report;
}
