"""Crop/align generated rows; emit PNG masters, WebP runtime and GIF review."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());J=json.loads((R/'src/generation-jobs.json').read_text());done=[];details={};CUTS=json.loads((R/'src/frame-cuts.json').read_text()) if (R/'src/frame-cuts.json').exists() else {}
for j in J:
 p=R/'src/generated'/(j['id']+'.png')
 if not p.exists():continue
 spec=M['sheets'][j['id']];fw,fh=spec['frameW'],spec['frameH'];im=Image.open(p).convert('RGBA');count=j['frames'];cells=[];boxes=[];cuts=CUTS.get(j['id'],[round(i*im.width/count) for i in range(count+1)])
 for i in range(count):
  cell=im.crop((cuts[i],0,cuts[i+1],im.height));box=cell.getchannel('A').point(lambda v:255 if v>(32 if j['kind']=='actor' else 8) else 0).getbbox();assert box,(j['id'],i);cells.append(cell);boxes.append(box)
 frames=[]
 if j['kind']=='actor':
  scale=min((fh-25)/max(b[3]-b[1] for b in boxes),(fw-20)/max(b[2]-b[0] for b in boxes))
  for cell,b in zip(cells,boxes):
   part=cell.crop(b);part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS);frame=Image.new('RGBA',(fw,fh));frame.alpha_composite(part,(round(spec['anchor'][0]-part.width/2),spec['anchor'][1]-part.height));frames.append(frame)
 else:
  common=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes));scale=min((fw-8)/(common[2]-common[0]),(fh-10)/(common[3]-common[1]))
  for cell in cells:
   part=cell.crop(common);part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS);frame=Image.new('RGBA',(fw,fh));frame.alpha_composite(part,(round(spec['anchor'][0]-part.width/2),spec['anchor'][1]-part.height));frames.append(frame)
 if j['id'] in ('pop_plus3','pop_plus10'):
  # Mechanical opacity normalization, all shapes/colors remain generated image pixels.
  for frame,gain in zip(frames,[1.0,1.0,.7,.35]):frame.putalpha(frame.getchannel('A').point(lambda a:round(a*gain)))
 sheet=Image.new('RGBA',(fw*count,fh))
 for i,f in enumerate(frames):sheet.alpha_composite(f,(i*fw,0))
 sheet.save(R/'src/sheets'/(j['id']+'.png'));sheet.save(R/spec['file'],'WEBP',quality=85,method=4,alpha_quality=100);spec['frames']=count;done.append(j['id']);details[j['id']]={'sourceSize':list(im.size),'sourceCuts':cuts,'boxes':boxes,'scale':scale,'alignment':'common scale per set; fixed feet/hip baseline, centered body' if j['kind']=='actor' else 'common crop per set preserves generated vertical offsets and alpha fades'}
 if j['id'].endswith('walk_left'):
  right=j['id'].replace('walk_left','walk_right');rs=M['sheets'][right];rsheet=Image.new('RGBA',(fw*count,fh))
  for i,f in enumerate(frames):rsheet.alpha_composite(ImageOps.mirror(f),(i*fw,0))
  rsheet.save(R/'src/sheets'/(right+'.png'));rsheet.save(R/rs['file'],'WEBP',quality=85,method=4,alpha_quality=100);rs['frames']=count;done.append(right);details[right]={'mirroredFrom':j['id'],'anchor':rs['anchor']}
# Render a GIF for every sheet, including still bubbles and staged placeholders.
contact=Image.new('RGB',(2040,math.ceil(len(M['sheets'])/6)*148),(241,231,212));draw=ImageDraw.Draw(contact)
for k,(id,s) in enumerate(M['sheets'].items()):
 sheet=Image.open(R/'src/sheets'/(id+'.png')).convert('RGBA');frames=[]
 for i in range(s['frames']):
  f=sheet.crop((i*s['frameW'],0,(i+1)*s['frameW'],s['frameH']));bg=Image.new('RGBA',f.size,(244,236,219,255));bg.alpha_composite(f);frames.append(bg.convert('RGB'))
 frames[0].save(R/'review'/(id+'.gif'),save_all=True,append_images=frames[1:],duration=round(1000/s['fps']),loop=0,disposal=2)
 x=k%6*340;y=k//6*148;draw.text((x+5,y+4),id,fill=(48,53,63))
 for i,f in enumerate(frames):
  thumb=f.copy();thumb.thumbnail((80,120),Image.Resampling.LANCZOS);contact.paste(thumb,(x+i*82+4,y+22))
contact.save(R/'review/contact-sheet.png');(R/'manifest.next.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));(R/'manifest.next.json').replace(R/'manifest.json');(R/'src/alignment.json').write_text(json.dumps(details,indent=2));print('generated sheets installed',len(done),'runtime bytes',sum(p.stat().st_size for p in (R/'runtime').glob('*.webp')))
