import * as THREE from 'three';
import {bendPoint,bendPointForView,bendFrameQuaternion,setTorusViewCorrection} from '../../engine/src/torus/TorusWorld.ts';
/** Aim at the actual bent target, with the target district's vertical as camera up. */
export function apply(p:any){
 const g=p.g,c=g.controller,temp=new THREE.PerspectiveCamera(),target=new THREE.Vector3(),q=new THREE.Quaternion(),anchor=new THREE.Quaternion();
 const original=c.updateCameraPosition.bind(c);
 c.updateCameraPosition=()=>{
  if(!p.fixed)return original();
  const pos=p.fixed.pos,look=p.fixed.target;
  c.camera.position.set(...pos);setTorusViewCorrection(c.camera.position);
  bendPoint(pos[0],pos[1],pos[2],temp.position);
  bendPointForView(look[0],look[1],look[2],target);
  bendFrameQuaternion(look[0],look[1],look[2],anchor);
  temp.up.set(0,1,0).applyQuaternion(anchor);temp.lookAt(target);
  bendFrameQuaternion(pos[0],pos[1],pos[2],q);
  c.camera.quaternion.copy(q.invert()).multiply(temp.quaternion);c.camera.updateMatrixWorld(true);
  if(g.sceneRenderer.playerFirstPersonHand&&!p.toolDemo)g.sceneRenderer.playerFirstPersonHand.visible=false;
  if(g.sceneRenderer.playerAvatar)g.sceneRenderer.playerAvatar.visible=false;
 };
 const style=document.createElement('style');style.textContent='body.city-clean #hud-overlay,body.city-clean #hotbar,body.city-clean #nav-system-container,body.city-clean .selector-panel-wrapper{display:none!important}body.city-clean *{cursor:none!important}';document.head.appendChild(style);
 p.views.overview=[[5460,140,845],[5390,10,675]];
 p.view('overview');
}
