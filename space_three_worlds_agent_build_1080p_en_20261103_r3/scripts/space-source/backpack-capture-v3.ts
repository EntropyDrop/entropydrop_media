import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
export async function install(p:any){
 const g=p.g,c=g.controller,u=g.uiStore;
 const load=async(name:string)=>fetch('/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/vlog-three-worlds/'+name+'.json').then(r=>r.json());
 const create=async(model:any,pos:number[])=>{const parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);const e=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...pos),null,false);e.stopAllNodeScripts();await e.scriptRuntimeClient.ready();return e;};
 p.rover=p.entity;
 p.chinook=await create(await load('chinook-refined-r3'),[8256,20,1026]);
 const blocks:any[]=[];const add=(x:number,y:number,z:number,color:number)=>blocks.push({dx:x,dy:y,dz:z,color,materialId:0});
 for(let x=-4;x<=4;x++)for(let z=-3;z<=3;z++){
  add(x,0,z,0x6f5846);
  for(let y=1;y<=4;y++){if(Math.abs(x)!==4&&Math.abs(z)!==3)continue;if(z===-3&&Math.abs(x)<=1&&y<=3)continue;if(Math.abs(x)===4&&Math.abs(z)<=1&&y>=2&&y<=3)continue;add(x,y,z,((x+z+y)%3===0)?0xbca584:0xd8c6a5);}
 }
 for(let x=-5;x<=5;x++)for(let z=-4;z<=4;z++)add(x,5+Math.max(0,3-Math.floor(Math.abs(x)*.7)),z,0x4f7565);
 p.cabin=await create({type:'space-entity',version:8,constraints:[],root:{id:'cabin',name:'FOREST CABIN | Reusable building',pivot:[0,0,0],body:{type:'static',useGravity:false,collisionEnabled:true},blocks,children:[],seats:[],decorations:[],scriptLanguage:'assemblyscript'}},[8212,18,1014]);
 const save=(e:any,id:string,name:string)=>{const slot=e.serializeSubtree(id);slot.name=name;return c.addInventoryItem('entity',slot,'hotbar-end');};
 p.inventoryDemo=[save(p.rover,p.rover.rootComponentId,'NATURE TRAIL | Rover'),save(p.chinook,p.chinook.rootComponentId,'AETHER 47 | Chinook'),save(p.cabin,'cabin','FOREST CABIN | Building')];
 p.saveWheel=()=>save(p.rover,'wheel_fl','ROVER | Front wheel');
 const rotor=[...p.chinook.entityNodes.keys()].find((id:string)=>/rotor/i.test(id));
 p.rotorId=rotor;p.saveRotor=()=>save(p.chinook,rotor,'CHINOOK | Rotor');
 p.view=(e:any,angle=.8,r=12,h=4)=>{p.entity=e;p.pose([e.position.x+Math.sin(angle)*r,e.position.y+h,e.position.z+Math.cos(angle)*r],[e.position.x,e.position.y+1,e.position.z]);};
 p.view(p.rover,2.4,10,3);p.cleanTravel(true);u.selectTool('selector');
 return {rotor,items:p.inventoryDemo,surface:(window as any).offlineSurfaceStatus};
}
