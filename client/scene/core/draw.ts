import type {Actors,Layout,Room,Station,Actor} from './layout';
import {manifest,type OfficeSprites} from './office-assets';
import {plateGeometry,deskDepth} from './nameplates';
export interface Context {
  [key:string]:any;
  drawImage(...args:any[]):void;
}
const providerColors = new Map<string,string>([['claude','#648c66'],['codex','#5b80b1'],['gemini','#96627f'],['antigravity','#96627f']]);
export function providerColor(provider:string):string{return providerColors.get(provider)??'#b58a36';}
/** Frame geometry, length and rate come from the manifest; arbitrary sheet lengths are supported. */
export function sheetFrame(spec:any,image:any,time:number){
  const w=spec.frameW||spec.frame?.[0]||image.naturalWidth||image.width;
  const h=spec.frameH||spec.frame?.[1]||image.naturalHeight||image.height;
  const count=Array.isArray(spec.frames)?spec.frames.length:spec.frames||1;
  const index=spec.loop===false?Math.min(count-1,Math.floor(time*(spec.fps||1))):Math.floor(time*(spec.fps||1))%count;
  const f=Array.isArray(spec.frames)?spec.frames[index]:null;
  const cols=Math.max(1,Math.floor((image.naturalWidth||image.width)/w));
  return {x:f?.x??(index%cols*w),y:f?.y??(Math.floor(index/cols)*h),w:f?.w||w,h:f?.h||h};
}
function actorKey(s:Station,state:string,sprites:OfficeSprites):string{
  const actors=manifest.actors;
  const entry=s.manager?actors?.orchestrator:actors?.[s.variant]||actors?.[`actor-${s.variant}`];
  const mapped=state==='walking-left'?'walk_left':state==='walking-right'?'walk_right':state;
  const value=entry?.[mapped]||entry?.animations?.[mapped]||(s.manager?(state==='away'?entry?.phone:entry?.working):undefined);
  if(typeof value==='string'&&sprites[value])return value;
  if(value?.sheet&&sprites[value.sheet])return value.sheet;
  return [`actor-${s.variant}-${state}`,`${s.variant}-${state}`,`actor-${s.variant}-sheet`].find(k=>sprites[k])||'';
}
export function draw(c:Context,layout:Layout,actors:Actors,time:number,sprites:OfficeSprites,epoch=Date.now()){
  c.fillStyle='#f2e6d1';c.fillRect(0,0,layout.width,layout.height);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const image=(key:string,x:number,y:number,w?:number,h?:number,alpha=1,t=time/1000)=>{
    const asset=sprites[key];if(!asset)return;
    c.save();c.globalAlpha=alpha;
    const f=sheetFrame(asset.spec,asset.image,t);
    c.drawImage(asset.image,f.x,f.y,f.w,f.h,x,y,w??asset.spec.size?.[0]??f.w,h??asset.spec.size?.[1]??f.h);c.restore();
  };
  const effect=(name:string,x:number,y:number,w:number,h:number,t:number,alpha=1)=>{
    const value=manifest.effects?.[name];
    const key=typeof value==='string'?value:value?.sheet;
    const fallback:Record<string,string>={flame_aura:`flame-${Math.floor(t*5)%3}`,pop_plus3:'points-3',pop_plus10:'points-10',bubble_done:'bubble-done',bubble_prup:'bubble-pr',attention:'emphasis',zzz:'zzz'};
    image(key||fallback[name]||name,x,y,w,h,alpha,t);
  };
  const figure=(s:Station,a:Actor,state:string,alpha=1,clip?:number[])=>{
    const key=actorKey(s,state,sprites),asset=sprites[key];if(!asset)return;
    const sp=asset.spec;
    let f=sheetFrame(sp,asset.image,a.phase);
    // v10's original combined 4x3 sheets are a compatibility input only.
    if(!sp.frameW&&key.endsWith('-sheet')){
      const i=state==='walking-left'?8+Math.floor(a.phase*6)%2:state==='walking-right'?10+Math.floor(a.phase*6)%2:state==='working'?Math.floor(a.phase*6)%4:state==='phone'||state==='away'?4+Math.floor(a.phase*2.5)%2:6+Math.floor(a.phase)%2;
      f={x:i%4*320,y:Math.floor(i/4)*432,w:320,h:432};
    }
    const scale=s.actorHeight/f.h*(a.moving?.8:1);
    const anchor=sp.anchor;const ax=Array.isArray(anchor)?anchor[0]:anchor?.x??f.w*.5;
    const ay=Array.isArray(anchor)?anchor[1]:anchor?.y??f.h*.95;
    c.save();c.globalAlpha=alpha;
    if(clip){c.beginPath();c.rect(...clip);c.clip();}
    c.drawImage(asset.image,f.x,f.y,f.w,f.h,a.x-ax*scale,a.y-ay*scale,f.w*scale,f.h*scale);
    c.restore();
  };
  const occupant=(s:Station,a:Actor,clip?:number[])=>{
    const mix=Math.min(1,(a.elapsed-a.changed)/.35);
    const state=a.moving?`walking-${a.direction}`:a.state;
    if(a.previous&&mix<1&&!a.moving)figure(s,a,a.previous,1-mix,clip);
    figure(s,a,state,a.previous&&!a.moving?mix:1,clip);
  };
  const nameplate=(s:Station)=>{
    const p=plateGeometry(s,layout.viewportScale);c.save();
    const gradient=c.createLinearGradient?.(0,p.y,0,p.y+p.height);
    if(gradient?.addColorStop){gradient.addColorStop(0,'#efcf99');gradient.addColorStop(1,'#d4ad72');}
    c.fillStyle=gradient?.addColorStop?gradient:'#dfbc87';c.strokeStyle='#81603c';c.lineWidth=1;
    c.beginPath();if(c.roundRect)c.roundRect(p.x,p.y,p.width,p.height,3);else c.rect(p.x,p.y,p.width,p.height);c.fill();c.stroke();
    c.font=`800 ${p.font}px monospace`;c.textAlign='left';c.textBaseline='middle';
    const measure=(text:string)=>c.measureText?.(text)?.width??Array.from(text).length*p.font*.6;
    const available=p.width-p.padding*2-p.icon-p.gap;
    let label=s.agent.name;
    if(measure(label)>available){const chars=Array.from(label);while(chars.length&&measure(chars.join('')+'…')>available)chars.pop();label=chars.join('')+'…';}
    const content=p.icon+p.gap+measure(label),left=p.x+(p.width-content)/2;
    const icon=sprites['provider-icon-'+s.agent.provider];
    if(icon)image('provider-icon-'+s.agent.provider,left,s.plate.y-p.icon/2,p.icon,p.icon);
    else{c.fillStyle=providerColor(s.agent.provider);c.beginPath();c.arc(left+p.icon/2,s.plate.y,p.icon*.3,0,Math.PI*2);c.fill();}
    c.fillStyle='#4d3327';c.fillText(label,left+p.icon+p.gap,s.plate.y);c.restore();
  };
  for(const room of layout.rooms){
    image(`background-${room.background}`,0,room.sceneY,1536,room.sceneHeight);
    const jobs:{y:number;draw:()=>void}[]=[];
    for(const s of room.stations){
      const a=actors[s.agent.id];if(!a)continue;
      const seated=!a.moving&&Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2;
      const drawStation=()=>{
        if(!s.manager)image(`pod-${s.pod}-back`,s.x,s.y,s.width,s.height);
        if(seated){
          if(a.state==='working'&&epoch-s.agent.stateSince>=60000)effect('flame_aura',s.seat.x-108,s.seat.y-s.actorHeight-35,215,220,a.phase,.92);
          occupant(s,a);
        }
        if(s.manager){const sp=sprites[`lead-front-${room.background}`]?.spec,b=sp?.sourceBox;
          if(sp&&b){const scale=1536/(sprites[`background-${room.background}`]?.spec.size?.[0]||1536);image(`lead-front-${room.background}`,b[0]*scale,room.sceneY+b[1]*scale,(sp.size?.[0]||0)*scale,(sp.size?.[1]||0)*scale);}
        }else image(`pod-${s.pod}-front`,s.x,s.y,s.width,s.height);
        if(seated){const clip=s.manager?[s.seat.x-130,s.seat.y-s.actorHeight,260,s.actorHeight*(1-125/432)]:[s.x-12,s.y-80,s.width*.53+12,s.seat.y-125*s.actorHeight/432-(s.y-80)];occupant(s,a,clip);}
        nameplate(s);
      };
      jobs.push({y:deskDepth(s,room.sceneY),draw:drawStation});
      if(!seated)jobs.push({y:a.y,draw:()=>occupant(s,a)});
    }
    jobs.sort((a,b)=>a.y-b.y).forEach(j=>j.draw());
    for(const s of room.stations){const a=actors[s.agent.id];if(!a)continue;
      const fy=a.y-s.actorHeight;
      if(a.state==='sleeping'&&!a.moving)effect('zzz',a.x+48,fy,75,57,a.phase);
      if(s.agent.needsAttention)effect('attention',a.x-35,fy-45,70,65,a.phase);
      if(a.state==='working'&&!a.moving){const p=(a.phase+s.index*.43)%6;
        if(p<1.5)effect(s.index%2?'pop_plus10':'pop_plus3',a.x+40,fy+20-p*23,70,54,p,1-p/1.5);
        if((a.phase+s.index*.93)%13<1.3){const x=a.x-44,y=fy-35;const blocked=room.stations.some(b=>b!==s&&!b.manager&&x<b.x+b.width&&x+95>b.x&&y<b.y+b.height&&y+62>b.y);if(!blocked)effect(s.index%2?'bubble_prup':'bubble_done',x,y,95,62,(a.phase+s.index*.93)%13);}
      }
    }
  }
  for(const h of layout.headers){c.fillStyle='#4d3327';c.font='24px monospace';c.fillText(h.text,h.x,h.y);}
}
