const names=['plugin#FDF9','scene#3C71','art#94A2','qa#0499','review#A1C2','docs#7B10','infra#55E3','api#C0DE','ui#5E19','perf#0F42','data#91AB','auth#3D7E','ci#B8F0','search#64CA','mobile#E27D','ops#4A09'];
function fixture(mode='6',state='mixed'){
  const now=Date.now();
  const agent=(id,i,lead=false)=>({id,name:lead?'Orchestrator':names[i%names.length],provider:lead?'orchestrator':['claude','codex','gemini'][i%3],state:state==='mixed'?(lead?'working':['working','phone','working','sleeping','working','phone'][i%6]):state,stateSince:now-90000,needsAttention:state==='attention'});
  const office=(n,p,solo=false)=>({id:p,kind:solo?'solo':'group',manager:solo?null:agent(p+'-lead',0,true),members:Array.from({length:n},(_,i)=>agent(p+'-'+i,i))});
  return {scope:mode==='all'||mode==='grid'?'all':'project',workspaceName:'Greeting with no task specified',generatedAt:now,projects:mode==='grid'?Array.from({length:6},(_,i)=>({projectId:'grid'+i,projectName:['Atlas','Beacon','Cedar','Delta','Ember','Forge'][i],offices:i<4?[office([3,6,10,16][i],'grid'+i),office(1,'solo'+i,true)]:[office(i===4?3:1,'grid'+i,i===5)]})):mode==='empty'?[]:mode==='all'?[{projectId:'p',projectName:'agent-office',offices:[office(3,'a'),office(1,'s',true)]},{projectId:'q',projectName:'Second project',offices:[office(6,'b')]}]:[{projectId:'p',projectName:'agent-office',offices:mode==='group-solos'?[office(1,'p'),office(1,'solo1',true),office(1,'solo2',true),office(1,'solo3',true)]:[office(mode==='solo'?1:Number(mode),'p',mode==='solo')]}]};
}
module.exports={fixture};
