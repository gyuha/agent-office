#!/usr/bin/env python3
"""Side-elevation office pixel art, authored specifically for Tower."""
from pathlib import Path
import zlib,struct
D=Path(__file__).parent/'sprites'
class Sprite:
 def __init__(self,w,h):self.w=w;self.h=h;self.buf=bytearray(w*h*4)
 def rect(self,x,y,w,h,color):
  color=bytes.fromhex(color[1:])+b'\xff'
  for yy in range(max(0,y),min(y+h,self.h)):
   for xx in range(max(0,x),min(x+w,self.w)):
    pos=(yy*self.w+xx)*4;self.buf[pos:pos+4]=color
 def save(self,name):
  def part(typ,data):return struct.pack('>I',len(data))+typ+data+struct.pack('>I',zlib.crc32(typ+data)&0xffffffff)
  raw=b''.join(b'\0'+self.buf[y*self.w*4:(y+1)*self.w*4] for y in range(self.h));(D/(name+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+part(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+part(b'IDAT',zlib.compress(raw,9))+part(b'IEND',b''))
outline='#51453f'; dark='#6c584e'; wood='#aa7f63'; pale='#f3e2c9'; skin='#e4ad8c'; coral='#bf7261'; blue='#6d969b'
# Side-profile sitter: nose points right towards their computer. Distinct from the top-down and isometric figures.
for state,n in [('working',4),('away',1),('phone',2),('sleeping',2)]:
 for f in range(n):
  a=Sprite(72,72);r=a.rect
  # Tall backrest and wheeled side chair
  r(12,30,5,22,dark);r(13,28,17,5,dark);r(15,48,21,5,outline);r(23,52,4,9,outline);r(17,61,17,3,outline);r(16,64,4,3,dark);r(31,64,4,3,dark)
  if state!='away':
   if state=='sleeping':
    r(23,35,19,13,blue);r(34,37,21,7,skin);r(41,34,14,6,'#705044');r(52,7+f*3,13,2,pale);r(61,9+f*3,4,2,pale);r(57,11+f*3,4,2,pale);r(52,13+f*3,13,2,pale);r(58,1+f*3,9,2,pale)
   else:
    y=15+(f%2 if state=='working' else 4);r(23,34,14,15,blue);r(25,48,17,5,outline);r(36,49,6,10,outline);r(23,y,18,19,'#674b40');r(26,y+4,16,15,skin);r(41,y+10,4,5,skin);r(36,y+9,3,3,outline);r(37,y+15,4,2,coral)
    if state=='working':
     r(35,36+(f%2)*2,17,4,skin);r(35,42-(f%2)*2,18,3,skin);r(38,46,15,2,'#f3c4a1');r(43,32,12,2,'#f3c4a1');r(2,23,12,2,pale);r(4,28,10,2,pale);r(45,13,4,6,'#78c4ce');r(49,18,3,5,'#78c4ce');r(16,2,4,10,'#e6c7b2');r(23,0,4,10,'#e6c7b2');r(30,3,4,8,'#e6c7b2');r(55,1+2*f,14,9,pale);r(57,3+2*f,8,1,dark)
    else:r(41,31,8,13,outline);r(43,33,4,7,'#a7c9c6');r(38,37,5,3,skin)
  else:r(45,25,15,10,pale);r(47,28,9,1,dark);r(47,31,7,1,dark)
  a.save(state+'-'+str(f))
# Side desks, monitors face the seated person while the broad back is visible to viewers.
for k in range(3):
 a=Sprite(72,64);r=a.rect;r(9,35,58,6,wood);r(9,41,5,21,dark);r(62,41,5,21,dark);r(10,34,55,2,'#d5b18d');r(28,8,32,24,outline);r(30,10,28,20,'#e5dfc9');r(37,12,14,16,[coral,'#7ca69a','#9d8cb5'][k]);r(42,14,4,12,pale)
 if k==0:r(39,18,10,4,pale)
 if k==1:r(47,16,2,8,pale);r(39,16,2,8,pale)
 if k==2:r(39,19,10,2,pale);r(39,15,2,2,pale);r(48,23,2,2,pale)
 r(41,32,6,3,outline);r(12,27,9,6,pale);a.save('desk-'+str(k))
a=Sprite(98,70);r=a.rect;r(5,38,88,9,'#805640');r(7,34,84,5,'#c2956e');r(9,47,9,22,outline);r(80,47,9,22,outline);r(37,3,38,29,outline);r(40,6,32,23,'#eee5ce');r(48,9,16,17,coral);r(54,11,4,13,pale);r(50,15,12,4,pale);r(53,32,6,3,outline);r(12,27,12,7,'#e1c28d');a.save('manager-desk')
# Architectural tiles and furnishings, drawn from the side.
a=Sprite(24,24);r=a.rect;r(0,0,24,24,'#eadbc6');r(0,22,24,2,'#a78570');r(0,0,1,22,'#dbc7b1');a.save('wall')
a=Sprite(48,56);r=a.rect;r(0,0,48,56,dark);r(3,3,42,50,'#cce0d8');r(5,5,38,46,'#a9cfd0');r(22,5,4,46,pale);r(5,26,38,4,pale);r(8,8,9,3,pale);a.save('window')
a=Sprite(24,32);r=a.rect;r(3,0,18,32,outline);r(5,2,14,30,'#c29a78');r(7,4,10,12,'#dbb894');r(7,18,10,12,'#dbb894');r(16,16,2,2,pale);a.save('door')
a=Sprite(28,34);r=a.rect;r(8,23,12,10,dark);r(10,24,8,7,'#bf8060');r(4,12,20,12,'#719b75');r(8,5,12,16,'#8db281');r(3,16,8,6,'#98bb87');a.save('plant')
a=Sprite(26,34);r=a.rect;r(4,4,18,28,outline);r(6,6,14,24,'#a3a29a');r(8,9,10,7,'#5d625e');r(10,21,8,7,pale);a.save('coffee')
a=Sprite(24,96);r=a.rect;r(10,12,5,80,outline);r(3,8,19,5,outline);r(2,4,7,8,'#dfc68e');r(15,4,7,8,'#dfc68e');r(5,92,15,4,dark);a.save('lamp')
a=Sprite(32,48);r=a.rect;r(2,1,28,47,'#8a8178');r(5,4,22,41,'#b6b2a8');r(6,5,9,38,'#d6d1c3');r(17,5,9,38,'#c7c2b6');r(15,4,2,41,outline);r(20,16,2,2,outline);a.save('elevator')
