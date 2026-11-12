import type { AgentView, AgentState, OfficeSnapshot, } from '../../../shared/state/contract';
import { manifest, assetData, type DeskSpec, type BeanbagSpec } from './office-assets';
import { tempMembers, type WorkerSub, type WorkerState, type LayoutHold, type HeldOffice } from './workers';
export interface Point {x:number;y:number}
export interface Rect extends Point {width:number;height:number}
export interface RestSeat extends Rect {spec:BeanbagSpec;seat:Point;scale:number;owner:string}
export interface Station extends Rect {
  desk:DeskSpec;moduleScale:number;rest:RestSeat|null;
  agent:AgentView; bodySeat:Point; seat:Point; away:Point; manager:boolean; variant:string; pod:number;
  actorHeight:number; plate:Point; plateWidth:number; plateDisplayWidth?:number; hasSofa:boolean; index:number;
  /** Temporary worker (running subagent): a regular desk appended after the regular members, never given a lounge seat. */
  temp?:{parentId:string;sub:WorkerSub;leaving:boolean};
}
export interface Room extends Rect {
  id:string; title:string; projectName:string; workspaceName?:string|null;
  background:string; /** Member count the room geometry is built for (>= stations while a shrink is held). */ layoutMembers:number; stations:Station[];subagents:readonly WorkerSub[];hiddenSubagents:number;rests:RestSeat[];obstacles:Rect[]; leftCorridorX:number; backgroundHeight:number; sceneY:number; sceneHeight:number;
}
export interface Layout {viewportScale?:number;width:number;height:number;rooms:Room[];headers:{text:string;x:number;y:number}[]}
export interface Actor extends Point {
  /** Present only on temporary-worker actors (see workers.ts). */
  worker?:WorkerState;
  /** Layout-size hold of the office this (lead) actor belongs to; see workers.ts. */
  hold?:LayoutHold;
  walkPhase?:number; moving:boolean; direction:'left'|'right'; phase:number; state:AgentState;
  previous?:string; ask?:number; changed:number; elapsed:number; route:Point[]; destination:string; home:Point;
  /** Lounge seat position the actor was last placed against (to notice a re-assigned or moved beanbag). */
  awayHome?:Point;
}
export type Actors=Record<string,Actor>;
/** v10 coordinates are shared by all rooms; scale only at the viewport boundary. */
export function layoutOffices(snapshot:OfficeSnapshot, _width=1536):Layout {
  const rooms:Room[]=[]; let y=0;
  const headerHeight=(_width<=550?66:_width<=900?74:84)/Math.min(1,Math.max(1,_width)/1536);
  for(const project of snapshot.projects) for(const office of project.offices) {
    const temps=tempMembers(office),members=[...office.members,...temps.visible.map(t=>t.agent)],n=Math.max(members.length,(office as HeldOffice).holdMembers??0);
    if(!n&&!office.manager)continue;
    const background=n<=3?'small':n<=6?'medium':'large';
    const backgroundHeight=n<=6?1024:1536+Math.max(0,Math.ceil(n/4)-4)*260;
    const sceneY=y+headerHeight, cols=n<=3?Math.max(1,n):n<=6?3:4;
    const stations:Station[]=[];
    const base=(agent:AgentView,i:number,manager:boolean):Station=>{
      const tempSub=temps.visible.find(t=>t.agent===agent);
      let desk=manager?manifest.leadDesks[background]:manifest.pods[String(i%3)];
      const size=desk.size||assetData[desk.back].size!;
      const actorHeight=320*(n<=6?280:210)/479;
      const moduleScale=actorHeight/(desk.referenceActorFrameHeight||desk.actorHeight);
      const x=manager?(1536-size[0]*moduleScale)/2:n<=6?350+i%cols*380:340+i%4*286;
      let py=manager?420-size[1]*moduleScale:n<=3?610:n<=6?450+Math.floor(i/3)*275:500+Math.floor(i/4)*260;
      const width=size[0]*moduleScale,height=size[1]*moduleScale;
      const rowHeight=Math.max(...Object.values(manifest.pods).map(d=>d.size![1]*actorHeight/(d.referenceActorFrameHeight||d.actorHeight)));
      if(!manager&&n>3)py=(n<=6?450:500)+Math.floor(i/cols)*(rowHeight+actorHeight*.8+12);

      const bodySeat={x:x+desk.seat[0]*moduleScale,y:sceneY+py+desk.seat[1]*moduleScale};
      // The new seat anchors the torso, not walking feet. Preserve the calibrated floor graph.
      const floorY=manager?({small:384,medium:371,large:343}[background]):size[1]-11;
      const seat={x:bodySeat.x,y:sceneY+py+floorY*moduleScale};
      return {agent,index:i,manager,temp:tempSub?{parentId:tempSub.sub.parentAgentId,sub:tempSub.sub,leaving:!!tempSub.sub.leaving}:undefined,variant:manager?'lead':String(i%6),pod:i%3,x,y:sceneY+py,width,height,desk,moduleScale,rest:null,
        bodySeat,seat,away:seat,hasSofa:false,actorHeight,
        plate:{x:x+desk.nameplate.center[0]*moduleScale,y:sceneY+py+desk.nameplate.center[1]*moduleScale},
        plateDisplayWidth:manager?width*.86:undefined,
        plateWidth:manager?desk.nameplate.width*moduleScale:Math.max(desk.nameplate.width*moduleScale,Math.max(180,Math.min(width-8,54/Math.min(1,Math.max(1,_width)/1536))))};
    };
    if(office.manager)stations.push(base(office.manager,0,true));
    members.forEach((agent,i)=>stations.push(base(agent,i,false)));
    const rests:RestSeat[]=[];
    const obstacles:Rect[]=stations.map(s=>({x:s.x,y:s.y,width:s.width,height:s.height}));
    const cfg=manifest.restLayout;
    const leftLounge=cfg.leftLounge;
    const loungeSpec=leftLounge.byBackground[background];
    const floorTrim=manifest.backgroundTrim?.bottomTrimHeight??24;
    // While a shrink is held (n > real members) the empty desk slots still size the room, so height and lounge slots stay as laid out for n.
    const sized=[...stations,...Array.from({length:Math.max(0,n-members.length)},(_,k)=>base(members[0]??office.manager!,members.length+k,false))];
    const lastDeskBottom=Math.max(...sized.map(s=>s.y+s.height-sceneY));
    // Reserve the walking aisle as well as half a module below the last row.
    const bottomMargin=Math.max(...sized.map(s=>Math.max(s.height*.5,s.actorHeight*.8+28)));
    const sceneHeight=lastDeskBottom+bottomMargin+floorTrim;
    const usableSlots=loungeSpec.slots.filter((slot:any)=>{
      const spec=manifest.beanbags[slot.beanbag],h=stations[0].actorHeight;
      const scale=h/(spec.referenceActorFrameHeight||spec.actorHeight);
      return slot.topLeft[1]+spec.size[1]*scale+h*.35+10<=sceneHeight-floorTrim;
    });
    function restSeat(station:Station,key:string,x:number,ry:number,scale:number){
      const spec=manifest.beanbags[key];
      const rest:RestSeat={owner:station.agent.id,spec,scale,x,y:ry,width:spec.size[0]*scale,height:spec.size[1]*scale,
        seat:{x:x+spec.seat[0]*scale,y:ry+spec.seat[1]*scale}};
      // Standing arrival is below the bag; seated pose uses a separate hip anchor.
      const arrivalY=spec.size[1]-spec.seat[1]+station.actorHeight*.35/scale;
      station.rest=rest;station.away={x:rest.seat.x,y:rest.seat.y+arrivalY*scale};rests.push(rest);
    }
    // Assign the closest columns, ordered by row. Stable across all state changes.
    // Avoid sending rightmost desks across the whole room for a left lounge slot.
    stations.filter(s=>!s.manager&&!s.temp).sort((a,b)=>a.x-b.x||a.y-b.y).slice(0,leftLounge.enabled?usableSlots.length:0).sort((a,b)=>a.y-b.y||a.x-b.x).forEach((s,i)=>{
      const slot=usableSlots[i];restSeat(s,slot.beanbag,slot.topLeft[0],sceneY+slot.topLeft[1],s.actorHeight/(manifest.beanbags[slot.beanbag].referenceActorFrameHeight||manifest.beanbags[slot.beanbag].actorHeight));
    });
    const manager=stations.find(s=>s.manager);
    if(manager){
      const spec=manifest.beanbags[cfg.managerSlot.beanbag],scale=manager.actorHeight/(spec.referenceActorFrameHeight||spec.actorHeight);
      const x=manager.x+manager.width+32;
      const ry=manager.y+manager.height-spec.size[1]*scale;
      restSeat(manager,cfg.managerSlot.beanbag,x,ry,scale);
    }
    rooms.push({id:office.id,title:office.manager?.name||members[0]?.name||'',projectName:project.projectName,
      workspaceName:snapshot.workspaceName,x:0,y,width:1536,height:sceneHeight+headerHeight,sceneY,sceneHeight,backgroundHeight,leftCorridorX:leftLounge.walkingCenterX,background,layoutMembers:n,stations,subagents:temps.visible.map(t=>t.sub),hiddenSubagents:temps.hidden,rests,obstacles});
    y+=sceneHeight+headerHeight+24;
  }
  return {viewportScale:Math.min(1,Math.max(1,_width)/1536),width:1536,height:Math.max(140,y?y-24:140),rooms,headers:rooms.length?[]:[{text:'No agents',x:32,y:72}]};
}
