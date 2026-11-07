import type {OfficeSnapshot} from '../../shared/state/contract';
import {draw,layoutOffices,step,loadOfficeAssets,assetData,type Actors,type Layout} from './core';
import {agentAtPoint,scenePoint} from './core/hitTest';
import {fitSceneWidth} from './core/viewport';
declare const document:any,window:any;
declare function requestAnimationFrame(callback:(time:number)=>void):number;
declare function cancelAnimationFrame(id:number):void;
/** App and preview share this exact canvas, DOM overlays, animation loop and click handler. */
export function mountOfficeScene(parent:any,getSnapshot:()=>OfficeSnapshot,onSelect?:(id:string)=>void){
  const root=document.createElement('div');root.className='office-scene';
  root.style.cssText='position:relative;width:100%;background:#f2e6d1;color:#4d3327;overflow:hidden';
  const style=document.createElement('style');style.textContent=`
.office-scene *{box-sizing:border-box}.office-scene button{cursor:pointer}
.office-context{position:absolute;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.8fr) minmax(0,1fr);color:#fff2d9;padding:0 12px;border:10px solid transparent;background-size:100% 100%;font-family:monospace}
.office-context.no-workspace{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.office-context-cell{min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 20px;overflow:hidden}
.office-context-cell+.office-context-cell{border-left:2px solid #e9d4ab}
.office-context small{font:800 12px/1.3 monospace;letter-spacing:.1em;color:#e4c88f;margin-bottom:5px}
.office-context strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:900 25px/1.2 monospace;color:#fff2d9}
.office-scene[data-size=medium] .office-context{padding:0 4px}.office-scene[data-size=medium] .office-context-cell{padding:0 12px}.office-scene[data-size=medium] .office-context small{font-size:10px}.office-scene[data-size=medium] .office-context strong{font-size:18px}
.office-scene[data-size=small] .office-context{padding:0 2px;border-width:4px;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr)}
.office-scene[data-size=small] .office-context.no-workspace{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.office-scene[data-size=small] .office-context-cell{padding:0 4px}.office-scene[data-size=small] .office-context-cell+.office-context-cell{border-left-width:1px}
.office-scene[data-size=small] .office-context small{font-size:7px;letter-spacing:.04em;margin-bottom:2px}.office-scene[data-size=small] .office-context strong{font-size:10.5px}
.office-scene[data-size=small] .office-context-cell.workspace strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal;overflow-wrap:anywhere;line-height:1.2}

.office-scene ::selection{background:#d4ad72;color:#202b40}`;
  const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:100%;height:auto';canvas.setAttribute('aria-label','Agent Office');
  const overlay=document.createElement('div');root.append(style,canvas,overlay);parent.append(root);
  const ctx=canvas.getContext('2d');const {sprites,spritesReady}=loadOfficeAssets();
  let ready=false,failed=false,active=true,paused=false,frame=0,last=0,actors:Actors={},layout:Layout|null=null,oldSnapshot:OfficeSnapshot|null=null,oldWidth=0,overlaySignature='';
  spritesReady.then(()=>{ready=true;}).catch((error:Error)=>{failed=true;const msg=document.createElement('p');msg.textContent='오피스 이미지를 불러오지 못했습니다. 화면을 다시 열어 주세요.';msg.setAttribute('role','alert');root.append(msg);console.error(error);});
  function overlays(l:Layout,width:number){
    const signature=JSON.stringify([width,l.rooms.map(r=>[r.y,r.sceneY,r.title,r.projectName,r.workspaceName,r.stations.map(s=>[s.agent.name,s.agent.id,s.agent.state,s.agent.provider,s.plate,s.plateWidth])])]);
    if(signature===overlaySignature)return;overlaySignature=signature;
    canvas.setAttribute('aria-label',l.rooms.map(r=>r.projectName+': '+r.stations.map(s=>s.agent.name+' ('+s.agent.state+')').join(', ')).join('; ')||'No agents');
    overlay.replaceChildren();const scale=Math.min(1,width/l.width);root.dataset.size=width<=550?'small':width<=900?'medium':'large';
    for(const room of l.rooms){
      const header=document.createElement('div');header.className='office-context'+(room.workspaceName?'':' no-workspace');header.setAttribute('aria-label','현재 작업 정보');
      header.style.cssText=`left:0;top:${room.y*scale}px;width:${l.width*scale}px;height:${(room.sceneY-room.y)*scale}px`;
      const hud=assetData['hud-panel']?.uri;if(hud){header.style.backgroundImage=`url("${hud}")`;const spec=assetData['hud-panel'];const slice=65*((spec as any).runtimeSize?.[0]||spec.size?.[0]||1)/(spec.size?.[0]||1);header.style.borderImage=`url("${hud}") ${slice} fill / 10px / 0 stretch`;}
      for(const [name,value] of [['PROJECT',room.projectName],...(room.workspaceName?[['WORKSPACE',room.workspaceName]]:[]),['AGENT',room.title]]){
        const cell=document.createElement('div');cell.className='office-context-cell'+(name==='WORKSPACE'?' workspace':'');const label=document.createElement('small');label.textContent=name;
        const text=document.createElement('strong');text.textContent=value;text.title=value;cell.append(label,text);header.append(cell);
      }overlay.append(header);

    }
  }
  const target=(event:any)=>{if(!layout)return null;const p=scenePoint(event.clientX,event.clientY,canvas.getBoundingClientRect(),layout);return p?agentAtPoint(layout,actors,p.x,p.y):null;};
  const click=(event:any)=>{const id=target(event);if(id)onSelect?.(id);};
  const move=(event:any)=>{canvas.style.cursor=target(event)?'pointer':'default';};
  canvas.addEventListener('click',click);canvas.addEventListener('mousemove',move);
  function tick(time:number,epoch?:number,fixed=false){if(!active||failed)return;
    const snapshot=getSnapshot(),width=Math.min(1536,Math.max(1,parent.clientWidth||700));
    if(snapshot!==oldSnapshot||width!==oldWidth){layout=layoutOffices(snapshot,width);overlays(layout,width);oldSnapshot=snapshot;oldWidth=width;}
    const l=layout!;const fit=fitSceneWidth(l.width,l.height,width),ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    const w=Math.round(fit.width*ratio),h=Math.round(fit.height*ratio);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;canvas.style.width=fit.width+'px';canvas.style.height=fit.height+'px';}
    root.style.height=fit.height+'px';
    if(ready){
      if(fixed){
        actors=step({},snapshot,0,l);
        // Replay with the runtime's maximum step so movement and visits are reproducible,
        // even when seeking backwards or capturing before the first animation frame.
        for(let elapsed=0;elapsed<time;elapsed+=100)actors=step(actors,snapshot,Math.min(100,time-elapsed),l);
      }else actors=step(actors,snapshot,last?Math.min(100,time-last):0,l);
      ctx.setTransform(fit.width/l.width*ratio,0,0,fit.width/l.width*ratio,0,0);
      draw(ctx,l,actors,time,sprites,epoch);
    }
    last=time;if(!paused)frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  return {async setTime(time:number,epoch:number){
    if(!Number.isFinite(time)||time<0||!Number.isFinite(epoch))throw new Error('setTime requires non-negative elapsed ms and a finite epoch');
    paused=true;cancelAnimationFrame(frame);
    await spritesReady;
    if(active){
      tick(time,epoch,true);
      // A newly overflowing panel may acquire a scrollbar after its first layout.
      // Settle the content width before a fixed screenshot pauses the live loop.
      for(let i=0;i<2&&oldWidth!==Math.min(1536,Math.max(1,parent.clientWidth||700));i++)tick(time,epoch,true);
    }
  },reset(){actors={};last=0;},pause(){paused=true;cancelAnimationFrame(frame);},resume(){if(paused){paused=false;last=0;frame=requestAnimationFrame(tick);}},dispose(){active=false;cancelAnimationFrame(frame);canvas.removeEventListener('click',click);canvas.removeEventListener('mousemove',move);root.remove();},inspect(){return {ready,failed,layout,actors};}};
}
