"""Export PNG masters at 5/8 logical scale, high quality, embed-only runtime."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,io,math,re
R=Path(__file__).resolve().parent
m=json.loads((R/'manifest.json').read_text());before=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'))
# Retain previous decoded samples for an identical logical crop, displayed at 960/1536.
old={k:Image.open(R/m['assets'][k]['file']).convert('RGBA') for k in ['pod-0-back','pod-0-front']}
old['actor']=Image.open(R/m['sheets']['actor-0-working']['file']).convert('RGBA').crop((0,0,80,108))
images={};padding={};excluded=[]
for id,a in m['assets'].items():
 if not re.match(r'^(background-|lead-front-|lead-back-|pod-|beanbag-|rug-lounge-|hud-panel$)',id):
  excluded.append(a['file']);a['file']=a['sourceFile'];a['runtimeExcluded']=True
  a.pop('runtimeSize',None);a.pop('runtimePaddedLogicalSize',None);continue
 im=Image.open(R/a['sourceFile']).convert('RGBA');w,h=a['size'];assert im.size==(w,h)
 pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8
 if (pw,ph)!=(w,h):
  padded=Image.new('RGBA',(pw,ph));padded.alpha_composite(im);im=padded;padding[id]=[pw,ph]
 a['runtimePaddedLogicalSize']=[pw,ph];a['runtimeSize']=[pw*5//8,ph*5//8]
 images[a['file']]=im.resize(tuple(a['runtimeSize']),Image.Resampling.LANCZOS)
for id,s in m['sheets'].items():
 fw,fh=s['frameW'],s['frameH'];assert fw%8==fh%8==0
 im=Image.open(R/'src/sheets'/f'{id}.png').convert('RGBA');assert im.size==(fw*s['frames'],fh)
 rw,rh=fw*5//8,fh*5//8;out=Image.new('RGBA',(rw*s['frames'],rh))
 for i in range(s['frames']):out.alpha_composite(im.crop((i*fw,0,(i+1)*fw,fh)).resize((rw,rh),Image.Resampling.LANCZOS),(i*rw,0))
 images[s['file']]=out
encoded={};lossless=[]
for file,im in images.items():
 b=io.BytesIO();im.save(b,'WEBP',quality=85,method=6,alpha_quality=100);data=b.getvalue()
 if file in [m['sheets'][id]['file'] for id in m['effects'].values()]:
  b=io.BytesIO();im.save(b,'WEBP',lossless=True,quality=100,method=6)
  if len(b.getvalue())<len(data):data=b.getvalue();lossless.append(file)
 encoded[file]=data
 print(file,len(data),flush=True)
for file,data in encoded.items():(R/file).write_bytes(data)
removed=[]
for p in (R/'runtime').glob('*.webp'):
 if str(p.relative_to(R)) not in encoded:removed.append(str(p.relative_to(R)));p.unlink()
m['runtimeScale']=.625;(R/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
# Compare at a 960 px-wide full-room scale (5/8), with an identical logical crop.
def sample(parts,is_old):
 canvas=Image.new('RGBA',(960,430),(242,228,205,255))
 for key in ['pod-0-back','actor','pod-0-front']:
  im=parts[key]
  if key=='actor':size=(100,135);pos=(110,66)
  else:
   w,h=m['assets'][key]['size'];size=(round(w*.625),round(h*.625));pos=(80,90)
   if not is_old:
    im=im.crop((0,0,w*.625,h*.625))
  canvas.alpha_composite(im.resize(size,Image.Resampling.LANCZOS),pos)
 return canvas.crop((50,40,410,350)).convert('RGB')
new={k:Image.open(R/m['assets'][k]['file']).convert('RGBA') for k in ['pod-0-back','pod-0-front']};new['actor']=Image.open(R/m['sheets']['actor-0-working']['file']).convert('RGBA').crop((0,0,100,135))
comparison=Image.new('RGB',(720,340),(242,228,205));comparison.paste(Image.open(R/'review/previous-q3-sample.png') if (R/'review/previous-q3-sample.png').exists() else sample(old,True),(0,30));comparison.paste(sample(new,False),(360,30));d=ImageDraw.Draw(comparison);d.text((10,8),'OLD 0.5 / q3 : 960px room scale',fill='black');d.text((370,8),'NEW 0.625 / q85 : 960px room scale',fill='black');comparison.save(R/'review/quality-compare.png')
contact=Image.new('RGB',(2520,math.ceil(len(m['sheets'])/6)*170),(241,231,212));draw=ImageDraw.Draw(contact)
for k,(id,s) in enumerate(m['sheets'].items()):
 im=Image.open(R/s['file']).convert('RGBA');fw=s['frameW']*5//8;fh=s['frameH']*5//8;frames=[]
 for i in range(s['frames']):
  f=im.crop((i*fw,0,(i+1)*fw,fh));bg=Image.new('RGBA',f.size,(244,236,219,255));bg.alpha_composite(f);frames.append(bg.convert('RGB'))
 frames[0].save(R/'review'/f'{id}.gif',save_all=True,append_images=frames[1:],duration=round(1000/s['fps']),loop=0,disposal=2)
 x=k%6*420;y=k//6*170;draw.text((x+5,y+4),id,fill=(48,53,63))
 for i,f in enumerate(frames):contact.paste(f,(x+i*102+4,y+22))
contact.save(R/'review/contact-sheet.png')
total=sum(map(len,encoded.values()));report={'beforeBytes':before,'afterBytes':total,'embeddedBytes':total,'quality':85,'alphaQuality':100,'method':6,'runtimeScale':.625,'lossless':lossless,'removed':removed,'paddedStatics':padding,'largest':sorted([{'file':f,'bytes':len(b),'size':list(images[f].size)} for f,b in encoded.items()],key=lambda x:-x['bytes'])[:5]}
(R/'compression-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report)
