from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,math,shutil
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());a=M['assets']['background-large'];target=R/a['sourceFile'];backup=R/'src/modules/background-large-before-vqa031.png'
if not backup.exists():shutil.copyfile(target,backup)
original=Image.open(backup).convert('RGBA');generated=Image.open(R/'src/generated/background-large-vqa031.png').convert('RGBA');assert generated.size==original.size;w,h=original.size
rows=[]
for y in range(h-80,h):
 pixels=[generated.getpixel((x,y)) for x in range(0,w,8)];ratio=sum(1 for r,g,b,aa in pixels if r<170 and g<115 and b<95)/len(pixels)
 if ratio>.85:rows.append(y)
assert rows,'no dark full-width trim';start=max(h-80,rows[0]-2);strip=generated.crop((0,start,w,h)).resize((w,20),Image.Resampling.LANCZOS);out=original.copy();out.alpha_composite(strip,(0,h-20));assert ImageChops.difference(out.crop((0,0,w,h-20)),original.crop((0,0,w,h-20))).getbbox() is None;out.save(target)
pw=math.ceil(w/8)*8;ph=math.ceil(h/8)*8;padded=Image.new('RGBA',(pw,ph));padded.alpha_composite(out);padded.resize((pw*5//8,ph*5//8),Image.Resampling.LANCZOS).save(R/a['file'],'WEBP',quality=85,alpha_quality=100,method=6)
updatedAliases=[]
for path in (R/'runtime').glob('static-background-large*.webp'):shutil.copyfile(R/a['file'],path);updatedAliases.append(str(path.relative_to(R)))
for kind in ['small','medium','large']:
 a=M['assets']['background-'+kind];sw,sh=a['size'];native=20 if kind=='large' else 24;worldH=1536 if kind=='large' else 1024
 a['bottomTrim']={'anchor':'bottom','height':24,'coordinateSpace':'1536-wide room logical pixels','sourceRect':[0,sh-native,sw,native],'sourceHeight':native,'destinationHeight':24,'mode':'fixed-height; never stretch with floor','sourceYFormula':'size[1]-sourceHeight','runtimeRect':[0,(sh-native)*.625,sw*.625,native*.625],'note':'runtime coordinates exclude padded rows; fractional source crop is intentional'}
M['backgroundTrim']={'wallHeight':400,'bottomTrimHeight':24,'coordinateSpace':'room world logical pixels','draw':'keep bottomTrim at sceneY+sceneHeight-24; stretch only middle floor','perAsset':'assets[background-key].bottomTrim','legacySceneCompatibility':'current hardcoded trim24 already samples the correct bottom band; sourceRect can replace hardcoded source scale for explicit handling'}
(R/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));runtime=Image.open(R/M['assets']['background-large']['file']);assert runtime.size==(785,785);runtime.crop((0,705,785,785)).save(R/'review/background-large-bottom.png')
review=Image.new('RGB',(1800,150),(242,229,207));d=ImageDraw.Draw(review)
for i,kind in enumerate(['small','medium','large']):
 im=Image.open(R/M['assets']['background-'+kind]['file']).convert('RGBA');im=im.crop((0,im.height-80,im.width,im.height)).resize((600,100),Image.Resampling.LANCZOS);review.paste(im,(i*600,30),im);d.text((i*600+6,8),kind+' / final runtime bottom trim',fill='black')
review.save(R/'review/vqa031-bottom-trim.png');(R/'vqa031-report.json').write_text(json.dumps({'editedNativeRows':[h-20,h],'unchangedAboveRow':h-20,'sourceGeneratedTrimStart':start,'runtimeSize':[785,785],'updatedStaticAliases':updatedAliases,'assetBottomTrim':M['assets']['background-large']['bottomTrim']},indent=2));print(M['assets']['background-large']['bottomTrim'])
