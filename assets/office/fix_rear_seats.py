from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text())
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:0 if a<24 else a));b=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();return im.crop(b)
def save(id,im):
 a=M['assets'][id];im.save(R/a['sourceFile']);w,h=im.size;pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;p=Image.new('RGBA',(pw,ph));p.alpha_composite(im);p.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS).save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6)
raw=Image.open(R/'src/generated/furniture-layered.png');cuts=[0,495,970,1450,2172];furniture=[clean(raw.crop((cuts[i],0,cuts[i+1],raw.height))) for i in range(4)];keys=clean(Image.open(R/'src/generated/keyboard-mouse.png')).resize((130,26),Image.Resampling.LANCZOS)
handRects={'actor-0':[[58,125,102,148],[101,118,137,146]],'actor-1':[[78,127,116,150],[114,121,146,148]],'actor-2':[[54,120,104,145],[101,117,138,146]],'actor-3':[[64,121,112,143],[108,112,146,144]],'actor-4':[[62,124,110,151],[105,115,143,147]],'actor-5':[[52,124,102,150],[98,116,137,146]],'orchestrator':[[52,125,103,152],[98,120,136,149]]}
allModules=[('pod-'+str(i),p,i) for i,p in enumerate(M['pods'].values())]+[('lead-'+kind,p,3) for kind,p in M['leadDesks'].items()]
for label,p,index in allModules:
 w,h=M['assets'][p['back']]['size'];topPad=64 if label.startswith('lead') else 0;full=Image.new('RGBA',(w,h));full.alpha_composite(furniture[index].resize((w,h-topPad),Image.Resampling.LANCZOS),(0,topPad));rear=topPad+round((h-topPad)*.43);kx=round(p['seat'][0]-25);ky=rear+6
 # Chair/rear accessories precede actor. Full tabletop and modesty panel occlude its body.
 full.alpha_composite(keys,(kx,ky));back=full.copy();front=Image.new('RGBA',full.size);front.paste(full.crop((0,rear,w,h)),(0,rear));back.paste((0,0,0,0),(0,rear,w,h))
 for x0,x1 in [(0,round(w*.24)),(round(w*.68),w)]:
  front.paste(full.crop((x0,0,x1,rear)),(x0,0));back.paste((0,0,0,0),(x0,0,x1,rear))
 save(p['back'],back);save(p['front'],front)
 f=p['actorHeight']/216;targetY=ky+12;originY=targetY-137*f;seatY=rear
 p['previousSeat']=p['seat'];p['seat']=[p['seat'][0],seatY];p['actorAnchor']=[80,125];p['seatMeaning']='body at table rear edge, anchored to source-frame torso row125';p['tableRearY']=rear;p['frontOcclusionY']=rear;p['actorClip']=[0,-80,w,rear+1];p['actorStateYOffset']={'working':0,'phone':-8,'sleeping':30};p['actorSourceClip']={'working':[0,0,160,145],'phone':[0,0,160,152],'sleeping':[0,0,160,138]}
 p['keyboard']={'rect':[kx,ky,130,26],'keycapRect':[kx+4,ky+3,104,18],'mouseRect':[kx+111,ky+3,19,22],'layer':'front-tabletop-before-hands','targetHandCenter':[p['seat'][0]+30,targetY],'includedInFront':True}
 p['actorOverlay']={'drawAfter':'desk front','working':{'byActor':handRects},'phone':{'sourceRects':[[84,85,150,151]]},'sleeping':{'sourceRects':[[20,20,150,138]]},'clipInModule':[0,rear-12,w,rear+65],'rule':'draw same actor frame at same origin/scale, ONLY these source rectangles after tabletop; body remains behind rear edge'}
 p['actorOffsets']={}
 hand=M.get('keyboardAlignment',{}).get('handCentersIn160x216Frames',{})
 for actor in M['actors']:
  hx,hy=hand.get(actor,[100,137]);p['actorOffsets'][actor]={'working':[round((100-hx)*f),round((137-hy)*f)]}
# Preserve original hand pixels, excluding sleeve/body rectangles from tabletop overlays.
handSheets={}
for actor in M['actors']:
 src=Image.open(R/'src/sheets'/(M['actors'][actor]['working']+'.png')).convert('RGBA');sheet=Image.new('RGBA',src.size)
 for fi in range(4):
  cell=src.crop((fi*160,0,(fi+1)*160,216));seed=Image.new('L',cell.size);sp=seed.load();px=cell.load()
  for x0,y0,x1,y1 in handRects[actor]:
   for yy in range(y0,y1):
    for xx in range(x0,x1):
     rr,gg,bb,aa=px[xx,yy]
     if aa>32 and rr>140 and gg>90 and rr>gg*1.2 and bb<205 and bb>gg*.45:sp[xx,yy]=255
  mask=seed.filter(ImageFilter.MaxFilter(5));hand=cell.copy();hand.putalpha(ImageChops.multiply(cell.getchannel('A'),mask));sheet.alpha_composite(hand,(fi*160,0))
 id='hands-'+actor+'-working';sheet.save(R/'src/sheets'/(id+'.png'));out=Image.new('RGBA',(400,135))
 for fi in range(4):out.alpha_composite(sheet.crop((fi*160,0,(fi+1)*160,216)).resize((100,135),Image.Resampling.LANCZOS),(fi*100,0))
 out.save(R/'runtime'/(id+'.webp'),'WEBP',quality=85,alpha_quality=100,method=6);M['sheets'][id]={'file':'runtime/'+id+'.webp','frameW':160,'frameH':216,'frames':4,'fps':8,'loop':True,'anchor':[80,205]};handSheets[actor]=id
