"""Export immutable PNG masters at half logical resolution; no source writes."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,io,math,hashlib
R=Path(__file__).resolve().parent
m=json.loads((R/'manifest.json').read_text());before=3199304
images={};padding={}
for id,a in m['assets'].items():
 im=Image.open(R/a['sourceFile']).convert('RGBA');w,h=a['size'];assert im.size==(w,h)
 pw=w+w%2;ph=h+h%2
 if (pw,ph)!=(w,h):
  padded=Image.new('RGBA',(pw,ph));padded.alpha_composite(im);im=padded;padding[id]=[pw,ph]
 images[a['file']]=im.resize((pw//2,ph//2),Image.Resampling.LANCZOS)
 a['runtimeSize']=[pw//2,ph//2]
 if (pw,ph)!=(w,h):a['runtimePaddedLogicalSize']=[pw,ph]
for id,s in m['sheets'].items():
 fw,fh=s['frameW'],s['frameH'];assert fw%2==fh%2==0
 im=Image.open(R/'src/sheets'/f'{id}.png').convert('RGBA');assert im.size==(fw*s['frames'],fh)
 out=Image.new('RGBA',(fw//2*s['frames'],fh//2))
 for i in range(s['frames']):out.alpha_composite(im.crop((i*fw,0,(i+1)*fw,fh)).resize((fw//2,fh//2),Image.Resampling.LANCZOS),(i*fw//2,0))
 images[s['file']]=out
# Encode from original masters each trial, never repeatedly compress.
for quality in [5,3,1,0]:
 encoded={}
 for file,im in images.items():
  q=0 if file.startswith('runtime/static-actor-') else quality
  b=io.BytesIO();im.save(b,'WEBP',quality=q,method=4,alpha_quality=80);encoded[file]=b.getvalue()
 total=sum(map(len,encoded.values()));print('quality',quality,'bytes',total,flush=True)
 if total<=1000000:break
assert total<=1000000,total
for file,data in encoded.items():(R/file).write_bytes(data)
m['runtimeScale']=.5
(R/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
contact=Image.new('RGB',(2040,math.ceil(len(m['sheets'])/6)*148),(241,231,212));draw=ImageDraw.Draw(contact)
for k,(id,s) in enumerate(m['sheets'].items()):
 im=Image.open(R/s['file']).convert('RGBA');fw=s['frameW']//2;fh=s['frameH']//2;frames=[]
 for i in range(s['frames']):
  f=im.crop((i*fw,0,(i+1)*fw,fh));bg=Image.new('RGBA',f.size,(244,236,219,255));bg.alpha_composite(f);frames.append(bg.convert('RGB'))
 frames[0].save(R/'review'/f'{id}.gif',save_all=True,append_images=frames[1:],duration=round(1000/s['fps']),loop=0,disposal=2)
 x=k%6*340;y=k//6*148;draw.text((x+5,y+4),id,fill=(48,53,63))
 for i,f in enumerate(frames):contact.paste(f,(x+i*82+4,y+22))
contact.save(R/'review/contact-sheet.png')
report={'beforeBytes':before,'afterBytes':total,'quality':quality,'runtimeScale':.5,'paddedStatics':padding,'largest':sorted([{'file':f,'bytes':len(b),'size':list(images[f].size)} for f,b in encoded.items()],key=lambda x:-x['bytes'])[:5]}
(R/'compression-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report)
