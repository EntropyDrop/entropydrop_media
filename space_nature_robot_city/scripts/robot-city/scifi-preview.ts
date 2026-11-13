import * as THREE from 'three';
import {encodeInventoryResource} from '../../engine/src/storage/InventoryProtobuf.ts';
import {parseInventoryImport} from '../../client/src/engine/inventory/InventoryImport.ts';
import {robot} from './scifi-models.ts';
import {apply as applyCamera} from './scifi-camera.ts';
import {apply as applyBatches} from './scifi-batch.ts';
import {prepare} from './scifi-prewarm.ts';
const root='/space/app/@fs/Users/ha/Documents/entropydrop_website/entropydrop_space/.local/robot-city/';
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
const P=(x:number,y:number,z:number)=>[5390+x,y,660+z];
export async function install(g:any){
 if((window as any).scifiCity)return (window as any).scifiCity;
 const p:any={stage:'loading',g,progress:0,failures:[],entities:[],verification:null};(window as any).scifiCity=p;
 g.uiStore.startGame(false);g.uiStore.setLightingQuality('ultra',false);g.uiStore.setShadowsEnabled(true,false);g.uiStore.setResolutionScale(1,false);g.uiStore.setRenderDistance(16,false);g.uiStore.setDistantSurfaceEnabled(true,false);
 g.world.setRenderDistance(16,14);
 for(const[k,v]of Object.entries({subdivisionSizePx2:1,renderDistanceChunks:2048,dataBudgetMiB:1024,geometryBudgetMiB:512,torusBackfaceCulling:false}))g.uiStore.setDistantSurfaceSetting(k,v,false);
 const style=document.createElement('style');style.textContent='.entity-nameplate,#dev-render-diagnostics,#dev-frame-profiler,#crosshair{display:none!important}#city-review{position:fixed;z-index:9999;top:18px;left:18px;color:#eef5f5;background:#13252be8;border:1px solid #83cddd55;border-radius:12px;padding:14px 18px;font:14px system-ui;max-width:390px}#city-review strong{font-size:18px}#city-review small{display:block;color:#a4bcc0;margin:6px 0 10px}#city-review button{cursor:pointer;background:#36525d;color:white;border:1px solid #83cddd66;border-radius:6px;padding:7px 10px;margin:3px}#city-review-status{margin-top:9px;color:#bce1ca;font:12px monospace}';document.head.appendChild(style);
 const panel=document.createElement('section');panel.id='city-review';panel.innerHTML='<strong>Nature · 科幻城市</strong><small>实机外观预览 · 33 栋建筑 · 多层立交<br>原生体素场景，可自由飞行检查</small><div id="city-review-buttons"></div><div id="city-review-status"></div>';document.body.appendChild(panel);const label=document.getElementById('city-review-status')!;
 const c=g.controller,originalCamera=c.updateCameraPosition.bind(c);c.setPerspective('first_person',false);c.setFov(45);
 p.pose=(pos:number[],target:number[])=>{p.fixed={pos,target};g.playerPhysics.isFlying=true;g.playerPhysics.position.set(5390,40,660);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();};
 c.updateCameraPosition=()=>{if(!p.fixed)return originalCamera();c.camera.position.set(...p.fixed.pos);c.camera.up.set(0,1,0);c.camera.lookAt(...p.fixed.target);c.camera.updateMatrixWorld();};
 const avatar=g.sceneRenderer.setPlayerAvatarVisible.bind(g.sceneRenderer);g.sceneRenderer.setPlayerAvatarVisible=(visible:boolean,hand:boolean)=>avatar(visible,p.fixed?false:hand);
 const aim=c.updateAimRaycast.bind(c);c.updateAimRaycast=()=>{if(!p.fixed)return aim();c.syncDrivenVehiclePose();c.updateCameraPosition();c.hoveredContraption=null;c.hoveredContraptionHit=null;c.currentRaycast={hit:false};};
 p.views={overview:[P(70,140,185),P(0,10,15)],interchange:[P(194,113,195),P(95,25,68)],skyline:[P(-8,46,42),P(-8,55,-35)],plaza:[P(15,62,48),P(-8,24,8)],street:[P(-28,25,45),P(-28,32,-30)]};
 p.viewFovs={overview:45,interchange:60,skyline:65,plaza:65,street:65};
 p.view=(name:string)=>{c.setFov(p.viewFovs[name]);p.pose(...p.views[name]);};p.view('overview');p.clean=(on=true)=>{panel.style.display=on?'none':'';document.body.classList.toggle('city-clean',on);};
 const buttons=document.getElementById('city-review-buttons')!;
 for(const[name,title]of Object.entries({overview:'城市全景',interchange:'多层立交',skyline:'高楼街区',plaza:'中央广场',street:'街道视角',free:'自由飞行'})){const b=document.createElement('button');b.textContent=title;b.onclick=()=>{if(name!=='free')p.view(name);else{const v=p.fixed?.pos||P(0,60,0);p.fixed=null;g.playerPhysics.position.set(...v);g.playerPhysics.velocity.set(0,0,0);g.playerPhysics.resetRenderInterpolation();}};buttons.appendChild(b);}
 applyCamera(p);
 // Review daylight covers the whole district, including the tall landmark.
 const render=g.sceneRenderer,shadow=render.sunLight.shadow;
 render.renderer.toneMappingExposure=1.2;render.sunLight.intensity=4.5;render.hemiLight.intensity=.65;
 shadow.camera.left=shadow.camera.bottom=-140;shadow.camera.right=shadow.camera.top=140;
 shadow.camera.near=-160;shadow.camera.far=400;shadow.camera.updateProjectionMatrix();
 shadow.bias=-.15/560;shadow.normalBias=.06;shadow.needsUpdate=true;
 label.textContent='正在读取城市蓝图…';
 p.manifest=await(await fetch(root+'review/scifi-city.json')).json();const bytes=new Uint32Array(await(await fetch(root+'review/scifi-city.bin')).arrayBuffer());p.total=bytes.length/5;p.stage='placing';let placed=0;
 applyBatches(p);
 // Explicit scene authoring for style review. This is not autonomous drone construction.
 for(let i=0;i<bytes.length;){const end=Math.min(bytes.length,i+5000*5),until=performance.now()+15;for(;i<end&&performance.now()<until;i+=5){const[x,y,z,packed,type]=bytes.subarray(i,i+5),color=packed&0xffffff,mat=packed>>>24;
   if(type===1){g.world.setBlock(x,y,z,1,true,color,mat);}
   else{if(g.world.getBlock(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8))!==0)g.world.setBlock(Math.floor(x/8),Math.floor(y/8),Math.floor(z/8),0,true);g.world.setMicroBlock(x,y,z,color,null,mat);}
   placed++;
  }p.progress=placed/p.total;label.textContent=`正在落成原生体素 ${Math.round(p.progress*100)}%`;await frame();}
 p.restoreImporter();p.stage='verifying';let mismatch=0,checked=0;
 for(let i=0;i<bytes.length;){const end=Math.min(bytes.length,i+40000*5);for(;i<end;i+=5){const[x,y,z,packed,type]=bytes.subarray(i,i+5),color=packed&0xffffff,mat=packed>>>24;const actual=type===1?{color:g.world.getBlockColor(x,y,z),materialId:g.world.getBlockMaterial(x,y,z)}:g.world.getMicroBlock(x,y,z);if(!actual||actual.color!==color||(actual.materialId||0)!==mat){mismatch++;if(p.failures.length<20)p.failures.push({x,y,z,type,color,mat,actual});}checked++;}label.textContent=`逐格回读校验 ${Math.round(checked/p.total*100)}%`;await frame();}
 p.verification={checked,mismatch,failures:p.failures};
 const positions=[P(-25,35,35),P(82,27,84),P(-38,64,-20),P(50,61,12),P(2,28,32)];
 for(let i=0;i<5;i++){const model=robot(i);model.root.name+=' · appearance review';const parsed=parseInventoryImport(encodeInventoryResource('entity',model),'entity');if(!parsed.ok)throw Error(parsed.error);const e=g.contraptionManager.buildFromSlot(parsed.item,new THREE.Vector3(...positions[i]),null,false);if(!e)throw Error('Drone placement failed');e.enableAllNodeScripts();p.entities.push(e);}
 p.stage=mismatch?'validation-failed':'ready';label.textContent=mismatch?`检查发现 ${mismatch} 个未匹配体素`:`已建成 · ${(p.total/1e6).toFixed(2)}M 体素 · 回读全部通过`;
 p.status=()=>({stage:p.stage,progress:p.progress,meshRemaining:p.meshRemaining,counts:p.manifest.counts,verification:p.verification,surface:(window as any).offlineSurfaceStatus,fps:g.currentFps,robots:p.entities.map((e:any)=>({id:e.publicId,error:e.scriptError,status:e.scriptStatus}))});
 await prepare(p);
 // This local appearance-review scene keeps the entire authored district resident.
 // Its immutable blueprint reloads the scene; no account or production-world writes occur.
 while(!(window as any).offlineSurfaceStatus?.complete)await new Promise(r=>setTimeout(r,200));
 g.world.fixedTerrainCenter={cx:Math.floor(5390/16),cz:Math.floor(660/16)};
 p.residency='City district held resident during free flight';
 return p.status();
}
