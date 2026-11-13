export async function check(p:any){
 const shots=await(await fetch('/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/scifi-static-shots.json')).json();
 const report:any={kind:'native-camera-path-occupancy',passed:true,shots:[]};
 for(const [id,shot] of Object.entries(shots) as any){
  const result:any={id,samples:0,blocked:[]};
  for(const [segment,s] of (shot.segments||[shot]).entries()){
   const count=Math.round(s.seconds*30);
   for(let j=0;j<count;j++){
    const t=j/Math.max(1,count-1);let v:number[];
    if(s.path){const x=t*(s.path.length-1),i=Math.min(s.path.length-2,Math.floor(x)),f=x-i;v=s.path[i].position.map((n:number,k:number)=>n+(s.path[i+1].position[k]-n)*f);}
    else v=s.position[0].map((n:number,k:number)=>n+(s.position[1][k]-n)*t);
    result.samples++;
    if(p.g.world.getBlock(...v.map(Math.floor))||p.g.world.getMicroBlock(...v.map((n:number)=>Math.floor(n*8)))){if(result.blocked.length<12)result.blocked.push({segment,frame:j,position:v});report.passed=false;}
   }
  }
  report.shots.push(result);
 }
 return report;
}
