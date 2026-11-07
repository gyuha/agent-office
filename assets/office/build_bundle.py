"""Package original generated v10 assets and replaceable animation sheets."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import json,shutil,math
ROOT=Path(__file__).resolve().parent;V10=ROOT.parent/'mockups/v10'
for folder in ['runtime','src/v10','src/sheets','src/generated','review']:(ROOT/folder).mkdir(parents=True,exist_ok=True)
manifest=json.loads((V10/'layout.json').read_text());manifest['bundleVersion']=1
manifest['drawingOrder']=['background','orchestrator actor','lead-front occlusion','upper body/hand clip','depth-sort pods and walkers by feet Y','pod-back','flame_aura','actor state','pod-front','upper body/hand clip','effects','HTML context header and nameplates']
manifest['stateContract']={'states':['working','away','phone','sleeping'],'needsAttention':'independent boolean; draw attention effect above current state','walking':'auxiliary locomotion, use walk_left/walk_right while traveling','away':'rest-area seated pose; place on the existing sofa; same feet anchor','nativeActorFrame':[320,432],'runtimeActorFrame':[160,216],'runtimeActorAnchor':[80,205],'assetGeometry':'assets.size and layout remain v10 native logical coordinates; runtimeSize is actual WebP size; sheets dimensions are actual source pixels','reservedRuntimePrefix':'runtime/'}
for key,a in manifest['assets'].items():
 src=V10/a['file'];copy=ROOT/'src/v10'/src.name;shutil.copyfile(src,copy);im=Image.open(src).convert('RGBA')
 limit=960 if key.startswith('background-') else 320 if key.endswith('-sheet') else 128 if key.startswith('actor-') else 320 if key.startswith('lead-front') else 256
 if im.width>limit:im=im.resize((limit,round(im.height*limit/im.width)),Image.Resampling.LANCZOS)
 dest=ROOT/'runtime'/('static-'+key+'.webp');im.save(dest,'WEBP',quality=83,method=6,alpha_quality=100)
 a['file']=str(dest.relative_to(ROOT));a['sourceFile']=str(copy.relative_to(ROOT));a['runtimeSize']=list(im.size)
manifest['sheets']={};manifest['actors']={};manifest['effects']={};manifest['defaultActor']='actor-0'
SPECS={}
def register(id,source,fw,fh,anchor,fps,loop=True):
 manifest['sheets'][id]={'file':'runtime/'+id+'.webp','frameW':fw,'frameH':fh,'frames':1,'fps':fps,'loop':loop,'anchor':anchor}
 im=Image.open(source).convert('RGBA');im.thumbnail((fw,fh),Image.Resampling.LANCZOS);out=Image.new('RGBA',(fw,fh));out.alpha_composite(im,((fw-im.width)//2,fh-im.height));out.save(ROOT/'src/sheets'/(id+'.png'));out.save(ROOT/'runtime'/(id+'.webp'),'WEBP',quality=85,method=6,alpha_quality=100)
 SPECS[id]={'source':str(source),'frame':[fw,fh],'anchor':anchor}
for who in list(map(str,range(6)))+['orchestrator']:
 actor='actor-'+who if who!='orchestrator' else 'orchestrator';v='lead' if who=='orchestrator' else who;states=['working','phone','sleeping','walk_left','walk_right','away'];mapping={}
 for state in states:
  id=actor+'-'+state;old={'walk_left':'walking-left','walk_right':'walking-right','away':'phone'}.get(state,state);register(id,V10/'parts'/('actor-'+v+'-'+old+'-0.png'),160,216,[80,205],{'working':8,'phone':3,'sleeping':1.5,'walk_left':8,'walk_right':8,'away':2}[state]);mapping[state]=id
 manifest['actors'][actor]=mapping
fx={'flame_aura':('flame-0',128,160,[64,144],8,True),'pop_plus3':('points-3',96,80,[48,72],4,False),'pop_plus10':('points-10',96,80,[48,72],4,False),'bubble_done':('bubble-done',128,96,[64,90],1,False),'bubble_prup':('bubble-pr',128,96,[64,90],1,False),'zzz':('zzz',96,80,[48,72],2,True),'attention':('emphasis',80,96,[40,88],3,True)}
for id,(old,w,h,anchor,fps,loop) in fx.items():register(id,V10/'parts'/(old+'.png'),w,h,anchor,fps,loop);manifest['effects'][id]=id
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(ROOT/'src/packing-spec.json').write_text(json.dumps(SPECS,indent=2))
# A frozen contract verifies stage 2 only changes sheet file/frames.
(ROOT/'src/stage1-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('sheets',len(manifest['sheets']),'runtime bytes',sum(p.stat().st_size for p in (ROOT/'runtime').glob('*')))
