import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(repoRoot, "package.json"));
const ts = require("typescript");

export function buildVisualHarness() {
  const coreDir = path.join(repoRoot, "client/scene/core");
  const names = fs
    .readdirSync(coreDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.replace(/\.ts$/, ""))
    .sort((a, b) => (a === "index" ? 1 : b === "index" ? -1 : a.localeCompare(b)));

  const modules = names
    .map((name) => {
      const source = fs.readFileSync(path.join(coreDir, `${name}.ts`), "utf8");
      const code = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText;
      return `${JSON.stringify("./" + name)}: function(exports, require) {\n${code}\n}`;
    })
    .join(",\n");

  const spriteDataSource = fs
    .readFileSync(path.join(repoRoot, "client/scene/generated/sprites.ts"), "utf8")
    .replace(/^.*export const spriteData = /s, "")
    .replace(/ as const;\s*$/, "");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deterministic Visual Test Harness</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #111a28;
      overflow: hidden;
    }
    canvas {
      display: block;
      image-rendering: pixelated;
    }
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
        if (!fn) {
          throw new Error('Harness module not found: ' + name);
        }
        const exports = {};
        cache[name] = exports;
        fn(exports, require);
      }
      return cache[name];
    }
    const core = require('./index');
    const data = ${spriteDataSource};
    const sprites = {};
    const loadPromises = Object.entries(data).map(([key, s]) => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          sprites[key] = { image, metadata: s.metadata };
          resolve();
        };
        image.onerror = reject;
        image.src = s.uri;
      });
    });

    const spritesReady = Promise.all(loadPromises);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const capturedBuffers = new Map();
    let nextBufferId = 1;

    window.__harness = {
      core,
      sprites,
      spritesReady,
      renderFrame({ snapshot, actors, timeMs, width = 800, scale = 2 }) {
        const layout = core.layoutOffices(snapshot, width);
        const w = layout.width * scale;
        const h = layout.height * scale;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          canvas.style.width = w + 'px';
          canvas.style.height = h + 'px';
        }
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        core.draw(ctx, layout, actors, timeMs, sprites);
        return { layout, width: w, height: h };
      },
      stepAndRender({ snapshot, steps, timeMs, width = 800, scale = 2, initialActors = {} }) {
        const layout = core.layoutOffices(snapshot, width);
        let actors = initialActors;
        for (const s of steps) {
          const snapForStep = s.snapshot || snapshot;
          const layoutForStep = s.snapshot ? core.layoutOffices(snapForStep, width) : layout;
          actors = core.step(actors, snapForStep, s.dtMs, layoutForStep);
        }
        const finalSnap = steps.length && steps[steps.length - 1].snapshot
          ? steps[steps.length - 1].snapshot
          : snapshot;
        const finalLayout = core.layoutOffices(finalSnap, width);
        const w = finalLayout.width * scale;
        const h = finalLayout.height * scale;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          canvas.style.width = w + 'px';
          canvas.style.height = h + 'px';
        }
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        core.draw(ctx, finalLayout, actors, timeMs, sprites);
        return { layout: finalLayout, actors, width: w, height: h };
      },
      saveBuffer() {
        const id = nextBufferId++;
        capturedBuffers.set(id, new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data));
        return id;
      },
      diffSavedBuffers(idA, idB) {
        const a = capturedBuffers.get(idA);
        const b = capturedBuffers.get(idB);
        if (!a || !b || a.length !== b.length) return -1;
        let diff = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (
            a[i] !== b[i] ||
            a[i + 1] !== b[i + 1] ||
            a[i + 2] !== b[i + 2] ||
            a[i + 3] !== b[i + 3]
          ) {
            diff++;
          }
        }
        return diff;
      }
    };
  </script>
</body>
</html>`;

  const outPath = path.join(__dirname, "index.html");
  fs.writeFileSync(outPath, html, "utf8");
  return outPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = buildVisualHarness();
  console.log(`Built visual harness at ${out}`);
}
