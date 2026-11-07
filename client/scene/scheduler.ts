declare const document:any;
declare function requestAnimationFrame(fn:(time:number)=>void):number;
declare function cancelAnimationFrame(id:number):void;
const entries=new Set<{draw:(time:number)=>void;active:()=>boolean}>();
let timer:ReturnType<typeof setTimeout>|undefined,frame=0,nextAt=0,batches=0,lastBatchMs=0;
const interval=1000/12;
function stop(){if(timer!==undefined)clearTimeout(timer);timer=undefined;if(frame)cancelAnimationFrame(frame);frame=0;nextAt=0;}
function schedule(){
  if(timer!==undefined||frame||document.hidden||![...entries].some(e=>e.active()))return;
  timer=setTimeout(()=>{timer=undefined;frame=requestAnimationFrame(time=>{
    frame=0;const start=performance.now();
    if(!document.hidden)for(const entry of [...entries])if(entries.has(entry)&&entry.active())entry.draw(time);
    lastBatchMs=performance.now()-start;batches++;nextAt=time+interval;schedule();
  });},Math.max(0,nextAt-performance.now()));
}
function visibility(){if(document.hidden)stop();else schedule();}
export function subscribeFrames(draw:(time:number)=>void,active:()=>boolean){
  const entry={draw,active};if(!entries.size)document.addEventListener('visibilitychange',visibility);
  entries.add(entry);schedule();
  return ()=>{entries.delete(entry);if(!entries.size){stop();document.removeEventListener('visibilitychange',visibility);}};
}
export function schedulerMetrics(){return {subscribers:entries.size,timers:timer!==undefined||frame?1:0,batches,lastBatchMs};}
