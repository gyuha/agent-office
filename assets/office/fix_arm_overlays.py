from pathlib import Path
from PIL import Image,ImageDraw
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());before=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'))
left=[(54,92),(42,100),(36,112),(37,129),(45,138),(63,141),(96,146),(102,139),(96,130),(80,126),(71,118),(76,108),(76,99)]
right=[(102,98),(116,102),(120,115),(132,118),(139,127),(138,139),(128,145),(112,144),(101,139),(96,129),(98,114)]
phoneLeft=[(55,90),(42,98),(36,111),(38,132),(48,142),(70,146),(100,145),(117,132),(118,111),(100,108),(88,127),(72,130),(70,112),(78,100)]
phoneRight=[(104,62),(143,66),(154,128),(146,146),(130,151),(111,143),(100,117),(98,99)]
sleep=[(0,0),(160,0),(160,126),(145,130),(130,134),(112,132),(94,128),(78,130),(65,134),(45,136),(24,132),(0,126)]
shifts={'actor-0':(-2,0),'actor-1':(9,4),'actor-2':(-2,-3),'actor-3':(4,-3),'actor-4':(2,2),'actor-5':(-4,3),'orchestrator':(-6,4)}
armMap={};masks={}
for actor in M['actors']:
 armMap[actor]={};dx,dy=shifts[actor]
 for state in ['working','phone','sleeping']:
  sourceId=M['actors'][actor][state];spec=M['sheets'][sourceId];n=spec['frames'];src=Image.open(R/'src/sheets'/(sourceId+'.png')).convert('RGBA');sheet=Image.new('RGBA',src.size)
  polygons=[[(x+dx,y+dy) for x,y in p] for p in [left,right,[(70,102),(112,102),(110,128),(76,129)]]] if state=='working' else [phoneLeft,phoneRight] if state=='phone' else [sleep]
  mask=Image.new('L',(160,216));d=ImageDraw.Draw(mask)
  for poly in polygons:d.polygon(poly,fill=255)
  if state=='sleeping':d.rectangle((0,0,39,143),fill=255)
  for fi in range(n):
   cell=src.crop((fi*160,0,(fi+1)*160,216));out=Image.new('RGBA',cell.size);out.paste(cell,(0,0),mask);sheet.alpha_composite(out,(fi*160,0))
  id=M['workingHandOverlays'][actor] if state=='working' else 'arms-'+actor+'-'+state
  sheet.save(R/'src/sheets'/(id+'.png'));runtime=Image.new('RGBA',(100*n,135))
  for fi in range(n):runtime.alpha_composite(sheet.crop((fi*160,0,(fi+1)*160,216)).resize((100,135),Image.Resampling.LANCZOS),(fi*100,0))
  file='runtime/'+id+'.webp';runtime.save(R/file,'WEBP',quality=85,alpha_quality=100,method=6);M['sheets'][id]={'file':file,'frameW':160,'frameH':216,'frames':n,'fps':spec['fps'],'loop':spec['loop'],'anchor':spec['anchor'],'overlaySource':sourceId,'overlayType':'armsSleevesHands' if state!='sleeping' else 'headArmsSleeves'};armMap[actor][state]=id;masks[id]={'source':sourceId,'polygons':polygons,'rule':'original RGBA pixels only; shoulders to fingertips, torso and lower body excluded'}
# Front must never contain the upper-left chair quadrant that masked hair/ponytails.
for p in list(M['pods'].values())+list(M['leadDesks'].values()):
 a=M['assets'][p['back']];full=Image.open(R/a['sourceFile']).convert('RGBA');full.alpha_composite(Image.open(R/M['assets'][p['front']]['sourceFile']).convert('RGBA'));full.putalpha(full.getchannel('A').point(lambda a:255 if a>=240 else 0 if a<16 else a));w,h=full.size;rear=p['tableRearY'];front=Image.new('RGBA',full.size);front.paste(full.crop((0,rear,w,h)),(0,rear));x0=round(w*.68);front.paste(full.crop((x0,0,w,rear)),(x0,0))
 for id,im in [(p['back'],full),(p['front'],front)]:
  a=M['assets'][id];im.save(R/a['sourceFile']);pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;padded=Image.new('RGBA',(pw,ph));padded.alpha_composite(im);padded.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS).save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6)
 assert front.getchannel('A').crop((0,0,x0,rear)).getbbox() is None
 p['actorClip']=[-256,-256,w+256,rear+2];p['actorSourceClip']={state:[0,0,160,216] for state in ['working','phone','sleeping']};cfg={'clipInModule':[-256,-256,w+256,rear+90],'rule':'body -> complete tabletop -> original shoulder/arm/sleeve overlays -> nameplate; no left/right silhouette clips'}
 for state in ['working','phone','sleeping']:cfg[state]={'preferSheet':True,'sheetByActor':{actor:armMap[actor][state] for actor in armMap},'type':'armOverlays','sameTransformAsBody':True}
 p['actorOverlay']=cfg;p['frontLayerContract']={'noLeftChairAboveRear':True,'frontStartsAt':rear,'backContainsFullFurniture':True,'seamPrevention':'full furniture underlay plus foreground tabletop; body clip overlaps rear by2 logical px'}
