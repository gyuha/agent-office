import type {OfficeSnapshot} from '../../shared/state/contract';
import {layoutOffices} from './core/layout';
import {mountOfficeRoom} from './mount-room';
import {subscribeFrames,schedulerMetrics} from './scheduler';
declare const document:any,window:any;
/** Cards own geometry and caches; decoded assets and the 12fps scheduler are shared. */
export function mountOfficeScene(parent:any,getSnapshot:()=>OfficeSnapshot,onSelect?:(id:string)=>void){
  const root=document.createElement('div');root.className='office-collection';root.style.width='100%';parent.append(root);
  type Scene=ReturnType<typeof mountOfficeRoom>;
  const cards=new Map<string,{holder:any;snapshot:OfficeSnapshot;scene:Scene}>();
  let previous:OfficeSnapshot|undefined,paused=false,disposed=false,oldWidth=0,placementKey='',placements=0;
  let order:string[]=[];
  function reconcile(){
    const snapshot=getSnapshot(),width=root.clientWidth||parent.clientWidth||480;if(snapshot===previous&&width===oldWidth)return;
    const modeChanged=snapshot.scope!==previous?.scope;previous=snapshot;oldWidth=width;
    const grid=snapshot.scope==='all';
    if(modeChanged)root.style.cssText=grid?'position:relative;box-sizing:border-box;width:100%':'width:100%';
    const values=grid?[...snapshot.projects].sort((a,b)=>a.projectName.localeCompare(b.projectName)).flatMap(p=>p.offices.filter(o=>o.manager||o.members.length).map(o=>({key:JSON.stringify([p.projectId,o.id]),snapshot:{...snapshot,projects:[{...p,offices:[o]}]}}))):[{key:'panel',snapshot}];
    order=values.map(v=>v.key);
    const wanted=new Set(order);
    for(const [key,card]of cards)if(!wanted.has(key)){card.scene.dispose();card.holder.remove();cards.delete(key);}
    for(const [index,value] of values.entries()){
      let card=cards.get(value.key);
      if(!card){const holder=document.createElement('div');holder.style.cssText='width:100%;max-width:480px;min-width:0;align-self:start;justify-self:center';root.append(holder);
        const record={holder,snapshot:value.snapshot,scene:null as unknown as Scene};
        record.scene=mountOfficeRoom(holder,()=>record.snapshot,onSelect);card=record;cards.set(value.key,card);if(paused)card.scene.pause();
      }else card.snapshot=value.snapshot;
      if(root.children[index]!==card.holder)root.insertBefore(card.holder,root.children[index]||null);
    }
    if(grid){
      const gap=20,padding=16,available=Math.max(1,width-padding*2);
      const columns=Math.max(1,Math.min(values.length||1,Math.floor((available+gap)/(410+gap))));
      const cardWidth=Math.min(480,(available-gap*(columns-1))/columns);
      const heights=values.map(v=>layoutOffices(v.snapshot,cardWidth).height*cardWidth/1536);
      const key=JSON.stringify([width,order,heights]);
      if(key!==placementKey){
        placementKey=key;placements++;
        const bottoms=Array(columns).fill(padding),left=(width-(columns*cardWidth+(columns-1)*gap))/2;
        // Keep all offices of a project contiguous in one shortest column.
        const blocks:{project:string;items:number[]}[]=[];
        values.forEach((v,i)=>{
          const project=v.snapshot.projects[0].projectId;
          if(blocks.at(-1)?.project!==project)blocks.push({project,items:[]});
          blocks[blocks.length-1].items.push(i);
        });
        for(const block of blocks){
          const column=bottoms.indexOf(Math.min(...bottoms));
          for(const i of block.items){
            const holder=cards.get(values[i].key)!.holder;
            holder.dataset.project=block.project;
            holder.style.cssText=`position:absolute;min-width:0;width:${cardWidth}px;left:${left+column*(cardWidth+gap)}px;top:${bottoms[column]}px`;
            bottoms[column]+=heights[i]+gap;
          }
        }
        root.style.height=(Math.max(...bottoms)-(values.length?gap:0)+padding)+'px';
      }
    }else placementKey='';
  }
  reconcile();
  const unsubscribe=subscribeFrames(reconcile,()=>!disposed&&!paused&&!document.hidden);
  let resizeTask:(()=>void)|undefined;
  const resizeObserver=window.ResizeObserver?new window.ResizeObserver(()=>{
    if(root.clientWidth===oldWidth||resizeTask)return;
    resizeTask=subscribeFrames(()=>{resizeTask?.();resizeTask=undefined;reconcile();},()=>!disposed&&!document.hidden);
  }):null;
  resizeObserver?.observe(parent);
  const each=()=>order.map(key=>cards.get(key)!);
  async function fixed(method:'setTime'|'setTransition'|'setTransitionSequence',args:any[]){
    paused=true;reconcile();
    for(let pass=0;pass<3;pass++){
    await Promise.all(each().map(card=>{
      const select=(snapshot:OfficeSnapshot)=>card.snapshot.scope==='all'?{...snapshot,projects:snapshot.projects.flatMap(p=>p.offices.filter(o=>JSON.stringify([p.projectId,o.id])===JSON.stringify([card.snapshot.projects[0].projectId,card.snapshot.projects[0].offices[0].id])).map(o=>({...p,offices:[o]})))}:snapshot;
      if(method==='setTransition')return card.scene.setTransition(select(args[0]),args[1],args[2],args[3]);
      if(method==='setTransitionSequence')return card.scene.setTransitionSequence(select(args[0]),args[1].map((s:any)=>({...s,snapshot:select(s.snapshot)})),args[2],args[3]);
      return card.scene.setTime(args[0],args[1]);
    }));
    if(root.clientWidth===oldWidth)break;reconcile();
    }
  }
  return {setTime:(time:number,epoch:number)=>fixed('setTime',[time,epoch]),setTransition:(from:OfficeSnapshot,time:number,epoch:number,settle=60000)=>fixed('setTransition',[from,time,epoch,settle]),setTransitionSequence:(from:OfficeSnapshot,stages:{snapshot:OfficeSnapshot;duration:number}[],epoch:number,settle=60000)=>fixed('setTransitionSequence',[from,stages,epoch,settle]),
    reset(){reconcile();each().forEach(c=>c.scene.reset());},pause(){paused=true;each().forEach(c=>c.scene.pause());},resume(){paused=false;reconcile();each().forEach(c=>c.scene.resume());},
    dispose(){disposed=true;unsubscribe();resizeObserver?.disconnect();resizeTask?.();each().forEach(c=>c.scene.dispose());cards.clear();root.remove();},
    inspect(){reconcile();const all=each().map(c=>c.scene.inspect());if(previous?.scope!=='all')return {...all[0],scheduler:schedulerMetrics()};
      return {ready:all.every(c=>c.ready),failed:all.some(c=>c.failed),layout:{width:root.clientWidth,height:root.clientHeight,rooms:all.flatMap(c=>c.layout?.rooms||[])},actors:Object.assign({},...all.map(c=>c.actors)),cards:all,placements,scheduler:schedulerMetrics(),metrics:{backingPixels:all.reduce((n,c)=>n+c.metrics.backing[0]*c.metrics.backing[1],0),backgroundPixels:all.reduce((n,c)=>n+c.metrics.backgroundBacking[0]*c.metrics.backgroundBacking[1],0),meanFrameMs:all.reduce((n,c)=>n+c.metrics.meanFrameMs,0)}};
    }};
}
