#!/usr/bin/env python3
"""Hand-authored isometric pixel sprites, no image library required."""
from pathlib import Path
import struct,zlib
D=Path(__file__).parent/'sprites'
class Art:
 def __init__(self,w,h):self.w=w;self.h=h;self.data=bytearray(w*h*4)
 def rect(self,x,y,w,h,c):
  b=bytes.fromhex(c[1:])+b'\xff'
  for yy in range(max(0,y),min(self.h,y+h)):
   for xx in range(max(0,x),min(self.w,x+w)):
    i=(yy*self.w+xx)*4;self.data[i:i+4]=b
 def poly(self,points,col):
  for y in range(max(0,min(p[1] for p in points)),min(self.h,max(p[1] for p in points)+1)):
   crossings=[]
   for (x1,y1),(x2,y2) in zip(points,points[1:]+points[:1]):
    if (y1<=y<y2) or (y2<=y<y1):crossings.append(x1+(y-y1)*(x2-x1)/(y2-y1))
   crossings.sort()
   for a,b in zip(crossings[::2],crossings[1::2]):self.rect(round(a),y,max(1,round(b)-round(a)),1,col)
 def save(self,name):
  def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
  raw=b''.join(b'\0'+self.data[y*self.w*4:(y+1)*self.w*4] for y in range(self.h));(D/(name+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
ink='#385453'; wood='#b87d5e'; light='#f9e8cd'; shade='#805d50'; skin='#efbd9d'; teal='#5b9a93'; rose='#d8796c'
# 48:24 diamond tile. The room projects on the exact same grid.
a=Art(48,24);a.poly([(24,0),(48,12),(24,24),(0,12)],'#c4dfcd');a.poly([(24,1),(46,12),(24,23),(2,12)],'#e2efdd');a.save('tile')
# Back wall segments: two individually drawn diamond-grid-aligned faces.
for side in ('left','right'):
 a=Art(48,64)
 if side=='left':a.poly([(0,0),(48,24),(48,64),(0,40)],'#8bb8a7');a.poly([(2,3),(46,25),(46,60),(2,38)],'#b4d4c3')
 else:a.poly([(0,24),(48,0),(48,40),(0,64)],'#699d94');a.poly([(2,25),(46,3),(46,38),(2,60)],'#a0cabc')
 a.save('wall-'+side)
for side in ('left','right'):
 a=Art(40,44)
 if side=='left':
  a.poly([(2,1),(38,19),(38,43),(2,25)],ink);a.poly([(5,5),(35,20),(35,38),(5,23)],'#cbe9e3');a.poly([(19,12),(22,13),(22,31),(19,30)],light)
 else:
  a.poly([(2,19),(38,1),(38,25),(2,43)],ink);a.poly([(5,20),(35,5),(35,23),(5,38)],'#cbe9e3');a.poly([(19,13),(22,12),(22,30),(19,31)],light)
 a.save('window-'+side)
# The desk has a diamond top and two visible sides. Monitor back is angled, with a different mark per provider.
for k in range(3):
 a=Art(64,58);p=a.poly;r=a.rect
 p([(3,32),(31,18),(61,33),(33,48)],'#d6a77d');p([(3,32),(33,48),(33,55),(3,40)],shade);p([(33,48),(61,33),(61,40),(33,55)],wood);p([(8,42),(13,44),(13,56),(8,54)],ink);p([(52,42),(57,40),(57,52),(52,54)],ink)
 p([(19,6),(40,16),(40,35),(19,25)],ink);p([(22,9),(37,16),(37,31),(22,24)],'#dfebe0');p([(25,12),(34,16),(34,27),(25,23)],[rose,teal,'#a58fc1'][k]);r(28,15,3,8,light)
 if k==0:r(26,18,7,3,light)
 if k==1:r(32,17,2,6,light)
 if k==2:r(26,18,7,2,light);r(26,16,2,2,light);r(33,22,2,2,light)
 a.save('desk-'+str(k))
a=Art(84,70);p=a.poly;p([(2,38),(41,18),(82,39),(43,60)],'#e6be8e');p([(2,38),(43,60),(43,69),(2,47)],'#826050');p([(43,60),(82,39),(82,48),(43,69)],'#a37660');p([(24,2),(51,15),(51,40),(24,27)],ink);p([(27,5),(48,15),(48,36),(27,26)],'#e7f1e7');p([(32,10),(43,15),(43,30),(32,25)],rose);a.rect(36,13,3,13,light);a.rect(33,18,9,3,light);a.save('manager-desk')
# 3/4 sitting poses, a visible side face, diagonal chair and dynamic silhouettes.
for state,n in [('working',4),('away',1),('phone',2),('sleeping',2)]:
 for f in range(n):
  a=Art(64,70);p=a.poly;r=a.rect
  p([(13,42),(28,35),(46,44),(30,52)],'#7eaaa0');p([(13,42),(30,52),(30,62),(13,52)],'#517a74');p([(30,52),(46,44),(46,54),(30,62)],'#385d5b');p([(15,25),(30,32),(30,50),(15,43)],'#517a74')
  if state!='away':
   if state=='sleeping':
    p([(19,33),(33,26),(48,34),(34,42)],'#609791');p([(25,27),(39,24),(49,29),(47,36),(31,35)],skin);p([(25,27),(36,22),(43,25),(34,30)],'#735444');r(48,5+f*3,11,2,light);r(55,7+f*3,3,2,light);r(48,10+f*3,11,2,light);r(54,1+f*3,7,2,light)
   else:
    y=12+(f%2 if state=='working' else 4);p([(20,35),(30,30),(42,36),(42,48),(30,53),(20,47)],'#d27f72');p([(19,y+5),(30,y),(42,y+6),(42,y+21),(30,y+27),(19,y+21)],skin);p([(19,y+5),(30,y),(42,y+6),(42,y+10),(30,y+5),(19,y+10)],'#6d5042');p([(30,y+5),(42,y+10),(42,y+21),(30,y+27)],'#d99d80');r(23,y+13,3,3,ink);r(34,y+14,3,3,ink);r(28,y+19,4,2,rose)
    if state=='working':
     r(8,33+(f%2)*3,15,3,skin);r(41,37-(f%2)*3,14,3,skin);r(6,38,15,2,light);r(43,42,14,2,light);r(8,43,12,2,skin);r(45,33,12,2,skin);r(46,11,4,6,'#57c8d0');r(50,15,3,5,'#57c8d0');r(7,3,4,10,'#e4c2b0');r(14,0,4,11,'#e4c2b0');r(51,2+f*2,12,9,light);r(53,4+f*2,7,1,wood);r(0,25,10,2,light);r(53,27,10,2,light)
    else:r(39,31,8,13,ink);r(41,33,4,7,'#a7dcdb');r(35,37,6,3,skin)
  else:r(48,20,13,10,light);r(50,22,8,1,ink);r(50,25,6,1,ink)
  a.save(state+'-'+str(f))
# Isometric props: potted plant and coffee station.
a=Art(32,42);p=a.poly;p([(8,29),(16,25),(25,29),(17,33)],'#d59c77');p([(8,29),(17,33),(17,41),(8,37)],'#a66e58');p([(17,33),(25,29),(25,37),(17,41)],'#895946');p([(4,19),(15,12),(26,18),(19,28),(9,27)],'#6aa787');p([(7,12),(17,3),(23,12),(17,21)],'#8fc59c');a.save('plant')
a=Art(32,40);p=a.poly;p([(3,9),(17,2),(29,8),(15,15)],'#9ab2aa');p([(3,9),(15,15),(15,38),(3,32)],'#5d8079');p([(15,15),(29,8),(29,31),(15,38)],'#739b91');a.rect(17,17,7,8,light);a.save('coffee')
a=Art(72,36);a.poly([(36,0),(72,18),(36,36),(0,18)],'#956d66');a.poly([(36,3),(66,18),(36,33),(6,18)],'#dfac94');a.poly([(36,8),(56,18),(36,28),(16,18)],'#eecbb0');a.save('rug')
