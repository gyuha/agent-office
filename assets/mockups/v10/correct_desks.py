"""Apply only the generated desk-panel/monitor edits. No pixels are painted or recolored."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
R=Path(__file__).resolve().parent;S=R/'source';B=S/'before-desk-fix'
def apply(target,generated,regions,keep_green=False):
 old=Image.open(B/(target+'.png')).convert('RGBA');new=Image.open(S/(generated+'.png')).convert('RGBA');assert old.size==new.size
 mask=Image.new('L',old.size);d=ImageDraw.Draw(mask)
 for region in regions:d.polygon(region,fill=255)
 if target=='pods':
  # Use the union of opaque furniture silhouettes, keeping the existing soft shadows.
  m=mask.load();oa=old.getchannel('A').load();na=new.getchannel('A').load()
  for y in range(old.height):
   for x in range(old.width):
    if m[x,y] and oa[x,y]<90 and na[x,y]<90:m[x,y]=0
 if keep_green:
  # Keep the exact original plant pixels where leaves hang over a desk panel.
  pix=old.load();m=mask.load()
  for y in range(old.height):
   for x in range(old.width):
    if m[x,y]:
     r,g,b,a=pix[x,y]
     plant_zone=target!='pods' or (420<=x<=500 and 420<=y<=560) or (920<=x<=1005 and 420<=y<=560) or (1420<=x<=1512 and 420<=y<=630)
     if plant_zone and g>r*.94 and g>b*1.12:m[x,y]=0
 final=Image.composite(new,old,mask);final.save(S/(target+'.png'))
 return {'target':target,'generated':generated,'regions':regions,'outsideMaskUnchanged':True}
records=[]
records.append(apply('pods','pods-facing-inward',[
 # One continuous generated apron per desk, keep original outer legs/desktop.
 [(78,602),(443,602),(443,707),(78,707)],
 [(571,602),(945,602),(945,707),(571,707)],
 [(1081,602),(1450,602),(1450,707),(1081,707)],
 # Monitor back cases, stands and short cables. Leave accessory clusters intact.
 [(270,350),(445,350),(445,550),(270,550)],
 [(768,350),(939,350),(939,550),(768,550)],
 [(1272,350),(1445,350),(1445,550),(1272,550)]
],True))
records.append(apply('bg-small','bg-small-desk-corrected',[
 [(574,323),(1034,323),(1034,393),(574,393)],
 [(889,194),(1000,194),(1000,302),(889,302)]
],True))
records.append(apply('bg-medium','bg-medium-desk-corrected',[
 [(574,290),(1019,290),(1019,358),(574,358)],
 [(887,162),(996,162),(996,273),(887,273)]
],True))
records.append(apply('bg-large-final','bg-large-final-desk-corrected',[
 [(463,284),(872,284),(872,344),(463,344)],
 [(723,167),(824,167),(824,264),(723,264)]
],True))
(R/'desk-fix-regions.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
print('Applied generated edits to 4 sources; unrelated pixels preserved')
