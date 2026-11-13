import * as THREE from 'three';
import {chinook,rover,drone} from './models.ts';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
export function setup(g:any){
 if(!location.hostname.match(/^(localhost|127\.0\.0\.1)$/))throw Error('Local preview only');
 g.uiStore.startGame(false);g.uiStore.setLightingQuality('ultra',false);g.uiStore.setShadowsEnabled(true,false);g.uiStore.setResolutionScale(1,false);g.uiStore.setRenderDistance(16,false);
 for(const[k,v]of Object.entries({subdivisionSizePx2:1,renderDistanceChunks:2048,dataBudgetMiB:1024,geometryBudgetMiB:512,torusBackfaceCulling:false}))g.uiStore.setDistantSurfaceSetting(k,v,false);
 const panel=document.querySelector('#dev-render-diagnostics') as HTMLElement;if(panel)panel.style.display='none';
 const p:any={g,entity:null,samples:[]};
 p.pose=(pos:number[],target:number[])=>{g.playerPhysics.isFlying=true;g.playerPhysics.position.set(...pos);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();g.controller.yaw=Math.atan2(pos[0]-target[0],pos[2]-target[2]);g.controller.pitch=Math.atan2(target[1]-pos[1]-1.62,Math.hypot(target[0]-pos[0],target[2]-pos[2]));};
 p.create=async(name:string,pos:number[],portable?:any)=>{if(p.entity){p.entity.stopAllNodeScripts();g.contraptionManager.removeContraption(p.entity);}const model=portable||({chinook,rover,drone} as any)[name]();const parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);p.entity=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...pos),null,false);p.entity.stopAllNodeScripts();await p.entity.scriptRuntimeClient.ready();p.samples=[];return p.status();};
 p.status=()=>{const e=p.entity;return e?{position:e.position.toArray(),quaternion:e.quaternion.toArray(),velocity:e.velocity?.toArray(),status:e.scriptStatus,error:e.scriptError,nodeErrors:[...e.nodeScriptErrors.entries()],body:e.bodyType,state:e.nodeScriptStates?Object.fromEntries(e.nodeScriptStates):null}:null;};
 p.start=()=>p.entity.enableAllNodeScripts();p.stop=()=>p.entity.stopAllNodeScripts();
 p.mount=()=>{const e=p.entity,c=g.controller;c.hoveredContraption=e;c.hoveredContraptionHit={contraption:e,entityId:e.rootComponentId,point:e.getSeatWorldPosition(e.rootComponentId,0)};c.toggleDriveVehicle();c.setPerspective('third_person',true);c.yaw=0;c.pitch=-.20;return p.status();};
 p.pose([8244,83,1006],[8229,81,1022]);
 (window as any).vlog=p;return{ready:true};
}
