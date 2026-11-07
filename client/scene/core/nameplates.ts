import type {Station} from './layout';
/** Logical geometry shared by rendering and hit testing. 6.5 CSS px readability floor. */
export function plateGeometry(station:Station,scale=1){
  const font=Math.max(18,6.5/Math.max(.01,scale));
  const padding=Math.max(3,1/Math.max(.01,scale));
  const height=font*1.35+padding*2;
  return {x:station.plate.x-station.plateWidth/2,y:station.plate.y-height/2,width:station.plateWidth,height,font,padding,icon:font*.95,gap:font*.25};
}
export function deskDepth(station:Station,sceneY:number){return station.manager?sceneY+400:station.y+station.height;}
