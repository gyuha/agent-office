// Core verification without a DOM. Visual/browser checks use verify-preview.cjs.
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
const {fixture}=require('./fixtures.cjs');const cache={};
function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const source=fs.readFileSync(`client/scene/${name}.ts`,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(js,{exports,Date,console,require(p){const path=require('path').posix;let key=path.normalize(path.join(path.dirname(name),p));if(!fs.existsSync(`client/scene/${key}.ts`))key+='/index';return load(key);}});return exports;}
const core=load('core/index'),hit=load('core/hitTest');
for(const mode of ['3','6','10','16','solo','all','empty']){
  const snap=fixture(mode),layout=core.layoutOffices(snap,900);let actors=core.step({},snap,0,layout);
  for(const room of layout.rooms)for(const s of room.stations){assert.equal(hit.agentAtPoint(layout,actors,s.plate.x,s.plate.y),s.agent.id);assert.equal(hit.agentAtPoint(layout,actors,s.seat.x,s.seat.y-s.actorHeight*.4),s.agent.id);}
  const polled=JSON.parse(JSON.stringify(snap));actors=core.step(actors,polled,2000,core.layoutOffices(polled,900));for(const a of Object.values(actors))assert.equal(a.phase,2);
  for(const p of snap.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.state='away';
  for(let i=0;i<300;i++)actors=core.step(actors,snap,100,layout);
  for(const room of layout.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-(s.hasSofa||s.manager?s.away:s.seat).x,a.y-(s.hasSofa||s.manager?s.away:s.seat).y)<1);}
  for(const p of snap.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.state='phone';
  for(let i=0;i<300;i++)actors=core.step(actors,snap,100,layout);
  for(const room of layout.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<1);assert.equal(a.state,'phone');}
  const resized=core.layoutOffices(snap,420);actors=core.step(actors,snap,0,resized);
  for(const room of resized.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<1);}
  console.log(`${mode}: layout, figure/plate hitTest, polling continuity, sofa capacity/return, resize passed`);
}
for(const frames of [1,2,7,12]){const spec={frameW:160,frameH:216,frames,fps:8,loop:true};const f=core.sheetFrame(spec,{width:160*frames,height:216},1);assert.ok(f.x>=0&&f.x<160*frames);}
const once=core.sheetFrame({frameW:10,frameH:20,frames:7,fps:4,loop:false},{width:70,height:20},999);assert.equal(once.x,60);
console.log('Arbitrary frame count/fps and non-looping last-frame clamp passed');
