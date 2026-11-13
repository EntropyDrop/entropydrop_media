import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
export async function install(p:any){
 const g=p.g,c=g.controller,u=g.uiStore;
 const base='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/vlog-three-worlds/';
 const create=async(file:string,pos:number[])=>{const model=await fetch(base+file+'.json').then(r=>r.json());const parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);const e=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...pos),null,false);e.stopAllNodeScripts();await e.scriptRuntimeClient.ready();return e;};
 p.rover=await create('rover-refined',[8229,18,1022]);p.rover.position.y=18.6875;
 p.chinook=await create('chinook-refined-r3',[8256,20,1026]);
 p.windmill=await create('medieval-windmill',[8200,17,1015]);p.windmill.position.set(8200,17,1015);
 const slot=(e:any,id:string,name:string)=>{const s=e.serializeSubtree(id);s.name=name;return s;};
 const items=[slot(p.rover,p.rover.rootComponentId,'NATURE TRAIL | Rover'),slot(p.chinook,p.chinook.rootComponentId,'AETHER 47 | Chinook'),slot(p.windmill,'mill','OAK & STONE | Windmill')];
 const current=c.inventories.item.items;
 if(current.slice(0,5).some((x:any)=>x&&!/NATURE TRAIL|AETHER 47|FOREST CABIN|wheel fl|Aft three-blade rotor|OAK & STONE/.test(x.name||'')))throw Error('Unexpected backpack items; preserve and inspect first');
 p.originalDemoItems=current.slice(0,5);for(let i=0;i<5;i++)current[i]=null;items.forEach((x:any)=>c.addInventoryItem('entity',x));c.saveInventoriesToLocalStorage();u.renderInventoryBar();
 p.rotorId='aft_rotor';
 p.view=(e:any,angle=.8,r=12,h=4,targetHeight=1)=>{p.entity=e;p.pose([e.position.x+Math.sin(angle)*r,e.position.y+h,e.position.z+Math.cos(angle)*r],[e.position.x,e.position.y+targetHeight,e.position.z]);};
 p.prepareWheel=()=>{u.closeAllModals(false);u.selectTool('selector');p.pose([8222,20.7,1015],[8227.5,18.8,1020.5]);c.selectAllSelectionBlocks({contraption:p.rover,nodeId:'wheel_fl'});return c.canUseSelectionActions();};
 p.copyRotor=()=>{c.selectAllSelectionBlocks({contraption:p.chinook,nodeId:'aft_rotor'});return !!c.copySelectionToInventory();};
 p.backpack=()=>{u.toggleInventoryModal(true);const until=performance.now()+2500;const hide=()=>{const b=document.querySelector<HTMLButtonElement>('.market-close-btn');if(b)b.click();else if(performance.now()<until)requestAnimationFrame(hide);};requestAnimationFrame(hide);};
 p.windmill.enableAllNodeScripts();p.entity=p.windmill;u.selectTool('wrench');p.cleanTravel(true);p.view(p.windmill,2.65,22,10,8);
 return {surface:(window as any).offlineSurfaceStatus,windmill:p.windmill.position.toArray(),voxels:p.windmill.blocks.length,inventory:current.slice(0,5).map((x:any)=>x?.name||null)};
}
