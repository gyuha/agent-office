const names=['plugin#FDF9','scene#3C71','art#94A2','qa#0499','review#A1C2','docs#7B10','infra#55E3','api#C0DE','ui#5E19','perf#0F42','data#91AB','auth#3D7E','ci#B8F0','search#64CA','mobile#E27D','ops#4A09'];
/** `<scenario>+sub` adds running subagents (drawn as regular desks after the real members): manager 2, member 0 one, member 1 two; `+sub5` gives member 0 five; `16+sub` overflows the largest room ("+N"). */
function fixture(mode='6',state='mixed'){
  const m=/^(.*)\+sub(\d*)$/.exec(String(mode));
  if(!m)return base(mode,state);
  const value=base(m[1],state),words=['vqa sleeper 1/2','vqa waiter 3/4','explore','test-run','docs-gen','refactor'],big=Number(m[2])||0;
  const sub=(parent,i,n)=>Array.from({length:n},(_,k)=>({id:parent.id+'-sub'+k,parentAgentId:parent.id,name:words[(i+k)%words.length],provider:['claude','codex'][k%2],since:Date.now()-30000+k}));
  for(const p of value.projects)for(const o of p.offices){
    const who=[o.manager,...o.members].filter(Boolean);
    o.subagents=who.flatMap((a,i)=>sub(a,i,big&&i===(o.manager?1:0)?big:o.manager?(i===0?2:i===1?1:i===2?2:0):(i===0?1:0)));
  }
  return value;
}
function base(mode='6',state='mixed'){
  const now=Date.now();
  if(String(mode).startsWith('filters')){
    // Mixed states for the office filter: working-only, awaiting-only, working+awaiting, idle, solo idle, solo working.
    const a=(id,i,st,attention=false)=>({id,name:names[i%names.length],provider:['claude','codex','gemini'][i%3],state:st,stateSince:now-90000,needsAttention:attention});
    const lead=(id,st,attention=false)=>({...a(id,0,st,attention),name:'Orchestrator',provider:'orchestrator'});
    const group=(id,manager,members)=>({id,kind:'group',manager,members});
    const solo=(id,st,attention=false)=>({id,kind:'solo',manager:null,members:[a(id,1,st,attention)]});
    const offices={
      working:group('f-working',lead('f-working-lead','working'),[a('f-working-0',1,'working'),a('f-working-1',2,'working')]),
      awaiting:group('f-awaiting',lead('f-awaiting-lead','sleeping'),[a('f-awaiting-0',3,'working',true),a('f-awaiting-1',4,'away')]),
      both:group('f-both',lead('f-both-lead','working'),[a('f-both-0',5,'working',true),a('f-both-1',6,'working'),a('f-both-2',7,'phone')]),
      idle:group('f-idle',lead('f-idle-lead','away'),[a('f-idle-0',8,'phone'),a('f-idle-1',9,'sleeping')]),
      soloIdle:solo('f-solo-idle','sleeping'),soloWorking:solo('f-solo-working','working')};
    const list=Object.values(offices);
    const projects=mode==='filters-panel'?[{projectId:'p',projectName:'agent-office',offices:list}]:[{projectId:'f1',projectName:'Atlas',offices:[offices.working,offices.awaiting]},{projectId:'f2',projectName:'Beacon',offices:[offices.both,offices.idle]},{projectId:'f3',projectName:'Cedar',offices:[offices.soloIdle,offices.soloWorking]}];
    return {scope:mode==='filters-panel'?'project':'all',workspaceName:mode==='filters-panel'?'Filter workspace':null,generatedAt:now,projects};
  }
  const agent=(id,i,lead=false)=>({id,name:lead?'Orchestrator':names[i%names.length],provider:lead?'orchestrator':['claude','codex','gemini'][i%3],state:state==='mixed'?(lead?'working':['working','phone','working','sleeping','working','phone'][i%6]):state,stateSince:now-90000,needsAttention:state==='attention'});
  const office=(n,p,solo=false)=>({id:p,kind:solo?'solo':'group',manager:solo?null:agent(p+'-lead',0,true),members:Array.from({length:n},(_,i)=>agent(p+'-'+i,i))});
  return {scope:mode==='all'||mode==='grid'?'all':'project',workspaceName:'Greeting with no task specified',generatedAt:now,projects:mode==='grid'?Array.from({length:6},(_,i)=>({projectId:'grid'+i,projectName:['Atlas','Beacon','Cedar','Delta','Ember','Forge'][i],offices:i<4?[office([3,6,10,16][i],'grid'+i),office(1,'solo'+i,true)]:[office(i===4?3:1,'grid'+i,i===5)]})):mode==='empty'?[]:mode==='all'?[{projectId:'p',projectName:'agent-office',offices:[office(3,'a'),office(1,'s',true)]},{projectId:'q',projectName:'Second project',offices:[office(6,'b')]}]:[{projectId:'p',projectName:'agent-office',offices:mode==='group-solos'?[office(1,'p'),office(1,'solo1',true),office(1,'solo2',true),office(1,'solo3',true)]:[office(mode==='solo'?1:Number(mode),'p',mode==='solo')]}]};
}
module.exports={fixture};
