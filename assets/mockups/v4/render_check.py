#!/usr/bin/env python3
"""Render a deterministic 3s placement check from index.html's SCENE coordinates.

Uses the same 64px LPC frames, sprite crops, station geometry and draw order as
index.html.  The lightweight background and captions are for inspection.
No browser or third-party package is needed.
"""
from pathlib import Path
import json,re,math,sys
HERE=Path(__file__).resolve().parent
ns={'__file__':str(HERE/'compose.py')}
exec((HERE/'compose.py').read_text().split('styles=')[0],ns)
read,write=ns['png_read'],ns['png_write']
TIME=int(sys.argv[1]) if len(sys.argv)>1 else 3000
scene=json.loads(re.search(r'const SCENE=(\{.*?\});', (HERE/'index.html').read_text()).group(1))
W,H=960,540; buf=bytearray(W*H*4); cache={}
def box(x,y,w,h,c):
 x,y,w,h=map(round,(x,y,w,h));c=bytes.fromhex(c.lstrip('#'))+b'\xff'
 for yy in range(max(y,0),min(y+h,H)):
  for xx in range(max(x,0),min(x+w,W)):i=(yy*W+xx)*4;buf[i:i+4]=c
def image(path,x,y,sx=0,sy=0,sw=None,sh=None,dw=None,dh=None):
 path=Path(path)
 if path not in cache:cache[path]=read(path)
 w,h,raw=cache[path];sw=sw or w;sh=sh or h;dw=dw or sw;dh=dh or sh;x,y,dw,dh=map(round,(x,y,dw,dh))
 for yy in range(max(0,-y),min(dh,H-y)):
  py=sy+yy*sh//dh
  if py>=h:continue
  for xx in range(max(0,-x),min(dw,W-x)):
   px=sx+xx*sw//dw
   if px>=w:continue
   s=(py*w+px)*4;d=((y+yy)*W+x+xx)*4;a=raw[s+3]
   if a==255:buf[d:d+4]=raw[s:s+4]
   elif a:
    for k in range(3):buf[d+k]=(raw[s+k]*a+buf[d+k]*(255-a))//255
    buf[d+3]=255
sprites=HERE/'sprites';vendor=HERE.parent.parent/'vendor'
def spr(n,x,y):image(sprites/(n+'.png'),x,y)
GLYPHS={
 'Z':['111','001','010','100','111'], 'A':['010','101','111','101','101'],'C':['011','100','100','100','011'],'E':['111','100','110','100','111'],'F':['111','100','110','100','100'],'G':['011','100','101','101','011'],'H':['101','101','111','101','101'],'I':['111','010','010','010','111'],'J':['001','001','001','101','010'],'K':['101','101','110','101','101'],'L':['100','100','100','100','111'],'M':['101','111','111','101','101'],'N':['101','111','111','111','101'],'O':['010','101','101','101','010'],'R':['110','101','110','101','101'],'S':['011','100','010','001','110'],'T':['111','010','010','010','010'],'U':['101','101','101','101','111'],'V':['101','101','101','101','010']}
def label(name,x,y):
 w=len(name)*5+6;box(x-w/2,y,w,10,'#30343a');start=round(x-w/2+3)
 for i,c in enumerate(name):
  for j,row in enumerate(GLYPHS.get(c,[])):
   for k,pixel in enumerate(row):
    if pixel=='1':box(start+i*5+k,y+2+j,1,1,'#f4d884')

def room(x,y,w,h):
 box(x+3,y+3,w,h,'#070d19');box(x,y,w,h,'#314457');box(x+4,y+4,w-8,h-8,'#d7d3bd')
 floor=vendor/'lpc-floors/lpc-floors/floors.png'
 for yy in range(0,h-66,32):
  for xx in range(0,w-10,32):
   # Clip the last tile to the floor bounds as in canvas.
   dw=min(32,w-10-xx);dh=min(32,h-66-yy);image(floor,x+5+xx,y+61+yy,192,1216,dw,dh)
 box(x+5,y+4,w-10,57,'#d9ddce');box(x+5,y+54,w-10,7,'#666f68')
def desk(x,y,k,manager=False):
 width=96 if manager else 80;image(vendor/'lpc-furniture/dark-wood_3.png',x,y,0,304,96,32,width,32);box(x+2,y+27,width-4,7,'#795039');box(x+4,y+34,10,8,'#69432f');box(x+width-14,y+34,10,8,'#69432f');spr('monitor-'+str(k),x+width/2+5,y-17);box(x+width/2-12,y+13,24,6,'#b5b2a2')
