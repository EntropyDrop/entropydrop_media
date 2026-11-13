#!/usr/bin/env python3
"""Import the 23 titled sections of voiceover.en.txt into the persistent modules."""
from pathlib import Path
import json,re,hashlib,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from video import atomic_text,save
R=Path(__file__).resolve().parents[1]
def main():
 p=R/'voiceover.en.txt';text=p.read_text();lines=text.splitlines();ids=json.loads((R/'project.json').read_text())['order']
 heads=[(i,line) for i,line in enumerate(lines) if ':' in line and line and line[0].isupper() and not re.search(r'[:.!?;]$',line) and len(line)<110]
 if len(heads)!=len(ids):raise ValueError(f'Expected {len(ids)} titled sections; found {len(heads)}. No changes written.')
 updated=[];previous=[]
 for n,((start,title),mid) in enumerate(zip(heads,ids)):
  end=heads[n+1][0] if n+1<len(heads) else len(lines);body='\n'.join(lines[start+1:end]).strip()
  paras=[' '.join(x.split()) for x in body.split('\n\n') if x.strip()]
  if not paras:raise ValueError('Empty module '+mid)
  d=R/'modules'/mid;m=json.loads((d/'module.json').read_text());previous.append({'id':mid,'module':m,'script':(d/'script.en.txt').read_text(),'voice':json.loads((d/'voice.json').read_text())});m={**m,'title':title}
  if [' '.join(x.split()) for x in (d/'script.en.txt').read_text().strip().split('\n\n') if x.strip()] != paras: m.pop('tts_segments',None)
  updated.append((d,m,'\n\n'.join(paras)+'\n',{'id':mid,'title':title,'paragraphs':len(paras),'words':sum(len(x.split()) for x in paras)}))
 save(R/'review/previous-module-inputs.json',previous)
 for d,m,body,_ in updated:save(d/'module.json',m);atomic_text(d/'script.en.txt',body)
 save(R/'review/voiceover-import.json',{'source':'voiceover.en.txt','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'editorial_changes':False,'sections':[x[3] for x in updated]})
 print('IMPORTED',len(updated),'modules; source wording preserved')
if __name__=='__main__':main()
