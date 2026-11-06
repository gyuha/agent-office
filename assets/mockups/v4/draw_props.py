#!/usr/bin/env python3
"""Small original office props; PNG encoding from compose.py is reused."""
from pathlib import Path
import struct,zlib
D=Path(__file__).parent/'sprites'
def write(name,w,h,p):
 def ch(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
 raw=b''.join(b'\0'+p[y*w*4:(y+1)*w*4] for y in range(h));(D/(name+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(raw,9))+ch(b'IEND',b''))
class S:
 def __init__(self,w,h):self.w=w;self.h=h;self.p=bytearray(w*h*4)
 def r(self,x,y,w,h,c):
  col=bytes.fromhex(c[1:])+b'\xff'
  for yy in range(max(0,y),min(y+h,self.h)):
   for xx in range(max(0,x),min(x+w,self.w)):
    i=(yy*self.w+xx)*4;self.p[i:i+4]=col
 def save(self,n):write(n,self.w,self.h,self.p)
for k in range(3):
 s=S(32,24);r=s.r;r(1,2,30,17,'#323f4a');r(3,4,26,13,'#66767a');r(5,5,22,10,'#a6b5ab');r(11,5,10,10,['#c77f5f','#719c87','#9c8cb2'][k]);
 if k==0:r(15,6,2,8,'#eff0d7');r(12,9,8,2,'#eff0d7')
 if k==1:r(12,7,2,6,'#eff0d7');r(18,7,2,6,'#eff0d7');r(14,5,4,2,'#eff0d7');r(14,13,4,2,'#eff0d7')
 if k==2:r(15,6,2,8,'#eff0d7');r(12,9,8,2,'#eff0d7');r(13,7,2,2,'#eff0d7');r(17,11,2,2,'#eff0d7')
r(14,19,4,3,'#323f4a');r(10,22,12,2,'#323f4a');s.save('monitor-'+str(k))
s=S(32,32);r=s.r;r(7,4,18,18,'#293641');r(9,6,14,14,'#465d69');r(6,20,20,5,'#293641');r(14,25,4,4,'#293641');r(7,29,18,2,'#293641');r(5,30,4,2,'#293641');r(23,30,4,2,'#293641');s.save('chair')
s=S(96,48);r=s.r;r(1,1,94,46,'#32414b');r(3,3,90,42,'#a2c9ce');r(5,5,86,38,'#7bb5c4');r(5,29,86,14,'#89aeb4');
for x,h in [(8,14),(18,22),(31,12),(43,26),(57,17),(68,24),(79,12)]:r(x,42-h,8,h,'#668b9f');r(x+2,44-h,2,2,'#d2dbb9')
r(31,4,3,39,'#e1e1ca');r(62,4,3,39,'#e1e1ca');s.save('city-window')
s=S(32,32);r=s.r;r(10,23,12,8,'#78513b');r(12,24,8,6,'#bc875a');r(14,8,3,17,'#547248');r(5,7,12,12,'#5d8b58');r(14,3,12,14,'#76a66b');r(4,12,8,7,'#87b577');s.save('plant')
s=S(64,32);r=s.r;r(2,3,60,24,'#4f3e54');r(5,5,54,18,'#765c81');r(7,7,23,12,'#9b7ca0');r(34,7,23,12,'#9b7ca0');r(3,21,58,7,'#654d70');r(7,27,5,4,'#3f3742');r(52,27,5,4,'#3f3742');s.save('sofa')
s=S(64,32);r=s.r;r(1,1,62,26,'#58666a');r(3,3,58,22,'#e8e8d9');r(6,21,52,3,'#bdc7bd');r(9,8,23,2,'#9cb2ab');r(9,12,16,2,'#b7c5b8');s.save('whiteboard')
s=S(64,32);r=s.r;r(2,6,60,17,'#565c5b');r(4,8,56,13,'#98bec1');r(5,9,54,4,'#d8eeea');r(9,23,3,8,'#565c5b');r(52,23,3,8,'#565c5b');s.save('glass-table')
