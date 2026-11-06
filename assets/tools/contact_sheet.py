#!/usr/bin/env python3
"""Character-state contact sheet; nearest-neighbour scale, no dependencies."""
from pathlib import Path
from pnglib import png_read,png_write
P=Path(__file__).resolve().parents[1]/'sprites'; ids=[f'agent-{n:02d}' for n in range(1,9)]+['manager-01','manager-02'];states=['working','phone','sleeping','walk','idle'];w=5*72;h=10*72+48;data=bytearray(w*h*4)
for i in range(w*h):data[i*4:i*4+4]=bytes([37,46,50,255])
for y,person in enumerate(ids):
 for x,state in enumerate(states):
  sw,sh,raw=png_read(P/'characters'/person/(state+'.png'));sx=0;sy=128 if state in ('walk','idle') else 0
  for j in range(64):
   for k in range(64):
    a=((sy+j)*sw+sx+k)*4;b=(((y*72+j+4)*w)+(x*72+k+4))*4;alpha=raw[a+3]
    if alpha:
     for c in range(3):data[b+c]=(raw[a+c]*alpha+data[b+c]*(255-alpha))//255
# Final row: six provider icons and the unknown fallback, at the same 2× display scale.
providers=['claude','codex','antigravity','copilot','muse','opencode','unknown']
for col,provider in enumerate(providers):
 sw,sh,raw=png_read(P/'furniture'/('monitor-'+provider+'.png'))
 for j in range(sh):
  for k in range(sw):
   a=(j*sw+k)*4;b=(((720+j+2)*w)+(col*50+k+8))*4;alpha=raw[a+3]
   if alpha:
    for c in range(3):data[b+c]=(raw[a+c]*alpha+data[b+c]*(255-alpha))//255
font={'s':['011','100','010','001','110'],'a':['010','101','111','101','101'],'c':['011','100','100','100','011'],'d':['110','101','101','101','110'],'e':['111','100','110','100','111'],'g':['011','100','101','101','011'],'i':['111','010','010','010','111'],'l':['100','100','100','100','111'],'m':['101','111','111','101','101'],'n':['101','111','111','111','101'],'o':['010','101','101','101','010'],'p':['110','101','110','100','100'],'r':['110','101','110','101','101'],'t':['111','010','010','010','010'],'u':['101','101','101','101','111'],'v':['101','101','101','101','010'],'x':['101','101','010','101','101'],'k':['101','101','110','101','101'],'w':['101','101','111','111','101']}
for col,provider in enumerate(providers):
 for i,letter in enumerate(provider):
  for y,row in enumerate(font.get(letter,[])):
   for x,bit in enumerate(row):
    if bit=='1':
     b=(((720+30+y)*w)+(col*50+3+i*4+x))*4;data[b:b+4]=bytes([222,229,220,255])
# Enlarged by an integer factor to keep the sheet directly readable.
out=bytearray(w*h*16)
for y in range(h):
 for x in range(w):
  px=data[(y*w+x)*4:(y*w+x)*4+4]
  for yy in range(2):
   for xx in range(2):o=((y*2+yy)*(w*2)+x*2+xx)*4;out[o:o+4]=px
png_write(P/'contact-sheet.png',w*2,h*2,out);print('contact sheet:',len(ids),'appearances ×',len(states),'states; 7 monitors')