for label,p,index in allModules:
 p['actorOverlay']['working']['sheetByActor']=handSheets;p['actorOverlay']['working']['preferSheet']=True
 p['actorOverlay']['working']['extraction']='original working-frame skin pixels and 2px adjacent outline, alpha mask; no repainted pixels'
M['workingHandOverlays']=handSheets
M['drawingOrder']=['background','chair and desk back above table rear edge','actor BODY clipped at tableRearY','desk front INCLUDING entire tabletop and keyboard','actor working hands / phone / sleeping head-arms source overlays ONLY','nameplate','beanbag back -> away actor -> beanbag front, complete groups by Y','effects','HTML context header']
for kind in ['pod','lead']:
 if 'furnitureProportions' in M:M['furnitureProportions'][kind]['keyboardWidthToActorFrameHeight']=130/320
M['keyboardAlignment']['draw']='body -> full tabletop/keyboard -> hand source rectangles; hands share exactly the same actor transform'
M['rearSeatContract']={'bodyOcclusion':'tableRearY, not tabletop front edge','overlay':'actorOverlay source rectangles use original160x216 frame coordinates; multiply source coordinates by runtimeScale when cropping runtime sheet, do not change actor destination origin','clipping':'actorClip applies to body; actorOverlay.clipInModule applies separately to hand/head overlay','moduleScale':'all new coordinates follow existing uniform furniture scale'}
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
# Render proof with overscan above module, retaining identical transform for overlays.
def compose(p,actor,state,frame):
 w,h=M['assets'][p['back']]['size'];pad=80;out=Image.new('RGBA',(w,h+pad+20));back=Image.open(R/M['assets'][p['back']]['sourceFile']).convert('RGBA');front=Image.open(R/M['assets'][p['front']]['sourceFile']).convert('RGBA');out.alpha_composite(back,(0,pad));s=M['sheets'][M['actors'][actor][state]];a=Image.open(R/'src/sheets'/(M['actors'][actor][state]+'.png')).convert('RGBA').crop((frame*160,0,(frame+1)*160,216));f=p['actorHeight']/216;adj=p['actorOffsets'].get(actor,{}).get(state,[0,0]);x=round(p['seat'][0]-80*f+adj[0]);y=round(p['seat'][1]-p['actorAnchor'][1]*f+p['actorStateYOffset'][state]+adj[1])+pad
 def actorLayer(rects,overlay=False):
  mask=Image.new('RGBA',a.size)
  if overlay and state=='working':mask=Image.open(R/'src/sheets'/(handSheets[actor]+'.png')).convert('RGBA').crop((frame*160,0,(frame+1)*160,216))
  else:
   for b in rects:mask.paste(a.crop(tuple(b)),tuple(b[:2]))
  layer=Image.new('RGBA',out.size);layer.alpha_composite(mask.resize((round(160*f),round(216*f)),Image.Resampling.LANCZOS),(x,y));return layer
 layer=actorLayer([p['actorSourceClip'][state]]);rear=p['tableRearY']+pad;layer.paste((0,0,0,0),(0,rear,w,out.height));out.alpha_composite(layer);out.alpha_composite(front,(0,pad));o=p['actorOverlay'][state];rects=o.get('byActor',{}).get(actor,o.get('sourceRects',[]));layer=actorLayer(rects,True);clip=p['actorOverlay']['clipInModule'];mask=Image.new('RGBA',out.size);box=(clip[0],clip[1]+pad,clip[2],clip[3]+pad);mask.paste(layer.crop(box),box[:2]);out.alpha_composite(mask);return out
W=360;H=370;review=Image.new('RGB',(W*6,H*21),(242,229,207));d=ImageDraw.Draw(review)
for pod,p in enumerate(M['pods'].values()):
 for actor in range(6):
  row=pod*6+actor
  for col,(state,frame) in enumerate([('working',i) for i in range(4)]+[('phone',0),('sleeping',0)]):
   im=compose(p,'actor-'+str(actor),state,frame);im.thumbnail((355,340),Image.Resampling.LANCZOS);review.paste(im,(col*W,row*H+25),im);d.text((col*W+4,row*H+4),f'pod{pod} actor{actor} {state} {frame}',fill='black')
for row,(kind,p) in enumerate(M['leadDesks'].items()):
 for col,(state,frame) in enumerate([('working',i) for i in range(4)]+[('phone',0),('sleeping',0)]):
  im=compose(p,'orchestrator',state,frame);im.thumbnail((355,340),Image.Resampling.LANCZOS);review.paste(im,(col*W,(18+row)*H+25),im);d.text((col*W+4,(18+row)*H+4),f'lead {kind} {state} {frame}',fill='black')
review.save(R/'review/desk-compose.png')
for i in range(3):review.crop((0,i*6*H,W*6,(i+1)*6*H)).save(R/'review'/f'desk-compose-pod{i}.png')
review.crop((0,18*H,W*6,21*H)).save(R/'review/desk-compose-manager.png')
# Native source-resolution typing detail, 24 frames, no thumbnail guessing.
detail=Image.new('RGB',(960,6*130),(242,229,207));d=ImageDraw.Draw(detail);p=M['pods']['0']
for row in range(6):
 for f in range(4):
  im=compose(p,'actor-'+str(row),'working',f);rear=p['tableRearY']+80;crop=im.crop((110,rear-15,290,rear+45)).resize((240,80),Image.Resampling.LANCZOS);detail.paste(crop,(f*240,row*130+25),crop);d.text((f*240+4,row*130+4),f'actor{row} working {f}',fill='black')
detail.save(R/'review/typing-hands-detail.png');print({k:{'seat':p['seat'],'rear':p['tableRearY'],'keyboard':p['keyboard']['rect']} for k,p in M['pods'].items()});print({k:{'seat':p['seat'],'rear':p['tableRearY']} for k,p in M['leadDesks'].items()})
