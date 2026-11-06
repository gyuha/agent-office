#!/usr/bin/env python3
"""Build distributable sheets from licensed local LPC layers and pixel art."""
from pathlib import Path
import json,csv,struct,zlib,shutil,subprocess,sys
from pnglib import png_read,png_write
A=Path(__file__).resolve().parents[1]; V=A/'vendor'; OUT=A/'sprites'; LPC=V/'lpc/spritesheets'; USED=set(); entries=[]
def blank(w,h):return bytearray(w*h*4)
def put(dst,dw,dh,src,sw,sh,x=0,y=0,sx=0,sy=0,cw=None,ch=None):
 cw=cw or sw;ch=ch or sh
 for j in range(ch):
  if not 0<=y+j<dh or not 0<=sy+j<sh:continue
  for i in range(cw):
   if not 0<=x+i<dw or not 0<=sx+i<sw:continue
   a=((sy+j)*sw+sx+i)*4;b=((y+j)*dw+x+i)*4;alpha=src[a+3]
   if alpha==255:dst[b:b+4]=src[a:a+4]
   elif alpha:
    old=dst[b+3];ao=alpha+old*(255-alpha)//255
    if ao:dst[b:b+4]=bytes((src[a+k]*alpha+dst[b+k]*old*(255-alpha)//255)//ao for k in range(3))+bytes([ao])
def rect(p,w,h,x,y,rw,rh,c):
 c=bytes.fromhex(c.lstrip('#'))+b'\xff'
 for yy in range(max(0,y),min(h,y+rh)):
  for xx in range(max(0,x),min(w,x+rw)):p[(yy*w+xx)*4:(yy*w+xx)*4+4]=c
def save(path,w,h,p,frames,anims,anchor,fw=None,fh=None):
 path=OUT/path;path.parent.mkdir(parents=True,exist_ok=True);png_write(path,w,h,p)
 meta={'frameWidth':fw or w,'frameHeight':fh or h,'frames':frames,'animations':anims,'anchor':anchor};mp=path.with_suffix('.json');mp.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');entries.append({'png':str(path.relative_to(OUT)),'metadata':str(mp.relative_to(OUT))})
def frame(n,x,y,w,h):return {'name':n,'x':x,'y':y,'w':w,'h':h}
def make_png(path,w,h,p,anchor=None):save(path,w,h,p,[frame('default',0,0,w,h)],{'default':{'frames':['default'],'fps':1}},anchor or {'x':w//2,'y':h},w,h)
def original(path):return png_read(V/path)
def composite(paths,hair,shirt):
 canvas=None
 for index,path in enumerate(paths):
  USED.add(path);w,h,p=png_read(LPC/path)
  if canvas is None:canvas=blank(w,h)
  if index in (4,5):
   tint=shirt if index==4 else hair
   for k in range(0,len(p),4):
    if p[k+3]:
     lum=(p[k]+p[k+1]+p[k+2])//3;p[k:k+3]=bytes(min(255,lum*c//160) for c in tint)
  put(canvas,w,h,p,w,h)
 return w,h,canvas
styles=['plain','bob','spiked','messy1','parted','pixie','bangs','plain','bob','spiked']
hairs=[(56,45,37),(95,63,42),(205,166,94),(81,61,52),(104,69,43),(53,51,48),(181,93,48),(120,91,72),(41,42,46),(97,75,55)]
shirts=[(104,131,113),(125,100,105),(99,115,144),(157,122,77),(112,129,130),(151,104,94),(117,111,145),(89,124,121),(45,58,90),(52,58,74)]
ids=[f'agent-{i+1:02d}' for i in range(8)]+['manager-01','manager-02']
for i,identity in enumerate(ids):
 sheets={}
 for act in ['sit','walk','idle']:
  ps=[f'body/bodies/male/{act}.png',f'head/heads/human/male/{act}.png',f'legs/pants/male/{act}.png',f'feet/shoes/basic/male/{act}.png',f'torso/clothes/{"longsleeve/longsleeve" if i%2==0 or i>=8 else "shortsleeve/shortsleeve"}/male/{act}.png',f'hair/{styles[i]}/adult/{act}.png'];sheets[act]=composite(ps,hairs[i],shirts[i])
 for act in ['walk','idle']:
  w,h,p=sheets[act];frames=[];anims={};cols=w//64
  for row,direction in enumerate(['up','left','down','right']):
   keys=[]
   for j in range(cols):n=f'{direction}-{j}';frames.append(frame(n,j*64,row*64,64,64));keys.append(n)
   anims[direction]={'frames':keys,'fps':9 if act=='walk' else 3}
  save(Path('characters')/identity/(act+'.png'),w,h,p,frames,anims,{'x':32,'y':52},64,64)
 w,h,base=sheets['sit']
 for state,count in [('working',4),('phone',3),('sleeping',3)]:
  out=blank(count*64,64);frames=[]
  for f in range(count):
   # Front/down row of LPC sit, copied independently into each state frame.
   tile=blank(64,64);put(tile,64,64,base,w,h,0,0,(0 if state=='sleeping' else f%2)*64,128,64,64)
   if state=='working':
    for j in range(3):rect(tile,64,64,14-j*2,37+j*3+(f%2),11,2,'#e9b18e');rect(tile,64,64,40+j*2,37+j*3-(f%2),11,2,'#e9b18e')
   elif state=='phone':
    rect(tile,64,64,17,34,7,11,'#253b49');rect(tile,64,64,18,35,5,7,'#78d8df');rect(tile,64,64,22,31,6,2,'#9ce0de');rect(tile,64,64,22,41,5,3,'#e9b18e')
   else:
    # Remove upright head; reuse and flatten original LPC head pixels at desk level.
    top=blank(64,64);put(top,64,64,tile,64,64); 
    for yy in range(0,40):
     for xx in range(0,64):tile[(yy*64+xx)*4:(yy*64+xx)*4+4]=b'\0\0\0\0'
    for yy in range(14):
     for xx in range(28):
      sy=14+yy*18//14;si=(sy*64+18+xx)*4;di=((30+yy+f%2)*64+18+xx)*4
      if top[si+3]:tile[di:di+4]=top[si:si+4]
    rect(tile,64,64,15,44,14,3,'#d3a081');rect(tile,64,64,35,44,14,3,'#d3a081')
   if i>=8 and state!='sleeping':
    rect(tile,64,64,31,34,2,8,'#a53940');rect(tile,64,64,30,34,4,2,'#d0c5ae')
   put(out,count*64,64,tile,64,64,f*64,0);frames.append(frame(f'{state}-{f}',f*64,0,64,64))
  save(Path('characters')/identity/(state+'.png'),count*64,64,out,frames,{state:{'frames':[f'{state}-{f}' for f in range(count)],'fps':12 if state=='working' else 3}}, {'x':32,'y':48},64,64)
# Existing independent pixel props from approved mockup.
for n in ['chair','city-window','plant','sofa','whiteboard','glass-table']:
 w,h,p=png_read(A/'mockups/v4/sprites'/f'{n}.png');make_png(Path('furniture')/(n+'.png'),w,h,p)
for k,name in enumerate(['claude','codex','antigravity']):
 w,h,p=png_read(A/'mockups/v4/sprites'/f'monitor-{k}.png');make_png(Path('furniture')/f'monitor-{name}.png',w,h,p)
w,h,p=png_read(A/'mockups/v4/sprites/monitor-1.png');rect(p,w,h,11,5,10,10,'#7b8790');rect(p,w,h,15,7,2,2,'#eff0d7');rect(p,w,h,17,9,2,2,'#eff0d7');rect(p,w,h,15,11,2,2,'#eff0d7');rect(p,w,h,15,13,2,1,'#eff0d7');make_png('furniture/monitor-unknown.png',w,h,p)
# Precise crops from original vendor art.
crops=[('furniture/desk.png','lpc-furniture/dark-wood_3.png',(0,304,96,32)),('furniture/meeting-table.png','lpc-furniture/dark-wood_3.png',(136,176,80,64)),('furniture/bookshelf.png','lpc-shelves/bookshelf-brown_0.png',(0,0,64,96)),('furniture/coffee-machine.png','lpc-office/Coffee Maker.png',(0,0,32,32)),('furniture/water-cooler.png','lpc-office/Water Cooler.png',(0,0,32,64)),('furniture/copier.png','lpc-office/Copy Machine.png',(0,0,64,64)),('furniture/bin.png','lpc-office/Bins.png',(0,0,32,32)),('furniture/tv.png','lpc-office/TV, Widescreen.png',(0,0,96,64)),('tiles/floor.png','lpc-floors/lpc-floors/floors.png',(192,1216,32,32))]
for dst,source,(sx,sy,w,h) in crops:
 sw,sh,p=original(source);out=blank(w,h);put(out,w,h,p,sw,sh,0,0,sx,sy,w,h)
 if dst=='furniture/desk.png':
  extended=blank(w,48);put(extended,w,48,out,w,h);out=extended;h=48
  rect(out,w,h,0,29,w,6,'#795039');rect(out,w,h,3,35,11,11,'#69432f');rect(out,w,h,w-14,35,11,11,'#69432f')
  rect(out,w,h,4,27,10,5,'#b88456');rect(out,w,h,w-14,27,10,5,'#b88456')
  rect(out,w,h,35,12,26,7,'#bbbca9')
  for j in range(5):rect(out,w,h,37+j*4,14,2,2,'#586b68')
 make_png(dst,w,h,out)
# Larger desk is a transparent, unscaled 96x32 vendor crop, with gold manager inlay.
w,h,p=png_read(OUT/'furniture/desk.png');large=blank(128,h);put(large,128,h,p,w,h,0,0,0,0,48,h);put(large,128,h,p,w,h,48,0,16,0,32,h);put(large,128,h,p,w,h,80,0,48,0,48,h);rect(large,128,h,0,12,128,7,'#96613f');rect(large,128,h,51,12,26,7,'#bbbca9');
for j in range(5):rect(large,128,h,53+j*4,14,2,2,'#586b68')
rect(large,128,h,40,23,48,2,'#d5af72');make_png('furniture/manager-desk.png',128,h,large)
def draw_asset(name,w,h,rects):
 p=blank(w,h)
 for x,y,rw,rh,c in rects:rect(p,w,h,x,y,rw,rh,c)
 make_png(name,w,h,p)
draw_asset('furniture/glass-partition.png',32,32,[(0,0,32,2,'#68898d'),(0,0,2,32,'#68898d'),(30,0,2,32,'#68898d'),(0,30,32,2,'#68898d'),(4,4,24,1,'#b4d9d9')])
draw_asset('furniture/clock.png',16,16,[(2,1,12,14,'#667776'),(4,3,8,10,'#e9e9d9'),(7,5,1,5,'#465758'),(7,9,3,1,'#465758')])
draw_asset('furniture/coat-rack.png',16,32,[(7,4,2,24,'#5e4436'),(3,8,10,2,'#5e4436'),(3,27,10,3,'#5e4436')])
draw_asset('tiles/wall.png',32,32,[(0,0,32,32,'#d9ddce'),(0,29,32,3,'#66736d')])
draw_asset('tiles/wall-top.png',32,32,[(0,0,32,32,'#314457'),(0,5,32,27,'#d9ddce')])
draw_asset('tiles/pantry-floor.png',32,32,[(0,0,32,32,'#cddad1'),(0,0,32,1,'#a5b7af'),(0,0,1,32,'#a5b7af'),(16,0,1,32,'#a5b7af'),(0,16,32,1,'#a5b7af')])
# Small, isolated overlay effects, four frames on a consistent 32px grid.
for name in ['steam','sweat','paper','exclamation','zzz','phone-glow','attention']:
 w,h=128,32;p=blank(w,h)
 for f in range(4):
  x=f*32;rise=f*2
  if name=='steam':
   for j in range(4):rect(p,w,h,x+5+j*6,20-(rise+j*2)%13,4,3,'#e8ded1')
  elif name=='sweat':rect(p,w,h,x+14,10+f%2,4,7,'#61c8d5');rect(p,w,h,x+12,15+f%2,3,3,'#a7e1e1')
  elif name=='paper':rect(p,w,h,x+9,18-rise,12,8,'#f7edd5');rect(p,w,h,x+11,20-rise,7,1,'#ad9a85')
  elif name=='exclamation':
   for xx in [10,17]:rect(p,w,h,x+xx,7,3,10,'#ffe184');rect(p,w,h,x+xx,19,3,3,'#ffe184')
  elif name=='zzz':
   for j in range(2):
    xx=x+5+j*12;yy=9+j*5-f;rect(p,w,h,xx,yy,8,2,'#fff4dc');rect(p,w,h,xx+5,yy+2,2,2,'#fff4dc');rect(p,w,h,xx+3,yy+4,2,2,'#fff4dc');rect(p,w,h,xx,yy+6,8,2,'#fff4dc')
  elif name=='phone-glow':rect(p,w,h,x+10,11,10,8,'#6bd9df');rect(p,w,h,x+12,9,6,12,'#b6f1e9')
  else:
   rect(p,w,h,x+7,3,18,18,'#f5f0df');rect(p,w,h,x+10,1,12,2,'#f5f0df');rect(p,w,h,x+13,21,4,4,'#f5f0df');rect(p,w,h,x+13,7,6,2,'#374b55');rect(p,w,h,x+17,9,2,3,'#374b55');rect(p,w,h,x+14,12,3,2,'#374b55');rect(p,w,h,x+14,16,3,2,'#374b55')
 fs=[frame(f'{name}-{i}',i*32,0,32,32) for i in range(4)];save(Path('effects')/(name+'.png'),w,h,p,fs,{name:{'frames':[f'{name}-{i}' for i in range(4)],'fps':6}}, {'x':16,'y':32},32,32)
(OUT/'manifest.json').write_text(json.dumps({'version':1,'tileSize':32,'sheets':entries},indent=2)+'\n')
rows=list(csv.DictReader((V/'lpc/CREDITS.csv').open(newline='',encoding='utf8')));by={r['filename']:r for r in rows};missing=USED-set(by)
if missing:raise RuntimeError('Missing credits '+str(missing))
with (OUT/'character-source-credits.csv').open('w',encoding='utf8',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=['filename','notes','authors','licenses','urls']);writer.writeheader();writer.writerows(by[k] for k in sorted(USED))
shutil.copyfile(A/'tools/sprites-README.md',OUT/'README.md')
subprocess.run([sys.executable,str(A/'tools/contact_sheet.py')],check=True)
print('Generated',len(entries),'sheets')
