#!/usr/bin/env python3
"""Original three-quarter frontal pixel sprites for the Win95 office."""
from pathlib import Path
import struct,zlib
D=Path(__file__).parent/'sprites'
class Image:
 def __init__(self,w,h):self.w=w;self.h=h;self.p=bytearray(w*h*4)
 def rect(self,x,y,w,h,c):
  c=bytes.fromhex(c[1:])+b'\xff'
  for yy in range(max(0,y),min(self.h,y+h)):
   for xx in range(max(0,x),min(self.w,x+w)):
    o=(yy*self.w+xx)*4;self.p[o:o+4]=c
 def poly(self,pts,c):
  for y in range(max(0,min(y for x,y in pts)),min(self.h,max(y for x,y in pts)+1)):
   hits=[]
   for (x1,y1),(x2,y2) in zip(pts,pts[1:]+pts[:1]):
    if (y1<=y<y2) or (y2<=y<y1):hits.append(x1+(y-y1)*(x2-x1)/(y2-y1))
   hits.sort()
   for a,b in zip(hits[::2],hits[1::2]):self.rect(round(a),y,max(1,round(b)-round(a)),1,c)
 def save(self,n):
  def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
  rows=b''.join(b'\0'+self.p[y*self.w*4:(y+1)*self.w*4] for y in range(self.h));(D/(n+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))
edge='#45494a';metal='#b5b6ae';white='#eee9d5';skin='#dba88b';hair='#514b48';shirt='#788d88';pink='#bb827b'
# Cabinet-like desk is viewed from slightly above; monitor back is frontal, top surface recedes.
for k in range(3):
 a=Image(72,58);p=a.poly;r=a.rect
 p([(7,31),(65,31),(70,40),(2,40)],'#d0c5ae');r(2,40,68,8,'#817769');r(5,48,6,9,edge);r(61,48,6,9,edge);r(8,39,56,2,white)
 r(19,3,34,25,edge);r(21,5,30,21,'#d6d6ca');r(29,8,14,15,[pink,'#779e8b','#9c91ad'][k]);r(34,10,4,11,white)
 if k==0:r(31,13,10,4,white)
 if k==1:r(30,11,2,9,white);r(41,11,2,9,white)
 if k==2:r(31,14,10,2,white);r(31,10,2,2,white);r(40,19,2,2,white)
 r(33,28,6,3,edge);r(7,34,7,4,white);a.save('desk-'+str(k))
a=Image(92,68);p=a.poly;r=a.rect;p([(8,36),(84,36),(90,48),(2,48)],'#b5a793');r(2,48,88,11,'#71685f');r(5,59,7,9,edge);r(80,59,7,9,edge);r(23,2,44,30,edge);r(26,5,38,24,'#d6d6ca');r(37,8,16,17,pink);r(43,10,4,13,white);r(39,14,12,4,white);r(43,32,6,4,edge);r(10,39,12,5,white);a.save('manager-desk')
# Frontal upper body above the desk, chair back behind it; four exaggerated animated poses.
for state,n in [('working',4),('away',1),('phone',2),('sleeping',2)]:
 for f in range(n):
  a=Image(72,72);r=a.rect;p=a.poly
  r(14,30,44,25,edge);r(17,33,38,19,'#899a93');p([(20,53),(52,53),(56,59),(16,59)],'#6b7772')
  if state!='away':
   if state=='sleeping':
    p([(18,39),(54,39),(58,48),(14,48)],shirt);r(21,40,32,9,skin);r(24,36,25,6,hair);r(48,6+f*3,12,2,white);r(57,8+f*3,3,2,white);r(52,10+f*3,3,2,white);r(48,12+f*3,12,2,white);r(57,1+f*3,9,2,white)
   else:
    y=13+(f%2 if state=='working' else 4);p([(24,33),(48,33),(56,47),(16,47)],shirt);r(23,y,26,22,hair);r(21,y+5,30,17,skin);r(23,y+3,26,5,hair);r(26,y+11,3,3,edge);r(43,y+11,3,3,edge);r(31,y+17,10,2,pink)
    if state=='working':
     r(9,37+(f%2)*2,14,4,skin);r(49,39-(f%2)*2,14,4,skin);r(6,42,17,2,white);r(49,44,17,2,white);r(7,47,15,2,skin);r(50,35,14,2,skin);r(54,13,4,7,'#6ab4bb');r(58,18,3,5,'#6ab4bb');r(11,2,4,10,'#cbbcb3');r(18,0,4,12,'#cbbcb3');r(25,2,4,10,'#cbbcb3');r(56,2+f*2,14,10,white);r(58,4+f*2,8,1,edge);r(1,25,10,2,white);r(62,27,10,2,white)
    else:r(48,30,9,13,edge);r(50,32,5,8,'#b9d2cc');r(44,38,5,3,skin)
  else:r(51,18,16,11,white);r(53,21,10,1,edge);r(53,24,7,1,edge)
  a.save(state+'-'+str(f))
# Window and office props use the same 3/4 frontal pixel perspective, authored for this concept.
a=Image(32,32);r=a.rect;r(1,1,30,30,edge);r(3,3,26,26,'#c9cec5');r(5,5,22,22,'#91b9b3');r(15,5,2,22,white);r(5,15,22,2,white);a.save('window')
a=Image(32,32);r=a.rect;r(10,22,13,9,edge);r(12,23,9,7,'#b38273');r(6,11,20,12,'#6e9684');r(10,4,12,14,'#89aa92');r(5,15,8,6,'#a4b9a2');a.save('plant')
a=Image(32,32);r=a.rect;r(5,2,22,30,edge);r(7,4,18,26,'#aaab9f');r(10,8,12,8,'#6b7771');r(12,20,9,7,white);a.save('coffee')
a=Image(16,16);r=a.rect;r(0,0,16,16,'#cfcabe');r(0,14,16,2,'#b3aca0');r(7,0,1,14,'#bbb5aa');a.save('floor')
