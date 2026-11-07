// Core verification without a DOM. Visual/browser checks use verify-preview.cjs.
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
const {fixture}=require('./fixtures.cjs');const cache={};
function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const source=fs.readFileSync(`client/scene/${name}.ts`,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(js,{exports,Date,console,require(p){const path=require('path').posix;let key=path.normalize(path.join(path.dirname(name),p));if(!fs.existsSync(`client/scene/${key}.ts`))key+='/index';return load(key);}});return exports;}
const core=load('core/index'),hit=load('core/hitTest');
for(const mode of ['3','6','10','16','solo','all','empty']){
  const snap=fixture(mode),layout=core.layoutOffices(snap,900);let actors=core.step({},snap,0,layout);
  for(const room of layout.rooms)for(const s of room.stations){assert.equal(hit.agentAtPoint(layout,actors,s.plate.x,s.plate.y),s.agent.id);assert.equal(hit.agentAtPoint(layout,actors,s.seat.x,s.seat.y-s.actorHeight*.4),s.agent.id);}
  const roomSlots=layout.rooms.map(r=>r.rests.map(s=>s.owner));
  for(const room of layout.rooms){
    assert.equal(new Set(room.rests.map(s=>s.owner)).size,room.rests.length);
    const slots=core.manifest.restLayout.leftLounge.byBackground[room.background];
    assert.equal(room.stations.filter(s=>!s.manager&&s.rest).length,Math.min(slots.slots.filter(slot=>{const s=room.stations[0],b=core.manifest.beanbags[slot.beanbag],scale=s.actorHeight/(b.referenceActorFrameHeight||b.actorHeight);return slot.topLeft[1]+b.size[1]*scale+s.actorHeight*.35+10<=room.sceneHeight-24;}).length,room.stations.filter(s=>!s.manager).length));
    assert.ok(room.sceneHeight>400);
    const plates=load('core/nameplates');
    for(const lead of room.stations.filter(s=>s.manager)){
      const plate=plates.plateGeometry(lead,layout.viewportScale);
      assert.ok(plate.x>=lead.x&&plate.x+plate.width<=lead.x+lead.width,'Lead plate exceeds furniture');
      assert.ok(plate.font*layout.viewportScale>=6.5-.001,'Lead readability floor');
    }
    const navigation=load('core/navigation');
    for(const station of room.stations.filter(s=>!s.manager&&s.rest)){
      const path=navigation.route(room,station,station.seat,station.away);
      assert.ok(path.every(p=>!('cut' in p)),'No transition position cuts');
    }
  }
  // Working stays seated for every phase, including the removed visit window.
  const working=JSON.parse(JSON.stringify(snap));
  for(const p of working.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.state='working';
  let still={};for(let i=0;i<400;i++)still=core.step(still,working,100,layout);
  for(const room of layout.rooms){
    assert.ok(room.stations.every(s=>Math.abs(s.actorHeight-room.stations[0].actorHeight)<.001));
    for(const s of room.stations){assert.equal(still[s.agent.id].moving,false);assert.equal(still[s.agent.id].route.length,0);}
    for(const station of room.stations){
      const desk=station.desk,id=station.manager?'orchestrator':`actor-${station.variant}`;
      const hand=core.manifest.keyboardAlignment.handCentersIn160x216Frames[id],adj=desk.actorOffsets[id].working,f=station.actorHeight/216;
      const x=station.bodySeat.x+(hand[0]-desk.actorAnchor[0])*f+adj[0]*station.moduleScale;
      const y=station.bodySeat.y+(hand[1]-desk.actorAnchor[1])*f+(desk.actorStateYOffset.working+adj[1])*station.moduleScale;
      const [kx,ky,kw,kh]=desk.keyboard.keycapRect;
      assert.ok(x>=station.x+kx*station.moduleScale&&x<=station.x+(kx+kw)*station.moduleScale&&y>=station.y+ky*station.moduleScale&&y<=station.y+(ky+kh)*station.moduleScale,'Scaled hands miss keyboard');
    }

    const manager=room.stations.find(s=>s.manager);
    if(manager?.rest)for(const d of room.stations.filter(s=>!s.manager)){
      const r=manager.rest;assert.ok(!(r.x<d.x+d.width&&r.x+r.width>d.x&&r.y<d.y+d.height&&r.y+r.height>d.y),'Manager bag overlaps member module');
    }
  }
  const polled=JSON.parse(JSON.stringify(snap));actors=core.step(actors,polled,2000,core.layoutOffices(polled,900));for(const a of Object.values(actors))assert.equal(a.phase,2);
  for(const p of snap.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.state='away';
  for(let i=0;i<130;i++){
    const before=actors;actors=core.step(actors,snap,100,layout);
    for(const room of layout.rooms)for(const station of room.stations){
      const a=actors[station.agent.id],b=before[station.agent.id];
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=256*station.actorHeight/216*.1+.001,'Position cut or excessive locomotion speed');
    }

    if(i===59&&['6','16'].includes(mode))assert.ok(Object.values(actors).every(a=>!a.route.length),'Whole transition exceeds six seconds');
    for(const room of layout.rooms)for(const s of room.stations){
      const a=actors[s.agent.id];if(!a.moving)continue;
      for(const d of room.stations){if(d===s)continue;
        const top=d.y+Math.max(0,(d.desk.frontOcclusionY-95)*d.moduleScale);
        assert.ok(!(a.x>d.x&&a.x<d.x+d.width&&a.y>top&&a.y<d.y+d.height),`Route crosses another desk: ${s.agent.id}`);
      }
    }
  }
  assert.equal(JSON.stringify(core.layoutOffices(snap,900).rooms.map(r=>r.rests.map(s=>s.owner))),JSON.stringify(roomSlots));
  for(const room of layout.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-(s.rest?s.away:s.seat).x,a.y-(s.rest?s.away:s.seat).y)<1);}
  for(const p of snap.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.state='phone';
  for(let i=0;i<130;i++)actors=core.step(actors,snap,100,layout);
  for(const room of layout.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<1);assert.equal(a.state,'phone');}
  const resized=core.layoutOffices(snap,420);actors=core.step(actors,snap,0,resized);
  for(const room of resized.rooms)for(const s of room.stations){const a=actors[s.agent.id];assert.ok(Math.hypot(a.x-s.seat.x,a.y-s.seat.y)<1);}
  console.log(`${mode}: layout, figure/plate hitTest, polling continuity, beanbag capacity/return, resize passed`);
}
for(const frames of [1,2,7,12]){const spec={frameW:160,frameH:216,frames,fps:8,loop:true};const f=core.sheetFrame(spec,{width:160*frames,height:216},1);assert.ok(f.x>=0&&f.x<160*frames);}
const once=core.sheetFrame({frameW:10,frameH:20,frames:7,fps:4,loop:false},{width:70,height:20},999);assert.equal(once.x,60);
console.log('Arbitrary frame count/fps and non-looping last-frame clamp passed');

for(const desk of [...Object.values(core.manifest.pods),...Object.values(core.manifest.leadDesks)]){
  for(const [id,hand]of Object.entries(core.manifest.keyboardAlignment.handCentersIn160x216Frames)){
    const f=desk.actorHeight/216,adj=desk.actorOffsets[id].working;
    const x=desk.seat[0]+(hand[0]-desk.actorAnchor[0])*f+adj[0];
    const y=desk.seat[1]+(hand[1]-desk.actorAnchor[1])*f+desk.actorStateYOffset.working+adj[1];
    const [kx,ky,kw,kh]=desk.keyboard.keycapRect;
    assert.ok(x>=kx&&x<=kx+kw&&y>=ky&&y<=ky+kh,`Hands outside keyboard: ${id} ${desk.back}`);
  }
}
console.log('Module hand alignment, fixed beanbag ownership/capacity, and furniture-free navigation passed');
