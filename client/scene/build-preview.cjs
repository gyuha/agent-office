// The standalone preview executes exactly the app's mountOfficeScene implementation.
const fs=require('fs'),ts=require('typescript');
const modules={};
for(const name of ['core/layout','core/actors','core/draw','core/office-assets','core/hitTest','core/nameplates','core/viewport','core/index','mount-scene','generated/office']){
  const source=fs.readFileSync(`client/scene/${name}.ts`,'utf8');
  modules[name]=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
}
const fixture=fs.readFileSync('client/scene/fixtures.cjs','utf8');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Office v10 runtime preview</title><style>body{margin:0;background:#f2e6d1}nav{padding:8px;font:14px monospace;background:#f2e6d1}#mount{max-width:1536px;margin:auto}select,button{font:inherit}#picked{margin-left:12px}</style><nav><label>Scenario <select id="scenario">${['3','4','6','10','16','solo','group-solos','all','empty'].map(n=>`<option>${n}</option>`).join('')}</select></label> <label>State <select id="state">${['mixed','working','away','phone','sleeping','attention'].map(n=>`<option>${n}</option>`).join('')}</select></label> <button id="poll">Poll identical snapshot</button><span id="picked"></span></nav><main id="mount"></main><script>
const source=${JSON.stringify(modules)},cache={};
function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const base=name.split('/').slice(0,-1);function require(p){const parts=[...base,...p.split('/')],out=[];for(const part of parts){if(part==='.'||part==='')continue;if(part==='..')out.pop();else out.push(part);}let key=out.join('/');if(!source[key])key+='/index';return load(key);}new Function('exports','require',source[name])(exports,require);return exports;}
const module={exports:{}};${fixture}
const fixtureFn=module.exports.fixture;
const scenario=document.querySelector('#scenario'),stateSelect=document.querySelector('#state');
scenario.value=location.hash.slice(1)||'6';
let snap=fixtureFn(scenario.value),selected=null;
const mounted=load('mount-scene').mountOfficeScene(document.querySelector('#mount'),()=>snap,id=>{selected=id;document.querySelector('#picked').textContent=id;});
window.preview={setTime:mounted.setTime,inspect:mounted.inspect,reset:mounted.reset,pause:mounted.pause,resume:mounted.resume,get selected(){return selected},snapshot:()=>snap,setSnapshot(value){snap=value},setState(state){snap=fixtureFn(scenario.value,state)},poll(){snap=JSON.parse(JSON.stringify(snap));}};
scenario.onchange=()=>{location.hash=scenario.value;snap=fixtureFn(scenario.value,stateSelect.value)};
stateSelect.onchange=()=>{snap=fixtureFn(scenario.value,stateSelect.value==='attention'?'working':stateSelect.value);if(stateSelect.value==='attention')for(const p of snap.projects)for(const o of p.offices)for(const a of [o.manager,...o.members].filter(Boolean))a.needsAttention=true;};
document.querySelector('#poll').onclick=()=>window.preview.poll();
</script></html>`;
fs.writeFileSync('client/scene/preview.html',html);
console.log(`preview.html: ${Buffer.byteLength(html)} bytes`);
