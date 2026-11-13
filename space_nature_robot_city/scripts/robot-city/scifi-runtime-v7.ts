import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
import {robot} from './scifi-models.ts';
import {controller,PAGE_RUNS,CONTROLLER_REVISION} from './scifi-controllers-v7.ts';
export const roles=['surveyor','road','builder_a','builder_b','planter'];
export async function installTeam(manager:any,assets:any,options:{dropEvery?:number}={}){
 const entities:any[]=[],events:any[]=[];let sequence=0,clock=0;const [x,z]=assets.center;
 const bases=[-30,-18,-6,6,18].map((dz,i)=>[x-122,40+i*2,z+dz]);
 for(let i=0;i<5;i++){const parsed=parseInventoryImport(encodeInventoryResource('entity',robot(i)),'entity');if(!parsed.ok)throw Error(parsed.error);const e=manager.buildFromSlot(parsed.item,new THREE.Vector3(...bases[i] as [number,number,number]),null,false);if(!e)throw Error('Could not place '+roles[i]);e.stopAllNodeScripts();e.publicId=crypto.randomUUID();entities.push(e);}
 const ids=entities.map(e=>e.publicId),libraryId=crypto.randomUUID(),libraries=[assets.survey,assets.jobs.slice(0,6),assets.jobs.slice(6,12),assets.jobs.slice(6,12),assets.jobs.slice(12,18)];
 const original=manager.runtimeContextProvider;
 manager.runtimeContextProvider=()=>({...(original?.()||{}),messages:{send:(sourceId:string,targetId:string,type:string,payload:string,encoding:string)=>{
  const messageId='city-'+(++sequence),dropped=!!options.dropEvery&&sequence%options.dropEvery===0;
  if(targetId===libraryId&&type==='blue.get.v2'){
   const f=payload.split('|'),role=Number(f[1]),job=Number(f[2]),page=Number(f[3]),stride=role===0?3:5,asset=libraries[role]?.[job];
   const valid=f[0]==='2'&&sourceId===ids[role]&&asset&&Number.isInteger(page)&&page>=0&&page*PAGE_RUNS*stride<asset.data.length;
   let ok=false;if(valid&&!dropped){const data=asset.data.slice(page*PAGE_RUNS*stride,(page+1)*PAGE_RUNS*stride),reply=`2|${role}|${job}|${page}|${asset.count}|${data}`;if(new TextEncoder().encode(reply).length>4096)throw Error('Page too large');ok=entities[role].enqueueEntityMessage({messageId:'blue-'+sequence,sourceId:libraryId,targetId:sourceId,type:'blue.page.v2',payload:reply,encoding:'utf8'});}
   if(!ok)events.push({t:clock,type:'blueprint-drop',role,job,page});return{ok,messageId,deliveryStatus:ok?'routed':'dropped',reason:ok?'routed':'offline_unavailable'};
  }
  const target=entities.find(e=>e.publicId===targetId),envelope={messageId,sourceId,targetId,type,payload,encoding:encoding||'utf8'},ok=!dropped&&!!target?.enqueueEntityMessage(envelope);
  if(!type.startsWith('ack')&&(!type.startsWith('status')||sequence%80===0))events.push({t:clock,...envelope,ok});return{ok,messageId,deliveryStatus:ok?'routed':'dropped',reason:ok?'routed':'offline_unavailable'};
 }}});
 for(let i=0;i<5;i++){entities[i].setScript(controller(i,ids,libraryId,assets));await entities[i].scriptRuntimeClient.ready();if(entities[i].scriptError)throw Error(roles[i]+': '+entities[i].scriptError);}
 const state=(e:any)=>e.getSerializableComponentStates()?.[e.rootComponentId]||{};
 return{entities,ids,libraryId,events,state,assets,revision:CONTROLLER_REVISION,start(){entities.forEach(e=>e.enableAllNodeScripts());},setClock(t:number){clock=t;},pause(i:number){const e=entities[i];return e.enqueueClickedBlock({eventId:'pause-'+(++sequence),entityId:e.publicId,playerId:'dev-local',nodeId:'work_button',kind:'micro',size:.125,decorationId:null,position:[0,0,0],point:e.position.toArray(),localPoint:[0,1,.75]});},snapshot(){return entities.map((e,i)=>({role:roles[i],id:e.publicId,position:e.position.toArray(),error:e.scriptError,status:e.scriptStatus,state:state(e)}));}};
}
