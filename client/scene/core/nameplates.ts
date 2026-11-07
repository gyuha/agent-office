import type {Station,Actor} from './layout';
/** Logical geometry shared by rendering and hit testing. 6.5 CSS px readability floor. */
export function plateGeometry(station:Station,scale=1){
  const width=station.plateDisplayWidth??station.plateWidth;
  const floor=(station.manager?5:6.5)/Math.max(.01,scale);
  const desired=station.manager?Math.max(30*station.moduleScale,6.5/Math.max(.01,scale)):18;
  const nameFit=station.manager?(width-6)/(station.agent.name.length*.61+1.2):Infinity;
  const font=Math.max(floor,Math.min(desired,nameFit));
  const padding=Math.max(station.manager?3*station.moduleScale:3,1/Math.max(.01,scale));
  const height=Math.max(font,6.5/Math.max(.01,scale))*1.35+padding*2;
  return {x:station.plate.x-width/2,y:station.plate.y-height/2,width,height,font,padding,icon:font*.95,gap:font*.25};
}
export function deskDepth(station:Station,sceneY:number){return station.y+station.height;}

/** Keep the entire manager silhouette behind its front until it clears the side. */
export function managerBehindDesk(s:Station,a:Actor){
  return s.manager&&a.moving&&Math.abs(a.y-s.seat.y)<1&&a.x<=s.x+s.width+s.actorHeight*.4+1;
}

/** Standing behind a desk places the feet on its rear floor, above the seated anchor. */
export function managerWalkLift(s:Station,a:Actor){
  if(!managerBehindDesk(s,a))return 0;
  const remaining=s.x+s.width+s.actorHeight*.4-a.x;
  return s.actorHeight*.3*Math.min(1,Math.max(0,remaining/(s.actorHeight*.6)));
}

/** Walking uses floor anchors; standing behind a member desk stays above its new rear edge. */
export function actorWalkLift(s:Station,a:Actor){
  if(s.manager)return managerWalkLift(s,a);
  if(!a.moving||Math.abs(a.y-s.seat.y)>=1)return 0;
  const side=s.x-s.actorHeight*.27;
  if(a.x<side-1||a.x>s.seat.x+1)return 0;
  return s.actorHeight*.3*Math.min(1,Math.max(0,(a.x-side)/(s.actorHeight*.6)));
}
