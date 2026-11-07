from pathlib import Path
from PIL import Image,ImageDraw
import json,math,shutil
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text())
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:0 if a<24 else a));b=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();return im.crop(b)
def save_sheet(id,im):
 s=M['sheets'][id];im.save(R/'src/sheets'/(id+'.png'));w=s['frameW'];h=s['frameH'];out=Image.new('RGBA',(w*5//8*s['frames'],h*5//8))
 for i in range(s['frames']):out.alpha_composite(im.crop((i*w,0,(i+1)*w,h)).resize((w*5//8,h*5//8),Image.Resampling.LANCZOS),(i*w*5//8,0))
 out.save(R/s['file'],'WEBP',quality=85,alpha_quality=100,method=6)
for id,rawid in [('attention','attention-vqa'),('flame_aura','flame-vqa')]:
 s=M['sheets'][id];raw=Image.open(R/'src/generated'/(rawid+'.png'));n=s['frames'];cells=[clean(raw.crop((round(i*raw.width/n),0,round((i+1)*raw.width/n),raw.height))) for i in range(n)];fw=s['frameW'];fh=s['frameH'];sheet=Image.new('RGBA',(fw*n,fh));mw,mh=(68,80) if id=='attention' else (72,106);scale=min(mw/max(c.width for c in cells),mh/max(c.height for c in cells))
 for i,c in enumerate(cells):
  c=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.LANCZOS);sheet.alpha_composite(c,(i*fw+round(fw/2-c.width/2),s['anchor'][1]-c.height))
 save_sheet(id,sheet)
M['effectPlacement']={'attention':{'sheet':'attention','anchor':'sheet.anchor bottom-center','position':'current rendered pose headTopCenter + [0,-10] logical px; never station foot minus fixed height','preferredDisplayHeight':64},'flame_aura':{'sheet':'flame_aura','target':'torso, not head','maxDisplayWidthRatioToActor':0.6,'placement':'align aura bottom to torso waist; behind actor','clip':'intersect actor body silhouette expansion and exclude monitor silhouette; desk-back contains monitor so draw order alone cannot protect it'},'zzz':{'position':'current pose head upper-left empty space; avoid monitor bounding box'}}
def save_asset(id,im):
 a=M['assets'][id];im.putalpha(im.getchannel('A').point(lambda a:0 if a<16 else a));im.save(R/a['sourceFile']);w,h=a['size'];pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;p=Image.new('RGBA',(pw,ph));p.alpha_composite(im);p.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS).save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6)
# Use cleaned generation, registered to the previous furniture silhouette extent.
cleanLead=clean(Image.open(R/'src/generated/lead-cleanup-vqa.png'))
for kind,p in M['leadDesks'].items():
 a=M['assets'][p['back']];w,h=a['size'];full=Image.new('RGBA',(w,h));full.alpha_composite(cleanLead.resize((w,h-64),Image.Resampling.LANCZOS),(0,64));cut=p['frontOcclusionY'];back=full.copy();front=Image.new('RGBA',full.size);front.paste(full.crop((0,cut,w,h)),(0,cut));back.paste((0,0,0,0),(0,cut,w,h))
 for x0,x1 in [(0,round(w*.26)),(round(w*.65),w)]:
  front.paste(full.crop((x0,0,x1,cut)),(x0,0));back.paste((0,0,0,0),(x0,0,x1,cut))
 save_asset(p['back'],back);save_asset(p['front'],front);p['alphaCleanup']='cleaned generated furniture, bbox registered; alpha<24 removed before scale'
# Final large-room corner: retain every pixel outside local rectangle.
id='background-large';a=M['assets'][id];im=Image.open(R/a['sourceFile']).convert('RGBA');backup=R/'src/modules/background-large-before-vqa.png'
if not backup.exists():im.save(backup)
new=Image.open(R/'src/generated/corner-vqa.png').convert('RGBA').resize(im.size,Image.Resampling.LANCZOS);box=(1000,1030,im.width,im.height);im.paste(new.crop(box),box[:2]);save_asset(id,im)
# Brand originals are copied, never edited; generated neutral fallback fills unsupported mappings.
icons={}
for provider in ['claude','codex','antigravity','copilot','muse','opencode']:
 source=R.parent/'reference/provider-icons'/(provider+'-64.png');dest=R/'src/modules'/('provider-icon-'+provider+'.png');shutil.copyfile(source,dest);im=Image.open(dest).convert('RGBA');file='runtime/provider-icon-'+provider+'.webp';im.resize((40,40),Image.Resampling.LANCZOS).save(R/file,'WEBP',quality=85,alpha_quality=100,method=6);key='provider-icon-'+provider;M['assets'][key]={'file':file,'size':[64,64],'sourceFile':str(dest.relative_to(R)),'runtimeSize':[40,40],'runtimePaddedLogicalSize':[64,64]};icons[provider]=key
im=clean(Image.open(R/'src/generated/provider-fallback-vqa.png')).resize((64,64),Image.Resampling.LANCZOS);dest=R/'src/modules/provider-icon-default.png';im.save(dest);file='runtime/provider-icon-default.webp';im.resize((40,40),Image.Resampling.LANCZOS).save(R/file,'WEBP',quality=85,alpha_quality=100,method=6);M['assets']['provider-icon-default']={'file':file,'size':[64,64],'sourceFile':str(dest.relative_to(R)),'runtimeSize':[40,40],'runtimePaddedLogicalSize':[64,64]};icons.update(gemini='provider-icon-default',orchestrator='provider-icon-default',default='provider-icon-default');M['providerIcons']=icons
for id,s in M['sheets'].items():
 if 'walk_left' in id or 'walk_right' in id:s['locomotion']={'cycleDistance':128,'referenceActorHeight':216,'stepsPerCycle':2,'cycleSeconds':s['frames']/s['fps'],'speedAtReferenceHeight':128*s['fps']/s['frames'],'speedFormula':'cycleDistance * fps / frames * renderedActorHeight / referenceActorHeight','calibration':'visual stride estimate, not motion-capture root motion'}
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));print('runtime bytes',sum(p.stat().st_size for p in (R/'runtime').glob('*.webp')))
