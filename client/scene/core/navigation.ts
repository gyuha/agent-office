import type {Point,Room,Station} from './layout';
const near=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<2;
/** Continuous calibrated travel through desk sides, row floor aisles and two lounge lanes. */
function canonical(room:Room,s:Station,from:Point,to:Point):Point[]{
  if(near(from,to))return [];
  const returning=near(to,s.seat),home=near(from,s.seat);
  const side={x:s.manager?Math.max(s.x+s.width+s.actorHeight*.4,s.away.x):s.x-s.actorHeight*.27,y:s.seat.y};
  if(s.manager){const bend={x:side.x,y:s.away.y};return returning?[bend,side,to]:[...(home?[side]:[]),bend,to];}
  const slot=room.rests.filter(r=>r.x<300).findIndex(r=>r.owner===s.agent.id);
  const lane=slot%2?room.leftCorridorX:room.leftCorridorX-100;
  const firstColumn=s.x<400;
  const row=room.stations.filter(d=>!d.manager&&Math.abs(d.y-s.y)<1);
  const crossingY=firstColumn?side.y:Math.max(...row.map(d=>d.y+d.height))+s.actorHeight*.8+8;
  const aisle={x:side.x,y:crossingY},entry={x:lane,y:crossingY},arrival={x:lane,y:s.away.y};
  const points=returning?[arrival,entry,aisle,side,to]:[...(home?[side]:[]),aisle,entry,arrival,to];
  return points.filter((p,i)=>!near(i?points[i-1]:from,p));
}

/** Undirected corridor graph: reconnect a moving actor at its current edge.
 * Never attach its current position directly to an unrelated endpoint.
 */
export function route(room:Room,s:Station,from:Point,to:Point):Point[]{
  if(near(from,to))return [];
  const points=[s.seat,...canonical(room,s,s.seat,s.away)];
  if(points.length<2)return [];
  const home=near(to,s.seat),candidates:{path:Point[];distance:number}[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    if(!length)continue;
    const t=((from.x-a.x)*dx+(from.y-a.y)*dy)/length;
    if(t<-.001||t>1.001)continue;
    const p={x:a.x+Math.max(0,Math.min(1,t))*dx,y:a.y+Math.max(0,Math.min(1,t))*dy};
    if(Math.hypot(p.x-from.x,p.y-from.y)>1)continue;
    const path=home?points.slice(0,i).reverse():points.slice(i);
    let previous=from,distance=0;for(const q of path){distance+=Math.hypot(q.x-previous.x,q.y-previous.y);previous=q;}
    candidates.push({path,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.path.filter((p,i,list)=>!near(i?list[i-1]:from,p))||[];
}
