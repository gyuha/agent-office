import type { OfficeSnapshot } from '../../../shared/state/contract';
import {layoutOffices,type Actors,type Point,type Station,type Room} from './layout';
function path(room:Room,s:Station,from:Point,to:Point):Point[] {
  if(Math.hypot(from.x-to.x,from.y-to.y)<2)return [to];
  const below=s.manager?room.sceneY+440:s.y+s.height+25;
  const lane=s.manager?1100:Math.min(1460,s.x+s.width+26);
  const aisle=room.sceneY+430;
  if(Math.hypot(to.x-s.seat.x,to.y-s.seat.y)<2)
    return [from,{x:from.x,y:aisle},{x:lane,y:aisle},{x:lane,y:below},{x:s.seat.x,y:below},to];
  return [from,{x:s.seat.x,y:below},{x:lane,y:below},{x:lane,y:aisle},{x:to.x,y:aisle},to];
}
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
    if(a.state==='away'&&(s.hasSofa||s.manager)){target=s.away;destination=s.manager?'manager-rest':'sofa';}
    else if(a.state==='working'&&!s.manager){
      // A single visitor uses the right aisle; stagger by station index.
      const cycle=Math.floor(Math.max(0,a.elapsed-10)/16),q=(a.elapsed-10)%16;
      const members=room.stations.filter(st=>!st.manager);
      if(a.elapsed>=10&&s.index===(2+cycle)%members.length&&q>=4&&q<8){
        target={x:cycle%2?900:1190,y:room.sceneY+430};destination='visit';
      }
    }
    if(a.destination!==destination){a.route=path(room,s,a,target).slice(1);a.destination=destination;}
    let budget=500*seconds;
    while(a.route.length&&budget>0){const p=a.route[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
      if(dx)a.direction=dx<0?'left':'right';
      if(d<=budget){a.x=p.x;a.y=p.y;budget-=d;a.route.shift();}else{a.x+=dx/d*budget;a.y+=dy/d*budget;budget=0;}}
    a.moving=a.route.length>0||Math.hypot(a.x-s.seat.x,a.y-s.seat.y)>2&&a.destination==='visit';
    next[s.agent.id]=a;
  }
  return next;
}
