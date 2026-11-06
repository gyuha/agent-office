#!/usr/bin/env python3
"""Character-state contact sheet; nearest-neighbour scale, no dependencies."""
from pathlib import Path
from pnglib import png_read,png_write
P=Path(__file__).resolve().parents[1]/'sprites'; ids=[f'agent-{n:02d}' for n in range(1,9)]+['manager-01','manager-02'];states=['working','phone','sleeping','walk','idle'];w=5*72;h=10*72;data=bytearray(w*h*4)
for i in range(w*h):data[i*4:i*4+4]=bytes([37,46,50,255])
for y,person in enumerate(ids):
 for x,state in enumerate(states):
  sw,sh,raw=png_read(P/'characters'/person/(state+'.png'));sx=0;sy=128 if state in ('walk','idle') else 0
  for j in range(64):
   for k in range(64):
    a=((sy+j)*sw+sx+k)*4;b=(((y*72+j+4)*w)+(x*72+k+4))*4;alpha=raw[a+3]
    if alpha:
     for c in range(3):data[b+c]=(raw[a+c]*alpha+data[b+c]*(255-alpha))//255
# Enlarged by an integer factor to keep the sheet directly readable.
out=bytearray(w*h*16)
for y in range(h):
 for x in range(w):
  px=data[(y*w+x)*4:(y*w+x)*4+4]
  for yy in range(2):
   for xx in range(2):o=((y*2+yy)*(w*2)+x*2+xx)*4;out[o:o+4]=px
png_write(P/'contact-sheet.png',w*2,h*2,out);print('contact sheet:',len(ids),'appearances ×',len(states),'states')
