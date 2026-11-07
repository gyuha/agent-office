from pathlib import Path
from PIL import Image,ImageDraw
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());before=1317636
D=R/'src/modules';D.mkdir(exist_ok=True)
def crop_clean(im,box):
 im=im.crop(box).convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:0 if a<16 else a));b=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();return im.crop(b)
def export(id,im,sourceBox=None):
 im.save(D/(id+'.png'));w,h=im.size;pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;p=Image.new('RGBA',(pw,ph));p.alpha_composite(im);p=p.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS);file='runtime/'+id+'.webp';p.save(R/file,'WEBP',quality=85,alpha_quality=100,method=6)
 a={'file':file,'size':[w,h],'sourceFile':'src/modules/'+id+'.png','runtimeSize':list(p.size),'runtimePaddedLogicalSize':[pw,ph]}
 if sourceBox:a['sourceBox']=sourceBox
 old=M['assets'].get(id)
 if old and old['file']!=file and (R/old['file']).suffix=='.webp':(R/old['file']).unlink(missing_ok=True)
 M['assets'][id]=a
 return id

def split(im,y):
 back=im.copy();front=Image.new('RGBA',im.size);front.paste(im.crop((0,y,im.width,im.height)),(0,y));back.paste((0,0,0,0),(0,y,im.width,im.height));return back,front
f=Image.open(R/'src/generated/furniture-layered.png').convert('RGBA');cuts=[0,495,970,1450,2172];desks=[crop_clean(f,(cuts[i],0,cuts[i+1],724)) for i in range(4)]
M['pods']={};states={'working':-45,'phone':-45,'sleeping':-15}
for i in range(3):
 w,h=M['assets'][f'pod-{i}-back']['size'];im=desks[i].resize((w,h),Image.Resampling.LANCZOS);y=round(h*.62);back,front=split(im,y)
 # Extreme left/right props belong to foreground, preserving exact composite.
 for x0,x1 in [(0,round(w*.24)),(round(w*.68),w)]:
  front.paste(im.crop((x0,0,x1,y)),(x0,0));back.paste((0,0,0,0),(x0,0,x1,y))
 export(f'pod-{i}-back',back);export(f'pod-{i}-front',front)
 M['pods'][str(i)]={'back':f'pod-{i}-back','front':f'pod-{i}-front','size':[w,h],'seat':[round(w*.37),round(h*.97)],'actorHeight':320,'actorAnchor':[80,205],'actorStateYOffset':states,'frontOcclusionY':y,'actorClip':[0,0,w,y+1],'clearTableZone':[round(w*.24),round(h*.4),round(w*.68),y],'nameplate':{'center':[w*.5,h*.8],'width':w*.74},'chairIncludedInBack':True}
M['leadDesks']={}
for kind in ['small','medium','large']:
 a=M['assets']['lead-front-'+kind];x,y,x2,y2=a['sourceBox'];w=x2-x;h=round(w*desks[3].height/desks[3].width);im=desks[3].resize((w,h),Image.Resampling.LANCZOS);padded=Image.new('RGBA',(w,h+64));padded.alpha_composite(im,(0,64));im=padded;sourceBox=[x,y2-h-64,x2,y2];sy=round(h*.63)+64;back,front=split(im,sy)
 for x0,x1 in [(0,round(w*.26)),(round(w*.65),w)]:
  front.paste(im.crop((x0,0,x1,sy)),(x0,0));back.paste((0,0,0,0),(x0,0,x1,sy))
 export('lead-back-'+kind,back,sourceBox);export('lead-front-'+kind,front,sourceBox)
 M['leadDesks'][kind]={'back':'lead-back-'+kind,'front':'lead-front-'+kind,'sourceBox':sourceBox,'seat':[round(w*.45),round(h*1.12)+64],'actorHeight':320,'actorAnchor':[80,205],'actorStateYOffset':{'working':-45,'phone':-45,'sleeping':-15},'frontOcclusionY':sy,'actorClip':[0,0,w,sy+1],'nameplate':{'center':[w*.5,h*.8+64],'width':w*.45},'backgroundDeskOverlay':True}
