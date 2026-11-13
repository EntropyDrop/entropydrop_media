import json,uuid,urllib.request,os
from pathlib import Path
R=Path(__file__).resolve().parents[1]
c=json.loads(Path(os.environ['SPACE_AGENT_CONNECTION_FILE']).read_text())
specs={'rover':('00000000-0000-4000-8000-000000000001','25dd5778-8ea1-4f93-92aa-02f0af0fcbe9'),'drone':('00000000-0000-4000-8000-000000000003','4a23309f-1a48-4640-9af1-1e6ca195c0e2')}
def call(path,body=None):
 req=urllib.request.Request(c['backend']+path,data=json.dumps(body).encode() if body else None,method='PATCH' if body else 'GET',headers={'Authorization':'Bearer '+c['api_key'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=45) as response:return json.load(response)
for name,(world,entity) in specs.items():
 path=f'/space/api/v2/worlds/{world}/entities/{entity}/configuration'
 result=call(path)
 (R/'models'/f'{name}-before-configuration.json').write_text(json.dumps(result,indent=2))
 assert result['entity']['desired_run_state']=='stopped' and result['entity']['execution_user_id'] is None
 model=json.loads((R/'models'/f'{name}-refined.json').read_text())
 request_file=R/'models'/f'{name}-update-request.json'
 if request_file.exists(): saved=json.loads(request_file.read_text())
 else:
  saved={'backend_origin':c['backend'],'world_id':world,'entity_id':entity,'body':{'operation_id':str(uuid.uuid4()),'expected_revision':result['entity']['revision'],'components':[{'id':model['root']['id'],'script':model['root']['script']}]}}
  request_file.write_text(json.dumps(saved,indent=2))
 receipt=R/'models'/f'{name}-update-receipt.json'
 if not receipt.exists():receipt.write_text(json.dumps(call(path,saved['body']),indent=2))
 confirmed=call(path)
 def contains(v):
  return (isinstance(v,dict) and (v.get('script')==model['root']['script'] or any(contains(x) for x in v.values()))) or (isinstance(v,list) and any(contains(x) for x in v))
 assert contains(confirmed), 'Controller readback mismatch'
 (R/'models'/f'{name}-updated-configuration.json').write_text(json.dumps(confirmed,indent=2))
 print(name,confirmed['entity']['revision'],confirmed['entity']['desired_run_state'],flush=True)
