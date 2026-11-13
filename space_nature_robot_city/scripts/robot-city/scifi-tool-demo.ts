/** Native tool presentation and physical eye alignment for the survey demonstration. */
export function install(p:any){
 p.pose=(pos:number[],target:number[])=>{p.fixed={pos,target};const physics=p.g.playerPhysics;physics.isFlying=true;physics.position.set(...(p.toolDemo?[pos[0],pos[1]-physics.eyeHeight,pos[2]]:[5390,40,660]));physics.velocity.set(0,0,0);physics.resetRenderInterpolation();if(p.g.sceneRenderer.playerFirstPersonHand)p.g.sceneRenderer.playerFirstPersonHand.visible=!!p.toolDemo;};
 p.setToolDemo=(show:boolean)=>{p.toolDemo=show;document.body.classList.toggle('city-tool-demo',show);if(show)p.c.setHotbarSlot(3);};
 const style=document.createElement('style');style.textContent='body.city-tool-demo #hud-overlay{display:flex!important}body.city-tool-demo .hud-top{visibility:hidden!important}body.city-tool-demo #hotbar{display:grid!important}body.city-tool-demo #crosshair{display:block!important}';document.head.appendChild(style);
}
