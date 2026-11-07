"""Audit output edge alpha plus raw source row cuts; no asset mutations."""
from pathlib import Path
from PIL import Image
import json
R=Path(__file__).resolve().parent

def components(im,threshold=32):
 w,h=im.size;data=bytearray(im.getchannel('A').point(lambda a:1 if a>threshold else 0).tobytes());out=[]
 for at in range(len(data)):
  if not data[at]:continue
  data[at]=0;todo=[at];count=0;y,x=divmod(at,w);x0=x1=x;y0=y1=y
  while todo:
   p=todo.pop();y,x=divmod(p,w);count+=1;x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
   for n in ([p-1] if x else [])+([p+1] if x+1<w else [])+([p-w] if y else [])+([p+w] if y+1<h else []):
    if data[n]:data[n]=0;todo.append(n)
  if count>=8:out.append({'pixels':count,'box':[x0,y0,x1+1,y1+1]})
 return sorted(out,key=lambda a:-a['pixels'])

def audit():
 m=json.loads((R/'manifest.json').read_text());jobs=json.loads((R/'src/generation-jobs.json').read_text());rows=[];nominalRows=[];edge=[];fragments=[];overrides=json.loads((R/'src/frame-cuts.json').read_text()) if (R/'src/frame-cuts.json').exists() else {}
 for id,s in m['sheets'].items():
  im=Image.open(R/s['file']).convert('RGBA');fw,fh=s['frameW'],s['frameH']
  for i in range(s['frames']):
   f=im.crop((i*fw,0,(i+1)*fw,fh));a=f.getchannel('A').point(lambda v:255 if v>32 else 0)
   hit=bool(a.crop((0,0,3,fh)).getbbox() or a.crop((fw-3,0,fw,fh)).getbbox())
   if hit:edge.append({'id':id,'frame':i})
   if id.startswith('actor-') or id.startswith('orchestrator-'):
    cs=components(f);sus=[c for c in cs[1:] if c['pixels']>=30 and (c['box'][0]<fw*.15 or c['box'][2]>fw*.85)]
    if sus:fragments.append({'id':id,'frame':i,'components':sus})
 for j in jobs:
  if j['kind']!='actor':continue
  im=Image.open(R/'src/generated'/(j['id']+'.png')).convert('RGBA');w,h=im.size;data=im.getchannel('A').point(lambda a:1 if a>32 else 0).tobytes();projection=[sum(data[x::w]) for x in range(w)]
  nominal=[round(i*w/j['frames']) for i in range(1,j['frames'])];cuts=overrides.get(j['id'],[0]+nominal+[w])[1:-1];cross=[{'x':x,'opaquePixels':sum(projection[max(0,x-1):min(w,x+2)])} for x in cuts if sum(projection[max(0,x-1):min(w,x+2)])>12]
  if cross:rows.append({'id':j['id'],'crossings':cross})
  old=[{'x':x,'opaquePixels':sum(projection[max(0,x-1):min(w,x+2)])} for x in nominal if sum(projection[max(0,x-1):min(w,x+2)])>12]
  if old:nominalRows.append({'id':j['id'],'crossings':old})
 report={'sheets':len(m['sheets']),'frames':sum(s['frames'] for s in m['sheets'].values()),'edgeHits':edge,'detachedEdgeFragments':fragments,'selectedSourceCutCrossings':rows,'originalNominalCutCrossings':nominalRows,'expectedSingleFrameBalloonBorders':['bubble_done','bubble_prup']};return report
if __name__=='__main__':print(json.dumps(audit(),ensure_ascii=False,indent=2))
