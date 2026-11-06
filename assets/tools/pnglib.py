import struct,zlib
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
