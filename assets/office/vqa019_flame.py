from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,hashlib
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());s=M['sheets']['flame_aura'];raw=Image.open(R/'src/generated/flame-vqa019.png').convert('RGBA');cells=[]
for i in range(4):
 im=raw.crop((round(i*raw.width/4),0,round((i+1)*raw.width/4),raw.height));im.putalpha(im.getchannel('A').point(lambda a:0 if a<24 else a));b=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();cells.append(im.crop(b))
scale=min(124/max(c.width for c in cells),100/max(c.height for c in cells));sheet=Image.new('RGBA',(512,160))
for i,c in enumerate(cells):
 c=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.LANCZOS);sheet.alpha_composite(c,(i*128+round(64-c.width/2),108-c.height))
sheet.save(R/'src/sheets/flame_aura.png');out=Image.new('RGBA',(320,100))
for i in range(4):out.alpha_composite(sheet.crop((i*128,0,(i+1)*128,160)).resize((80,100),Image.Resampling.LANCZOS),(i*80,0))
out.save(R/s['file'],'WEBP',quality=85,alpha_quality=100,method=6)
M['effectPlacement']['flame_aura']={'sheet':'flame_aura','referenceActorFrame':[160,216],'anchorInActorFrame':[44,166],'sheetAnchor':[64,144],'renderScaleFormula':'renderedActorFrameHeight / 216','renderSizeToActorFrameHeight':[128/216,160/216],'inkBounds':[2,8,126,108],'emptyLowerBand':[0,109,128,160],'target':'upper back and shoulders, slightly left of torso center','layer':'behind actor, then actor drawn once','clipPolicy':'exclude monitor/keyboard/nameplate foreground only; NEVER intersect with actor opaque silhouette or redraw torso on top of a clipped narrow sliver','minimumVisibleShoulderMarginAtReference':18,'positionFormula':'current pose frame top-left + [44,166]*actorScale - [64,144]*actorScale; never use desk seat or hand center as effect anchor'}
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));actors=list(M['actors']);review=Image.new('RGB',(4*480,len(actors)*250),(239,225,200));d=ImageDraw.Draw(review);report={}
for row,actor in enumerate(actors):
 aid=M['actors'][actor]['working'];a=Image.open(R/'src/sheets'/(aid+'.png')).convert('RGBA').crop((0,0,160,216))
 for f in range(4):
  off=Image.new('RGBA',(240,220),(239,225,200,255));off.alpha_composite(a,(50,0));on=Image.new('RGBA',off.size,(239,225,200,255));on.alpha_composite(sheet.crop((f*128,0,(f+1)*128,160)),(30,22));on.alpha_composite(a,(50,0));x=f*480;y=row*250;review.paste(on.convert('RGB'),(x,y+22));review.paste(off.convert('RGB'),(x+240,y+22));d.text((x+4,y+3),actor+' f'+str(f)+' ON | OFF',fill='black');diff=ImageChops.difference(on.convert('RGB'),off.convert('RGB'));count=sum(1 for p in diff.get_flattened_data() if max(p)>40);report[actor+'-'+str(f)]={'visibleChangedPixelsAtReference216':count,'estimatedDevicePixelsAtScale0625':round(count*.625**2)}
review.save(R/'review/flame-on-off.png');(R/'vqa019-report.json').write_text(json.dumps(report,indent=2));hashes=json.loads((R/'source-hashes.json').read_text());hashes['src/sheets/flame_aura.png']=hashlib.sha256((R/'src/sheets/flame_aura.png').read_bytes()).hexdigest();(R/'source-hashes.json').write_text(json.dumps(hashes,indent=2));print('visible pixel range',min(v['estimatedDevicePixelsAtScale0625'] for v in report.values()),max(v['estimatedDevicePixelsAtScale0625'] for v in report.values()))
