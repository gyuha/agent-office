from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());before=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'))
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:0 if a<16 else a));b=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();return im.crop(b)
def save_asset(id,im):
 a=M['assets'][id];im.save(R/a['sourceFile']);a['size']=list(im.size);pw=math.ceil(im.width/8)*8;ph=math.ceil(im.height/8)*8;p=Image.new('RGBA',(pw,ph));p.alpha_composite(im);p=p.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS);p.save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6);a['runtimeSize']=list(p.size);a['runtimePaddedLogicalSize']=[pw,ph]
raw=Image.open(R/'src/generated/beanbags-left60.png');colors=['moss','terracotta','navy','mustard']
for i,color in enumerate(colors):
 part=clean(raw.crop((round(i*raw.width/4),0,round((i+1)*raw.width/4),raw.height))).resize((240,200),Image.Resampling.LANCZOS)
 part=ImageOps.mirror(part);front=Image.new('RGBA',part.size)
 # Only right rear side bolster is foreground; the open left foot exit is fully clear.
 front.paste(part.crop((0,105,50,200)),(0,105));save_asset('beanbag-'+color+'-back',part);save_asset('beanbag-'+color+'-front',front)
 M['beanbags'][color].update(size=[240,200],seat=[102,132],actorAnchor=[48,166],actorHeight=256,rotationDegrees=60,frontOcclusionRect=[0,105,50,95],legExit='lower right, no foreground pixels in x>=50',spacing=[288,0])
# Frame contracts remain unchanged. All new poses packed from same-person horizontal rows.
registration={}
for actor in ['actor-'+str(i) for i in range(6)]+['orchestrator']:
 id=M['actors'][actor]['away'];p=R/'src/generated'/(id+'-left60.png');raw=Image.open(p).convert('RGBA');n=3;cuts=[0]
 # Actual transparent valleys near thirds avoid clipping a neighbor into a cell.
 a=raw.getchannel('A');data=a.point(lambda v:1 if v>16 else 0).tobytes();proj=[sum(data[x::raw.width]) for x in range(raw.width)]
 for i in [1,2]:
  nominal=round(i*raw.width/3);candidates=[x for x in range(max(1,nominal-raw.width//12),min(raw.width-1,nominal+raw.width//12)) if sum(proj[x-2:x+3])==0];cuts.append(min(candidates,key=lambda x:abs(x-nominal)) if candidates else nominal)
 cuts.append(raw.width);cells=[clean(raw.crop((cuts[i],0,cuts[i+1],raw.height))) for i in range(n)];factor=min(140/max(c.width for c in cells),190/max(c.height for c in cells));sheet=Image.new('RGBA',(480,216))
 for i,c in enumerate(cells):
  c=c.resize((round(c.width*factor),round(c.height*factor)),Image.Resampling.LANCZOS);sheet.alpha_composite(c,(i*160+round(80-c.width/2),205-c.height))
 mirrored=Image.new('RGBA',sheet.size)
 for i in range(3):mirrored.alpha_composite(ImageOps.mirror(sheet.crop((i*160,0,(i+1)*160,216))),(i*160,0))
 sheet=mirrored
 sheet.save(R/'src/sheets'/(id+'.png'));out=Image.new('RGBA',(300,135))
 for i in range(3):out.alpha_composite(sheet.crop((i*160,0,(i+1)*160,216)).resize((100,135),Image.Resampling.LANCZOS),(i*100,0))
 out.save(R/M['sheets'][id]['file'],'WEBP',quality=85,alpha_quality=100,method=6);M['sheets'][id]['frames']=3;registration[id]={'cuts':cuts,'scale':factor,'frameHip':[48,166],'horizontallyFlipped':True,'frameFeetBaseline':205}
rest=M['restLayout'];b=rest['memberLounge'];b['slotStride']=[288,0];b['beanbagSize']=[240,200]
for i,s in enumerate(b['slots']):s['topLeft']=[216+i*288,56];s['seat']=[318+i*288,188]
b['narrowLayout']['rule']='firstX=(roomWidth-(count*240+(count-1)*48))/2; y=56; rugX=(roomWidth-rugWidth)/2; seat=topLeft+[102,132]';b['arrivalAnchor']={'seatedFrameHip':[48,166],'walkFrameAnchor':'sheet.anchor (feet)','transition':'crossfade at slot seat; away frame hip placed at seat; walking feet target=seat+[0,64]; never interpolate incompatible frame anchors'}
rest['slotStride']=[288,0];rest['managerSlot']['seatInBeanbag']=[102,132]
for kind,p in M['leadDesks'].items():
 w,h=M['assets'][p['back']]['size'];top=[w+32,h-100];rest['managerSlot']['byBackground'][kind]={'topLeft':top,'seat':[top[0]+102,top[1]+132]}
rest['managerSlot']['topLeftFormula']='[leadWidth+32, leadHeight-100]';rest['managerSlot']['size']=[240,200]
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));(R/'src/away-left60-alignment.json').write_text(json.dumps(registration,indent=2))
# All seven people, every away frame, each color, plus a four-seat strip proof.
def asset(id):
 a=M['assets'][id];im=Image.open(R/a['file']).convert('RGBA').resize(tuple(a['runtimePaddedLogicalSize']),Image.Resampling.LANCZOS);return im.crop((0,0,*a['size']))
def pose(color,actor,frame):
 p=M['beanbags'][color];canvas=Image.new('RGBA',(288,270));origin=[24,54];canvas.alpha_composite(asset(p['back']),tuple(origin));s=M['sheets'][M['actors'][actor]['away']];im=Image.open(R/s['file']).convert('RGBA').crop((frame*100,0,(frame+1)*100,135)).resize((190,256),Image.Resampling.LANCZOS);f=256/216;x=round(origin[0]+p['seat'][0]-48*f);y=round(origin[1]+p['seat'][1]-166*f);canvas.alpha_composite(im,(x,y));canvas.alpha_composite(asset(p['front']),tuple(origin));return canvas
out=Image.new('RGB',(288*7,310*5),(242,229,207));draw=ImageDraw.Draw(out)
actors=['actor-'+str(i) for i in range(6)]+['orchestrator']
for row,color in enumerate(colors):
 for col,actor in enumerate(actors):
  im=pose(color,actor,0);out.paste(im,(col*288,row*310+24),im);draw.text((col*288+5,row*310+5),color+' '+actor,fill='black')
# Actual strip at logical 1536; bags placed at exact slot topLeft, pose origin removed.
strip=Image.new('RGBA',(1536,320));strip.alpha_composite(asset('rug-lounge-long'),(88,32))
for i,s in enumerate(b['slots']):
 im=pose(s['beanbag'],actors[i],0);strip.alpha_composite(im,(s['topLeft'][0]-24,s['topLeft'][1]-54))
out.paste(strip,(0,4*310),strip);out.save(R/'review/lounge-compose.png')
frames=Image.new('RGB',(288*3,310*7),(242,229,207));d=ImageDraw.Draw(frames)
for row,actor in enumerate(actors):
 for f in range(3):
  im=pose(colors[row%4],actor,f);frames.paste(im,(f*288,row*310+24),im);d.text((f*288+5,row*310+4),actor+' away frame'+str(f),fill='black')
frames.save(R/'review/lounge-frames.png');after=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'));(R/'rotated-lounge-report.json').write_text(json.dumps({'beforeBytes':before,'afterBytes':after,'changedSheets':list(registration),'beanbagKeys':[p[k] for p in M['beanbags'].values() for k in ['back','front']],'registration':registration},indent=2));print('runtime bytes',after)
