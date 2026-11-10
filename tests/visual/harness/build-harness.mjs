import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(repoRoot, "package.json"));
const ts = require("typescript");

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

export function buildVisualHarness() {
  const coreDir = path.join(repoRoot, "client/scene/core");
  const names = fs
    .readdirSync(coreDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.replace(/\.ts$/, ""))
    .sort((a, b) => (a === "index" ? 1 : b === "index" ? -1 : a.localeCompare(b)));

  const entries = names.map((name) => [`./${name}`, transpile(path.join(coreDir, `${name}.ts`))]);
  // v10 매니페스트와 시트 data URI는 generated/office.ts에 있고, core는 '../generated/office'로 가져온다.
  entries.push(["../generated/office", transpile(path.join(repoRoot, "client/scene/generated/office.ts"))]);
  const modules = entries
    .map(([name, code]) => `${JSON.stringify(name)}: function(exports, require) {\n${code}\n}`)
    .join(",\n");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deterministic Visual Test Harness</title>
  <style>
    html, body { margin: 0; padding: 0; background: #f2e6d1; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const modules = { ${modules} };
    const cache = {};
    function require(name) {
      if (!cache[name]) {
        const fn = modules[name];
        if (!fn) throw new Error('Harness module not found: ' + name);
        const exports = {};
        cache[name] = exports;
        fn(exports, require);
      }
      return cache[name];
    }
    const core = require('./index');
    // 시간은 전부 주입한다: draw의 time(ms)/epoch는 인자로, 액터 시계는 step의 dt로 정한다.
    const { sprites, spritesReady } = core.loadOfficeAssets();
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const buffers = new Map();
    let nextBufferId = 1;

    function size(layout, scale) {
      const w = Math.round(layout.width * scale), h = Math.round(layout.height * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      }
    }

    window.__harness = {
      core,
      sprites,
      // 로드 완료(onload)와 디코드 완료는 다르다: 디코드 전에 처음 그리면 일부 이미지가 비어 보이므로 모두 디코드한 뒤 준비 완료로 본다.
      spritesReady: spritesReady.then(() => Promise.all(Object.values(sprites).map((s) => (s.image.decode ? s.image.decode().catch(() => {}) : null)))),
      /**
       * steps: [{ dtMs, snapshot? }]를 차례로 core.step에 먹인 뒤 그린다.
       * epoch는 flame(working 60초) 판정에 쓰는 "현재 시각(ms)"이다.
       */
      stepAndRender({ snapshot, steps = [], timeMs = 0, epoch = 0, scale = 0.5, initialActors = {} }) {
        let actors = initialActors;
        let current = snapshot;
        for (const s of steps) {
          current = s.snapshot || current;
          actors = core.step(actors, current, s.dtMs, core.layoutOffices(current));
        }
        const layout = core.layoutOffices(current);
        size(layout, scale);
        // 높이가 소수면 마지막 행은 draw가 덮지 못하므로 매번 지워 결정성을 보장한다.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        // time 인자는 sprite-sheet 프레임(액터는 a.phase 사용)과 효과 시계로 쓰인다.
        // Chrome은 큰 이미지를 처음 축소해 그릴 때 밉맵이 준비되기 전 저품질 경로를 쓰고(전체 화면 ±70 차이), 이후엔 고품질로 그린다.
        // 한 번 버려지는 워밍업 그리기로 이 첫 호출 차이를 없애 결정성을 보장한다.
        core.draw(ctx, layout, actors, timeMs, sprites, epoch);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        core.draw(ctx, layout, actors, timeMs, sprites, epoch);
        return { layout, actors, width: canvas.width, height: canvas.height };
      },
      saveBuffer() {
        const id = nextBufferId++;
        buffers.set(id, new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data));
        return id;
      },
      diffSavedBuffers(idA, idB) {
        const a = buffers.get(idA), b = buffers.get(idB);
        if (!a || !b || a.length !== b.length) return -1;
        let diff = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++;
        }
        return diff;
      },
    };
  </script>
