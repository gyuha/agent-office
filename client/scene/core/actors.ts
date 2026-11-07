import type { OfficeSnapshot } from '../../../shared/state/contract';
import {layoutOffices,type Actors} from './layout';
import {route} from './navigation';
import {manifest} from './office-assets';
/** Keep clocks and positions keyed by id, never by immutable snapshot object identity. */
export function step(previous:Actors,snapshot:OfficeSnapshot,dt:number,layout=layoutOffices(snapshot)):Actors {
  const next:Actors={}; const seconds=Math.max(0,dt)/1000;
  for(const room of layout.rooms)for(const s of room.stations){
    const old=previous[s.agent.id];
    const a=old?{...old,route:[...old.route]}:{...s.seat,moving:false,direction:'right' as const,phase:0,state:s.agent.state,changed:0,elapsed:0,route:[],destination:'seat',home:{...s.seat}};
    if(old&&(old.home.x!==s.seat.x||old.home.y!==s.seat.y)){
      a.x+=s.seat.x-old.home.x;a.y+=s.seat.y-old.home.y;a.route=[];a.destination='changed';
    }
    a.home={...s.seat};
    a.elapsed+=seconds; a.phase+=seconds;
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
    next[s.agent.id]=a;
  }
  return next;
}
