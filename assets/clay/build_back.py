"""Rebuild back-view parts and the back-view section of preview.html."""
from pathlib import Path
import json, re
root=Path(__file__).parent
m=json.loads((root/'manifest.json').read_text())
def save(path,vb,body,pivot=(0,0),**extra):
    p=root/path;p.parent.mkdir(parents=True,exist_ok=True)
    defs='<defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#30283b" stop-opacity=".29"/></linearGradient></defs>'
    p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{defs}{body}</svg>\n')
    v=list(map(float,vb.split()));m['files'][path]={'viewBox':v,'size':v[2:],'pivot':list(pivot),**extra}
for idx,ident in enumerate(m['appearanceIds']):
    pre=f'characters/{ident}/'
    def color(name):return re.search(r'fill="(#[0-9a-fA-F]{6})"',(root/pre/name).read_text()).group(1)
    skin=color('head.svg');hair=color('hair.svg');shirt=color('body.svg')
    ears=f'<ellipse cx="-33" cy="5" rx="7" ry="10" fill="{skin}"/><ellipse cx="33" cy="5" rx="7" ry="10" fill="{skin}"/>'
    save(pre+'head-back.svg','-43 -42 86 84',ears+f'<ellipse rx="34" ry="36" fill="{skin}"/><ellipse rx="34" ry="36" fill="url(#shade)"/>')
    # Full back coverage, with silhouettes matching the front's six hair designs.
    shapes=[
      'M-34 4Q-39-35-16-40Q0-49 16-40Q39-35 34 4L30 20Q0 32-30 20Z',
      'M-35 5Q-40-35-16-40Q0-49 16-40Q40-35 35 5L35 35Q0 42-35 35Z',
      'M-34 5Q-38-34-16-40Q2-48 18-38Q39-31 34 5L27 23Q0 31-29 23Z',
      'M-34 5Q-40-35-16-40Q0-48 17-39Q39-30 34 6L30 20Q16 29-26 22Z M25 2Q47-1 47 18Q50 38 32 49Q25 52 19 46Q32 32 27 18Z',
      'M-35 5Q-44-7-36-18Q-43-31-30-36Q-29-48-17-44Q-7-55 2-47Q14-55 22-44Q37-45 35-30Q45-23 36-11L34 9Q28 26 0 28Q-28 25-35 5Z',
      'M-34 5Q-39-35-16-40Q0-48 17-40Q39-34 34 5L29 22Q0 30-29 22Z M-13-39Q-19-61 0-65Q20-61 13-39Z']
    shape=shapes[idx%6]
    save(pre+'hair-back.svg','-52 -70 104 130',f'<path d="{shape}" fill="{hair}"/><path d="{shape}" fill="url(#shade)"/><path d="M-23 -27Q-7-40 12-31" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="5" stroke-linecap="round"/>')
    body='M-23 4Q-23-23-12-24H12Q23-23 23 4L21 38Q0 44-21 38Z' if idx%2==0 else 'M-28 4Q-30-22-14-24H14Q30-22 28 4Q34 29 26 38Q0 48-26 38Q-34 29-28 4Z'
    seam='<path d="M0 -18v51M-21 24q21 7 42 0" fill="none" stroke="#d6dfef" stroke-opacity=".4" stroke-width="1.8"/>' if ident.startswith('manager') else '<path d="M-15 -17Q0-21 15-17" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3" stroke-linecap="round"/>'
    save(pre+'body-back.svg','-36 -30 72 78',f'<path d="{body}" fill="{shirt}"/><path d="{body}" fill="url(#shade)"/>{seam}')
    for side,sign in [('l',-1),('r',1)]:
      vb='-34 -12 48 42' if side=='l' else '-14 -12 48 42'
      save(pre+f'arm-upper-{side}-back.svg',vb,f'<path d="M0 0Q{sign*16} 2 {sign*21} 20" fill="none" stroke="{shirt}" stroke-width="16" stroke-linecap="round"/><path d="M0-3Q{sign*12}-1 {sign*16} 10" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round"/>')
      save(pre+f'arm-lower-{side}-back.svg','-24 -12 48 38',f'<path d="M0 0Q{sign*9} 7 {sign*13} 18" fill="none" stroke="{skin}" stroke-width="13" stroke-linecap="round"/><path d="M0-3Q{sign*6} 2 {sign*9} 9" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>')
