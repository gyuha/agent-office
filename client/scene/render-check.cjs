// Record real core draw calls for the offline raster check.
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = {}; cache[name] = exports;
  const source = fs.readFileSync(`client/scene/core/${name}.ts`, 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(js, {exports, require: p => load(p.replace('./',''))});
  return exports;
}
const core = load('index');
const source = fs.readFileSync('client/scene/generated/clay.ts', 'utf8');
const data = JSON.parse(source.slice(source.indexOf('= ') + 2).replace(/ as const;\s*$/, ''));
const sprites = {};
fs.mkdirSync('/tmp/scene-clay-assets', { recursive: true });
let imageIndex = 0;
for (const [key, entry] of Object.entries(data)) {
  const file = `/tmp/scene-clay-assets/${imageIndex++}.svg`;
  fs.writeFileSync(file, Buffer.from(entry.uri.split(',')[1], 'base64'));
  sprites[key] = { image: file, metadata: entry.metadata };
}
function agent(id, state='working') { return {id, name:id==='0'?'Orchestrator':'Agent '+id,
  provider:['claude','codex','antigravity','copilot','muse','opencode','pi'][Number(id)%7],state,stateSince:0,needsAttention:id==='2'}; }
function office(n, prefix) {
  const members = Array.from({length:n},(_,i)=>agent(String(i),['working','away','phone','sleeping'][i%4]));
  members.forEach(a=>a.id=prefix+a.id);
  return {id:prefix,kind:n>1?'group':'solo',manager:n>1?members.shift():null,members};
}
for (const mode of ['project-1','project-3','project-5','project-7','project-15','away-3','away-7','away-15','all','transition-start','transition-away','transition-return','empty']) {
  const projects = mode==='all'
    ? [7,3,1].map((n,i)=>({projectId:String(i),projectName:['Atlas','Beacon','Cosmos'][i],offices:[office(n,'p'+i)]}))
    : [{projectId:'p',projectName:'Studio',offices:mode==='empty'?[]:[office(mode.startsWith('transition')?3:Number(mode.split('-')[1]),'p')]}];
  const snapshot={scope:mode==='all'?'all':'project',projects,generatedAt:0};
  if(mode.startsWith('away-')) {
    const office=projects[0].offices[0];
    for(const a of [office.manager,...office.members].filter(Boolean)) a.state='away';
  }
  const layout=core.layoutOffices(snapshot,800);
  if(mode.startsWith('transition')) projects[0].offices[0].members[0].state='working';
  let actors=core.step({},snapshot,0,layout);
  if(mode.startsWith('transition')) {
    const a=projects[0].offices[0].members[0]; a.state='working';
    actors=core.step(actors,snapshot,0,layout);
    if(mode!=='transition-start') { a.state='away'; actors=core.step(actors,snapshot,1000,layout); }
    if(mode==='transition-return') { a.state='working'; actors=core.step(actors,snapshot,300,layout); }
  }
  const commands=[];
  const ctx={fillStyle:'#000',strokeStyle:'#000',font:'',textAlign:'left',globalAlpha:1,
    imageSmoothingEnabled:false,
    fillRect(x,y,w,h){commands.push(['rect',this.fillStyle,this.globalAlpha,x,y,w,h])},
    strokeRect(x,y,w,h){commands.push(['stroke',this.strokeStyle,this.globalAlpha,x,y,w,h])},
    fillText(text,x,y){commands.push(['text',this.fillStyle,this.globalAlpha,x,y,text,this.font,this.textAlign])},
    drawImage(...args){commands.push(['image',this.globalAlpha,...args])},
    save(){commands.push(['save'])}, restore(){commands.push(['restore'])},
    translate(x,y){commands.push(['translate',x,y])}, rotate(a){commands.push(['rotate',a])},
    scale(x,y){commands.push(['scale',x,y])}};
  core.draw(ctx,layout,actors,3000,sprites);
  fs.writeFileSync(`/tmp/scene-${mode}.json`,JSON.stringify({width:layout.width,height:layout.height,commands}));
}
