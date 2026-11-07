from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops
import json,math,shutil
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());before=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'));reports={}
regions={'small':[(0,230,292,780),(180,365,410,590)],'medium':[(0,170,258,705),(145,335,392,625),(0,700,275,1024)],'large':[(0,215,235,680),(0,590,85,1254),(0,1040,215,1254)]}
for kind,rects in regions.items():
 a=M['assets']['background-'+kind];backup=R/'src/modules'/('background-before-left-'+kind+'.png')
 if not backup.exists():shutil.copyfile(R/a['sourceFile'],backup)
 original=Image.open(backup).convert('RGBA');generated=Image.open(R/'src/generated'/('background-left-clear-'+kind+'.png')).convert('RGBA')
 if generated.size!=original.size:generated=generated.resize(original.size,Image.Resampling.LANCZOS)
 mask=Image.new('L',original.size);d=ImageDraw.Draw(mask)
 for rect in rects:d.rectangle(rect,fill=255)
 # Blend only INSIDE edited region; every pixel outside mask stays byte-identical.
 blend=ImageChops.multiply(mask,mask.filter(ImageFilter.GaussianBlur(5)));out=Image.composite(generated,original,blend);out.save(R/a['sourceFile']);diff=ImageChops.difference(original,out);outside=ImageChops.multiply(diff.getchannel('R'),ImageChops.invert(mask));assert not outside.getbbox()
 w,h=a['size'];pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;p=Image.new('RGBA',(pw,ph));p.alpha_composite(out);p.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS).save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6)
 # Refresh any legacy runtime aliases if present, keeping their names/dimensions.
 for legacy in (R/'runtime').glob('static-background-'+kind+'*.webp'):shutil.copyfile(R/a['file'],legacy)
 reports[kind]={'editedRectangles':rects,'outsideRegionPixelsUnchanged':True,'size':list(out.size)}
rest=M['restLayout'];rest.update(placement='left clear floor beside desk grid; manager private slot unchanged',columns=1,slotStride=[0,180],overflow='own desk when full; no extra room height')
rest['memberLounge'].update(enabled=False,deprecated=True,disabledReason='replaced by leftLounge; do not draw bottom rug/strip',addedRoomHeight=0,stripHeight=0,roomHeightRule='base room height unchanged')
for id,a in M['assets'].items():
 if id.startswith('rug-lounge-'):a['enabled']=False;a['unusedReason']='bottom lounge strip disabled; key preserved'
configs={'small':{'canvas':[1536,1024],'ys':[400,580,760]},'medium':{'canvas':[1536,1024],'ys':[390,570,750]},'large':{'canvas':[1536,1536],'ys':[400,580,760,940,1120,1300]}}
left={'enabled':True,'origin':'room top-left, logical world pixels; background-native pixels must first be scaled to canvas','beanbagSize':[240,200],'actorHeight':256,'seatedFrameHip':[48,166],'roomHeightPolicy':'base canvas only; never append memberLounge height','walkingCorridorX':[284,340],'walkingCenterX':312,'walkingRule':'reserved foot-center lane between bag right edge276 and nearest pod left340/350; do not allocate furniture here','overflow':'rest at own desk; never share slot','slotStride':[0,180],'verticalOverlap':20,'drawOrder':'sort complete beanbag-back -> actor -> beanbag-front groups by slot topLeft.y ascending','protectedActorRegion':'face and cup above local y=130; next occupied group starts near local y=160 or lower','byBackground':{}}
colors=['moss','terracotta','navy','mustard']
for kind,c in configs.items():
 slots=[{'id':'left-'+str(i),'beanbag':colors[i%4],'topLeft':[36,y],'seat':[138,y+132]} for i,y in enumerate(c['ys'])]
 left['byBackground'][kind]={'canvas':c['canvas'],'maxSlots':len(slots),'slots':slots,'walkingCorridorX':[284,340]}
 for i,s in enumerate(slots):
  assert s['topLeft'][0]+240<=284 and s['topLeft'][1]+200<=c['canvas'][1]-32
  if i:assert s['topLeft'][1]-slots[i-1]['topLeft'][1]>=180
rest['leftLounge']=left;(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
def asset(id):
 a=M['assets'][id];im=Image.open(R/a['file']).convert('RGBA').resize(tuple(a['runtimePaddedLogicalSize']),Image.Resampling.LANCZOS);return im.crop((0,0,*a['size']))
def seated(color,actor):
 p=M['beanbags'][color];im=Image.new('RGBA',(288,270));im.alpha_composite(asset(p['back']),(24,54));s=M['sheets'][M['actors'][actor]['away']];a=Image.open(R/s['file']).convert('RGBA').crop((0,0,100,135)).resize((190,256),Image.Resampling.LANCZOS);f=256/216;im.alpha_composite(a,(round(24+102-48*f),round(54+132-166*f)));im.alpha_composite(asset(p['front']),(24,54));return im
review=Image.new('RGB',(1800,640),(242,229,207));d=ImageDraw.Draw(review)
for col,(kind,c) in enumerate(configs.items()):
 cw,ch=c['canvas'];bg=asset('background-'+kind).resize((cw,ch),Image.Resampling.LANCZOS)
 for i,s in enumerate(left['byBackground'][kind]['slots']):bg.alpha_composite(seated(s['beanbag'],'actor-'+str(i)),(s['topLeft'][0]-24,s['topLeft'][1]-54))
 # Existing lead back/front use original background coordinates.
 lead=M['leadDesks'][kind];a=M['assets'][lead['back']];sx=cw/M['assets']['background-'+kind]['size'][0];sy=ch/M['assets']['background-'+kind]['size'][1]
 for id in [lead['back'],lead['front']]:
  im=asset(id);im=im.resize((round(im.width*sx),round(im.height*sy)),Image.Resampling.LANCZOS);bg.alpha_composite(im,(round(a['sourceBox'][0]*sx),round(a['sourceBox'][1]*sy)))
 # A few real grid pods, including the nearest column, demonstrate the reserved corridor.
 n=3 if kind=='small' else 6 if kind=='medium' else 16;columns=n if n<=3 else 3 if n<=6 else 4;pw=310 if n<=6 else 258
 for i in range(min(n,8)):
  x=350+i%columns*380 if n<=6 else 340+i%4*286;y=610 if n<=3 else 450+i//3*275 if n<=6 else 500+i//4*260;p=M['pods'][str(i%3)]
  for id in [p['back'],p['front']]:
   im=asset(id);im=im.resize((pw,round(im.height*pw/im.width)),Image.Resampling.LANCZOS);bg.alpha_composite(im,(x,y))
 bg.convert('RGB').save(R/'review'/('left-lounge-'+kind+'.png'));bg.thumbnail((600,600),Image.Resampling.LANCZOS);review.paste(bg,(col*600,30));d.text((col*600+8,8),kind+' / '+str(len(c['ys']))+' member slots / original room height',fill='black')
review.save(R/'review/left-lounge-compose.png');after=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'));(R/'left-lounge-report.json').write_text(json.dumps({'beforeBytes':before,'afterBytes':after,'backgrounds':reports,'maxSlots':{k:len(c['ys']) for k,c in configs.items()},'managerSlotUnchanged':True},indent=2));print('runtime bytes',after,'outside edit regions unchanged, lounge slots do not intersect grid')
