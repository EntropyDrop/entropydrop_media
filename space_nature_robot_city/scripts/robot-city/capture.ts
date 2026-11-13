import {setup} from './browser.ts';
export async function install(){
 await setup((window as any).game);const p=(window as any).city,g=p.g,c=p.c;
 const style=document.createElement('style');style.textContent='.entity-nameplate,#dev-render-diagnostics,#dev-frame-profiler{display:none!important}';document.head.appendChild(style);
 p.cleanTravel=(on=true)=>{p.travelClean=on;const cross=document.getElementById('crosshair');if(cross)cross.style.display=on?'none':'';};
 const avatar=g.sceneRenderer.setPlayerAvatarVisible.bind(g.sceneRenderer);g.sceneRenderer.setPlayerAvatarVisible=(visible:any,hand:any)=>avatar(visible,p.travelClean?false:hand);
 const aim=c.updateAimRaycast.bind(c),links=c.updateComponentHierarchyLinks.bind(c);
 c.updateAimRaycast=()=>{if(!p.travelClean)return aim();c.syncDrivenVehiclePose();c.updateCameraPosition();c.hoveredContraption=null;c.hoveredContraptionHit=null;c.currentRaycast={hit:false};for(const e of p.team.entities){e.setHighlighted(false);e.clearFocusHighlight();}};
 c.updateComponentHierarchyLinks=()=>p.travelClean?g.sceneRenderer.setComponentHierarchyLinks(null):links();
 const update=g.contraptionManager.update.bind(g.contraptionManager);p.captureRunning=false;g.contraptionManager.update=(dt:any,input:any)=>{if(p.captureRunning)return update(dt,input);};
 p.sequence=(seconds:number,events:any[],step:any=()=>{})=>{let at=0;p.frame(seconds,(t:number)=>{while(at<events.length&&t>=events[at][0])events[at++][1]();step(t);});};
 p.cleanTravel(true);g.sceneRenderer.setPlayerAvatarVisible(false,false);return {surface:(window as any).offlineSurfaceStatus,robots:p.team.snapshot()};
}
