import * as THREE from 'three';
import {parseInventoryImport} from '../../../client/src/engine/inventory/InventoryImport.ts';
import {TerrainGenerator} from '../../../engine/src/worldgen/TerrainGenerator.ts';

export async function install(){
 if(location.hostname!=='localhost')throw Error('Local-only asset style preview');
 const g=(window as any).game,c=g.controller;
 g.uiStore.startGame(false);g.uiStore.setLightingQuality('ultra',false);g.uiStore.setShadowsEnabled(true,false);g.uiStore.setResolutionScale(1,false);g.uiStore.setRenderDistance(16,false);
 g.uiStore.setDistantSurfaceEnabled(true,false);
 for(const[k,v]of Object.entries({subdivisionSizePx2:1,renderDistanceChunks:2048,dataBudgetMiB:1024,geometryBudgetMiB:512,torusBackfaceCulling:false}))g.uiStore.setDistantSurfaceSetting(k,v,false);
 const style=document.createElement('style');style.textContent='*{cursor:none!important}#hud-overlay,#crosshair,#nav-header-toggle,#navigation-panel,#dev-render-diagnostics,#dev-frame-profiler,.entity-nameplate{display:none!important}';document.head.appendChild(style);
 const manifest=await(await fetch(new URL('./output/manifest.json',import.meta.url).href)).json();
 const terrain=new TerrainGenerator(20260827,1);
 const p:any={g,c,entities:[],origin:[5352,15,760],presets:manifest.assets,terrain};
 p.pose=(pos:number[],target:number[])=>{p.fixedCamera={pos,target};g.playerPhysics.isFlying=true;g.playerPhysics.position.set(...pos);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();c.yaw=Math.atan2(pos[0]-target[0],pos[2]-target[2]);c.pitch=Math.atan2(target[1]-pos[1]-1.62,Math.hypot(target[0]-pos[0],target[2]-pos[2]));};
 c.setPerspective('first_person',false);c.setFov(45);
 c.updateCameraPosition=()=>{if(p.fixedCamera){c.camera.position.set(...p.fixedCamera.pos);c.camera.up.set(0,1,0);c.camera.lookAt(...p.fixedCamera.target);c.camera.updateMatrixWorld();}};
 const avatar=g.sceneRenderer.setPlayerAvatarVisible.bind(g.sceneRenderer);g.sceneRenderer.setPlayerAvatarVisible=(v:any,h:any)=>avatar(v,false);
 c.updateAimRaycast=()=>{c.syncDrivenVehiclePose();c.updateCameraPosition();c.hoveredContraption=null;c.hoveredContraptionHit=null;c.currentRaycast={hit:false};for(const e of p.entities){e.setHighlighted(false);e.clearFocusHighlight();}};
 c.updateComponentHierarchyLinks=()=>g.sceneRenderer.setComponentHierarchyLinks(null);
 p.clear=()=>{for(const e of p.entities)g.contraptionManager.removeContraption(e);p.entities=[];};
 p.add=async(id:string,position=p.origin,rotationY=0)=>{
  const url=new URL(`./output/${id}.pb`,import.meta.url).href,bytes=new Uint8Array(await(await fetch(url)).arrayBuffer());
  const parsed=parseInventoryImport(bytes,'entity');if(!parsed.ok)throw Error(parsed.error);
  const e=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...position as [number,number,number]),null,false);if(!e)throw Error('Could not place '+id);e.stopAllNodeScripts();e.setHighlighted(false);
  if(rotationY){e.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),rotationY);e.position.copy(new THREE.Vector3(...position as [number,number,number])).add(e.localCenter.clone().applyQuaternion(e.quaternion));e.updateTransform();e.resetRenderInterpolation?.();}
  p.entities.push(e);return {id,position:e.position.toArray(),blocks:e.blocks.length};
 };
 p.show=async(index:number)=>{p.clear();const a=p.presets[index];p.origin=a.category==='tree'?[5352,15,769]:[5352,index>=6?15.5:15,760];const placed=await p.add(a.id);p.active=index;const road=index>=6;const tall=[1,3,5].includes(index);const o=p.origin;
  
  const views=[[[9,6.5,-13],[0,2.5,0]],[[13,10,-18],[0,5.5,0]],[[9,6.5,-13],[0,2.5,0]],[[15,11,-19],[1,5,0]],[[9,7.5,-13],[0,3,0]],[[14,10,-19],[-1.5,5,0]]];
  let view=views[index]||[[10,13,-12],[index===7?-1:0,0,index===7?1:0]];
  if(a.category==='tree'){const h=a.bounds.size[1],d=Math.max(17,h*2.2);view=[[d*.58,h*.82,-d*.815],[0,h*.4,0]];}
  if(a.category==='bridge')view=[[19,14,-22],[0,a.id==='11_overpass_core'?3:2,0]];
  p.pose(view[0].map((v,i)=>v+o[i]),view[1].map((v,i)=>v+o[i]));return placed;
 };
 p.interchange=async()=>{p.clear();const layout=await(await fetch(new URL('./output/interchange-layout.json',import.meta.url).href)).json();p.active='overpass';p.origin=[5444,19.5,660];
  for(const a of layout.parts)await p.add(a.assetId,a.position.map((n:number,i:number)=>n+p.origin[i]),a.rotationY);
  p.pose([5482,73,570],[5444,-4,660]);return p.status();
 };
 p.planting=async(id:string)=>{p.clear();const layouts=await(await fetch(new URL('./output/planting-layouts.json',import.meta.url).href)).json(),layout=layouts.find((a:any)=>a.id===id);p.active='planting_'+id;p.origin=[5352,15,760];
  for(const a of layout.recipe.placements){const x=5352+a.position[0],z=760+a.position[2],y=terrain.sampleHeight(Math.floor(x),Math.floor(z))+1;await p.add(a.assetId,[x,y,z],a.rotationY);}
  p.pose([5383,46,715],[5352,18,760]);return {id,count:p.entities.length};
 };
 p.status=()=>({active:p.active,models:p.entities.map((e:any)=>({name:e.name,blocks:e.blocks.length,position:e.position.toArray()})),surface:(window as any).offlineSurfaceStatus,fps:g.currentFps});
 document.querySelector<HTMLElement>('#nav-header-toggle')?.parentElement?.style.setProperty('display','none','important');
 (window as any).architecture=p;await p.show(0);return p.status();
}
