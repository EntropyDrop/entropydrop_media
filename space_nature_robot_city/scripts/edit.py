from pathlib import Path
import json,subprocess
R=Path('/Users/ha/Documents/entropydrop_website/entropydrop_media/space_nature_robot_city')
def v(mid): return json.loads((R/'modules'/mid/'voice.zh.json').read_text())
def clip(name,start,duration): return dict(file='footage/'+name+'.mp4',start=round(start,6),duration=round(duration,6))
def save(mid,clips,notes):
 voice=v(mid); duration=sum(x['duration'] for x in clips)
 assert abs(duration-voice['duration'])<.002,(mid,duration,voice['duration'])
 for c in clips:
  p=R/c['file']; assert p.exists(),p
  source=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
  assert c['start']+c['duration']<=source+.04,(mid,c,source)
 (R/'modules'/mid/'module.json').write_text(json.dumps(dict(schema_version=1,id=mid,language='zh',clips=clips,editing_notes=notes,retime=1,burned_subtitles=False),ensure_ascii=False,indent=2)+'\n')
mid='01_cold_open'; d=v(mid)['duration']; save(mid,[clip('drone_city_final_aerial',0,8),clip('drone_road_bridge_print',2,7),clip('drone_bridge_complete',0,d-15)],'完成后的城市预览与真实施工片段。五台无人机，资源无限。')
mid='02_nature_site'; save(mid,[clip('nature_drone_site',0,v(mid)['duration'])],'完整环形地形 128/128 加载后录制。')
mid='03_team_design'; d=v(mid)['duration']; save(mid,[clip('drone_city_final_aerial',0,1.9),clip('drone_team_roles_clean',0,4.1),clip('drone_team_roles_clean',5.6,1.5),clip('drone_team_roles_clean',11.2,1.55),clip('drone_team_roles_clean',16.8,1.55),clip('drone_team_roles_clean',22.4,1.83),clip('drone_tool_heads',0,d-12.43)],'按旁白顺序介绍五种颜色和职责；近看建筑与植树工具头。')
mid='04_agent_build'; d=v(mid)['duration']; save(mid,[clip('drone_agent_prompt',0,16),clip('drone_final_house_details',0,d-16)],'提示词是本期设计说明，不伪称在线生成过程；随后展示原生场景里的参数化房屋。')
mid='05_survey_and_tools'; save(mid,[clip('drone_survey',0,v(mid)['duration'])],'原生场景实际障碍检查，12 秒清理障碍后勘测通过；画面角落为游戏工具。')
mid='06_road_builder'; d=v(mid)['duration']; save(mid,[clip('drone_road_bridge_print',0,7),clip('drone_road_surface',0,d-7)],'实际铺路无人机和已验收路面细节，正常速度。')
mid='07_overpass'; d=v(mid)['duration']; save(mid,[clip('drone_bridge_complete',0,12),clip('drone_bridge_underpass',0,d-12)],'完成并逐格验收后的连续坡道、桥墩、护栏和下层通道。')
mid='08_parallel_builders'; d=v(mid)['duration']; save(mid,[clip('drone_pause_road',12,11),clip('drone_final_house_details',0,6),clip('drone_final_house_details',9.5,6),clip('drone_final_house_details',19,d-23)],'两台建筑无人机实际并行施工，再展示不同结构的房屋。')
mid='09_tree_planter'; d=v(mid)['duration']; save(mid,[clip('drone_tree_planting',1,11),clip('drone_tree_varieties',0,d-11)],'建筑验收后实际植树，随后近看不同树冠。')
mid='10_pause_road'; d=v(mid)['duration']; save(mid,[clip('drone_pause_road',12,d)],'连续实机片段。原素材 29 秒恢复铺路，对应本模块 17 秒旁白。')
mid='11_builder_handoff'; d=v(mid)['duration']; save(mid,[clip('drone_handoff_release',0,8),clip('drone_handoff_claim',0,5),clip('drone_inn_verified',5,d-13)],'释放未开工地块、另一台实际领取并开始写入，再切至验收后的旅馆；不使用失败恢复片段。')
mid='12_city_walkthrough'; d=v(mid)['duration']; save(mid,[clip('drone_city_final_walk',0,13),clip('drone_city_final_aerial',12,d-13)],'完成全部 517687 个微格的实机场景，低处巡游再拉高镜头。')
mid='13_reuse_and_close'; d=v(mid)['duration']; save(mid,[clip('drone_final_house_details',17,9),clip('drone_city_final_aerial',12,d-9)],'近看可拆分复用的建筑结构，最后飞越五机协作建成的街区。')
print('EDIT READY',sum(v(mid)['duration'] for mid in json.loads((R/'production.json').read_text())['module_order']))
