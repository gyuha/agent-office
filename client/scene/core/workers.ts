import type {AgentView,Office,OfficeSnapshot,SubagentView} from '../../../shared/state/contract';
import type {Actors,Room,Station} from './layout';

/**
 * Temporary workers = running subagents. They are drawn as regular members: layoutOffices appends them after the real
 * members (grouped by parent, start order inside a parent), so the real members keep their seats, and they get the
 * normal desk, chair, sprite and typing animation. Only the plate styling (teal, dashed) and the fade differ.
 */
export const WORKER_ENTER_SECONDS=.4;
export const WORKER_EXIT_SECONDS=.6;
/** Largest room the layout supports; subagents beyond it are not drawn and are counted by a "+N" badge. */
export const MAX_ROOM_MEMBERS=16;

/** A subagent; `leaving` marks one that already left the snapshot and is only kept for its fade-out. */
export type WorkerSub=SubagentView&{readonly leaving?:boolean};
export interface WorkerState {
  sub:WorkerSub;
  /** Seconds since appearing. */
  enter:number;
  /** Seconds since leaving the snapshot; null while running. The worker is removed at WORKER_EXIT_SECONDS. */
  exit:number|null;
  /** Fade factor 0..1 (fade-in * fade-out). */
  alpha:number;
}

/** The office's subagents as members, in layout order, cut at MAX_ROOM_MEMBERS (`hidden` = how many did not fit). */
export function tempMembers(office:Office):{visible:{sub:WorkerSub;agent:AgentView}[];hidden:number}{
  const subs:readonly WorkerSub[]=office.subagents??[];
  if(!subs.length)return {visible:[],hidden:0};
  const order=[office.manager?.id,...office.members.map(m=>m.id)];
  const rank=(s:WorkerSub)=>{const i=order.indexOf(s.parentAgentId);return i<0?order.length:i;};
  const sorted=subs.map((sub,i)=>({sub,i})).sort((a,b)=>rank(a.sub)-rank(b.sub)||a.i-b.i).map(v=>v.sub);
  const room=Math.max(0,MAX_ROOM_MEMBERS-office.members.length);
  return {visible:sorted.slice(0,room).map(sub=>({sub,agent:{id:sub.id,name:sub.name,provider:sub.provider,state:'working' as const,stateSince:sub.since,needsAttention:false}})),hidden:Math.max(0,sorted.length-room)};
}

/**
 * Plate text. Siblings of one parent share leading words ("vqa sleeper 1", "vqa waiter 3"): those are dropped so the
 * distinguishing part is what fits on the plate. Falls back to the full name when nothing distinguishing is left.
 */
export function workerLabel(room:Room,station:Station):string{
  const name=station.agent.name,parent=station.temp?.parentId;
  const siblings=room.subagents.filter(s=>s.parentAgentId===parent).map(s=>s.name.split(/\s+/));
  if(siblings.length<2)return name;
  let common=0;while(siblings.every(w=>w.length>common+1&&w[common]===siblings[0][common]))common++;
  return common?name.split(/\s+/).slice(common).join(' ')||name:name;
}

/** A shrinking room keeps its larger layout this long after a worker leaves (grow is immediate). */
export const LAYOUT_HOLD_SECONDS=60;
/** Layout-size ordering: background (members <=3, <=6, more) first, then number of desk rows. Equal cost = same desk positions. */
export function layoutCost(members:number):number{
  const rows=members<=3?1:members<=6?Math.ceil(members/3):Math.ceil(members/4);
  return (members<=3?0:members<=6?1:2)*100+rows;
}
/** Per-office layout hold, kept on the office's lead (manager, else first member) actor. */
export interface LayoutHold {
  /** Member count the room is laid out for (>= the real count while a shrink is being delayed). */
  members:number;
  /** Real (non-subagent) members when set; a change means a real agent came or went, which re-lays out at once. */
  regular:number;
  /** Seconds the room has been smaller than `members` needs. */
  idle:number;
}
/** Next hold state for a room: grows at once, shrinks only after LAYOUT_HOLD_SECONDS, resets when real members change. */
export function nextLayoutHold(prev:LayoutHold|undefined,members:number,regular:number,seconds:number):LayoutHold{
  const now:LayoutHold={members,regular,idle:0};
  if(!prev||prev.regular!==regular||layoutCost(members)>=layoutCost(prev.members))return now;
  const idle=prev.idle+seconds;
  return idle>=LAYOUT_HOLD_SECONDS?now:{members:prev.members,regular,idle};
}
/** Office with the member count its layout is held at (set by withExitingWorkers, read by layoutOffices). */
export type HeldOffice=Office&{readonly holdMembers?:number};

/**
 * Snapshot to lay out/step: the real one plus (a) for every worker actor whose subagent is gone, that subagent again marked
 * `leaving` (its desk stays until the fade-out ends) and (b) `holdMembers` on offices whose shrink is being delayed.
 * Returns `snapshot` itself when neither applies.
 */
export function withExitingWorkers(snapshot:OfficeSnapshot,actors:Actors):OfficeSnapshot{
  const all=Object.values(actors);
  const running=new Set(snapshot.projects.flatMap(p=>p.offices.flatMap(o=>(o.subagents??[]).map(s=>s.id))));
  const leaving=all.filter(a=>a.worker&&(a.worker.exit??0)<WORKER_EXIT_SECONDS&&!running.has(a.worker.sub.id)).map(a=>a.worker!.sub);
  let changed=false;
  const projects=snapshot.projects.map(p=>({...p,offices:p.offices.map(o=>{
    const ids=new Set([o.manager?.id,...o.members.map(m=>m.id)]);
    const mine=leaving.filter(s=>ids.has(s.parentAgentId));
    let list:WorkerSub[]=[...(o.subagents??[])];
    for(const s of mine){const at=list.findIndex(x=>x.since>s.since);list.splice(at<0?list.length:at,0,{...s,leaving:true});}
    const lead=o.manager?.id??o.members[0]?.id,held=lead?actors[lead]?.hold?.members:undefined;
    const total=o.members.length+Math.min(list.length,Math.max(0,MAX_ROOM_MEMBERS-o.members.length));
    const hold=held!==undefined&&held>total?held:undefined;
    if(!mine.length&&hold===undefined)return o;
    changed=true;
    return {...o,subagents:list,...(hold!==undefined?{holdMembers:hold}:{})} as HeldOffice;
  })}));
  return changed?{...snapshot,projects}:snapshot;
}
