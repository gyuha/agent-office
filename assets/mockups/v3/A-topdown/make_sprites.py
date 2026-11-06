#!/usr/bin/env python3
"""Original pixel sprites for the warm overhead RPG office; stdlib only."""
import struct,zlib
from pathlib import Path
D=Path(__file__).parent/'sprites'
class Pixel:
 def __init__(self,w,h):self.w=w;self.h=h;self.p=bytearray(w*h*4)
 def rect(self,x,y,w,h,c):
  c=bytes.fromhex(c.lstrip('#'))+b'\xff'
  for yy in range(max(y,0),min(y+h,self.h)):
   for xx in range(max(x,0),min(x+w,self.w)):
    n=(yy*self.w+xx)*4;self.p[n:n+4]=c
 def save(self,name):
  def ch(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  raw=b''.join(b'\0'+self.p[y*self.w*4:(y+1)*self.w*4] for y in range(self.h))
  (D/(name+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(raw,9))+ch(b'IEND',b''))
P='#543d31'; WOOD='#a56d45'; GOLD='#e1b47c'; CREAM='#fff1d2'; SKIN='#e9ad85'; HAIR='#694333'; SHIRT='#628c80'; RED='#c65d47'; TEAL='#62a6a7'
# Overhead characters: front faces visible as the player looks down toward the desk.
for state,count in [('working',4),('phone',2),('sleeping',2),('away',1)]:
 for f in range(count):
  p=Pixel(64,64);r=p.rect
  # upholstered chair, legs, and its gold studs
  r(17,37,30,18,P);r(20,39,24,12,'#a17457');r(19,52,5,5,P);r(40,52,5,5,P)
  if state!='away':
   if state=='sleeping':
    r(19,35,27,12,SHIRT);r(17,39,31,9,SKIN);r(25,35,20,9,HAIR);r(29,38,16,6,SKIN)
    r(47,7+f*3,10,2,CREAM);r(54,9+f*3,3,2,CREAM);r(51,11+f*3,3,2,CREAM);r(47,13+f*3,10,2,CREAM);r(55,1+f*3,7,2,CREAM);r(59,3+f*3,3,2,CREAM);r(55,5+f*3,7,2,CREAM)
   else:
    y=18+(f%2 if state=='working' else 3)
    r(20,35,24,13,SHIRT);r(22,y,20,20,HAIR);r(20,y+4,24,15,SKIN);r(21,y+3,22,4,HAIR);r(24,y+10,3,3,P);r(37,y+10,3,3,P);r(28,y+15,8,2,RED)
    if state=='working':
     r(11,35+(f%2)*3,12,4,SKIN);r(41,38-(f%2)*3,12,4,SKIN);r(8,40-(f%2)*3,14,3,GOLD);r(42,41+(f%2)*2,14,3,GOLD);r(6,45+(f%2),16,2,SKIN);r(42,46-(f%2),16,2,SKIN);r(4,49,15,2,GOLD);r(45,49,15,2,GOLD)
     # sweat, heat, papers and motion strokes in every frame
     r(45,14,4,6,TEAL);r(48,18,3,4,TEAL);r(11,2,4,12,'#eabf9d');r(18,0,4,13,'#eabf9d');r(25,1,4,12,'#eabf9d');r(1,25,10,2,CREAM);r(3,30,8,2,CREAM);r(53,27,10,2,CREAM);r(55,33,8,2,CREAM);r(49,1+(f%3)*3,14,10,CREAM);r(51,3+(f%3)*3,8,1,WOOD);r(1,3+(f%2)*4,11,8,CREAM);r(3,5+(f%2)*4,7,1,WOOD)
    else:
     r(29,33,7,2,P);r(40,31,9,13,P);r(42,33,5,8,'#92c4bf');r(36,37,6,3,SKIN);r(50,22+f*2,3,3,GOLD)
  else:
   r(19,27,26,17,P);r(22,30,20,11,'#b58a64');r(48,30,13,10,CREAM);r(50,32,9,1,WOOD);r(50,35,6,1,WOOD)
  p.save(state+'-'+str(f))
# Distinct monitor backs with fictional provider marks, each part of its own desk sprite.
for k in range(3):
 p=Pixel(64,48);r=p.rect;r(3,22,58,18,P);r(5,20,54,17,WOOD);r(7,22,50,2,GOLD);r(7,36,5,10,P);r(52,36,5,10,P);r(13,3,38,23,P);r(16,5,32,18,'#e9d7b4');r(24,7,16,14,['#d88463','#7fa899','#a695c6'][k]);
 if k==0:r(30,8,4,12,CREAM);r(26,12,12,4,CREAM)
 if k==1:r(27,10,3,8,CREAM);r(34,10,3,8,CREAM);r(30,8,4,3,CREAM);r(30,17,4,3,CREAM)
 if k==2:r(30,8,4,12,CREAM);r(26,12,12,4,CREAM);r(27,10,3,3,CREAM);r(34,16,3,3,CREAM)
 r(8,25,7,5,CREAM);r(50,25,7,4,TEAL);p.save('desk-'+str(k))
p=Pixel(88,58);r=p.rect;r(1,26,86,25,P);r(4,22,80,23,'#824d36');r(7,24,74,17,'#bd8051');r(8,27,72,2,GOLD);r(7,45,8,10,P);r(73,45,8,10,P);r(20,2,48,27,P);r(23,5,42,21,CREAM);r(36,7,16,16,'#d88463');r(42,9,4,12,CREAM);r(38,13,12,4,CREAM);r(8,31,10,6,'#e6cb87');r(69,30,10,6,'#e6cb87');p.save('manager-desk')
# 16px repeat tiles and 32px furnishings
p=Pixel(16,16);r=p.rect;r(0,0,16,16,'#d3a16a');r(0,0,16,1,'#ae7b51');r(0,15,16,1,'#ae7b51');r(7,1,1,14,'#bf8b59');r(2,5,3,1,'#e0b47d');p.save('floor')
p=Pixel(16,16);r=p.rect;r(0,0,16,16,'#e9d0a2');r(0,12,16,4,'#81573e');r(0,11,16,1,'#c58b59');p.save('wall')
p=Pixel(32,32);r=p.rect;r(1,1,30,30,P);r(3,3,26,26,'#b98250');r(5,5,22,21,'#a5d0bf');r(15,5,2,21,CREAM);r(5,14,22,2,CREAM);r(7,9,6,2,CREAM);p.save('window')
p=Pixel(32,32);r=p.rect;r(10,22,13,9,P);r(12,22,9,7,'#c58054');r(7,11,18,13,'#699568');r(11,5,10,12,'#7fae72');r(5,14,8,6,'#82ae73');r(17,10,8,6,'#a7c98a');p.save('plant')
p=Pixel(32,32);r=p.rect;r(3,0,26,32,P);r(6,2,20,30,'#b47c50');r(8,4,16,11,'#d2a16c');r(8,18,16,11,'#d2a16c');r(21,16,2,2,CREAM);p.save('door')
p=Pixel(32,32);r=p.rect;r(5,3,22,29,P);r(7,5,18,25,'#ad9a84');r(10,8,12,8,'#5d4c43');r(13,19,9,8,CREAM);r(22,21,3,4,CREAM);p.save('coffee')
p=Pixel(32,32);r=p.rect;r(1,1,30,30,P);r(3,3,26,26,'#ae6453');r(5,5,22,22,'#d89672');r(8,8,16,16,'#c87c62');r(14,9,4,14,'#e8b28a');r(9,14,14,4,'#e8b28a');p.save('rug')
p=Pixel(32,32);r=p.rect;r(2,3,28,27,P);r(4,5,24,23,'#a56d45');r(6,8,20,3,GOLD);r(6,17,20,3,GOLD);r(8,10,4,7,'#a66456');r(14,11,4,6,'#7d9b7e');r(20,9,4,8,'#d6b371');p.save('bookshelf')
