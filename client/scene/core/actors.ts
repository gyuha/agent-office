import type { OfficeSnapshot } from '../../../shared/state/contract';
import {layoutOffices,type Actors} from './layout';
import {route} from './navigation';
import {manifest} from './office-assets';
import {WORKER_ENTER_SECONDS,WORKER_EXIT_SECONDS,nextLayoutHold} from './workers';
/** Keep clocks and positions keyed by id, never by immutable snapshot object identity. */
export function step(previous:Actors,snapshot:OfficeSnapshot,dt:number,layout=layoutOffices(snapshot)):Actors {
  const next:Actors={}; const seconds=Math.max(0,dt)/1000; const firstStep=!Object.keys(previous).length;
  for(const room of layout.rooms)for(const s of room.stations){
    const old=previous[s.agent.id];
    const a=old?{...old,route:[...old.route]}:{...s.seat,moving:false,direction:'right' as const,phase:0,state:s.agent.state,changed:0,elapsed:0,route:[],destination:'seat',home:{...s.seat}};
    // The room was re-laid out (desk moved) or this agent's beanbag was re-assigned/moved (room height changes the lounge slots).
    const seatMoved=!!old&&(old.home.x!==s.seat.x||old.home.y!==s.seat.y);
    // s.away is the seat when there is no beanbag, so a lost beanbag (room shrank) also counts as moved.
    const restMoved=!!old&&!!old.awayHome&&(old.awayHome.x!==s.away.x||old.awayHome.y!==s.away.y);
    if(old&&(seatMoved||restMoved)){
      // A seated agent moves with its desk. Anyone else (on a beanbag, walking) is off the new corridor graph, so it goes back to
      // its desk and the normal route (desk -> new beanbag for away) takes over; otherwise it would stand still at the old spot.
      if(!old.moving&&Math.hypot(old.x-old.home.x,old.y-old.home.y)<2){a.x+=s.seat.x-old.home.x;a.y+=s.seat.y-old.home.y;}
      else{a.x=s.seat.x;a.y=s.seat.y;a.moving=false;}
      a.route=[];a.destination='changed';
    }
    a.home={...s.seat};a.awayHome={...s.away};
    a.elapsed+=seconds; a.phase+=seconds;
    // Seated height blend for the question pose: new actors start at their target, changes ease over ~0.2s.
    const asks=s.agent.needsAttention&&s.agent.state==='working'?1:0;
    a.ask=asks;
    if(old&&old.ask!==undefined){const d=asks-old.ask,m=seconds/.2;a.ask=Math.abs(d)<=m?asks:old.ask+Math.sign(d)*m;}
    if(a.state!==s.agent.state){a.previous=a.state;a.state=s.agent.state;a.changed=a.elapsed;a.destination='changed';}
    let target=s.seat, destination='seat';
    if(a.state==='away'&&s.rest){target=s.away;destination='beanbag';}
    if(a.destination!==destination){a.route=route(room,s,a,target);a.destination=destination;}
    // Two lane batches, 300ms apart; every actor starts within 300ms.
    const slot=room.rests.findIndex(r=>r.owner===s.agent.id);
    const earlySmallLane=room.stations.filter(v=>!v.manager).length===3&&slot===2;
    const atEndpoint=Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2||!!s.rest&&Math.hypot(a.x-s.away.x,a.y-s.away.y)<2;
    // Stagger only seated departures. A moving reversal must never restart the delay.
    const waiting=atEndpoint&&!old?.moving&&!s.manager&&a.elapsed-a.changed<(earlySmallLane?0:slot%2===0?.3:0);
    const actor=manifest.actors[s.manager?'orchestrator':`actor-${s.variant}`];
    const sheet=manifest.sheets?.[actor.walk_left],locomotion=sheet?.locomotion;
    const frames=Array.isArray(sheet?.frames)?sheet.frames.length:sheet?.frames||4;
    const speed=locomotion?locomotion.cycleDistance*(sheet?.fps||8)/frames*s.actorHeight/locomotion.referenceActorHeight:256*s.actorHeight/216;
    let budget=waiting?0:speed*seconds,travel=0;
    while(a.route.length&&budget>0){const p=a.route[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
      if(Math.abs(dx)>16)a.direction=dx<0?'left':'right';
      travel+=Math.min(d,budget);
      if(d<=budget){a.x=p.x;a.y=p.y;budget-=d;a.route.shift();}else{a.x+=dx/d*budget;a.y+=dy/d*budget;budget=0;}}
    a.walkPhase=(a.walkPhase||0)+travel/speed;
    a.moving=a.route.length>0&&!waiting;
    if(a.route.length&&waiting){a.direction=a.destination==='beanbag'?'left':'right';}
    if(old?.moving&&!a.moving){a.previous=`walking-${old.direction}`;a.changed=a.elapsed;}
    if(s.temp){
      // Temporary worker: fades in (not on the very first step), and after leaving the snapshot fades out, then drops.
      const w=old?.worker,leaving=s.temp.leaving;
      const enter=Math.min(WORKER_ENTER_SECONDS,(w?.enter??(firstStep?WORKER_ENTER_SECONDS:-seconds))+seconds);
      const exit=leaving?(w?.exit==null?0:w.exit+seconds):null;
      if(exit!==null&&exit>=WORKER_EXIT_SECONDS)continue;
      a.worker={sub:s.temp.sub,enter,exit,alpha:Math.min(1,enter/WORKER_ENTER_SECONDS)*(exit===null?1:Math.max(0,1-exit/WORKER_EXIT_SECONDS))};
    }
    next[s.agent.id]=a;
  }
  // Per-office layout hold: only subagent departures can shrink a room, and they do so after LAYOUT_HOLD_SECONDS.
  for(const room of layout.rooms){
    const lead=room.stations[0],a=lead&&next[lead.agent.id];if(!a)continue;
    const members=room.stations.filter(s=>!s.manager).length,regular=room.stations.filter(s=>!s.manager&&!s.temp).length;
    a.hold=nextLayoutHold(previous[lead.agent.id]?.hold,members,regular,seconds);
  }
  return next;
}
