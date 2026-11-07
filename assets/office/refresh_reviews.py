from pathlib import Path
from PIL import Image,ImageDraw
import json,math
R=Path(__file__).resolve().parent;M=json.loads((R/'manifest.json').read_text());contact=Image.new('RGB',(2520,math.ceil(len(M['sheets'])/6)*170),(241,231,212));d=ImageDraw.Draw(contact)
for k,(id,s) in enumerate(M['sheets'].items()):
 im=Image.open(R/s['file']).convert('RGBA');fw=round(s['frameW']*M['runtimeScale']);fh=round(s['frameH']*M['runtimeScale']);frames=[]
 for i in range(s['frames']):
  a=im.crop((i*fw,0,(i+1)*fw,fh));bg=Image.new('RGBA',a.size,(244,236,219,255));bg.alpha_composite(a);frames.append(bg.convert('RGB'))
 frames[0].save(R/'review'/(id+'.gif'),save_all=True,append_images=frames[1:],duration=round(1000/s['fps']),loop=0,disposal=2)
 x=k%6*420;y=k//6*170;d.text((x+5,y+3),id,fill='black')
 for i,a in enumerate(frames):contact.paste(a,(x+i*102+4,y+22))
contact.save(R/'review/contact-sheet.png')