b=Image.open(R/'src/generated/beanbags.png');M['beanbags']={}
for i,color in enumerate(['moss','terracotta','navy','mustard']):
 im=crop_clean(b,(round(i*b.width/4),0,round((i+1)*b.width/4),b.height)).resize((240,192),Image.Resampling.LANCZOS);back,front=split(im,145);back=im.copy();export('beanbag-'+color+'-back',back);export('beanbag-'+color+'-front',front)
 M['beanbags'][color]={'back':'beanbag-'+color+'-back','front':'beanbag-'+color+'-front','size':[240,192],'seat':[120,132],'actorHeight':216,'actorAnchor':[80,150],'actorOffset':[0,0],'spacing':[280,240]}
# Replace only the original embedded manager-desk rectangle with generated clean plate.
for kind,box in {'small':(540,180,1068,413),'medium':(548,155,1048,373),'large':(430,143,905,365)}.items():
 original=Image.open(R/'src/v10'/('background-'+kind+'.png')).convert('RGBA');clean=Image.open(R/'src/generated'/('background-clean-'+kind+'.png')).convert('RGBA')
 if clean.size!=original.size:clean=clean.resize(original.size,Image.Resampling.LANCZOS)
 original.paste(clean.crop(box),box[:2]);export('background-'+kind,original);M['leadDesks'][kind]['backgroundDeskOverlay']=False;M['leadDesks'][kind]['backgroundDeskRemoved']=True
M['restLayout']={'placement':'inside room edge clear floor, beside rug; never on bed','columns':2,'slotStride':[280,240],'occupancy':'one actor per beanbag, unique slot; orchestrator shares the same pool','overflow':'add rows on clear floor; never reuse occupied slot'}
# Generated keyboard/mouse art is composited into every desk back, before actor.
kraw=Image.open(R/'src/generated/keyboard-mouse.png').convert('RGBA');keyboard=crop_clean(kraw,(0,0,kraw.width,kraw.height))
handCenters={'actor-0':[98,137],'actor-1':[109,141],'actor-2':[98,134],'actor-3':[104,134],'actor-4':[102,139],'actor-5':[96,140],'orchestrator':[94,141]}
for p in list(M['pods'].values())+list(M['leadDesks'].values()):
 backid=p['back'];asset=M['assets'][backid];im=Image.open(R/asset['sourceFile']).convert('RGBA');factor=p['actorHeight']/216;fy=p['frontOcclusionY'];seat=p['seat'];kw=150;kh=30;kx=round(seat[0]-50);ky=fy-31
 im.alpha_composite(keyboard.resize((kw,kh),Image.Resampling.LANCZOS),(kx,ky));export(backid,im,asset.get('sourceBox'))
 p['keyboard']={'rect':[kx,ky,kw,kh],'keycapRect':[kx+5,ky+4,120,21],'mouseRect':[kx+128,ky+4,22,25],'layer':'back','targetHandCenter':[seat[0]+30,fy-17]}
 p['actorOffsets']={}
 baseY=seat[1]-205*factor+p['actorStateYOffset']['working']+137*factor
 for actor,hand in handCenters.items():
  p['actorOffsets'][actor]={'working':[round((100-hand[0])*factor),round(fy-17-baseY+(137-hand[1])*factor)]}
 p['actorStateYOffset']['sleeping']=-38
 p['actorSourceClip']={'working':[0,0,160,145],'sleeping':[0,0,160,138]}
