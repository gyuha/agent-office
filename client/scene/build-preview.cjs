// Run from repository root; the output contains the same core used by the app.
const fs = require('fs');
const ts = require('typescript');
const names = ['layout', 'actors', 'sprites', 'effects', 'draw', 'index'];
const modules = names.map(name => {
  const source = fs.readFileSync(`client/scene/core/${name}.ts`, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return `${JSON.stringify('./' + name)}: function(exports, require) {\n${code}\n}`;
}).join(',\n');
const data = fs.readFileSync('client/scene/generated/sprites.ts', 'utf8')
  .replace(/^.*export const spriteData = /s, '').replace(/ as const;\s*$/, '');
const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Office scene preview</title><style>
body{margin:0;background:#111a28;color:white;font:14px sans-serif}
nav{position:sticky;top:0;background:#243344;padding:10px;z-index:1}
canvas{display:block;image-rendering:pixelated}
</style></head><body><nav><label>Scenario <select id="scenario">
<option value="project">Project overview</option><option value="project-1">Project: 1</option>
<option value="project-3">Project: 3</option><option value="project-7">Project: 7</option>
<option value="project-15">Project: 15</option><option value="all">All projects</option>
<option value="transition">Transition</option><option value="empty">Empty</option>
</select></label> <span id="status"></span></nav><canvas id="canvas"></canvas><script>
const modules={${modules}}, cache={};
function require(name){if(!cache[name]){const exports={};cache[name]=exports;modules[name](exports,require)}return cache[name]}
const core=require('./index');
const data=${data};const sprites={};
for(const [key,s] of Object.entries(data)){
  const image=new Image();image.onload=()=>sprites[key]={image,metadata:s.metadata};image.src=s.uri;
}
const states=['working','away','phone','sleeping'];
function agent(id,state){return {id,name:id==='0'?'Orchestrator':'Agent '+id,
  provider:['claude','codex','antigravity','copilot','muse','opencode','pi'][Number(id)%7],state,stateSince:0,
  needsAttention:id==='2'}}
function office(n,prefix){
  const members=Array.from({length:n},(_,i)=>agent(String(i),states[i%4]));
  for(const member of members)member.id=prefix+member.id;
  return {id:prefix,kind:n>1?'group':'solo',manager:n>1?members.shift():null,members};
}
let start=performance.now();
function snapshot(mode,now){
  let projects;
  if(mode==='all')projects=[0,1,2].map((i)=>({projectId:'p'+i,
    projectName:['Atlas','Beacon','Cosmos'][i],offices:[office([7,3,1][i],'p'+i)]}));
  else {
    const counts=mode==='project'?[7,3,1]:mode==='empty'?[]:
      mode==='transition'?[3]:[Number(mode.split('-')[1])];
    projects=[{projectId:'p',projectName:'Studio',offices:counts.map((n,i)=>office(n,'o'+i))}];
  }
  if(mode==='transition'){
    const state=['working','away','working'][Math.floor((now-start)/5000)%3];
    projects[0].offices[0].members[0].state=state;
    document.querySelector('#status').textContent='First member: '+state+' (changes every 5 seconds)';
  }else document.querySelector('#status').textContent='';
  return {scope:mode==='all'?'all':'project',projects,generatedAt:0};
}
const canvas=document.querySelector('#canvas'),ctx=canvas.getContext('2d');
const select=document.querySelector('#scenario');let actors={},last=0;
function selectHash(){const mode=location.hash.slice(1)||'project';
  select.value=[...select.options].some(o=>o.value===mode)?mode:'project';
  actors={};last=0;start=performance.now();}
window.addEventListener('hashchange',selectHash);
select.onchange=()=>{location.hash=select.value};selectHash();
function tick(t){
  const now=performance.now();
  const snap=snapshot(select.value,now),scale=innerWidth<500?1:2;
  const layout=core.layoutOffices(snap,Math.max(192,Math.floor(innerWidth/scale)));
  if(canvas.width!==layout.width*scale||canvas.height!==layout.height*scale){
    canvas.width=layout.width*scale;canvas.height=layout.height*scale;
    canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';
  }
  actors=core.step(actors,snap,last?Math.min(100,t-last):0,layout);last=t;
  ctx.setTransform(scale,0,0,scale,0,0);core.draw(ctx,layout,actors,t,sprites);
  requestAnimationFrame(tick);
}requestAnimationFrame(tick);
</script></body></html>`;
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) throw new Error('Preview has no inline script');
for (const match of scripts) new Function(match[1]);
fs.writeFileSync('client/scene/preview.html', html);
console.log('Preview inline script syntax OK');
