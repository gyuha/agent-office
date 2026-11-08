import './scene.ts'; // resolve 훅 등록

/** DOM 없이 mountOfficeScene을 돌리기 위한 최소 가짜 DOM과 가짜 시계. */
export class El {
  children: any[] = []; style: Record<string, any> = {}; dataset: Record<string, string> = {}; attrs: Record<string, string> = {};
  className = ''; textContent = ''; title = ''; width = 0; height = 0; onclick: any = null; tag: string; removed = false; parentEl: El | null = null;
  explicitWidth: number | undefined;
  listeners: Record<string, (e: any) => void> = {};
  constructor(tag: string) { this.tag = tag; }
  /** 레이아웃 근사: 명시한 값, 아니면 style.cssText의 width/max-width(px, %)를 부모 폭에 적용한다. */
  get clientWidth(): number {
    if (this.explicitWidth !== undefined) return this.explicitWidth;
    const base = this.parentEl ? this.parentEl.clientWidth : 0;
    const css = String(this.style.cssText ?? '') + ';' + (this.style.width ? `width:${this.style.width}` : '');
    const px = /(?:^|;)\s*width:\s*([\d.]+)px/.exec(css), max = /max-width:\s*([\d.]+)px/.exec(css);
    let w = px ? Number(px[1]) : base;
    if (max) w = Math.min(w, Number(max[1]));
    return w;
  }
  set clientWidth(v: number) { this.explicitWidth = v; }
  append(...c: any[]) { for (const x of c) { x.parentEl = this; this.children.push(x); } }
  insertBefore(node: any, ref: any) { const i = this.children.indexOf(node); if (i >= 0) this.children.splice(i, 1); const at = ref ? this.children.indexOf(ref) : -1; node.parentEl = this; if (at < 0) this.children.push(node); else this.children.splice(at, 0, node); }
  replaceChildren(...c: any[]) { this.children = c; for (const x of c) x.parentEl = this; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(type: string, fn: (e: any) => void) { this.listeners[type] = fn; }
  removeEventListener(type: string) { delete this.listeners[type]; }
  remove() { this.removed = true; if (this.parentEl) { const i = this.parentEl.children.indexOf(this); if (i >= 0) this.parentEl.children.splice(i, 1); this.parentEl = null; } }
  getBoundingClientRect() { return { left: 0, top: 0, width: parseFloat(this.style.width) || 700, height: parseFloat(this.style.height) || 400 }; }
  getContext() { return new Proxy({}, { get: (t: any, k) => k in t ? t[k] : () => {}, set: (t: any, k, v) => { t[k] = v; return true; } }); }
}

export interface MountOptions { clientWidth?: number; devicePixelRatio?: number; hidden?: boolean; intersectionObserver?: boolean }

export async function mountFake(snapshotOrGetter: any, opts: MountOptions = {}) {
  const getSnapshot = typeof snapshotOrGetter === 'function' ? snapshotOrGetter : () => snapshotOrGetter;
  const g = globalThis as any;
  const saved = Object.fromEntries(['document', 'window', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance'].map(k => [k, g[k]]));
  // 가짜 시계: setTimeout/rAF/performance.now를 직접 구동한다.
  let now = 0, nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const rafs = new Map<number, (t: number) => void>();
  const docListeners = new Map<string, Set<() => void>>();
  const doc: any = { hidden: !!opts.hidden, createElement: (tag: string) => new El(tag),
    addEventListener: (t: string, fn: () => void) => { (docListeners.get(t) ?? docListeners.set(t, new Set()).get(t)!).add(fn); },
    removeEventListener: (t: string, fn: () => void) => { docListeners.get(t)?.delete(fn); } };
  const win: any = { devicePixelRatio: opts.devicePixelRatio ?? 1, innerHeight: 800 };
  const io = { callback: null as null | ((entries: any[]) => void), callbacks: [] as ((entries: any[]) => void)[], options: [] as any[], observed: [] as any[], disconnected: false, disconnects: 0 };
  if (opts.intersectionObserver !== false) {
    win.IntersectionObserver = class { constructor(cb: any, options?: any) { io.callback = cb; io.callbacks.push(cb); io.options.push(options ?? {}); } observe(el: any) { io.observed.push(el); } disconnect() { io.disconnected = true; io.disconnects++; } };
  }
  g.document = doc; g.window = win;
  g.Image = class { onload: any; onerror: any; set src(_: string) { queueMicrotask(() => this.onload()); } };
  g.performance = { now: () => now };
  g.setTimeout = (fn: () => void, ms = 0) => { const id = nextId++; timers.set(id, { at: now + Math.max(0, ms), fn }); return id; };
  g.clearTimeout = (id: number) => { timers.delete(id); };
  g.requestAnimationFrame = (cb: (t: number) => void) => { const id = nextId++; rafs.set(id, cb); return id; };
  g.cancelAnimationFrame = (id: number) => { rafs.delete(id); };
  let paintHook: null | (() => void) = null;
  // rAF 콜백이 모두 끝난 직후가 브라우저가 화면을 칠하는 시점이다("한 프레임"의 경계).
  const flushRafs = (hook = true) => { let any = false; for (const [id, cb] of [...rafs]) { rafs.delete(id); cb(now); any = true; } if (any && hook) paintHook?.(); };
  /** 마이크로태스크를 모두 비운다: 브라우저는 이벤트 핸들러·rAF 콜백이 끝난 뒤 마이크로태스크를 처리하고 나서야 화면을 칠한다. */
  const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => queueMicrotask(() => r(undefined))); };
  /** `ms`만큼 가짜 시간을 진행하며 예약된 타이머와 rAF를 실행한다. */
  const run = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = Math.max(now, due[1].at); due[1].fn(); flushRafs();
    }
    now = end;
  };
  /** run과 같지만 rAF마다 마이크로태스크를 비운 뒤 "화면 칠하기" 훅을 부른다(실제 브라우저의 프레임 경계). */
  const runPaint = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = Math.max(now, due[1].at); due[1].fn();
      const had = rafs.size > 0; flushRafs(false); await flush(); if (had) paintHook?.();
    }
    now = end;
  };
  const restore = () => Object.assign(g, saved);
  try {
    const { mountOfficeScene } = await import('../../../client/scene/mount-scene.ts');
    const parent: any = new El('div'); parent.clientWidth = opts.clientWidth ?? 1200;
    const clicks: string[] = [];
    const handle = mountOfficeScene(parent, getSnapshot, (id: string) => clicks.push(id));
    await new Promise(r => queueMicrotask(() => r(undefined)));
    await new Promise(r => queueMicrotask(() => r(undefined)));
    run(0);
    // 구조: parent > .office-collection > (카드 holder > .office-scene[style, canvas, overlay])...
    const collection = parent.children[0] as El;
    const sceneRoots = () => collection.children.map((holder: El) => holder.children[0] as El);
    const root = sceneRoots()[0];
    const canvas = root.children[1] as El;
    const overlay = root.children[2] as El;
    const cardParts = (sceneRoot: El) => ({ root: sceneRoot, canvas: sceneRoot.children[1] as El, overlay: sceneRoot.children[2] as El });
    const headers = () => sceneRoots().flatMap((r: El) => (r.children[2] as El).children.filter((c: El) => c.className.startsWith('office-context')));
    const plates = () => sceneRoots().flatMap((r: El) => (r.children[2] as El).children.filter((c: El) => c.className === 'office-plate'));
    const clickScene = (x: number, y: number) => { const layout = handle.inspect().layout; canvas.listeners.click({ clientX: x * canvas.getBoundingClientRect().width / layout.width, clientY: y * canvas.getBoundingClientRect().height / layout.height }); };
    return { flush, runPaint, onPaint: (fn: (() => void) | null) => { paintHook = fn; }, parent, collection, root, canvas, handle, sceneRoots, cardParts, holders: () => collection.children as El[], clicks, headers, plates, clickScene, run, restore, io, doc, win,
      cells: (h: El) => h.children.map((c: El) => [c.children[0].textContent, c.children[1].textContent]),
      pendingTimers: () => timers.size + rafs.size,
      fire: (type: string) => docListeners.get(type)?.forEach(fn => fn()),
      drawCount: () => handle.inspect().metrics.drawCount as number,
      metrics: () => handle.inspect().metrics,
      listenerCount: (type: string) => docListeners.get(type)?.size ?? 0,
      now: () => now };
  } catch (error) { restore(); throw error; }
}
