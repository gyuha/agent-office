// Check the actual generated HTML script and its transition clock without a browser.
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('client/scene/preview.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Missing preview script');
new Function(script);
let now = 0, frame;
const status = { textContent: '' };
const select = { value: '', options: ['project','project-1','project-3','project-7',
  'project-15','project-5','all','transition','empty'].map(value => ({value})) };
const ctx = {setTransform(){},fillRect(){},strokeRect(){},fillText(){},drawImage(){},save(){},restore(){},translate(){},rotate(){},scale(){}};
const canvas = {width:0,height:0,style:{},getContext(){return ctx}};
const document = {querySelector(q) {return q === '#status' ? status : q === '#scenario' ? select : canvas}};
const sandbox = {document, location:{hash:'#transition'}, innerWidth:1600,
  performance:{now:()=>now}, window:{addEventListener(){}}, Image:class {},
  requestAnimationFrame(callback){frame=callback}, console};
vm.runInNewContext(script, sandbox);
for (const [time, expected] of [[0,'working'],[7500,'away'],[11000,'working']]) {
  now=time; frame(time);
  if (!status.textContent.includes(`: ${expected} `)) {
    throw new Error(`At ${time}ms expected ${expected}, got ${status.textContent}`);
  }
}
console.log('Preview syntax and transition at 0ms, 7500ms, 11000ms passed');
