import{spawn}from'node:child_process';
import fs from'node:fs/promises';
export async function startCapture(tab, output, seconds, {cdp=null,bitrate='12M'}={}){
 const report={output,seconds,mode:cdp?'compositor':'screenshots',incoming:0,frames:0,rejected:0,errors:'',state:'starting',start:0};
 const process=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','image2pipe','-framerate','30','-vcodec',cdp?'mjpeg':'png','-i','pipe:0','-an','-vf','scale=1920:1080:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
 process.stderr.on('data',d=>report.errors+=d.toString());process.stdin.on('error',e=>report.errors+=String(e));
 const exited=new Promise(resolve=>process.on('exit',code=>resolve(code)));
 let stopped=false,last=null,cursor=0;
 const ingest=async()=>{
  if(cdp){
   cursor=(await cdp.readEvents({methods:['Page.screencastFrame']})).cursor;
   await cdp.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
   while(!stopped){const batch=await cdp.readEvents({afterSequence:cursor,methods:['Page.screencastFrame'],limit:50,timeoutMs:200});cursor=batch.cursor;
    for(const e of batch.events){last=Buffer.from(e.params.data,'base64');report.incoming++;await cdp.send('Page.screencastFrameAck',{sessionId:e.params.sessionId});}
   }
   await cdp.send('Page.stopScreencast');
  }else while(!stopped){last=Buffer.from(await tab.screenshot({}));report.incoming++;await new Promise(r=>setTimeout(r,5));}
 };
 const incoming=ingest().catch(e=>{report.errors+=String(e);stopped=true});
 const deadline=Date.now()+20000;while(!last&&Date.now()<deadline&&!stopped)await new Promise(r=>setTimeout(r,20));
 if(!last){stopped=true;process.stdin.end();await exited;throw Error('No recording frames: '+report.errors);}
 const probe=spawn('ffprobe',['-v','error','-f','image2pipe','-show_entries','stream=width,height','-of','json','-i','pipe:0'],{stdio:['pipe','pipe','pipe']});let metadata='';probe.stdout.on('data',d=>metadata+=d);probe.stdin.end(last);await new Promise(r=>probe.on('exit',r));const size=JSON.parse(metadata).streams[0];report.sourceWidth=size.width;report.sourceHeight=size.height;
 if(size.width<1920||size.height<1080){stopped=true;await incoming;process.stdin.end();await exited;throw Error('Undersized source '+size.width+'x'+size.height);}
 report.start=Date.now();report.state='recording';
 report.done=(async()=>{
  const target=Math.round(seconds*30);
  while(report.frames<target&&!stopped){let wanted=Math.min(target,Math.floor((Date.now()-report.start)*30/1000));while(report.frames<wanted){process.stdin.write(last);report.frames++;}await new Promise(r=>setTimeout(r,4));}
  stopped=true;await incoming;process.stdin.end();report.exitCode=await exited;report.state=report.exitCode===0?'complete':'failed';
  const saved={...report};delete saved.done;await fs.writeFile(output+'.capture.json',JSON.stringify(saved,null,2));return saved;
 })();
 report.done.catch(e=>{report.state="failed";report.errors+=String(e);});
 return report;
}
