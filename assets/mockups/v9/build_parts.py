"""Regenerate original pixel modules; Pillow only. Run from repository root."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'parts'
reference=Image.open(ROOT.parent/'v8/office-c.png').convert('RGB')
# Sampling is only for a fixed color palette; no reference pixels are copied as artwork.
q=reference.quantize(colors=24,method=Image.Quantize.MEDIANCUT)
PAL=[tuple(q.getpalette()[i:i+3]) for i in range(0,72,3)]
# Preserve three semantic hues lost by frequency-only quantization.
samples=set(reference.getdata())
for slot,target in zip((21,22,23),((106,147,91),(100,140,175),(149,116,141))):
 PAL[slot]=min(samples,key=lambda p:sum((a-b)**2 for a,b in zip(p,target)))
def nearest(hex):
 h=hex.lstrip('#');rgb=tuple(int(h[i:i+2],16) for i in (0,2,4));return min(PAL,key=lambda p:sum((a-b)**2 for a,b in zip(rgb,p)))+(255,)
COL={k:nearest(v) for k,v in dict(ink='#293541',wood='#96634b',edge='#6f493c',floor='#f5d4a6',cream='#fff0ce',wall='#e1dfb8',green='#6a935b',leaf='#a8c87e',blue='#648caf',plum='#95748d',gold='#f2bd62',skin='#f5c39b',hair='#60463c',white='#fff4dd',red='#d67652').items()}
img=None;d=None
META={}
def begin(w,h):
 global img,d
 img=Image.new('RGBA',(w,h));d=ImageDraw.Draw(img)
def r(x,y,w,h,col):d.rectangle((int(x),int(y),int(x+w-1),int(y+h-1)),fill=COL.get(col,col))
def poly(points,col):d.polygon(points,fill=COL.get(col,col))
def save(name,anchor,layer,footprint=None):
 # All opaque pixels map to the same fixed 24-color palette; alpha remains binary.
 pixels=img.load()
 for y in range(img.height):
  for x in range(img.width):
   p=pixels[x,y]
   if p[3]:pixels[x,y]=min(PAL,key=lambda c:sum((a-b)**2 for a,b in zip(c,p[:3])))+(255,)
 img.save(OUT/(name+'.png'));META[name]={'file':'parts/'+name+'.png','size':list(img.size),'anchor':anchor,'layer':layer}
 if footprint:META[name]['footprint']=footprint
# floor and repeating back and side wall tiles
begin(16,16);r(0,0,16,16,'floor');r(0,15,16,1,'gold');r(15,0,1,16,'gold');save('room_floor',[0,0],0)
begin(64,96);r(0,0,64,96,'wall');r(0,0,64,5,'cream');r(0,89,64,7,'wood');r(2,8,60,3,'cream');r(8,17,48,57,'edge');r(11,20,42,50,'cream');r(14,23,36,44,'blue');r(15,24,15,23,'white');r(17,29,13,18,'cream');r(15,51,33,12,'leaf');r(20,45,8,16,'green');r(38,38,7,25,'green');r(30,23,3,44,'cream');r(14,47,36,3,'cream');r(6,74,52,5,'wood');save('room_back_window',[0,0],10)
begin(16,16);r(0,0,12,16,'edge');r(0,0,4,16,'cream');r(12,0,4,16,'wood');save('room_side',[0,0],10)
begin(16,16);r(0,0,16,16,'wood');r(0,0,16,4,'cream');save('room_front',[0,0],10)
# split desk pod: back chair, actor slot, foreground table and monitor
for lead in (False,True):
 name='lead' if lead else 'pod';w,h=(128,96) if lead else (96,80);cx=w//2;ay=h-8
 begin(w,h);r(cx-19,ay-44,38,32,'edge');r(cx-16,ay-42,32,29,'gold' if lead else 'blue');r(cx-16,ay-9,32,8,'ink');r(cx-21,ay-6,42,3,'ink');r(cx-3,ay-2,6,8,'ink');r(cx-20,ay+5,40,3,'edge');save(name+'_chair',[cx,ay],20)
 begin(w,h);left=6;right=w-7;top=ay-32
 r(left+8,ay-6,6,14,'edge');r(right-10,ay-6,6,14,'edge');poly([(left,top),(right-12,top),(right,top+17),(left+12,top+17)],'gold' if lead else 'cream');poly([(left+12,top+17),(right,top+17),(right,top+22),(left+12,top+22)],'wood');r(cx-20,top+6,24,5,'ink');r(cx-18,top+7,20,1,'white')
 # monitor to actor's right, character hands remain visible to its left
 mx=cx+9;my=ay-58;r(mx+13,my+24,4,9,'edge');r(mx+6,my+32,23,3,'edge');r(mx,my,35,25,'ink');r(mx+3,my+3,29,18,'blue');r(mx+6,my+6,18,2,'cream');r(mx+6,my+11,22,2,'leaf');r(mx+6,my+16,11,2,'cream');r(left+12,top+2,7,9,'plum');r(left+11,top+1,9,2,'white');save(name+'_desk',[cx,ay],40,[w-12,40])
# props all snapped to 16px bounding frames
begin(32,64);r(9,46,16,16,'wood');r(7,44,20,5,'gold');r(15,16,3,30,'green');r(3,23,13,9,'green');r(18,15,12,10,'leaf');r(7,7,11,14,'green');r(18,32,10,7,'leaf');save('prop_plant',[16,60],30)
begin(64,80);r(2,5,60,72,'edge');r(5,8,54,66,'wood')
for y in (12,32,52):
 r(7,y,50,16,'ink')
 for i in range(7):r(9+i*7,y+2+(i%3),5,14-i%3,['leaf','gold','plum','blue'][i%4])
 r(5,y+17,54,3,'cream')
save('prop_bookshelf',[32,76],30)
begin(96,64);r(4,3,88,45,'wood');r(7,6,82,39,'cream');r(13,13,25,3,'blue');r(48,13,24,3,'blue');r(34,16,3,13,'blue');r(24,27,36,2,'blue');r(16,34,10,8,'gold');r(33,34,10,8,'green');r(50,34,10,8,'plum');r(14,48,4,16,'edge');r(77,48,4,16,'edge');save('prop_whiteboard',[48,60],30)
begin(96,64);r(8,10,77,37,'plum');r(12,14,32,29,'blue');r(48,14,32,29,'blue');r(5,25,9,27,'plum');r(81,25,10,27,'plum');r(15,45,65,10,'plum');r(15,55,6,7,'wood');r(76,55,6,7,'wood');r(19,21,18,13,'cream');save('prop_sofa',[48,60],30)
begin(64,96);r(6,4,51,85,'edge');r(9,7,45,78,'cream');r(12,11,38,20,'white');r(12,35,38,46,'leaf');r(12,39,38,3,'green');r(12,56,38,3,'green');r(12,73,38,3,'green');r(8,84,6,10,'wood');r(49,84,6,10,'wood');save('prop_bed',[32,92],30)
begin(64,48);poly([(3,9),(49,9),(61,23),(15,23)],'cream');r(15,23,46,5,'wood');r(18,28,5,16,'wood');r(51,28,5,16,'wood');r(22,12,14,6,'blue');r(44,13,7,7,'plum');save('prop_coffee',[32,44],30)
# Bitmap font atlas. Rendering in 1-bit produces one consistent logical pixel grid.
# Hard-edged 5x7 glyphs, same grid as sprites. Lowercase aliases uppercase.
GLYPHS={
'A':['01110','10001','10001','11111','10001','10001','10001'],
'B':['11110','10001','10001','11110','10001','10001','11110'],
'C':['01111','10000','10000','10000','10000','10000','01111'],
'D':['11110','10001','10001','10001','10001','10001','11110'],
'E':['11111','10000','10000','11110','10000','10000','11111'],
'F':['11111','10000','10000','11110','10000','10000','10000'],
'G':['01111','10000','10000','10111','10001','10001','01111'],
'H':['10001','10001','10001','11111','10001','10001','10001'],
'I':['11111','00100','00100','00100','00100','00100','11111'],
'J':['00111','00010','00010','00010','10010','10010','01100'],
'K':['10001','10010','10100','11000','10100','10010','10001'],
'L':['10000','10000','10000','10000','10000','10000','11111'],
'M':['10001','11011','10101','10101','10001','10001','10001'],
'N':['10001','11001','10101','10011','10001','10001','10001'],
'O':['01110','10001','10001','10001','10001','10001','01110'],
'P':['11110','10001','10001','11110','10000','10000','10000'],
'Q':['01110','10001','10001','10001','10101','10010','01101'],
'R':['11110','10001','10001','11110','10100','10010','10001'],
'S':['01111','10000','10000','01110','00001','00001','11110'],
'T':['11111','00100','00100','00100','00100','00100','00100'],
'U':['10001','10001','10001','10001','10001','10001','01110'],
'V':['10001','10001','10001','10001','10001','01010','00100'],
'W':['10001','10001','10001','10101','10101','10101','01010'],
'X':['10001','10001','01010','00100','01010','10001','10001'],
'Y':['10001','10001','01010','00100','00100','00100','00100'],
'Z':['11111','00001','00010','00100','01000','10000','11111'],
'0':['01110','10001','10011','10101','11001','10001','01110'],
'1':['00100','01100','00100','00100','00100','00100','01110'],
'2':['01110','10001','00001','00010','00100','01000','11111'],
'3':['11110','00001','00001','01110','00001','00001','11110'],
'4':['00010','00110','01010','10010','11111','00010','00010'],
'5':['11111','10000','10000','11110','00001','00001','11110'],
'6':['01110','10000','10000','11110','10001','10001','01110'],
'7':['11111','00001','00010','00100','01000','01000','01000'],
'8':['01110','10001','10001','01110','10001','10001','01110'],
'9':['01110','10001','10001','01111','00001','00001','01110'],
'+':['00000','00100','00100','11111','00100','00100','00000'],
'/':['00001','00001','00010','00100','01000','10000','10000'],
'.':['00000','00000','00000','00000','00000','00110','00110'],
':':['00000','00110','00110','00000','00110','00110','00000'],
'%':['11001','11010','00010','00100','01000','01011','10011'],
'!':['00100','00100','00100','00100','00100','00000','00100'],
'|':['00100','00100','00100','00100','00100','00100','00100']}
def pixel_text(s,x,y,col):
 for j,ch in enumerate(s.upper()):
  for yy,row in enumerate(GLYPHS.get(ch,[])):
   for xx,v in enumerate(row):
    if v=='1':r(x+j*6+xx,y+yy,1,1,col)
begin(768,16)
for code in range(32,128):pixel_text(chr(code),(code-32)*8,1,'cream')
save('font_ascii',[0,0],100)
# sprite rows: work, walk down/up/left/right, sleep, phone. 4 cols, 7 rows.
for variant in range(5):
 begin(48*4,64*7)
 for row in range(7):
  for f in range(4):
   ox=f*48;oy=row*64;walk=row in (1,2,3,4);sleep=row==5;phone=row==6
   coat=['green','blue','plum','red','gold'][variant];hair=['hair','ink','wood','plum','white'][variant];skin='skin';bob=(f%2 if walk or row==0 else 0);hy=oy+8+bob+(9 if sleep else 0);cx=ox+24
   # 2.5-head body with short substantial legs.
   stride=[-3,0,3,0][f] if walk else 0
   r(cx-10,oy+46,8,11+stride,'ink');r(cx+3,oy+46,8,11-stride,'ink');r(cx-12,oy+55+stride,12,4,'edge');r(cx+3,oy+55-stride,12,4,'edge');r(cx-13,oy+31+bob,27,19,coat);r(cx-11,hy,23,22,skin);r(cx-15,hy+8,4,10,skin);r(cx+12,hy+8,4,10,skin)
   r(cx-11,hy,23,6,hair);r(cx-14,hy+3,6,12,hair);r(cx+9,hy+4,6,8,hair)
   if variant in (0,2):r(cx-8,hy-3,15,6,hair)
   if row==2:r(cx-11,hy+6,23,15,hair)
   elif row in (3,4):
    side=-1 if row==3 else 1;r(cx+side*8,hy+12,3,4,'ink');r(cx+side*12,hy+14,4,4,skin)
   else:
    if sleep:r(cx-7,hy+13,5,2,'ink');r(cx+4,hy+13,5,2,'ink')
    else:r(cx-7,hy+11,3,4,'ink');r(cx+5,hy+11,3,4,'ink');r(cx-1,hy+18,4,2,'edge')
   if variant==4 and row!=2:r(cx-9,hy+9,8,7,'ink');r(cx+3,hy+9,8,7,'ink');r(cx-2,hy+10,5,2,'ink');r(cx-2,oy+33,5,12,'plum')
   if row==0:
    r(cx-19,oy+34+f%2*2,9,9,coat);r(cx-17,oy+42+f%2*2,15,5,skin);r(cx+10,oy+34+(1-f%2)*2,9,9,coat);r(cx+3,oy+42+(1-f%2)*2,14,5,skin)
   elif phone:
    r(cx-16,oy+36,12,8,coat);r(cx+9,oy+29,9,15,coat);r(cx-3,oy+27,12,19,'ink');r(cx,oy+30,6,12,'gold');r(cx,oy+32+(f%2)*4,6,2,'cream');r(cx+8,oy+35+(f%2)*2,5,5,skin)
   elif sleep:r(cx-20,oy+43,20,8,coat);r(cx,oy+43,20,8,coat)
   else:
    r(cx-18,oy+32+stride,6,17,coat);r(cx+13,oy+32-stride,6,17,coat);r(cx-18,oy+47+stride,6,4,skin);r(cx+13,oy+47-stride,6,4,skin)
 save('actor_v'+str(variant),[24,60],35)
# Effects; all independent of the actors.
begin(256,64)
for f in range(4):
 for j in range(12):
  x=f*64+j*5+2;y=5+(j*7+f*5)%24;r(x,y,4,59-y,'red');r(x+1,y+5,2,max(1,52-y),'gold');r(x,y-4,2,3,'gold')
save('fx_flame',[32,60],32)
begin(192,16)
for f in range(4):
 r(f*48+7,3+f%2,10,4,'skin');r(f*48+22,4-f%2,10,4,'skin')
save('actor_hands',[24,16],45)
# Use same bitmap glyphs for authored effect labels.
def label(s,x,y,color='ink'):
 pixel_text(s,x,y,color)
begin(128,32)
for f in range(4):label('+3' if f%2==0 else '+10',f*32+4,6,'gold')
save('fx_points',[16,20],60)
begin(128,32)
for f in range(2):
 r(f*64+1,2,61,23,'ink');r(f*64+3,4,57,19,'cream');r(f*64+27,25,6,5,'ink');r(f*64+28,24,4,4,'cream');label('Done!' if f==0 else 'PR up!',f*64+12,9)
save('fx_bubble',[32,30],60)
begin(64,32)
for f in range(2):label('Zzz',f*32+3,4-f*2,'plum')
save('fx_zzz',[16,20],60)
for name,h in [('top',32),('bottom',32)]:
 begin(16,h);r(0,0,16,h,'ink');r(0,0,16,2,'gold');r(0,h-2,16,2,'edge');save('hud_'+name,[0,0],100)
# Palette documentation asset.
begin(16*24,16)
for i,color in enumerate(PAL):r(i*16,0,16,16,color+(255,))
save('palette',[0,0],0)
layout={'version':1,'grid':{'tile':16,'renderScale':2,'pixel':'1 logical pixel = 2 CSS pixels; integer nearest-neighbor only','view':'3/4 parallel projection, x horizontal, y floor depth'},'palette':['#%02x%02x%02x'%c for c in PAL],'colors':{k:'#%02x%02x%02x'%v[:3] for k,v in COL.items()},'modules':META,'actor':{'frame':[48,64],'anchor':[24,60],'columns':4,'rows':{'working':0,'walking-down':1,'walking-up':2,'walking-left':3,'walking-right':4,'sleeping':5,'phone':6},'frames':{'working':[0,1,2,3],'walking':[0,1,2,3],'sleeping':[0,1],'phone':[0,1]},'fps':{'working':8,'walking':8,'sleeping':1,'phone':3},'variants':5,'providerMark':{'location':'nameplate left strip and monitor screen','claude':'green','codex':'blue','gemini':'plum'},'slot':'actor anchor equals desk and chair anchor; lead uses actor_v4'},'layout':{'minN':1,'maxN':16,'columns':'N<=3 ? N : N<=6 ? 3 : 4','rows':'ceil(N/columns)','width':'224+columns*128','height':'max(512,224+rows*128)','podOrigin':[224,256],'podStep':[128,128],'podAnchor':'[224+(i%columns)*128,256+floor(i/columns)*128]','leadAnchor':'[width/2,144]','walkLane':'pod anchor → [x,y+48] → [x+64,y+48] → [x+64,208] → target; reverse for return','targets':{'whiteboard':'[width-80,208]','orchestrator':'[width/2+88,208]'},'rest':'left strip x=32..144, sofa y=240; coffee y=320; bed at [88,height-48]','aisles':{'horizontal':32,'row':48,'rear':48},'labels':'pod anchor + [0,18], [0,29]; manager anchor+[0,22]'},'drawing':['floor','repeat rear and side walls','depth-sort props and pod composites by foot y','per pod: chair → aura → actor → desk → phone overlay if needed → provider mark','world-space points, bubble and Zzz','HUD in viewport, outside world canvas'],'states':{'default':'working','autoAgent0':'0..3 working;3..5 phone;5..7 sleeping;7..12 working; repeat','idleSleepAfterSeconds':12,'crossfadeSeconds':0.35,'walkCycle':'working only, first 10 seconds seated; then one reserved visitor per 16-second cycle, actor (2+cycleIndex)%N,4..7 outbound,7..8 visit,8..11 return','walkSpeed':'path uses normalized arc length, no teleport','sleep':'slump at own desk; bed is rest prop, bed animation reserved'}}
layout['effects']={'flame':{'frame':[64,64],'count':4,'anchor':[32,60],'fps':7},'points':{'frame':[32,32],'count':4,'anchor':[16,20],'duration':1.5},'bubble':{'frame':[64,32],'count':2,'anchor':[32,30],'duration':1.4},'zzz':{'frame':[32,32],'count':2,'anchor':[16,20],'fps':1},'hands':{'frame':[48,16],'count':4,'anchor':[24,16],'slotOffset':[0,-14],'fps':8}}
(ROOT/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2))
(ROOT/'layout-data.js').write_text('window.OFFICE_LAYOUT='+json.dumps(layout,ensure_ascii=False)+';')
print('Generated',len(META),'PNG modules; palette',len(PAL))
