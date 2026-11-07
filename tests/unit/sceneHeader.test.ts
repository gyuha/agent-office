import test from 'node:test';
import assert from 'node:assert/strict';
import { group, providerColor, snap, snapAll, solo } from './helpers/scene.ts';

// DOM 없이 mountOfficeScene을 돌리기 위한 최소 가짜 DOM.
class El {
  children: any[] = []; style: Record<string, any> = {}; dataset: Record<string, string> = {}; attrs: Record<string, string> = {};
  className = ''; textContent = ''; title = ''; width = 0; height = 0; onclick: any = null;
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  append(...c: any[]) { this.children.push(...c); }
  replaceChildren(...c: any[]) { this.children = c; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  listeners: Record<string, (e: any) => void> = {};
  addEventListener(type: string, fn: (e: any) => void) { this.listeners[type] = fn; }
  removeEventListener() {} remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 700, height: 400 }; }
  getContext() { return new Proxy({}, { get: (t: any, k) => k in t ? t[k] : () => {}, set: (t: any, k, v) => { t[k] = v; return true; } }); }
}

async function mount(snapshot: any, clientWidth = 1200) {
  const g = globalThis as any;
  const saved = { document: g.document, window: g.window, Image: g.Image, raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame };
  g.document = { createElement: (tag: string) => new El(tag) };
  g.window = { devicePixelRatio: 1 };
  g.Image = class { onload: any; onerror: any; set src(_: string) { queueMicrotask(() => this.onload()); } };
  const frames: ((t: number) => void)[] = [];
  g.requestAnimationFrame = (cb: any) => frames.push(cb);
  g.cancelAnimationFrame = () => {};
  try {
    const { mountOfficeScene } = await import('../../client/scene/mount-scene.ts');
    const parent: any = new El('div'); parent.clientWidth = clientWidth;
    const clicks: string[] = [];
    const handle = mountOfficeScene(parent, () => snapshot, (id: string) => clicks.push(id));
    await new Promise(r => setTimeout(r, 0));
    frames.shift()!(0);
    const overlay = parent.children[0].children[2] as El;
    const headers = overlay.children.filter((c: El) => c.className.startsWith('office-context'));
    const plates = overlay.children.filter((c: El) => c.className === 'office-plate');
    const canvas = parent.children[0].children[1] as El;
    const layout = handle.inspect().layout;
    // 캔버스 위 장면 좌표 (x, y)를 클릭한다(가짜 bounds는 700x400).
    const clickScene = (x: number, y: number) => canvas.listeners.click({ clientX: x * 700 / layout.width, clientY: y * 400 / layout.height });
    handle.dispose();
    return { headers, plates, clicks, layout, clickScene, cells: (h: El) => h.children.map((c: El) => [c.children[0].textContent, c.children[1].textContent]) };
  } finally {
    Object.assign(g, { document: saved.document, window: saved.window, Image: saved.Image, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf });
  }
}

test('top bar of a group office: PROJECT / WORKSPACE / AGENT(manager name)', async () => {
  const m = await mount(snap([group(3)], { workspaceName: 'Fix the login bug' } as any));
  assert.equal(m.headers.length, 1);
  assert.deepEqual(m.cells(m.headers[0]), [['PROJECT', 'P'], ['WORKSPACE', 'Fix the login bug'], ['AGENT', 'Orchestrator']]);
  assert.ok(!m.headers[0].className.includes('no-workspace'));
});

test('top bar of a solo office shows the solo agent name', async () => {
  const m = await mount(snap([solo('s')], { workspaceName: 'ws' } as any));
  assert.deepEqual(m.cells(m.headers[0]).map(c => c[1]), ['P', 'ws', 'Solo Agent']);
});

test('workspaceName null, undefined or empty hides the WORKSPACE cell and switches to the two-column style', async () => {
  for (const workspaceName of [null, undefined, '']) {
    const m = await mount(snap([group(2)], { workspaceName } as any));
    assert.deepEqual(m.cells(m.headers[0]), [['PROJECT', 'P'], ['AGENT', 'Orchestrator']], String(workspaceName));
    assert.ok(m.headers[0].className.includes('no-workspace'));
  }
});

test('scope all: one top bar per office with its own project name; no workspace cell when the snapshot has none', async () => {
  const m = await mount(snapAll([{ name: 'alpha', offices: [group(2, 'a'), solo('as')] }, { name: 'beta', offices: [group(4, 'b')] }]));
  assert.deepEqual(m.headers.map(h => m.cells(h).map(c => c[1])), [['alpha', 'Orchestrator'], ['alpha', 'Solo Agent'], ['beta', 'Orchestrator']]);
});

test('nameplates are drawn on the canvas, not as DOM buttons; clicking a plate on the canvas selects its agent', async () => {
  const m = await mount(snap([group(3)]));
  assert.equal(m.plates.length, 0, 'no .office-plate DOM buttons');
  const stations = m.layout.rooms[0].stations;
  for (const st of stations) m.clickScene(st.plate.x, st.plate.y);
  assert.deepEqual(m.clicks, stations.map((st: any) => st.agent.id));
  m.clickScene(5, 5);
  assert.equal(m.clicks.length, stations.length, 'clicking empty space selects nothing');
});

test('providerColor: known providers have their own color, unknown providers fall back to one default', () => {
  const known = ['claude', 'codex', 'gemini', 'antigravity'].map(providerColor);
  assert.equal(new Set(known).size, 3, 'gemini and antigravity share a color');
  for (const odd of ['', 'pi', 'opencode']) assert.equal(providerColor(odd), providerColor('nope'), odd);
});

test('providerColor: prototype keys are not providers', () => {
  for (const odd of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(providerColor(odd), providerColor('nope'), odd);
});
