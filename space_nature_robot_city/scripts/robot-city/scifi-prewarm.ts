/** Temporarily spend more frame time preparing a large authored scene before review. */
export async function prepare(p:any){
 const m=p.g.world.microVoxels,original=m.updateMesh;
 const initial=m.dirtyMeshChunks.size;p.stage='preparing-meshes';
 m.updateMesh=function(_max:any,active:any,blocked:any,_budget:any,deferred:any){return original.call(this,256,active,blocked,12,deferred);};
 try{while(m.dirtyMeshChunks.size||m.activeMeshBuild||m.workerBuilds.size){
  p.meshRemaining=m.dirtyMeshChunks.size;p.meshInitial=initial;
  const label=document.getElementById('city-review-status');if(label)label.textContent=`体素校验通过 · 正在准备显示 ${Math.max(0,Math.round((1-p.meshRemaining/initial)*100))}%`;
  await new Promise(r=>setTimeout(r,250));
 }}finally{m.updateMesh=original;}
 p.stage=p.verification?.mismatch?'validation-failed':'ready';p.meshRemaining=0;
 const label=document.getElementById('city-review-status');if(label)label.textContent='已建成 · 体素回读与显示准备完成';
}