save('furniture/chair-back.svg','0 0 180 80','<ellipse cx="90" cy="74" rx="49" ry="6" fill="#3f344a" opacity=".25"/><rect x="51" y="3" width="78" height="67" rx="29" fill="#786d9f"/><rect x="55" y="5" width="70" height="58" rx="26" fill="#ae9ed2"/><rect x="55" y="5" width="70" height="58" rx="26" fill="url(#shade)"/><path d="M69 17Q90 7 111 17" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="4" stroke-linecap="round"/><path d="M63 60Q90 68 117 60" fill="none" stroke="#776c99" stroke-width="3"/>',(90,74),floorContact=[90,74],seat=[90,35])
rig={'body-back':{'parent':None,'offset':[0,0]},'head-back':{'parent':'body-back','offset':[0,-42]},'hair-back':{'parent':'head-back','offset':[0,0]}}
for side,sgn in [('l',-1),('r',1)]:
 rig[f'arm-upper-{side}-back']={'parent':'body-back','offset':[sgn*22,-15]}
 rig[f'arm-lower-{side}-back']={'parent':f'arm-upper-{side}-back','offset':[sgn*21,20]}
 rig[f'hand-{side}']={'parent':f'arm-lower-{side}-back','offset':[sgn*13,18]}
 rig[f'leg-{side}']={'parent':'body-back','offset':[sgn*12,35]}
m['backRig']=rig
m['backDrawOrder']=['leg-l','leg-r','body-back','arm-upper-l-back','arm-lower-l-back','hand-l','arm-upper-r-back','arm-lower-r-back','hand-r','head-back','hair-back','chair-back']
(root/'manifest.json').write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
# Self-contained preview: append an independent section, preserving the existing front preview.
p=root/'preview.html';s=p.read_text();s=re.sub(r'<!-- BACK_PREVIEW_START -->.*?<!-- BACK_PREVIEW_END -->','',s,flags=re.S)
assets={k:(root/k).read_text() for k in m['files'] if k.endswith('-back.svg') or k=='effects/zzz.svg'}
section='''<!-- BACK_PREVIEW_START --><header><h1>Back view</h1><p>10 appearances × working / phone / sleeping</p></header><main class="grid" id="back-grid"></main><script>
(()=>{const data=DATA, meta=METADATA, NS='http://www.w3.org/2000/svg', grid=document.getElementById('back-grid'), rigs=[];
function node(t,a={}){let n=document.createElementNS(NS,t);for(let [k,v] of Object.entries(a))n.setAttribute(k,v);return n}
function part(parent,path,x,y){let v=meta.files[path],g=node('g',{transform:`translate(${x} ${y})`}),svg=new DOMParser().parseFromString(data[path],'image/svg+xml').documentElement;svg=document.importNode(svg,true);svg.setAttribute('x',v.viewBox[0]);svg.setAttribute('y',v.viewBox[1]);svg.setAttribute('width',v.size[0]);svg.setAttribute('height',v.size[1]);g.appendChild(svg);parent.appendChild(g);return g}
for(const id of meta.appearanceIds)for(const state of ['working','phone','sleeping']){let c=document.createElement('article');c.className='card';let h=document.createElement('h2');h.textContent=`${id} · back · ${state}`;c.appendChild(h);let svg=node('svg',{viewBox:'-110 -120 220 200',role:'img','aria-label':`${id} back ${state}`});c.appendChild(svg);grid.appendChild(c);let shadow=node('ellipse',{cx:0,cy:63,rx:45,ry:9,fill:'#382f46',opacity:.25});svg.appendChild(shadow);let figure=node('g');svg.appendChild(figure);const pre=`characters/${id}/`;let body=part(figure,pre+'body-back.svg',0,0),arms=[];for(let [side,sign] of [['l',-1],['r',1]]){let upper=part(body,pre+`arm-upper-${side}-back.svg`,sign*22,-15);part(upper,pre+`arm-lower-${side}-back.svg`,sign*21,20);arms.push(upper)}let head=part(body,pre+'head-back.svg',0,-42);part(head,pre+'hair-back.svg',0,0);if(state==='phone')head.setAttribute('transform','translate(0 -37) rotate(12)');if(state==='sleeping'){body.setAttribute('transform','translate(0 12) scale(1 .75)');head.setAttribute('transform','translate(0 -30) rotate(18)');part(svg,'effects/zzz.svg',25,-94)}let chair=node('g',{transform:'translate(-54 17) scale(.6)'});svg.appendChild(chair);let img=new DOMParser().parseFromString(data['furniture/chair-back.svg'],'image/svg+xml').documentElement;img=document.importNode(img,true);img.setAttribute('width','180');img.setAttribute('height','80');chair.appendChild(img);rigs.push({body,head,arms,state})}
function tick(ms){let t=ms/1000;for(let r of rigs)if(r.state==='working'){r.body.setAttribute('transform',`translate(0 ${-2-Math.sin(t*15)*2})`);r.arms.forEach((a,i)=>{let s=i?1:-1;a.setAttribute('transform',`translate(${s*22} -15) rotate(${s*14*Math.sin(t*22)})`)})}requestAnimationFrame(tick)}requestAnimationFrame(tick);
})();</script><!-- BACK_PREVIEW_END -->'''.replace('METADATA',json.dumps(m,ensure_ascii=False)).replace('DATA',json.dumps(assets,ensure_ascii=False))
s=s.replace('</body></html>',section+'</body></html>');p.write_text(s)