def actor(i,state,x,y,t=TIME,target=None):
 # HTML receives the centre 55 px above each desk's station anchor.
 if state!='away':spr('chair',x-16,y+2);direction=2;action='sit';f=(t//160)%3;shift=1 if state=='phone' else 5 if state=='sleeping' else 0
 else:
  spr('chair',x-16,y+2);target=target or (x+100,y-30);points=[(x,y),(x-30,y),(x-30,y+42),(target[0],y+42),target];turn=(t%12000)/12000;progress=turn*3 if turn<1/3 else 1 if turn<.625 else (1-turn)/.375;z=progress*4;j=min(3,math.floor(z));fpart=z-j;dx=points[j+1][0]-points[j][0];dy=points[j+1][1]-points[j][1];x=points[j][0]+dx*fpart;y=points[j][1]+dy*fpart;direction=(3 if dx>0 else 1) if abs(dx)>abs(dy) else (2 if dy>0 else 0);action='idle' if 1/3<=turn<.625 else 'walk';direction=2 if action=='idle' else direction;f=(t//500)%2 if action=='idle' else (t//120)%9;shift=0
 if state=='working':x+=1 if (t//85)%2 else -1
 imgpath=sprites/f'agent-{i}-{action}.png';sw,sh,_=cache.get(imgpath) or read(imgpath);f%=sw//64
 if state=='sleeping':
  image(imgpath,x-16,y-7,f*64+16,direction*64+28,32,24)
  image(imgpath,x-14,y+6,f*64+18,direction*64+13,28,16,28,12)
 else:image(imgpath,x-32,y-38+shift,f*64,direction*64,64,64)
 effects.append((state,x,y))
 return x,y
def glass(x,y,w,h):
 # Borders match the HTML; omitted translucency keeps the visibility test strict.
 box(x,y,w,2,'#68898d');box(x,y,2,h,'#68898d');box(x+w-2,y,2,h,'#68898d');box(x,y+h-2,w,2,'#68898d');box(x+w//2,y,2,h,'#92b8b7')
box(0,0,W,H,'#111927');labels=[];walkers=[];effects=[]
for name in ('alpha','beta','solo'):
 d=scene[name];room(d['x'],d['y'],d['w'],d['h'])
ax,ay=scene['alpha']['x'],scene['alpha']['y'];bx,by=scene['beta']['x'],scene['beta']['y'];sx,sy=scene['solo']['x'],scene['solo']['y']
for x,y in [(ax+12,ay+6),(bx+7,by+7),(sx+8,sy+7)]:spr('city-window',x,y)
spr('whiteboard',ax+112,ay+13);spr('whiteboard',bx+108,by+12)
image(vendor/'lpc-shelves/bookshelf-brown_0.png',ax+188,ay+2,0,0,64,96,42,63)
image(vendor/'lpc-office/TV, Widescreen.png',ax+235,ay+9,0,0,96,64,48,32)
box(ax+206,ay+62,109,55,'#d7dfd4')
for fn,x,y,sw,sh,dw,dh in [('Coffee Maker.png',ax+208,ay+65,32,32,32,32),('Water Cooler.png',ax+235,ay+60,32,64,16,32),('Copy Machine.png',ax+255,ay+64,64,64,32,32),('Bins.png',ax+290,ay+72,32,32,16,16),('Coffee Maker.png',bx+9,by+71,32,32,32,32),('Coffee Maker.png',sx+130,sy+70,32,32,32,32)]:image(vendor/'lpc-office'/fn,x,y,0,0,sw,sh,dw,dh)
image(vendor/'lpc-furniture/dark-wood_3.png',ax+32,ay+83,136,176,80,64,96,72)
for q in range(3):spr('chair',ax+31+q*31,ay+69);spr('chair',ax+31+q*31,ay+143)
# Managers are working at 3 seconds.
for i,(x,y),dx,dy,k in [(0,scene['managers'][0],ax+330,ay+91,0),(3,scene['managers'][1],bx+115,by+93,1)]:actor(i,'working',x,y);desk(dx,dy,k,True);labels.append(('ORCHESTRATOR',x,y+55))
glass(ax+318,ay+58,140,98);glass(bx+104,by+60,135,98)
items=[(j+1,s,*scene['alpha']['stations'][j],n,j%3,(ax+355,ay+273)) for j,(s,n) in enumerate(zip(['working','away','phone','sleeping','working','phone'],['NOVA','MIRA','SAGE','LEO','NARI','JUNO']))]+[(6,'away',*scene['beta']['stations'][0],'KAI',1,(bx+22,by+125)),(7,'sleeping',*scene['beta']['stations'][1],'LUNA',2,None),(4,'phone',*scene['solo']['stations'][0],'FINN',2,None)]
for i,state,x,y,name,k,target in items:
 if state=='away':spr('chair',x-16,y-53);walkers.append((i,state,x,y,name,target))
 else:
  px,py=actor(i,state,x,y-55);labels.append((name,px,py-31))
 desk(x-40,y-38,k)
for n,x,y in [('sofa',ax+371,ay+286),('sofa',ax+371,ay+350),('glass-table',ax+373,ay+316),('plant',ax+435,ay+250),('plant',ax+435,ay+370),('plant',bx+212,by+253),('plant',sx+132,sy+167)]:spr(n,x,y)
for i,state,x,y,name,target in walkers:
 px,py=actor(i,state,x,y-55,target=target);labels.append((name,px,py-31));print(name,'position:',round(px,1),round(py,1))
for state,x,y in effects:
 if state=='working':
  d=(TIME//85)%3
  for j in range(3):box(x-20-j*2,y-10-j*3+d,10,2,'#ecc8a5');box(x+10+j*2,y-10-j*3-d,10,2,'#ecc8a5')
  box(x+12,y-30,3,5,'#61c8d5')
  for j in range(4):
   rise=((TIME//150)+j*4)%16;box(x-12+j*7,y-35-rise,4,3,'#e8ded1')
  jump=(TIME//110)%14;box(x+19,y+6-jump,10,7,'#f7edd5')
  if TIME%2100<600:label('!!',x-20,y-40)
 if state=='phone':box(x-13,y-15,7,10,'#253b49');box(x-12,y-14,5,7,'#7be2e8');box(x-9,y-19,7,3,'#8ddbdc');box(x-10,y-5,5,3,'#e9bd9a')
 if state=='sleeping':box(x-14,y+12,12,3,'#d8a281');box(x+2,y+12,12,3,'#d8a281');label('ZZZ',x+31,y-38-(TIME//300)%6)
for name,x,y in labels:label(name,x,y)
write(HERE/f'render-check-{TIME//1000}s.png',W,H,buf)
print('Rendered:',len(items),'staff +',len(scene['managers']),'managers; timestamp',TIME,'ms')
