import type {Actors,Layout} from './layout';
import {plateGeometry,deskDepth,actorWalkLift} from './nameplates';
export function scenePoint(clientX:number,clientY:number,bounds:{left:number;top:number;width:number;height:number},layout:Layout){
  return bounds.width>0&&bounds.height>0?{x:(clientX-bounds.left)*layout.width/bounds.width,y:(clientY-bounds.top)*layout.height/bounds.height}:null;
}
export function agentAtPoint(layout:Layout,actors:Actors,x:number,y:number):string|null{
  const hits:{depth:number;order:number;id:string}[]=[];
  let order=0;
  for(const room of layout.rooms)for(const s of room.stations){
    if(s.temp)continue; // temporary workers are not Paseo agents
    const a=actors[s.agent.id];if(!a)continue;
    const current=actors[s.agent.id],onRest=!!(s.rest&&!current.moving&&Math.hypot(a.x-s.away.x,a.y-s.away.y)<2);
    const h=s.actorHeight;
    if(onRest&&s.rest&&x>=s.rest.x&&x<=s.rest.x+s.rest.width&&y>=s.rest.y&&y<=s.rest.y+s.rest.height)hits.push({depth:s.rest.y+s.rest.height,order:order++,id:s.agent.id});
    const p=plateGeometry(s,layout.viewportScale);
    const plate=x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height;
    if(plate)hits.push({depth:deskDepth(s,room.sceneY),order:order++,id:s.agent.id});
    const isSeated=!a.moving&&Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2;
    const pose=a.state==='away'?'phone':a.state;
    const offset=s.desk.actorOffsets?.[s.manager?'orchestrator':`actor-${s.variant}`]?.[pose]?.[1]||0;
    const figureY=isSeated?s.bodySeat.y+(205-s.desk.actorAnchor[1])*h/216+((s.desk.actorStateYOffset?.[pose]||0)+offset)*s.moduleScale:a.y-actorWalkLift(s,a);
    if(Math.abs(x-a.x)<=h*.36&&y>=figureY-h*.92&&y<=figureY+10){
      const seated=!('moving' in a&&a.moving)&&Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2;
      const depth=seated?deskDepth(s,room.sceneY):a.y;
      // A figure behind a desk does not own the desk's visible plate area.
      const occluded=room.stations.some(d=>{const rect=plateGeometry(d,layout.viewportScale);return deskDepth(d,room.sceneY)>depth&&x>=rect.x&&x<=rect.x+rect.width&&y>=rect.y&&y<=rect.y+rect.height;});
      if(!occluded)hits.push({depth,order:order++,id:s.agent.id});
    }
  }
  hits.sort((a,b)=>a.depth-b.depth||a.order-b.order);
  return hits.at(-1)?.id??null;
}
