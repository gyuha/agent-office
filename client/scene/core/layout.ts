import type { AgentView, AgentState, OfficeSnapshot } from '../../../shared/state/contract';
import { manifest, assetData } from './office-assets';
export interface Point {x:number;y:number}
export interface Rect extends Point {width:number;height:number}
export interface Station extends Rect {
  agent:AgentView; seat:Point; away:Point; manager:boolean; variant:string; pod:number;
  actorHeight:number; plate:Point; plateWidth:number; hasSofa:boolean; index:number;
}
export interface Room extends Rect {
  id:string; title:string; projectName:string; workspaceName?:string|null;
  background:string; stations:Station[]; sceneY:number; sceneHeight:number;
}
export interface Layout {viewportScale?:number;width:number;height:number;rooms:Room[];headers:{text:string;x:number;y:number}[]}
export interface Actor extends Point {
  moving:boolean; direction:'left'|'right'; phase:number; state:AgentState;
  previous?:AgentState; changed:number; elapsed:number; route:Point[]; destination:string; home:Point;
}
export type Actors=Record<string,Actor>;
/** v10 coordinates are shared by all rooms; scale only at the viewport boundary. */
export function layoutOffices(snapshot:OfficeSnapshot, _width=1536):Layout {
  const rooms:Room[]=[]; let y=0;
  const headerHeight=(_width<=550?66:_width<=900?74:84)/Math.min(1,Math.max(1,_width)/1536);
  for(const project of snapshot.projects) for(const office of project.offices) {
    const n=office.members.length;
    if(!n&&!office.manager)continue;
    const background=n<=3?'small':n<=6?'medium':'large';
    const sceneHeight=n<=6?1024:1536+Math.max(0,Math.ceil(n/4)-4)*260;
    const sceneY=y+headerHeight, cols=n<=3?Math.max(1,n):n<=6?3:4;
    const lead=manifest.lead[background];
    const plateSpec=manifest.ui.nameplates;
    const stations:Station[]=[];
    const base=(agent:AgentView,i:number,manager:boolean):Station=>{
      const width=manager?0:n<=6?310:258;
      const x=manager?0:n<=6?350+i%cols*380:340+i%4*286;
      const py=manager?0:n<=3?610:n<=6?450+Math.floor(i/3)*275:500+Math.floor(i/4)*260;
      const size=assetData[`pod-${i%3}-back`]?.size||[479,365];
      const height=manager?0:width*size[1]/size[0];
      const seat=manager?{x:lead.foot[0],y:sceneY+lead.foot[1]}:{x:x+width*.27,y:sceneY+py+width*.61};
      return {agent,index:i,manager,variant:manager?'lead':String(i%6),pod:i%3,x,y:sceneY+py,width,height,
        seat,away:seat,hasSofa:false,actorHeight:manager?lead.height:n<=6?240:200,
        plate:manager?{x:plateSpec.leadAnchors[background][0],y:sceneY+plateSpec.leadAnchors[background][1]}:{x:x+width*.5,y:sceneY+py+height*.8},
        plateWidth:manager?plateSpec.leadWidth:width*.74};
    };
    if(office.manager)stations.push(base(office.manager,0,true));
    office.members.forEach((agent,i)=>stations.push(base(agent,i,false)));
    // Reserve both sofa seats for members; the manager rests beside the large desk.
    const manager=stations.find(s=>s.manager);
    if(manager)manager.away={x:manager.seat.x+240,y:manager.seat.y+100};
    stations.filter(s=>!s.manager).slice(0,2).forEach((s,i)=>{s.hasSofa=true;s.away={x:125+i*85,y:sceneY+(background==='large'?640:590)};});
    rooms.push({id:office.id,title:office.manager?.name||office.members[0]?.name||'',projectName:project.projectName,
      workspaceName:snapshot.workspaceName,x:0,y,width:1536,height:sceneHeight+headerHeight,sceneY,sceneHeight,background,stations});
    y+=sceneHeight+headerHeight+24;
  }
  return {viewportScale:Math.min(1,Math.max(1,_width)/1536),width:1536,height:Math.max(140,y?y-24:140),rooms,headers:rooms.length?[]:[{text:'No agents',x:32,y:72}]};
}