M['keyboardAlignment']={'source':'src/generated/keyboard-mouse.png','handCentersIn160x216Frames':handCenters,'offsetUnits':'desk logical pixels; applied only to named state after actorStateYOffset','framePolicy':'constant per actor across all 4 working frames; no per-frame jitter correction','draw':'desk back including keyboard -> actor hands -> desk front'}
M['drawingOrder']=['background','chair (included in desk back)','desk back','flame_aura','actor','desk front','nameplate','beanbag back','away actor','beanbag front','effects','HTML context header']
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
# Desk composition proof: 3 pods x 6 identities x 3 states, plus manager.
st=['working','phone','sleeping'];W=240;H=235;contact=Image.new('RGB',(W*6,H*12),(242,229,207));d=ImageDraw.Draw(contact)
def compose(backid,frontid,spec,actor,state,frame=0):
 back=Image.open(R/M['assets'][backid]['sourceFile']).convert('RGBA');front=Image.open(R/M['assets'][frontid]['sourceFile']).convert('RGBA');s=M['sheets'][M['actors'][actor][state]];a=Image.open(R/'src/sheets'/(M['actors'][actor][state]+'.png')).convert('RGBA').crop((frame*s['frameW'],0,(frame+1)*s['frameW'],s['frameH']))
 sourceClip=spec.get('actorSourceClip',{}).get(state)
 if sourceClip:
  masked=Image.new('RGBA',a.size);masked.paste(a.crop(tuple(sourceClip)),tuple(sourceClip[:2]));a=masked
 factor=spec['actorHeight']/s['frameH'];a=a.resize((round(a.width*factor),round(a.height*factor)),Image.Resampling.LANCZOS);out=Image.new('RGBA',(back.width,back.height+45));out.alpha_composite(back);anchor=spec['actorAnchor'];seat=spec['seat'];offset=spec.get('actorStateYOffset',{}).get(state,0);adj=spec.get('actorOffsets',{}).get(actor,{}).get(state,[0,0]);layer=Image.new('RGBA',out.size);layer.alpha_composite(a,(round(seat[0]-anchor[0]*factor+adj[0]),round(seat[1]-anchor[1]*factor+offset+adj[1])))
 if 'actorClip' in spec:
  box=spec['actorClip'];clipped=Image.new('RGBA',out.size);clipped.paste(layer.crop(tuple(box)),tuple(box[:2]));layer=clipped
 out.alpha_composite(layer);out.alpha_composite(front);return out
W=320;H=290;contact=Image.new('RGB',(W*6,H*21),(242,229,207));d=ImageDraw.Draw(contact)
for pod in range(3):
 p=M['pods'][str(pod)]
 for actor in range(6):
  row=pod*6+actor
  for col,(state,frame) in enumerate([('working',f) for f in range(4)]+[('phone',0),('sleeping',0)]):
   out=compose(p['back'],p['front'],p,'actor-'+str(actor),state,frame);out.thumbnail((315,260),Image.Resampling.LANCZOS);x=col*W;y=row*H;contact.paste(out,(x,y+24),out);d.text((x+5,y+3),f'pod{pod} actor{actor} {state} frame{frame}',fill='black')
for row,kind in enumerate(['small','medium','large']):
 p=M['leadDesks'][kind]
 for col,(state,frame) in enumerate([('working',f) for f in range(4)]+[('phone',0),('sleeping',0)]):
  out=compose(p['back'],p['front'],p,'orchestrator',state,frame);out.thumbnail((315,260),Image.Resampling.LANCZOS);contact.paste(out,(col*W,(18+row)*H+24),out);d.text((col*W+5,(18+row)*H+3),f'manager {kind} {state} frame{frame}',fill='black')
for i in range(3):contact.crop((0,i*6*H,W*6,(i+1)*6*H)).save(R/'review'/f'desk-compose-pod{i}.png')
contact.crop((0,18*H,W*6,21*H)).save(R/'review/desk-compose-manager.png')
contact.save(R/'review/desk-compose.png')
contact=Image.new('RGB',(280*7,260*4),(242,229,207));d=ImageDraw.Draw(contact)
for row,(color,p) in enumerate(M['beanbags'].items()):
 for col,actor in enumerate(['actor-'+str(i) for i in range(6)]+['orchestrator']):
  out=compose(p['back'],p['front'],p,actor,'away');out.thumbnail((270,225),Image.Resampling.LANCZOS);contact.paste(out,(col*280,row*260+24),out);d.text((col*280+5,row*260+4),color+' '+actor,fill='black')
contact.save(R/'review/beanbag-compose.png');after=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'));print('before',before,'after',after,'delta',after-before)
(R/'layer-report.json').write_text(json.dumps({'beforeBytes':before,'afterBytes':after,'newAssetKeys':[k for k in M['assets'] if k.startswith(('lead-back-','beanbag-'))],'podCombinations':54,'managerCombinations':9,'beanbagCombinations':28},indent=2))

rooms=Image.new('RGB',(1800,650),(242,229,207))
for i,kind in enumerate(['small','medium','large']):
 p=M['leadDesks'][kind];bg=Image.open(R/M['assets']['background-'+kind]['sourceFile']).convert('RGBA');desk=compose(p['back'],p['front'],p,'orchestrator','working');bg.alpha_composite(desk,tuple(p['sourceBox'][:2]));bg.thumbnail((600,650),Image.Resampling.LANCZOS);rooms.paste(bg,(i*600,0))
rooms.save(R/'review/lead-room-compose.png')

# Lounge metadata and assets are a subsequent build stage; run build_lounge.py after this.
