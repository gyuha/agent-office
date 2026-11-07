from pathlib import Path
from PIL import Image
import json,hashlib
from audit_edges import audit
R=Path(__file__).resolve().parent;m=json.loads((R/'manifest.json').read_text());fail=[]
for id,s in m['sheets'].items():
 im=Image.open(R/s['file']).convert('RGBA');fw=int(s['frameW']*m['runtimeScale']);fh=int(s['frameH']*m['runtimeScale'])
 assert im.size==(fw*s['frames'],fh),(id,im.size)
 for i in range(s['frames']):
  a=im.crop((i*fw,0,(i+1)*fw,fh)).getchannel('A');assert a.getbbox(),(id,i);assert a.getextrema()[0]==0,(id,i)
 gif=Image.open(R/'review'/f'{id}.gif');assert gif.n_frames==s['frames'],(id,gif.n_frames)
for a in m['assets'].values():
 if not a.get('runtimeExcluded'):assert list(Image.open(R/a['file']).size)==a['runtimeSize']
for actor,states in m['actors'].items():
 for state in ['working','phone','sleeping','away','walk_left','walk_right']:assert states[state] in m['sheets']
for s in m['effects'].values():assert s in m['sheets']
for p,h in json.loads((R/'source-hashes.json').read_text()).items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
report=audit();assert not report['detachedEdgeFragments'],report['detachedEdgeFragments'];assert not report['selectedSourceCutCrossings']
(R/'edge-audit.json').write_text(json.dumps(report,indent=2))
v=json.loads((R/'validation.json').read_text());v.update(runtimeBytes=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp')),runtimeScale=m['runtimeScale'],sourcePngsUnchanged=True,dimensionsAndMappingsValid=True,reviewUsesRuntimePixels=True,edgeAudit=report)
(R/'validation.json').write_text(json.dumps(v,ensure_ascii=False,indent=2));print('PASS',v['runtimeBytes'],'bytes',len(m['sheets']),'sheets',sum(s['frames'] for s in m['sheets'].values()),'frames')
