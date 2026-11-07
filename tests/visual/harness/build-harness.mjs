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
      spritesReady,
      /**
       * steps: [{ dtMs, snapshot? }]를 차례로 core.step에 먹인 뒤 그린다.
       * epoch는 flame(working 60초) 판정에 쓰는 "현재 시각(ms)"이다.
       */
      stepAndRender({ snapshot, steps = [], timeMs = 0, epoch = 0, scale = 1, initialActors = {} }) {
        let actors = initialActors;
        let current = snapshot;
        for (const s of steps) {
          current = s.snapshot || current;
          actors = core.step(actors, current, s.dtMs, core.layoutOffices(current));
        }
        const layout = core.layoutOffices(current);
        size(layout, scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        // time 인자는 sprite-sheet 프레임(액터는 a.phase 사용)과 효과 시계로 쓰인다.
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
    "mount-scene", "generated/office"];
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
window.mount = {
  open({ snapshot, width = 1200 }) {
    if (handle) handle.dispose();
    document.querySelector('#mount').style.width = width + 'px';
    snap = snapshot; selected = [];
    handle = load('mount-scene').mountOfficeScene(document.querySelector('#mount'), () => snap, (id) => selected.push(id));
    return handle.inspect().ready;
  },
  setTime: (ms, epoch) => handle.setTime(ms, epoch),
  selected: () => selected,
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