</body>
</html>`;

  const outPath = path.join(__dirname, "index.html");
  fs.writeFileSync(outPath, html, "utf8");
  buildMountHarness();
  return outPath;
}

/**
 * 실제 마운트 경로 하네스: 앱이 쓰는 mountOfficeScene(canvas + DOM 상단바·명판)을 그대로 실행한다.
 * 시간은 mount.setTime(ms, epoch)로 고정한다(RAF/Date.now를 쓰지 않는다).
 */
export function buildMountHarness() {
  const sceneDir = path.join(repoRoot, "client/scene");
  const names = [...fs.readdirSync(path.join(sceneDir, "core")).filter((f) => f.endsWith(".ts")).map((f) => `core/${f.slice(0, -3)}`),
    "mount-scene", "mount-room", "scheduler", "generated/office"];
  const modules = Object.fromEntries(names.map((n) => [n, transpile(path.join(sceneDir, `${n}.ts`))]));
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Mounted scene harness</title>
<style>html,body{margin:0;background:#f2e6d1}#mount{width:1200px}</style></head>
<body><div id="mount"></div><script>
const source = ${JSON.stringify(modules)}, cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = {}; cache[name] = exports;
  const base = name.split('/').slice(0, -1);
  function require(p) {
    const out = [];
    for (const part of [...base, ...p.split('/')]) { if (part === '.' || part === '') continue; if (part === '..') out.pop(); else out.push(part); }
    let key = out.join('/'); if (!source[key]) key += '/index';
    return load(key);
  }
  new Function('exports', 'require', source[name])(exports, require);
  return exports;
}
let snap = null, selected = [], handle = null;
{
  const original = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    if (window.__rec && a.length === 8 && img && typeof img.src === 'string') window.__rec.push({ src: img.src, sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7] });
    return original.call(this, img, ...a);
  };
}
window.mount = {
  open({ snapshot, width = 1200, initialFilter }) {
    if (handle) handle.dispose();
    document.querySelector('#mount').style.width = width + 'px';
    snap = snapshot; selected = [];
    handle = load('mount-scene').mountOfficeScene(document.querySelector('#mount'), () => snap, (id) => selected.push(id), { initialFilter });
    return handle.inspect().ready;
  },
  setTime: (ms, epoch) => handle.setTime(ms, epoch),
  // from 스냅샷을 settleMs 동안 정착시킨 뒤 현재 스냅샷으로 전환해 ms 시점을 고정한다(프리뷰 전용 훅).
  setTransition: (from, ms, epoch, settleMs) => handle.setTransition(from, ms, epoch, settleMs),
  metrics: () => {
    const c = document.querySelector('canvas'), r = document.querySelector('.office-scene').getBoundingClientRect();
    return { backing: [c.width, c.height], cssWidth: c.getBoundingClientRect().width, rootLeft: r.left, rootWidth: r.width, dpr: window.devicePixelRatio };
  },
  selected: () => selected,
  // 시트 첫 프레임의 머리 꼭대기·어깨선·몸통선(논리 160x216 프레임 px). art의 pack_awaiting.py와 같은 정의:
  // 머리 꼭대기 = 불투명(alpha>32) 픽셀이 18개 이상인 첫 행, 머리 열 = 그 뒤 8행의 평균 x,
  // 어깨 = 머리 열 ±50px, y<125 영역 질량의 25%에 처음 도달하는 행, 몸통 = 50% 행.
  /** 책상 뒤 이미지에서 열 구간 [cx-half, cx+half](논리 책상 px)의 가장 위 불투명 행 = 의자 등받이 꼭대기. */
  async columnTop(name, cx, half) {
    const { assetData } = load('core/office-assets');
    const spec = assetData[name], img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = spec.uri; });
    const [W, H] = spec.size, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(W, Math.round(cx + half)); x++) if (d[(y * W + x) * 4 + 3] > 32) return y;
    return null;
  },
  async sheetMetrics(names) {
    const { assetData } = load('core/office-assets');
    const out = {};
    for (const name of names) {
      const spec = assetData[name];
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = spec.uri; });
      const rs = spec.runtimeScale ?? (load('core/office-assets').manifest.runtimeScale ?? 1);
      const FW = spec.frameW, FH = spec.frameH, c = document.createElement('canvas');
      c.width = FW; c.height = FH;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, FW * rs, FH * rs, 0, 0, FW, FH); // 프레임 0을 논리 크기로
      const d = ctx.getImageData(0, 0, FW, FH).data;
      const op = (x, y) => d[(y * FW + x) * 4 + 3] > 32;
      const rowSum = (y) => { let n = 0; for (let x = 0; x < FW; x++) if (op(x, y)) n++; return n; };
      let ht = 0; while (ht < FH && rowSum(ht) < 18) ht++;
      let sx = 0, sn = 0; for (let y = ht; y < ht + 8; y++) for (let x = 0; x < FW; x++) if (op(x, y)) { sx += x; sn++; }
      const hx = Math.trunc(sx / sn), x0 = Math.max(0, hx - 50), x1 = Math.min(FW, hx + 50);
      const cum = []; let acc = 0;
      for (let y = 0; y < 125; y++) { for (let x = x0; x < x1; x++) if (op(x, y)) acc++; cum.push(acc); }
      const base = ht ? cum[ht - 1] : 0, tot = cum[cum.length - 1] - base;
      const q = (f) => { const t = f * tot; let i = 0; while (i < cum.length && cum[i] - base < t) i++; return i; };
      let hw = 0; { const y = ht + 20; let a = -1, b = -1; for (let x = 0; x < FW; x++) if (op(x, y)) { if (a < 0) a = x; b = x; } hw = a < 0 ? 0 : b - a; }
      out[name] = { headTop: ht, shoulder: q(0.25), torso: q(0.5), headWidth: hw };
    }
    return out;
  },
  // 라이브 갱신 재현: 다음 스냅샷으로 바꾼다(마운트는 getSnapshot으로 매 프레임 읽는다).
  setSnapshot(next) { snap = next; },
  // 현재 레이아웃의 자리(station) 정보: 오프셋·배율 계산용.
  stations() { return handle.inspect().layout.rooms.flatMap((r) => r.stations.map((s) => ({ agentId: s.agent.id, manager: s.manager, variant: s.variant, actorHeight: s.actorHeight, moduleScale: s.moduleScale, x: s.x, y: s.y, width: s.width, height: s.height, seat: s.seat, bodySeat: s.bodySeat, desk: { back: s.desk.back, seat: s.desk.seat, tableRearY: s.desk.tableRearY, actorStateYOffset: s.desk.actorStateYOffset, actorOffsets: s.desk.actorOffsets, actorAnchor: s.desk.actorAnchor } }))); },
  // 그리기 기록: drawImage(이미지, sx,sy,sw,sh, dx,dy,dw,dh) 호출을 장면 좌표(변환 전)로 기록한다. 이미지는 src(data URI)로 시트를 알아본다.
  record(on) { window.__rec = on ? [] : null; },
  recorded() { return window.__rec || []; },
  /** data URI로 시트 이름을 찾는다. */
  sheetUris(names) { const { assetData } = load('core/office-assets'); return Object.fromEntries(names.map((n) => [n, assetData[n].uri])); },
  // 필터 바 상태(DOM): 버튼 문구·눌림, 잘림 여부, '맞는 오피스 없음' 안내.
  filterBar() {
    const bar = document.querySelector('.office-filter-bar');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const empty = document.querySelector('.office-filter-empty');
    return {
      position: getComputedStyle(bar).position, left: r.left, right: r.right, width: r.width, scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth,
      buttons: [...bar.querySelectorAll('button')].map((b) => { const br = b.getBoundingClientRect(); return { filter: b.dataset.filter, text: b.textContent, pressed: b.getAttribute('aria-pressed') === 'true', left: br.left, right: br.right, top: br.top, bottom: br.bottom, scrollWidth: b.scrollWidth, clientWidth: b.clientWidth }; }),
      emptyVisible: !!empty && getComputedStyle(empty).display !== 'none' && empty.getBoundingClientRect().height > 0,
      emptyText: empty ? empty.textContent : null,
      cards: document.querySelectorAll('.office-collection > div').length,
      canvases: document.querySelectorAll('.office-collection canvas').length,
    };
  },
  headers: () => [...document.querySelectorAll('.office-context')].map((h) => ({
    noWorkspace: h.classList.contains('no-workspace'),
    cells: [...h.querySelectorAll('.office-context-cell')].map((c) => [c.querySelector('small').textContent, c.querySelector('strong').textContent]) })),
  // 명판은 canvas에 그려진다. DOM 버튼이 없음을 확인하고, 명판 중심의 페이지 좌표를 돌려준다.
  domPlates: () => document.querySelectorAll('.office-plate').length,
  plateCenter(id) {
    const { layout } = handle.inspect();
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    for (const room of layout.rooms) for (const s of room.stations) {
      if (s.agent.id === id) return { x: canvas.left + s.plate.x * canvas.width / layout.width, y: canvas.top + s.plate.y * canvas.height / layout.height };
    }
    return null;
  },
  // WORKSPACE 값이 몇 줄로 나오는지(줄 높이 대비 높이).
  workspaceLines() {
    const el = document.querySelector('.office-context-cell.workspace strong');
    if (!el) return 0;
    return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  },
};
</script></body></html>`;
  const out = path.join(__dirname, "mount.html");
  fs.writeFileSync(out, html, "utf8");
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Built visual harness at ${buildVisualHarness()}`);
}
