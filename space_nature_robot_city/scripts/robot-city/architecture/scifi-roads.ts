/** A directed interchange, rather than decorative curves with coincident endpoints. */
export type Vec=[number,number,number];
export type RoadLink={end:'start'|'end';road:string;lane:'forward'|'backward'|'both'};
export type Path={id:string;points:Vec[];width:number;kind:'street'|'highway'|'ramp';direction?:'both'|'forward';links?:RoadLink[];purpose?:string;length?:number};
const lerp=(a:Vec,b:Vec,t:number)=>a.map((v,k)=>v+(b[k]-v)*t) as Vec;
const line=(a:Vec,b:Vec)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])*2);return Array.from({length:n+1},(_,i)=>lerp(a,b,i/n));};
function cubic(a:Vec,b:Vec,c:Vec,d:Vec){const estimate=Math.hypot(b[0]-a[0],b[2]-a[2])+Math.hypot(c[0]-b[0],c[2]-b[2])+Math.hypot(d[0]-c[0],d[2]-c[2]),n=Math.ceil(estimate*3);return Array.from({length:n+1},(_,i)=>{const t=i/n,s=1-t;return a.map((v,k)=>v*s*s*s+3*b[k]*s*s*t+3*c[k]*s*t*t+d[k]*t*t*t) as Vec;});}
export function chain(segments:Vec[][]){return segments.flatMap((p,i)=>cubic(p[0],p[1],p[2],p[3]).slice(i?1:0));}
export function stations(points:Vec[]){const s=[0];for(let i=1;i<points.length;i++)s.push(s[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));return s;}
// Constant middle grade with quadratic vertical transitions at both ends. C1 height continuity.
function easeGrade(t:number,e=.1){if(t<e)return t*t/(2*e*(1-e));if(t>1-e)return 1-(1-t)*(1-t)/(2*e*(1-e));return (t-e/2)/(1-e);}
function profile(points:Vec[],knots:{s:number;h:number}[],e=.1){const s=stations(points);points.forEach((p,i)=>{const j=knots.findIndex((k,j)=>j<knots.length-1&&s[i]<=knots[j+1].s+1e-6),a=knots[Math.max(0,j)],b=knots[Math.max(0,j)+1];p[1]=a.h+(b.h-a.h)*easeGrade(Math.max(0,Math.min(1,(s[i]-a.s)/(b.s-a.s))),e);});return s.at(-1)!;}
function arc(cx:number,cz:number,r:number,a:number,b:number,h:number){const n=Math.ceil(Math.abs(b-a)*r*4);return Array.from({length:n+1},(_,i)=>[cx+r*Math.cos(a+(b-a)*i/n),h,cz+r*Math.sin(a+(b-a)*i/n)] as Vec);}
const link=(end:RoadLink['end'],road:string,lane:RoadLink['lane']='both'):RoadLink=>({end,road,lane});
export function buildRoadNetwork(streets:Path[]){
 const paths:Path[]=[];
 const ew:Path={id:'expressway-east-west',points:line([-185,28,52],[175,28,52]),width:7,kind:'highway',direction:'both',purpose:'East / west through road, one lane per direction'};
 const ns:Path={id:'expressway-north-south',points:line([112,35,-120],[112,35,125]),width:7,kind:'highway',direction:'both',purpose:'North / south through road, 7 m above the east / west crossing'};
 paths.push(ew,ns);
 const streetEnd=(id:string,end:'start'|'end')=>{const p=streets.find(p=>p.id===id)!;return [...p.points[end==='start'?0:p.points.length-1]] as Vec;};
 const w=streetEnd('street-ns--77','end'),n=streetEnd('street-ns--28','start'),s=streetEnd('street-ns--28','end'),e=streetEnd('street-ew--12','end');
 const access=(id:string,points:Vec[],startRoad:string,endRoad:string,purpose:string)=>{const length=stations(points).at(-1)!;profile(points,[{s:0,h:points[0][1]},{s:10,h:points[0][1]},{s:length-10,h:points.at(-1)![1]},{s:length,h:points.at(-1)![1]}],.025);paths.push({id,points,width:7,kind:'ramp',direction:'both',length,links:[link('start',startRoad),link('end',endRoad)],purpose});};
 access('west-city-approach',[...arc(-185,94,42,-Math.PI/2,-Math.PI*1.5,28),...line([-185,28,136],[-103,w[1],136]).slice(1),...arc(-103,110,26,Math.PI/2,0,w[1]).slice(1)],ew.id,'street-ns--77','Two-way west approach, tangent to both elevated road and city avenue');
 access('north-city-approach',cubic([112,35,-120],[112,35,-240],[-28,n[1],-240],n),ns.id,'street-ns--28','Two-way north approach, continuous descent to the city avenue');
 access('south-city-approach',cubic([112,35,125],[112,35,245],[-28,s[1],245],s),ns.id,'street-ns--28','Two-way south approach, continuous descent to the city avenue');
 access('east-city-approach',[...arc(175,20,32,Math.PI/2,-Math.PI/2,28),...line([175,e[1],-12],e).slice(1)],ew.id,'street-ew--12','Two-way east approach, returns to the east-west city street');
 // Right-hand traffic: positive path normal is the forward carriageway.
 // The SW cloverleaf exits the southbound lane to its right, then merges into the eastbound lane from its right.
 const loop=Array.from({length:793},(_,i)=>{const a=i/792*Math.PI*1.5;return[80.25+30*Math.cos(a),35,83.75+30*Math.sin(a)] as Vec;});
 const loopLength=stations(loop).at(-1)!;profile(loop,[{s:0,h:35},{s:18,h:35},{s:loopLength-18,h:28},{s:loopLength,h:28}]);
 paths.push({id:'southbound-to-eastbound-loop',points:loop,width:3,kind:'ramp',direction:'forward',length:loopLength,links:[link('start',ns.id,'forward'),link('end',ew.id,'forward')],purpose:'One-way: southbound → eastbound, 270° left-turn loop, correct right-hand lane connections'});
 // A semi-directional flyover connects the other left-turn movement. All cubic joins share tangent direction.
 const fly=chain([
  [[-165,28,53.75],[-145,28,53.75],[-130,28,78],[-110,28,78]],
  [[-110,28,78],[-60,28,78],[-10,28,78],[40,28,78]],
  [[40,28,78],[80,28,78],[83,28,116],[128,28,116]],
  [[128,28,116],[180,28,116],[180,28,35],[151,28,-15]],
  [[151,28,-15],[122,28,-65],[113.75,28,-65],[113.75,35,-110]],
 ]);
 const fs=stations(fly),nsIndex=fly.findIndex(p=>p[0]>=112&&p[2]>52),ewIndex=fly.findIndex((p,i)=>i>nsIndex&&p[2]<=52);
 const departure=fly.findIndex(p=>p[2]>58);
 profile(fly,[{s:0,h:28},{s:fs[departure]+4,h:28},{s:fs[nsIndex]-18,h:42},{s:fs[ewIndex]+18,h:42},{s:fs.at(-1)!-50,h:35},{s:fs.at(-1)!,h:35}]);
 paths.push({id:'eastbound-to-northbound-flyover',points:fly,width:3,kind:'ramp',direction:'forward',length:fs.at(-1),links:[link('start',ew.id,'forward'),link('end',ns.id,'backward')],purpose:'One-way: eastbound → northbound, 42 m flyover over both main roads, tangential right-side merge'});
 return paths;
}
