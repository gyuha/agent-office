import type {Actors,Layout,Room,Station,Actor} from './layout';
import {manifest,type OfficeSprites, type DeskSpec} from './office-assets';
import {plateGeometry,deskDepth,managerBehindDesk,actorWalkLift} from './nameplates';
import {workerLabel} from './workers';
export interface Context {
  [key:string]:any;
  drawImage(...args:any[]):void;
}
const providerColors = new Map<string,string>([['claude','#648c66'],['codex','#5b80b1'],['gemini','#96627f'],['antigravity','#96627f']]);
export function providerColor(provider:string):string{return providerColors.get(provider)??'#b58a36';}
/** Frame geometry, length and rate come from the manifest; arbitrary sheet lengths are supported. */
export function sheetFrame(spec:any,image:any,time:number){
  const runtimeScale=spec.runtimeScale??1;
  const w=spec.frameW||spec.frame?.[0]||(spec.runtimePaddedLogicalSize?spec.size[0]:(image.naturalWidth||image.width)/runtimeScale);
  const h=spec.frameH||spec.frame?.[1]||(spec.runtimePaddedLogicalSize?spec.size[1]:(image.naturalHeight||image.height)/runtimeScale);
  const count=Array.isArray(spec.frames)?spec.frames.length:spec.frames||1;
  const index=spec.loop===false?Math.min(count-1,Math.floor(time*(spec.fps||1))):Math.floor(time*(spec.fps||1))%count;
  const f=Array.isArray(spec.frames)?spec.frames[index]:null;
  const cols=Math.max(1,Math.floor((image.naturalWidth||image.width)/(w*runtimeScale)));
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
export function drawBackground(c:Context,layout:Layout,sprites:OfficeSprites){
  c.fillStyle='#f2e6d1';c.fillRect(0,0,layout.width,layout.height);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  for(const room of layout.rooms){
    const asset=sprites[`background-${room.background}`];if(!asset)continue;
    const sw=asset.spec.runtimePaddedLogicalSize?asset.spec.size![0]*(asset.spec.runtimeScale??1):(asset.image.naturalWidth||asset.image.width);
    const sh=asset.spec.runtimePaddedLogicalSize?asset.spec.size![1]*(asset.spec.runtimeScale??1):(asset.image.naturalHeight||asset.image.height);
    // Preserve walls and bottom trim; extend only the clear floor for walking aisles.
    const trimSpec=asset.spec.bottomTrim,rs=asset.spec.runtimeScale??1;
    const wall=manifest.backgroundTrim?.wallHeight??400;
    const trim=trimSpec?.destinationHeight??trimSpec?.height??manifest.backgroundTrim?.bottomTrimHeight??24;
    const sourceScale=sh/room.backgroundHeight;
    const rect=trimSpec?.sourceRect;
    const sx=rect?rect[0]*rs:0,sy=rect?rect[1]*rs:sh-trim*sourceScale;
    const tw=rect?rect[2]*rs:sw,th=rect?rect[3]*rs:trim*sourceScale;
    c.drawImage(asset.image,0,0,sw,wall*sourceScale,0,room.sceneY,1536,wall);
    c.drawImage(asset.image,0,wall*sourceScale,sw,Math.min(sy-wall*sourceScale,(room.sceneHeight-wall-trim)*sourceScale),0,room.sceneY+wall,1536,room.sceneHeight-wall-trim);
    c.drawImage(asset.image,sx,sy,tw,th,0,room.sceneY+room.sceneHeight-trim,1536,trim);
  }
}
export function draw(c:Context,layout:Layout,actors:Actors,time:number,sprites:OfficeSprites,epoch=Date.now(),background?:any){
  if(background){c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(background,0,0);c.restore();}
  else drawBackground(c,layout,sprites);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  let fade=1; // temporary workers fade in/out; 1 for everything else
  const image=(key:string,x:number,y:number,w?:number,h?:number,alpha=1,t=time/1000,nativeDeskBase=false)=>{
    const asset=sprites[key];if(!asset)return;
    c.save();c.globalAlpha=alpha*fade;
    const bitmap=nativeDeskBase?(asset.deskBase||asset.image):asset.image;
    const f=sheetFrame(asset.spec,bitmap,t);
    const rs=asset.spec.runtimeScale??1;
    c.drawImage(bitmap,f.x*rs,f.y*rs,f.w*rs,f.h*rs,x,y,w??asset.spec.size?.[0]??f.w,h??asset.spec.size?.[1]??f.h);c.restore();
  };
  const effect=(name:string,x:number,y:number,w:number,h:number,t:number,alpha=1)=>{
    const value=manifest.effects?.[name];
    const key=typeof value==='string'?value:value?.sheet;
    const fallback:Record<string,string>={flame_aura:`flame-${Math.floor(t*5)%3}`,pop_plus3:'points-3',pop_plus10:'points-10',bubble_done:'bubble-done',bubble_prup:'bubble-pr',attention:'emphasis',zzz:'zzz'};
    image(key||fallback[name]||name,x,y,w,h,alpha,t);
  };
  const geometry=(s:Station,a:Actor,state:string,desk?:DeskSpec,rest=false)=>{
    const asset=sprites[actorKey(s,state,sprites)];if(!asset)return;
    const sp=asset.spec,f=sheetFrame(sp,asset.image,state.startsWith('walking-')?(a.moving?(a.walkPhase??a.phase):0):a.phase),rs=sp.runtimeScale??1;
    const walking=state.startsWith('walking-');
    const onRest=rest&&!walking;
    const height=s.actorHeight;
    const factor=height/f.h;
    const anch=walking?sp.anchor:desk?.actorAnchor||(onRest?s.rest!.spec.actorAnchor:sp.anchor);
    const anchor=Array.isArray(anch)?anch:[(anch as any)?.x??80,(anch as any)?.y??205];
    const who=s.manager?'orchestrator':`actor-${s.variant}`;
    let adj=desk?.actorOffsets?.[who]?.[state]||(onRest?s.rest!.spec.actorOffset:[0,0]);
    let offset=desk?.actorStateYOffset?.[state]??(state==='away'?desk?.actorStateYOffset?.phone:0)??0;
    if(desk&&!walking&&(state==='working'||state==='awaiting')&&sprites[actorKey(s,'awaiting',sprites)]){
      // Typing and the raised-hand pose share one continuous seat height: eased by a.ask (0 working .. 1 awaiting).
      const b=a.ask??0,w=desk.actorOffsets?.[who]?.working||[0,0],q=desk.actorOffsets?.[who]?.awaiting||w;
      const wy=desk.actorStateYOffset?.working??0,qy=desk.actorStateYOffset?.awaiting??wy;
      adj=[w[0]+(q[0]-w[0])*b,w[1]+(q[1]-w[1])*b];offset=wy+(qy-wy)*b;
    }
    const moduleScale=desk?s.moduleScale:onRest?s.rest!.scale:1;
    const origin=onRest?s.rest!.seat:desk&&!walking?s.bodySeat:walking?{x:a.x,y:a.y-actorWalkLift(s,a)}:a;
    const x=origin.x-anchor[0]*factor+adj[0]*moduleScale;
    const y=origin.y-anchor[1]*factor+(offset+adj[1])*moduleScale;
    return {asset,f,rs,factor,x,y,height};
  };
  const figure=(s:Station,a:Actor,state:string,alpha=1,desk?:DeskSpec,rest=false)=>{
    const g=geometry(s,a,state,desk,rest);if(!g)return;
    const {asset,f,rs,factor,x,y}=g;
    c.save();c.globalAlpha=alpha*fade;
    if(desk?.actorClip){const p=desk.actorClip;c.beginPath();c.rect(s.x+p[0]*s.moduleScale,s.y+p[1]*s.moduleScale,(p[2]-p[0])*s.moduleScale,(p[3]-p[1])*s.moduleScale);c.clip();}
    const source=desk?.actorSourceClip?.[state]||[0,0,f.w,f.h];
    c.drawImage(asset.image,(f.x+source[0])*rs,(f.y+source[1])*rs,source[2]*rs,source[3]*rs,
      x+source[0]*factor,y+source[1]*factor,source[2]*factor,source[3]*factor);
    c.restore();
  };
  const actorOverlay=(s:Station,a:Actor,state:string)=>{
    const cfg=s.desk.actorOverlay,rule=cfg?.[state],g=geometry(s,a,state,s.desk);if(!rule||!g)return;
    const id=s.manager?'orchestrator':`actor-${s.variant}`;
    c.save();const clip=cfg.clipInModule;
    if(clip){c.beginPath();c.rect(s.x+clip[0]*s.moduleScale,s.y+clip[1]*s.moduleScale,(clip[2]-clip[0])*s.moduleScale,(clip[3]-clip[1])*s.moduleScale);c.clip();}
    const handKey=manifest.armOverlays?.[id]?.[state]||(rule.preferSheet&&rule.sheetByActor?.[id]);
    const hands=handKey&&sprites[handKey];
    if(hands){
      const f=sheetFrame(hands.spec,hands.image,a.phase),rs=hands.spec.runtimeScale??1;
      c.drawImage(hands.image,f.x*rs,f.y*rs,f.w*rs,f.h*rs,g.x,g.y,f.w*g.factor,f.h*g.factor);
    }else for(const rect of rule.sourceRects||rule.byActor?.[id]||[]){
      const [x0,y0,x1,y1]=rect;
      c.drawImage(g.asset.image,(g.f.x+x0)*g.rs,(g.f.y+y0)*g.rs,(x1-x0)*g.rs,(y1-y0)*g.rs,g.x+x0*g.factor,g.y+y0*g.factor,(x1-x0)*g.factor,(y1-y0)*g.factor);
    }
    c.restore();
  };
  /** Seated agent waiting on a question: raised-hand loop replaces typing (needs the awaiting sheet). */
  const awaitingPose=(s:Station,a:Actor,seated:boolean)=>seated&&a.state==='working'&&s.agent.needsAttention&&!!sprites[actorKey(s,'awaiting',sprites)];
  const occupant=(s:Station,a:Actor,desk?:DeskSpec,rest=false)=>{
    // A single opaque pose: no translucent double silhouettes during transitions.
    const state=a.moving||(!desk&&!rest)?`walking-${a.direction}`:rest?'away':desk&&a.state==='away'?'phone':desk&&awaitingPose(s,a,true)?'awaiting':a.state;
    figure(s,a,state,1,desk,rest);
  };
  const nameplate=(s:Station,room?:Room)=>{
    const p=plateGeometry(s,layout.viewportScale);c.save();
    const gradient=c.createLinearGradient?.(0,p.y,0,p.y+p.height);
    // Temporary workers get a teal plate with a dashed border so they never read as regular staff.
    const temp=!!s.temp;
    if(gradient?.addColorStop){gradient.addColorStop(0,temp?'#bfe3e0':'#efcf99');gradient.addColorStop(1,temp?'#86bfbd':'#d4ad72');}
    c.fillStyle=gradient?.addColorStop?gradient:temp?'#a2d0cd':'#dfbc87';c.strokeStyle=temp?'#2c6e75':'#81603c';c.lineWidth=1;
    if(temp&&c.setLineDash)c.setLineDash([3,2]);
    c.beginPath();if(c.roundRect)c.roundRect(p.x,p.y,p.width,p.height,3);else c.rect(p.x,p.y,p.width,p.height);c.fill();c.stroke();
    c.font=`800 ${p.font}px monospace`;c.textAlign='left';c.textBaseline='middle';
    const measure=(text:string)=>c.measureText?.(text)?.width??Array.from(text).length*p.font*.6;
    const lead=p.icon+p.gap,available=p.width-p.padding*2-lead;
    let label=temp&&room?workerLabel(room,s):s.agent.name;
    if(measure(label)>available){const chars=Array.from(label);while(chars.length&&measure(chars.join('')+'…')>available)chars.pop();label=chars.join('')+'…';}
    const content=lead+measure(label),left=p.x+(p.width-content)/2;
    const icons=manifest.providerIcons||{};
    const iconKey=Object.prototype.hasOwnProperty.call(icons,s.agent.provider)?icons[s.agent.provider]:icons.default;
    const icon=iconKey&&sprites[iconKey];
    if(icon)image(iconKey,left,s.plate.y-p.icon/2,p.icon,p.icon);
    else{c.fillStyle=providerColor(s.agent.provider);c.beginPath();c.arc(left+p.icon/2,s.plate.y,p.icon*.3,0,Math.PI*2);c.fill();}
    c.fillStyle=temp?'#173f44':'#4d3327';c.fillText(label,left+lead,s.plate.y);c.restore();
  };
  for(const room of layout.rooms){


    const jobs:{y:number;draw:()=>void}[]=[];
    for(const s of room.stations){
      const a=actors[s.agent.id];if(!a)continue;
      const seated=!a.moving&&Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2;
      const managerBehind=managerBehindDesk(s,a);
      const ownWalker=managerBehind||(!s.manager&&a.moving&&a.x>=s.x&&a.x<=s.x+s.width&&a.y<=s.y+s.height+8);
      const drawStation=()=>{
        image(s.desk.back,s.x,s.y,s.width,s.height,1,time/1000,true);

        if(seated||ownWalker){
          if(seated&&a.state==='working'&&!s.agent.needsAttention&&epoch-s.agent.stateSince>=60000&&a.elapsed-a.changed>.2){
            const g=geometry(s,a,'working',s.desk),placement=manifest.effectPlacement?.flame_aura;
            if(g&&placement){
              const spec=sprites[placement.sheet||'flame_aura']?.spec;
              const anchor=placement.anchorInActorFrame||[44,166],sheetAnchor=placement.sheetAnchor||[64,144];
              const keyboard=s.desk.keyboard?.rect,keycap=s.desk.keyboard?.keycapRect;
              const monitorLeft=keycap?s.x+(keycap[0]+keycap[2]+4)*s.moduleScale:s.x+s.width;
              const keyboardTop=keyboard?s.y+keyboard[1]*s.moduleScale:s.y+s.desk.frontOcclusionY*s.moduleScale;
              c.save();c.beginPath();c.rect(0,room.sceneY,Math.max(0,monitorLeft),Math.max(0,keyboardTop-room.sceneY));c.clip();
              effect('flame_aura',g.x+(anchor[0]-sheetAnchor[0])*g.factor,g.y+(anchor[1]-sheetAnchor[1])*g.factor,(spec?.frameW||128)*g.factor,(spec?.frameH||160)*g.factor,a.phase);
              c.restore();
            }
          }
          if(managerBehind){
            // Upper body is visible above the desk; legs never cover front or plate.
            c.save();c.beginPath();
            const top=Math.max(0,Math.min(s.y+s.desk.frontOcclusionY*s.moduleScale,plateGeometry(s,layout.viewportScale).y-1)-room.sceneY);
            c.rect(s.x,room.sceneY,s.width,top);
            // Only the actual desk footprint occludes legs; outside its sides is clear floor.
            c.rect(0,room.sceneY,s.x,room.sceneHeight);
            c.rect(s.x+s.width,room.sceneY,layout.width-s.x-s.width,room.sceneHeight);c.clip();
            occupant(s,a);c.restore();
          }else occupant(s,a,s.desk);
        }
        // Entire tabletop in front of the torso; full-cell sleeve/arm alpha overlays return above it.
        c.save();
        if(s.desk.tableRearY!==undefined){
          // Upper chair pixels belong behind the actor; only tabletop and monitor
          // are foreground. Redrawing the chair here sliced the left silhouette.
          const rear=s.y+s.desk.tableRearY*s.moduleScale,k=s.desk.keyboard?.keycapRect;
          c.beginPath();c.rect(s.x,rear,s.width,s.y+s.height-rear);
          if(k){const mx=s.x+(k[0]+k[2]+4)*s.moduleScale;c.rect(mx,s.y,s.x+s.width-mx,rear-s.y);}
          c.clip();
        }
        image(s.desk.front,s.x,s.y,s.width,s.height);c.restore();
        if(seated)actorOverlay(s,a,awaitingPose(s,a,true)?'awaiting':a.state==='away'?'phone':a.state);
        nameplate(s,room);
      };
      jobs.push({y:managerBehind?Math.max(deskDepth(s,room.sceneY),...room.rests.map(r=>r.y+r.height))+1:deskDepth(s,room.sceneY),draw:a.worker&&a.worker.alpha<1?()=>{
        // Temporary worker fading in/out: whole desk + occupant + plate share one alpha.
        c.save();c.globalAlpha=a.worker!.alpha;fade=a.worker!.alpha;drawStation();fade=1;c.restore();
      }:drawStation});
      const onBeanbag=s.rest&&!a.moving&&Math.hypot(a.x-s.away.x,a.y-s.away.y)<2;
      if(!seated&&!onBeanbag&&!ownWalker){
        // Transition walkers are local side/front poses and always remain fully visible.
        const depth=Math.max(a.y,...room.stations.map(d=>deskDepth(d,room.sceneY)+1),...room.rests.map(r=>r.y+r.height+1));
        jobs.push({y:depth,draw:()=>occupant(s,a)});
      }
    }
    for(const rest of room.rests){
      const station=room.stations.find(s=>s.agent.id===rest.owner)!;
      const a=actors[rest.owner];
      jobs.push({y:rest.y+rest.height,draw:()=>{
        image(rest.spec.back,rest.x,rest.y,rest.width,rest.height);
        if(a&&!a.moving&&Math.hypot(a.x-station.away.x,a.y-station.away.y)<2)occupant(station,a,undefined,true);
        c.save();const clip=rest.spec.frontOcclusionRect;
        if(clip){c.beginPath();c.rect(rest.x+clip[0]*rest.scale,rest.y+clip[1]*rest.scale,clip[2]*rest.scale,clip[3]*rest.scale);c.clip();}
        image(rest.spec.front,rest.x,rest.y,rest.width,rest.height);c.restore();
      }});
    }
    jobs.sort((a,b)=>a.y-b.y).forEach(j=>j.draw());
    // "+N": subagents that did not fit in the largest room. Badge sits right of the last desk.
    if(room.hiddenSubagents>0&&room.stations.length){
      const last=room.stations[room.stations.length-1],w=44,h=28,x=last.x+last.width+6,y=last.y+last.height/2-h/2;c.save();
      c.fillStyle='#86bfbd';c.strokeStyle='#2c6e75';c.lineWidth=1;if(c.setLineDash)c.setLineDash([3,2]);
      c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,4);else c.rect(x,y,w,h);c.fill();c.stroke();
      c.fillStyle='#173f44';c.font=`800 ${Math.max(11,5.5/Math.max(.01,layout.viewportScale??1))}px monospace`;c.textAlign='center';c.textBaseline='middle';
      c.fillText('+'+room.hiddenSubagents,x+w/2,y+h/2+1);c.restore();
    }
    const poseInfo=(s:Station)=>{const a=actors[s.agent.id];if(!a)return null;
      const seated=!a.moving&&Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2;
      const rest=!!s.rest&&!a.moving&&Math.hypot(a.x-s.away.x,a.y-s.away.y)<2;
      const asking=awaitingPose(s,a,seated),pose=a.moving||(!seated&&!rest)?`walking-${a.direction}`:rest?'away':a.state==='away'?'phone':asking?'awaiting':a.state;
      const g=geometry(s,a,pose,seated?s.desk:undefined,rest);if(!g)return null;
      return {a,seated,asking,g,head:{x:g.x+80*g.factor,y:g.y+12*g.factor}};
    };
    const infos=new Map(room.stations.map(o=>[o,poseInfo(o)] as const));
    for(const s of room.stations){const info=infos.get(s);if(!info)continue;
      const {a,seated,asking,g,head}=info;
      const fy=head.y;
      if(a.state==='sleeping'&&seated)effect('zzz',head.x-65*g.factor,head.y-48*g.factor,64*g.factor,48*g.factor,a.phase);
      if(asking&&sprites.question_bubble){
        // The bubble tail tip sits left of the sheet anchor; shift so the tail points at the head.
        const placement=manifest.effectPlacement?.question_bubble,spec=sprites.question_bubble.spec;
        const height=(placement?.preferredDisplayHeight??64)*g.factor,factor=height/(spec?.frameH||96);
        const anchor=Array.isArray(spec?.anchor)?spec.anchor:[64,90];
        const tail=placement?.tailTipInSheetFrame0||anchor;
        // Default: tail tip just above the head. A nameplate in the way lowers the tip toward the hair (tail still
        // points at this head, bubble stays above it) and, if needed, shrinks the bubble. Candidates must keep the
        // tail within ~12 CSS px of the head box, the center nearer this head than any other, and stay inside the scene.
        const f=g.factor,hb={x0:g.x+52*f,x1:g.x+108*f,y0:g.y+18*f,y1:g.y+80*f},hh=hb.y1-hb.y0;
        const fw=(spec?.frameW||128)*factor,reach=Math.max(12/(layout.viewportScale||1),6*f+11);
        const plates=room.stations.map(o=>plateGeometry(o,layout.viewportScale));
        const others=[...infos].filter(([o,i])=>o!==s&&i).map(([,i])=>({x:i!.head.x,y:i!.g.y+49*i!.g.factor}));
        const own={x:head.x,y:g.y+49*f};
        const valid=(x:number,y:number,w:number,h:number,tx:number,ty:number)=>{
          if(x<0||x+w>layout.width||plates.some(r=>x<r.x+r.width&&x+w>r.x&&y<r.y+r.height&&y+h>r.y))return false;
          if(Math.hypot(Math.max(hb.x0-tx,0,tx-hb.x1),Math.max(hb.y0-ty,0,ty-hb.y1))>reach)return false;
          const cx=x+w/2,cy=y+h/2,mine=Math.hypot(cx-own.x,cy-own.y);
          return others.every(o=>Math.hypot(cx-o.x,cy-o.y)>mine);
        };
        let box={x:head.x-tail[0]*factor,y:head.y-10-anchor[1]*factor,w:fw,h:height};
        const tip0=head.y-10,tipLow=hb.y0+.45*hh;
        search:for(const k of [1,.85,.7])for(const drop of [0,.25,.5,.75,1])for(const dx of [0,-1,1,-2,2]){
          const w=fw*k,h=height*k,tx=head.x+dx*(hb.x1-hb.x0)*.125,ty=tip0+drop*(tipLow-tip0);
          const x=tx-tail[0]*factor*k,y=ty-anchor[1]*factor*k;
          if(valid(x,y,w,h,tx,ty)){box={x,y,w,h};break search;}
        }
        effect('question_bubble',box.x,box.y,box.w,box.h,a.phase);
      }else if(s.agent.needsAttention){
        const placement=manifest.effectPlacement?.attention;
        const spec=sprites[placement?.sheet||'attention']?.spec;
        const height=(placement?.preferredDisplayHeight??64)*g.factor,factor=height/(spec?.frameH||96);
        const anchor=Array.isArray(spec?.anchor)?spec.anchor:[40,88];
        effect('attention',head.x-anchor[0]*factor,head.y-10-anchor[1]*factor,(spec?.frameW||80)*factor,height,a.phase);
      }
      if(a.state==='working'&&seated&&!s.agent.needsAttention&&a.elapsed-a.changed>.2&&!(a.worker&&a.worker.alpha<1)){const p=(a.phase+s.index*.43)%6;
        if(p<1.5)effect(s.index%2?'pop_plus10':'pop_plus3',a.x+40,fy+20-p*23,70,54,p,1-p/1.5);
        if((a.phase+s.index*.93)%13<1.3){const x=a.x-44,y=fy-35;const blocked=room.stations.some(b=>b!==s&&!b.manager&&x<b.x+b.width&&x+95>b.x&&y<b.y+b.height&&y+62>b.y);if(!blocked)effect(s.index%2?'bubble_prup':'bubble_done',x,y,95,62,(a.phase+s.index*.93)%13);}
      }
    }
  }
  for(const h of layout.headers){c.fillStyle='#4d3327';c.font='24px monospace';c.fillText(h.text,h.x,h.y);}
}
