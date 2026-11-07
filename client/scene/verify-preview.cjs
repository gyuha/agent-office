// Run offline checks normally. --browser prints the real-browser check function;
// evaluate it in a tab serving preview.html (Paseo browser_evaluate or equivalent).
async function browserChecks(){
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const preview=window.preview;assert(preview,'Preview API missing');
  for(let i=0;i<100&&!preview.inspect().ready;i++)await new Promise(r=>setTimeout(r,50));
  assert(preview.inspect().ready,'Assets failed to load');
  preview.resume();await frame();
  const results=[];
  for(const mode of ['3','6','10','16','solo','all']){
    const select=document.querySelector('#scenario');select.value=mode;select.onchange();preview.reset();await frame();
    const scene=preview.inspect(),expected=mode==='all'?3:1;
    assert(scene.layout.rooms.length===expected,mode+' room count');
    for(const room of scene.layout.rooms)for(const s of room.stations){const a=scene.actors[s.agent.id];assert(Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<2,mode+' initial seated pose');}
    assert(!document.querySelector('.office-plate'),mode+' plates belong to the canvas depth pass');
    assert(scene.layout.rooms.every(r=>r.stations.every(s=>s.plateWidth>0)),mode+' canvas plate geometry');
    for(let i=1;i<scene.layout.rooms.length;i++)assert(scene.layout.rooms[i].y>scene.layout.rooms[i-1].y+scene.layout.rooms[i-1].height,mode+' vertical stacking');
    results.push(mode+' layout/plates');
  }
  const select=document.querySelector('#scenario');select.value='6';select.onchange();preview.reset();await frame();
  const phase=preview.inspect().actors['p-0'].phase;preview.poll();await new Promise(r=>setTimeout(r,150));
  assert(preview.inspect().actors['p-0'].phase>phase,'Polling reset phase');
  const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect(),scene=preview.inspect(),s=scene.layout.rooms[0].stations[1];
  canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+s.seat.x/scene.layout.width*r.width,clientY:r.top+(s.seat.y-s.actorHeight*.4)/scene.layout.height*r.height}));
  assert(preview.selected===s.agent.id,'Canvas hitTest callback');
  const lead=scene.layout.rooms[0].stations[0];canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+lead.plate.x/scene.layout.width*r.width,clientY:r.top+lead.plate.y/scene.layout.height*r.height}));assert(preview.selected==='p-lead','Canvas nameplate navigation callback');
  let snap=JSON.parse(JSON.stringify(preview.snapshot()));delete snap.workspaceName;preview.setSnapshot(snap);await frame();
  assert(![...document.querySelectorAll('.office-context small')].some(n=>n.textContent==='WORKSPACE'),'Missing workspace must hide cell');
  for(const node of document.querySelectorAll('.office-context strong'))assert(getComputedStyle(node).textOverflow==='ellipsis','Header ellipsis');
  preview.pause();return {passed:[...results,'polling continuity','canvas hitTest','nameplate navigation','optional workspace','ellipsis'],ready:true};
}
if(process.argv.includes('--browser'))console.log(browserChecks.toString());
else{
  require('./render-check.cjs');
  const fs=require('fs'),assert=require('assert/strict');
  const html=fs.readFileSync('client/scene/preview.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);new Function(script);console.log('Preview script syntax passed. Use --browser for real-browser checks.');
}
