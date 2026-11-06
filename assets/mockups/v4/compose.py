#!/usr/bin/env python3
"""Compose locally supplied ULPC layers into eight PNG sheets (stdlib only)."""
from pathlib import Path
import struct,zlib,csv
HERE=Path(__file__).resolve().parent
ASSETS=HERE.parent.parent
LPC=ASSETS/'vendor/lpc/spritesheets'
OUT=HERE/'sprites'
used=set()
def png_read(path):
 data=path.read_bytes();pos=8;packed=b'';pal=[];trans=b''
 while pos<len(data):
  n=struct.unpack('>I',data[pos:pos+4])[0];typ=data[pos+4:pos+8];v=data[pos+8:pos+8+n];pos+=12+n
  if typ==b'IHDR':w,h,depth,kind,_,_,interlace=struct.unpack('>IIBBBBB',v)
  elif typ==b'PLTE':pal=[tuple(v[i:i+3]) for i in range(0,len(v),3)]
  elif typ==b'tRNS':trans=v
  elif typ==b'IDAT':packed+=v
  elif typ==b'IEND':break
 if (depth!=8 and not (kind==3 and depth in (1,2,4))) or interlace or kind not in (3,6,2):raise ValueError((path,depth,kind,interlace))
 channels={3:1,6:4,2:3}[kind];stride=(w*depth+7)//8 if kind==3 else w*channels;raw=zlib.decompress(packed);prior=bytearray(stride);out=bytearray(w*h*4);off=0
 for y in range(h):
  f=raw[off];off+=1;row=bytearray(raw[off:off+stride]);off+=stride
  for i in range(stride):
   a=row[i-channels] if i>=channels else 0;b=prior[i];c=prior[i-channels] if i>=channels else 0
   if f==1:row[i]=(row[i]+a)&255
   elif f==2:row[i]=(row[i]+b)&255
   elif f==3:row[i]=(row[i]+((a+b)//2))&255
   elif f==4:
    p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c);row[i]=(row[i]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
  for x in range(w):
   if kind==3:
    idx=(row[x*depth//8]>>(8-depth-(x*depth%8)))&((1<<depth)-1);rgba=(*pal[idx],trans[idx] if idx<len(trans) else 255)
   elif kind==6:rgba=row[x*4:x*4+4]
   else:rgba=(*row[x*3:x*3+3],255)
   o=(y*w+x)*4;out[o:o+4]=bytes(rgba)
  prior=row
 return w,h,out
def png_write(path,w,h,p):
 def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
 raw=b''.join(b'\0'+p[y*w*4:(y+1)*w*4] for y in range(h));path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
def compose(paths,out,tint,shirt):
 canvas=None;w=h=0
 for idx,rel in enumerate(paths):
  path=LPC/rel
  if not path.exists():raise FileNotFoundError(path)
  used.add(rel);sw,sh,p=png_read(path)
  if canvas is None:w,h=sw,sh;canvas=bytearray(w*h*4)
  if (sw,sh)!=(w,h):raise ValueError((rel,w,h,sw,sh))
  for i in range(0,len(p),4):
   alpha=p[i+3]
   if not alpha:continue
   rgb=p[i:i+3]
   if idx==4 or idx==len(paths)-1:
    tint_now=shirt if idx==4 else tint
    lum=(int(rgb[0])+int(rgb[1])+int(rgb[2]))//3;rgb=bytes(min(255,lum*c//160) for c in tint_now)
   if alpha==255:canvas[i:i+4]=bytes(rgb)+b'\xff'
   else:
    old=canvas[i:i+4];oa=alpha+old[3]*(255-alpha)//255
    if oa:canvas[i:i+4]=bytes((rgb[j]*alpha+old[j]*old[3]*(255-alpha)//255)//oa for j in range(3))+bytes([oa])
 png_write(out,w,h,canvas)
styles=['plain','bob','spiked','messy1','parted','pixie','bangs','plain'];colors=[(56,45,37),(95,63,42),(205,166,94),(81,61,52),(104,69,43),(53,51,48),(181,93,48),(120,91,72)]
for i,style in enumerate(styles):
 for action in ['sit','walk','idle']:
  paths=[f'body/bodies/male/{action}.png',f'head/heads/human/male/{action}.png',f'legs/pants/male/{action}.png',f'feet/shoes/basic/male/{action}.png',f'torso/clothes/{"longsleeve/longsleeve" if i%2==0 else "shortsleeve/shortsleeve"}/male/{action}.png',f'hair/{style}/adult/{action}.png']
  compose(paths,OUT/f'agent-{i}-{action}.png',colors[i],[(54,67,92),(104,131,113),(125,100,105),(99,115,144),(157,122,77),(112,129,130),(151,104,94),(117,111,145)][i])
# Capture the exact CSV entries used, not the entire vendor credit list.
rows=list(csv.DictReader((ASSETS/'vendor/lpc/CREDITS.csv').open(newline='',encoding='utf8')))
by={r['filename']:r for r in rows};missing=sorted(used-set(by));
if missing:raise RuntimeError('Missing LPC credits: '+', '.join(missing))
with (HERE/'lpc-used-credits.csv').open('w',newline='',encoding='utf8') as f:
 writer=csv.DictWriter(f,fieldnames=['filename','notes','authors','licenses','urls']);writer.writeheader();writer.writerows(by[k] for k in sorted(used))
