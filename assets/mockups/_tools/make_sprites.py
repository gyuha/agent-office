#!/usr/bin/env python3
"""Generate the small, transparent pixel assets for the eight office studies."""
import struct,zlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
styles=[('01-warm-rpg',['#6a4837','#d8a574','#f4dbad','#e2aa88','#b96b52','#739575']),('02-isometric',['#496966','#a8d1c4','#eff4de','#e8b79c','#e48d70','#79a69b']),('03-office-tower',['#624b40','#ccb09a','#f5e7d3','#dca58b','#bc7056','#819c87']),('04-pocket-office',['#263f31','#71864e','#bdce83','#dce7a8','#71864e','#263f31']),('05-neon-shift',['#241c40','#533b72','#b08bd4','#e8b2bd','#ec4f9c','#48c6d1']),('06-chibi-club',['#855c78','#e9b9cb','#fff0ef','#edb69f','#e780a8','#a08dce']),('07-office-95',['#42454a','#a9a9a4','#e1dfd5','#dda78e','#927d9a','#799e95']),('08-focus-panel',['#313b42','#53666a','#a5b6b0','#c59c8b','#718e88','#728994'])]
def rgba(h):return tuple(bytes.fromhex(h[1:]))+(255,)
def png(path,w,h,p):
 raw=b''.join(b'\0'+bytes(v for px in p[y*w:(y+1)*w] for v in px) for y in range(h))
 def chunk(k,d):return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d)&0xffffffff)
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
class Art:
 def __init__(self,w,h):self.w=w;self.h=h;self.p=[(0,0,0,0)]*(w*h)
 def box(self,x,y,w,h,c):
  for yy in range(max(0,y),min(self.h,y+h)):
   for xx in range(max(0,x),min(self.w,x+w)):self.p[yy*self.w+xx]=rgba(c)
 def pixel(self,x,y,c):self.box(x,y,1,1,c)
 def save(self,p):png(p,self.w,self.h,self.p)
def make(folder,pal,i):
 d=ROOT/folder/'sprites';d.mkdir(exist_ok=True);dark,mid,light,skin,accent,green=pal
 # Sprite geometry changes by viewpoint: isometric diamonds, elevation desks, oversized chibi heads.
 for k in range(3):
  a=Art(48,40)
  if i==1:
   for yy in range(14):
    half=(yy+1)*2 if yy<7 else (14-yy)*2;a.box(24-half,20+yy,half*2,1,mid)
   a.box(7,29,34,5,dark);a.box(9,34,4,5,dark);a.box(35,34,4,5,dark)
  elif i==2:
   a.box(3,25,42,5,mid);a.box(5,30,4,10,dark);a.box(39,30,4,10,dark)
  else:
   a.box(2,23,44,10,dark);a.box(4,22,40,8,mid);a.box(5,32,4,8,dark);a.box(39,32,4,8,dark)
  a.box(12,5,24,19,dark);a.box(14,7,20,15,light);a.box(19,9,10,10,[accent,green,mid][k]);
  if k==0:a.box(23,10,2,8,light);a.box(20,13,8,2,light)
  if k==1:a.box(20,11,2,6,light);a.box(26,11,2,6,light);a.box(22,10,4,2,light);a.box(22,16,4,2,light)
  if k==2:a.box(23,10,2,8,light);a.box(20,13,8,2,light);a.pixel(21,11,light);a.pixel(26,16,light)
  a.save(d/f'desk-{k}.png')
 a=Art(64,48);a.box(2,27,60,17,dark);a.box(5,25,54,14,mid);a.box(0,44,64,4,accent);a.box(18,5,28,22,dark);a.box(21,8,22,16,light);a.box(28,10,8,10,accent);a.box(31,11,2,8,light);a.box(29,14,6,2,light);a.save(d/'manager-desk.png')
 for state,count in [('working',4),('away',1),('phone',2),('sleeping',2)]:
  for f in range(count):
   a=Art(48,48);a.box(12,26,24,17,dark);a.box(15,29,18,10,mid)
   if state!='away':
    head=22 if i==5 else (14 if i in (3,7) else 18);hx=(48-head)//2;hy=3+(f%2 if state=='working' else 0)
    a.box(17,hy+head-1,14,15,accent);a.box(hx,hy,head,head,skin);a.box(hx,hy,head,3,dark);a.box(hx+4,hy+head//2,2,2,dark);a.box(hx+head-6,hy+head//2,2,2,dark)
    if i==5:a.box(hx+head//2-2,hy+head-5,4,2,dark)
    if state=='working':
     a.box(9,28+(f%2)*2,10,3,skin);a.box(29,30-(f%2)*2,10,3,skin);a.box(5,9,6,2,accent);a.box(2,15,9,2,accent);a.box(36,7,3,6,green);a.box(40,13,3,5,green);a.box(37,20+(f%2)*2,8,5,light);a.box(5,1,3,6,accent);a.box(10,0,3,5,accent);a.box(15,1,3,6,accent)
    if state=='phone':a.box(31,24,7,12,dark);a.box(32,25,5,7,light);a.box(38,13+(f%2)*2,2,5,accent)
    if state=='sleeping':a.box(13,27,22,7,skin);a.box(34,3+(f%2)*3,8,2,light);a.box(39,5+(f%2)*3,2,2,light);a.box(34,7+(f%2)*3,8,2,light)
   else:a.box(5,29,7,6,light);a.box(38,10,9,7,light);a.box(39,12,7,1,dark);a.box(39,14,5,1,dark)
   a.save(d/f'{state}-{f}.png')
 for name in ['floor','wall','window','plant','door','coffee']:
  a=Art(16,16)
  if name=='floor':
   if i==1:
    for yy in range(16):
     half=yy*2+2 if yy<8 else (16-yy)*2;a.box(max(0,8-half//2),yy,min(16,half),1,mid if yy%3 else light)
   else:a.box(0,0,16,16,mid);a.box(0,15,16,1,dark);a.box(7 if i%2 else 3,0,1,15,light)
  if name=='wall':a.box(0,0,16,16,light);a.box(0,13,16,3,dark);a.box(0,12,16,1,mid)
  if name=='window':a.box(1,1,14,14,dark);a.box(3,3,10,10,green);a.box(7,3,2,10,light);a.box(3,7,10,2,light)
  if name=='plant':a.box(5,10,7,6,accent);a.box(3,4,10,7,green);a.box(6,1,5,7,green);a.box(4,5,2,2,light)
  if name=='door':a.box(2,0,12,16,dark);a.box(4,2,8,14,mid);a.box(9,8,2,2,light)
  if name=='coffee':a.box(3,2,10,14,dark);a.box(5,4,6,4,light);a.box(6,10,5,4,light)
  a.save(d/f'{name}.png')
for i,(folder,pal) in enumerate(styles):make(folder,pal,i)
