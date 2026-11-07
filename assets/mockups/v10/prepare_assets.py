"""Crop generated atlases and separate occlusion layers. No drawing or palette reduction."""
from pathlib import Path
from PIL import Image
import json,collections,shutil
R=Path(__file__).resolve().parent;S=R/'source';P=R/'parts';P.mkdir(exist_ok=True)
meta={'version':10,'reference':'../v8/office-c.png','processing':'cropping, padding, alpha-preserving layer separation only; no palette reduction, no low-resolution redraw','assets':{},'frames':{},'layout':{'minN':1,'maxN':16,'columns':'N<=3 ? N : N<=6 ? 3 : 4','rows':'ceil(N/columns)','canvas':[1536,1024],'largeCanvas':[1536,1536],'background':'N<=3 small;N<=6 medium;else large','podWidth':'N<=6 ? 310 : 258','podLeft':'N<=6 ? 350+i%columns*380 : 340+i%4*286','podTop':'N<=3 ? 610 : N<=6 ? 450+floor(i/3)*275 : 500+floor(i/4)*260','actorAnchorInFrame':[160,410],'actorFrame':[320,432],'actorHeight':'N<=6 ? 240 : 200','slot':'[podLeft+podWidth*.27, podTop+podWidth*.61]','lead':'per-background placement in assets metadata','walk':'one reserved visitor per 16-second cycle after 10 seconds; actor (2+cycle)%N, seat→below row→right aisle→rear meeting lane→target, then reverse','idleSleepSeconds':12,'crossfadeSeconds':0.35}}
def record(name,im,anchor=None,**kw):
 im.save(P/(name+'.png'));meta['assets'][name]={'file':'parts/'+name+'.png','size':list(im.size),**({'anchor':anchor} if anchor else {}),**kw}
def bounds(im,threshold=96):return im.getchannel('A').point(lambda v:255 if v>threshold else 0).getbbox()
def major_bbox(im):
 w,h=im.size;arr=bytearray(im.getchannel('A').point(lambda v:1 if v>100 else 0).tobytes());best=(0,(0,0,w,h))
 for yy in range(h):
  for xx in range(w):
   at=yy*w+xx
   if not arr[at]:continue
   arr[at]=0;queue=[at];count=0;x0=x1=xx;y0=y1=yy
   while queue:
    p=queue.pop();y,x=divmod(p,w);count+=1;x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
    for n in ([p-1] if x else [])+([p+1] if x+1<w else [])+([p-w] if y else [])+([p+w] if y+1<h else []):
     if arr[n]:arr[n]=0;queue.append(n)
   if count>best[0]:best=(count,(max(0,x0-3),max(0,y0-3),min(w,x1+4),min(h,y1+4)))
 return best[1]
# backgrounds are untouched generated images.
for key,src in [('small','bg-small'),('medium','bg-medium'),('large','bg-large-final')]:
 im=Image.open(S/(src+'.png')).convert('RGBA');record('background-'+key,im)
 # Occlusion rectangle cut from the existing rear desk front, at native resolution.
 box={'small':(545,255,1065,408),'medium':(550,235,1048,369),'large':(447,228,900,361)}[key]
 record('lead-front-'+key,im.crop(box),sourceBox=list(box))
meta['lead']={'small':{'foot':[778,342],'height':230},'medium':{'foot':[785,340],'height':220},'large':{'foot':[800,385],'height':230}}
# Furniture pods: trim column, preserve generated alpha/shadows.
im=Image.open(S/'pods.png').convert('RGBA')
for i in range(3):
 cell=im.crop((i*512,0,(i+1)*512,1024));fixed=[(21,355,500,720),(527,351,1002,720),(1030,351,1512,720)][i];b=(fixed[0]-i*512,fixed[1],fixed[2]-i*512,fixed[3]);pod=cell.crop(b);record('pod-'+str(i)+'-back',pod,sourceBox=[i*512+b[0],b[1],i*512+b[2],b[3]])
 fg=pod.copy();a=fg.getchannel('A');a.paste(0,(0,0,int(pod.width*.53),int(pod.height*.40)));fg.putalpha(a);record('pod-'+str(i)+'-front',fg,split={'leftTopTransparent':[0,0,.53,.40]})
# One identity per source sheet; all 12 frames normalized without resampling.
labels=['working-0','working-1','working-2','working-3','phone-0','phone-1','sleeping-0','sleeping-1','walking-left-0','walking-left-1','walking-right-0','walking-right-1']
for who in list(map(str,range(6)))+['lead']:
 key='actor-'+who;im=Image.open(S/(key+'.png')).convert('RGBA');sheet=Image.new('RGBA',(1280,1296));meta['frames'][key]={}
 for i,label in enumerate(labels):
  col=i%4;row=i//4;box=(round(col*im.width/4),round(row*im.height/3),round((col+1)*im.width/4),round((row+1)*im.height/3));cell=im.crop(box);b=major_bbox(cell);part=cell.crop(b);frame=Image.new('RGBA',(320,432));x=160-part.width//2;y=410-part.height;frame.alpha_composite(part,(x,y));record(key+'-'+label,frame,[160,410]);sheet.alpha_composite(frame,(col*320,row*432));meta['frames'][key][label]={'column':col,'row':row,'sourceCell':list(box),'sourceTrim':list(b),'paste':[x,y]}
 record(key+'-sheet',sheet,frame=[320,432],grid=[4,3],anchor=[160,410])
# Effect atlas uses a true 4x3 grid, with 341/342px cell heights.
im=Image.open(S/'effects-hud.png').convert('RGBA');names=['flame-0','flame-1','flame-2','emphasis','points-3','points-10','bubble-done','bubble-pr','zzz','hud-panel','icon-active','icon-tokens']
for i,name in enumerate(names):
 col=i%4;row=i//4;box=(col*384,round(row*1024/3),(col+1)*384,round((row+1)*1024/3));cell=im.crop(box);b=bounds(cell,72) or (0,0,cell.width,cell.height);record(name,cell.crop(b),sourceCell=list(box),sourceTrim=list(b))
# Asset list and browser-friendly mirror are exact same schema.
if (R/'layout.json').exists():
 previous=json.loads((R/'layout.json').read_text())
 if 'ui' in previous:meta['ui']=previous['ui']
(R/'layout.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));(R/'layout-data.js').write_text('window.OFFICE_LAYOUT='+json.dumps(meta,ensure_ascii=False)+';')
print('prepared',len(meta['assets']),'assets')