M['armOverlays']=armMap;M['armOverlayContract']={'frameSize':[160,216],'transform':'same source pose frame index, destination origin, factor and actorOffsets as body; never re-anchor overlay independently','drawOrder':['body','tabletop','armOverlays','nameplate'],'workingHandOverlays':'compatibility alias now contains full sleeves and arms, not skin-only hands','sourceClip':'entire original160x216 cell; alpha mask defines arms, never use rectangular source clipping inside visible silhouette'}
M['drawingOrder']=['background','chair + desk back full furniture','actor body (only horizontal rear-edge occlusion)','desk front tabletop, excluding upper-left chair','armOverlays: sleeves/forearms/hands or phone/head, same pose transform','nameplate','beanbag groups sorted byY','effects','HTML context header'];(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));(R/'src/arm-overlay-masks.json').write_text(json.dumps(masks,indent=2))
# Comparison compositor.
def compose(p,actor,state,frame):
 w,h=M['assets'][p['back']]['size'];pad=80;out=Image.new('RGBA',(w,h+pad+20));out.alpha_composite(Image.open(R/M['assets'][p['back']]['sourceFile']).convert('RGBA'),(0,pad));sourceId=M['actors'][actor][state];a=Image.open(R/'src/sheets'/(sourceId+'.png')).convert('RGBA').crop((frame*160,0,(frame+1)*160,216));f=p['actorHeight']/216;adj=p['actorOffsets'].get(actor,{}).get(state,[0,0]);x=round(p['seat'][0]-p['actorAnchor'][0]*f+adj[0]);y=round(p['seat'][1]-p['actorAnchor'][1]*f+p['actorStateYOffset'][state]+adj[1])+pad;size=(round(160*f),round(216*f));layer=Image.new('RGBA',out.size);layer.alpha_composite(a.resize(size,Image.Resampling.LANCZOS),(x,y));layer.paste((0,0,0,0),(0,p['tableRearY']+pad+2,w,out.height));out.alpha_composite(layer);out.alpha_composite(Image.open(R/M['assets'][p['front']]['sourceFile']).convert('RGBA'),(0,pad));overlay=Image.open(R/'src/sheets'/(armMap[actor][state]+'.png')).convert('RGBA').crop((frame*160,0,(frame+1)*160,216));out.alpha_composite(overlay.resize(size,Image.Resampling.LANCZOS),(x,y));return out
W=360;H=370;review=Image.new('RGB',(W*6,H*21),(242,229,207));d=ImageDraw.Draw(review)
for pod,p in enumerate(M['pods'].values()):
 for actor in range(6):
  row=pod*6+actor
  for col,(state,fi) in enumerate([('working',i) for i in range(4)]+[('phone',0),('sleeping',0)]):
   im=compose(p,'actor-'+str(actor),state,fi);im.thumbnail((355,340),Image.Resampling.LANCZOS);review.paste(im,(col*W,row*H+25),im);d.text((col*W+4,row*H+4),f'pod{pod} actor{actor} {state} {fi}',fill='black')
for row,(kind,p) in enumerate(M['leadDesks'].items()):
 for col,(state,fi) in enumerate([('working',i) for i in range(4)]+[('phone',0),('sleeping',0)]):
  im=compose(p,'orchestrator',state,fi);im.thumbnail((355,340),Image.Resampling.LANCZOS);review.paste(im,(col*W,(18+row)*H+25),im);d.text((col*W+4,(18+row)*H+4),f'lead {kind} {state} {fi}',fill='black')
review.save(R/'review/desk-compose.png')
for i in range(3):review.crop((0,i*6*H,W*6,(i+1)*6*H)).save(R/'review'/f'desk-compose-pod{i}.png')
review.crop((0,18*H,W*6,21*H)).save(R/'review/desk-compose-manager.png')
detail=Image.new('RGB',(1200,6*210),(242,229,207));d=ImageDraw.Draw(detail);p=M['pods']['0']
for row in range(6):
 for fi in range(4):
  im=compose(p,'actor-'+str(row),'working',fi);rear=p['tableRearY']+80;crop=im.crop((75,rear-80,300,rear+55)).resize((300,180),Image.Resampling.LANCZOS);detail.paste(crop,(fi*300,row*210+25),crop);d.text((fi*300+4,row*210+4),f'actor{row} shoulder -> hands f{fi}',fill='black')
detail.save(R/'review/typing-hands-detail.png');after=sum(p.stat().st_size for p in (R/'runtime').glob('*.webp'));print('sheets',len(M['sheets']),'frames',sum(s['frames'] for s in M['sheets'].values()),'runtime',after);(R/'arm-overlay-report.json').write_text(json.dumps({'beforeBytes':before,'afterBytes':after,'armActors':7,'armStates':3,'frontLeftChairRemoved':True,'sourceLeftClipRemoved':True},indent=2))
