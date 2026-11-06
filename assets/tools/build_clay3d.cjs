// Build standalone SVG assets from the approved, self-contained clay illustration.
// Run: node assets/tools/build_clay3d.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const base = 'assets/sprites/clay3d';
const source = fs.readFileSync('assets/mockups/v6/02-clay3d/index.html', 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const defs = source.match(/<defs>([\s\S]*?)<\/defs>/)[1];
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].split('let a=room(world')[0];
const escape = v => String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
class Element {
  constructor(tag) { this.tag=tag; this.attrs={}; this.children=[]; this.textContent=''; }
  setAttribute(k,v) { this.attrs[k]=v; }
  appendChild(n) { this.children.push(n); }
  replaceChildren() { this.children=[]; }
  render() { const attrs=Object.entries(this.attrs).map(([k,v])=>` ${k}="${escape(v)}"`).join(''); return `<${this.tag}${attrs}>${escape(this.textContent)}${this.children.map(n=>n.render()).join('')}</${this.tag}>`; }
}
const ctx={document:{getElementById(){return new Element('g')},createElementNS(ns,t){return new Element(t)}},setInterval(){}};
vm.createContext(ctx);
vm.runInContext(script+'\nthis.api={rig,effects,desk,plant,pantry,props,cast,brand,add};',ctx);
const {rig,effects,desk,plant,pantry,props,cast,brand,add}=ctx.api;
const files=[];
function save(name,viewBox,contents,animated=false) {
  const dest=path.join(base,name); fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs>${defs}</defs>${animated?`<style>${css}</style>`:''}${contents}</svg>\n`); files.push(name);
}
const people=cast.map((p,i)=>({...p,id:`agent-${String(i+1).padStart(2,'0')}`}));
people.push({id:'manager-01',skin:'#d2a28a',hair:'#514647',shirt:'#92a5bd',style:0,provider:'claude'});
people.push({id:'manager-02',skin:'#eac1a7',hair:'#69524c',shirt:'#778cac',style:3,provider:'codex'});
for(const p of people) for(const state of ['working','away','phone','sleeping']) {
  let root=new Element('g');root.setAttribute('class',state);let fig=new Element('g');fig.setAttribute('class','figure');root.appendChild(fig);
  rig(fig,{...p,state});effects(fig,{...p,state});save(`characters/${p.id}/${state}.svg`,'-90 -115 180 205',root.render(),true);
}
for(const [name,fn,viewBox] of [
 ['desk',g=>desk(g,0,0,false),'-100 -35 200 125'],
 ['manager-desk',g=>desk(g,0,0,true),'-120 -35 240 125'],
 ['plant',g=>plant(g,0,0),'-8 -8 75 85'],
 ['pantry',g=>pantry(g,0,0),'-10 -10 175 110'],
 ['wall-props',g=>props(g,910,true),'-10 -10 940 145'],
 ['chair',g=>{add(g,'rect',{x:-38,y:3,width:76,height:63,rx:36,fill:'url(#lavender)',filter:'url(#smallshadow)'});add(g,'rect',{x:-42,y:46,width:84,height:19,rx:10,fill:'#958db4'});},'-55 -10 110 95'],
 ['sofa',g=>{add(g,'ellipse',{cx:0,cy:22,rx:117,ry:43,fill:'url(#lavender)',filter:'url(#shadow)'});add(g,'ellipse',{cx:0,cy:5,rx:103,ry:33,fill:'#ddd4ef',opacity:'.7'});},'-135 -45 270 125'],
 ['meeting-table',g=>add(g,'ellipse',{cx:0,cy:0,rx:112,ry:42,fill:'url(#wood)',filter:'url(#smallshadow)'}),'-125 -55 250 110'],
 ['glass-partition',g=>{add(g,'rect',{x:0,y:0,width:250,height:240,rx:24,fill:'url(#glass)',stroke:'#bbdce0','stroke-width':4,filter:'url(#smallshadow)'});add(g,'path',{d:'M83 5v230m84-230v230',stroke:'#d9f1ef','stroke-width':3});},'-12 -12 274 264']
]) {let g=new Element('g');fn(g);save(`furniture/${name}.svg`,viewBox,g.render());}
let attention=new Element('g');effects(attention,{state:'phone',attention:true});save('effects/attention.svg','-62 -98 44 44',attention.render(),true);
for(const provider of [...Object.keys(brand),'unknown']) {
  const icon=provider==='unknown'?'<text x="35" y="34" text-anchor="middle" font-family="sans-serif" font-size="23" fill="#fff">?</text>':`<svg x="19" y="10" width="32" height="27" viewBox="0 0 24 24" color="${brand[provider]}"><use href="#logo-${provider}" width="24" height="24"/></svg>`;
  save(`furniture/monitor-${provider}.svg`,'-8 -8 86 74',`<rect x="0" y="0" width="70" height="49" rx="22" fill="#697b83" filter="url(#smallshadow)"/><rect x="5" y="4" width="60" height="39" rx="18" fill="#87999c"/>${icon}<rect x="31" y="49" width="8" height="10" rx="3" fill="#68777d"/>`);
}
fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify({version:1,design:'v6/02-clay3d',characters:people.map(p=>p.id),states:['working','away','phone','sleeping'],coordinateSystem:{characterViewBox:[-90,-115,180,205],origin:'rig origin (0,0)',seated:true},files},null,2)+'\n');
console.log(`Built ${files.length} SVG assets`);
