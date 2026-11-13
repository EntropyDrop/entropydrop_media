import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
export async function fix(p:any){
 const g=p.g,c=g.controller,u=g.uiStore;
 const load=async(name:string)=>fetch('/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/vlog-three-worlds/'+name+'.json').then(r=>r.json());
 const create=async(model:any,pos:number[])=>{const parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);const e=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...pos),null,false);e.stopAllNodeScripts();await e.scriptRuntimeClient.ready();return e;};
 const blocks:any[]=[];const add=(x:number,y:number,z:number,color:number)=>blocks.push({dx:x,dy:y,dz:z,color,materialId:0});
 for(let x=-4;x<=4;x++)for(let z=-3;z<=3;z++){
  add(x,0,z,0x6f5846);
  for(let y=1;y<=4;y++){if(Math.abs(x)!==4&&Math.abs(z)!==3)continue;if(z===-3&&Math.abs(x)<=1&&y<=3)continue;if(Math.abs(x)===4&&Math.abs(z)<=1&&y>=2&&y<=3)continue;add(x,y,z,((x+z+y)%3===0)?0xbca584:0xd8c6a5);}
 }
 for(let x=-3;x<=3;x++)for(const z of [-3,3])for(let y=5;y<5+Math.max(0,3-Math.floor(Math.abs(x)*.7));y++)add(x,y,z,0xd8c6a5);
 for(let x=-5;x<=5;x++)for(let z=-4;z<=4;z++)add(x,5+Math.max(0,3-Math.floor(Math.abs(x)*.7)),z,0x4f7565);
 const old=p.cabin;p.cabin=await create({type:'space-entity',version:8,constraints:[],root:{id:'cabin',name:'FOREST CABIN | Reusable building',pivot:[0,0,0],body:{type:'static',useGravity:false,collisionEnabled:true},blocks,children:[],seats:[],decorations:[],scriptLanguage:'assemblyscript'}},[8212,18,1014]);
p.cabin.position.y=17;g.contraptionManager.removeContraption(old);const slot=p.cabin.serializeSubtree('cabin');slot.name='FOREST CABIN | Building';c.inventories.item.items[2]=slot;c.saveInventoriesToLocalStorage();u.renderInventoryBar();return true;}
