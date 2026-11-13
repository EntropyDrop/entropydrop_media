import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
import {robot} from './models.ts';
import {controller,pack,PAGE_RUNS} from './controllers.ts';
import {bases,roles,roads,houses,trees} from './plan.ts';
export async function installTeam(manager:any,options:{dropEvery?:number}={}){
 const entities:any[]=[],events:any[]=[];let sequence=0,clock=0;
 for(let i=0;i<roles.length;i++){
  const parsed=parseInventoryImport(encodeInventoryResource('entity',robot(i)),'entity');if(!parsed.ok)throw Error(parsed.error);
  const entity=manager.buildFromSlot(parsed.item,new THREE.Vector3(...bases[i] as [number,number,number]),null,false);
  if(!entity)throw Error('Could not place '+roles[i]);entity.stopAllNodeScripts();
  // Offline placements use an ent_ prefix; the public message contract requires a UUID.
  entity.publicId=crypto.randomUUID();entities.push(entity);
 }
 const ids=entities.map(e=>e.publicId),libraryId=crypto.randomUUID();
 const libraries=[null,pack(roads),pack(houses),pack(houses),pack(trees)];
 // Immutable asset service: serves requested blueprint pages only. It never assigns jobs, moves entities, edits voxels, or decides completion.

 const original=manager.runtimeContextProvider;
 manager.runtimeContextProvider=()=>({...(original?.()||{}),messages:{send:(sourceId:string,targetId:string,type:string,payload:string,encoding:string)=>{
  const messageId='city-'+(++sequence);
  if(targetId===libraryId&&type==='blue.get.v2'){
   const fields=payload.split('|'),role=Number(fields[1]),job=Number(fields[2]),page=Number(fields[3]);
   const asset=libraries[role],target=manager.contraptions.find((e:any)=>e.publicId===ids[role]),valid=fields[0]==='2'&&sourceId===ids[role]&&asset&&Number.isInteger(job)&&job>=0&&job<asset.data.length&&Number.isInteger(page)&&page>=0&&page*PAGE_RUNS*5<asset.data[job].length;
   let ok=false;if(valid&&!(options.dropEvery&&sequence%options.dropEvery===0)){const data=asset.data[job].slice(page*PAGE_RUNS*5,(page+1)*PAGE_RUNS*5);const reply=`2|${role}|${job}|${page}|${asset.counts[job]}|${data}`;if(new TextEncoder().encode(reply).length>4096)throw Error('Blueprint page exceeds message quota');ok=target.enqueueEntityMessage({messageId:'blue-'+sequence,sourceId:libraryId,targetId:sourceId,type:'blue.page.v2',payload:reply,encoding:'utf8'});}
   events.push({t:clock,type:'blueprint-page',role,job,page,ok});return{ok,messageId,deliveryStatus:ok?'routed':'dropped',reason:ok?'routed':'offline_unavailable'};
  }
  const target=manager.contraptions.find((e:any)=>e.publicId===targetId);
  const envelope={messageId,sourceId,targetId,type,payload,encoding:encoding||'utf8'};
  const dropped=!!options.dropEvery&&sequence%options.dropEvery===0;
  const ok=!dropped&&!!target?.enqueueEntityMessage(envelope);
  if(type!=='ack.v1')events.push({t:clock,...envelope,ok});
  return{ok,messageId,deliveryStatus:ok?'routed':'dropped',reason:ok?'routed':'offline_unavailable'};
 }}});
 for(let i=0;i<roles.length;i++){entities[i].setScript(controller(i,ids,libraryId));await entities[i].scriptRuntimeClient.ready();}
 const state=(e:any)=>e.getSerializableComponentStates()?.[e.rootComponentId]||{};
 const team={entities,ids,libraryId,events,state,start(){for(const e of entities)e.enableAllNodeScripts();},setClock(t:number){clock=t;},pause(i:number){const e=entities[i];return e.enqueueClickedBlock({eventId:'pause-'+(++sequence),entityId:e.publicId,playerId:'dev-local',nodeId:'work_button',kind:'micro',size:.125,decorationId:null,position:[0,0,0],point:e.position.toArray(),localPoint:[0,1,.75]});},snapshot(){return entities.map((e,i)=>({role:roles[i],id:e.publicId,position:e.position.toArray(),error:e.scriptError,status:e.scriptStatus,state:state(e)}));}};
 return team;
}
