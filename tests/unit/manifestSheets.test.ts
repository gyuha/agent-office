import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { actorImages, assetData, fakeSprites, group, layoutOffices, manifest, mixed, sheetFrame, snap, solo, step, trace, withState } from './helpers/scene.ts';

const sheets = manifest.sheets as Record<string, any>;
const diskManifest = JSON.parse(fs.readFileSync(new URL('../../assets/office/manifest.json', import.meta.url), 'utf8'));

// 생성기는 원본 manifest에서 assets/frames(제작용 메타)를 빼고 임베드한다. 나머지는 같아야 한다.
const EMBEDDED_OMITS = ['assets', 'frames'];
test('generated/office.ts embeds the current assets/office/manifest.json (run `npm run sprites` after art updates)', () => {
  const want = Object.fromEntries(Object.entries(diskManifest).filter(([k]) => !EMBEDDED_OMITS.includes(k)));
  assert.deepEqual(manifest, want);
  const missing = Object.keys(diskManifest.sheets).filter(key => !(key in assetData));
  assert.deepEqual(missing, [], 'sheets in the manifest but not embedded');
  for (const key of Object.keys(diskManifest.sheets)) assert.ok((assetData as any)[key].uri, `${key} has pixel data`);
});

test('every actor animation in the manifest resolves to a sheet with a positive frame count and fps', () => {
  for (const [name, entry] of Object.entries<any>(diskManifest.actors)) {
    for (const [anim, sheet] of Object.entries<string>(entry)) {
      const spec = diskManifest.sheets[sheet];
      assert.ok(spec, `${name}.${anim} -> ${sheet}`);
      assert.ok(spec.frames >= 1 && spec.fps > 0 && spec.frameW > 0 && spec.frameH > 0, sheet);
    }
  }
});

test('sheetFrame follows frames and fps for any frame count (looping)', () => {
  for (const frames of [1, 2, 3, 4, 7, 12, 30]) {
    for (const fps of [1, 1.5, 3, 8, 24]) {
      const spec = { frameW: 160, frameH: 216, frames, fps, loop: true };
      const image = { width: 160 * frames, height: 216 };
      for (const t of [0, 0.1, 0.5, 1, 2.37, 100]) {
        const f = sheetFrame(spec, image, t);
        assert.equal(f.x, (Math.floor(t * fps) % frames) * 160, `frames=${frames} fps=${fps} t=${t}`);
        assert.deepEqual([f.y, f.w, f.h], [0, 160, 216]);
      }
    }
  }
});

test('sheetFrame: non-looping sheets clamp on the last frame; sheets wrapped into several rows are addressed by columns', () => {
  const once = sheetFrame({ frameW: 10, frameH: 20, frames: 7, fps: 4, loop: false }, { width: 70, height: 20 }, 999);
  assert.equal(once.x, 60);
  assert.equal(sheetFrame({ frameW: 10, frameH: 20, frames: 7, fps: 4, loop: false }, { width: 70, height: 20 }, 0).x, 0);
  const wrapped = sheetFrame({ frameW: 10, frameH: 20, frames: 6, fps: 1, loop: true }, { width: 30, height: 40 }, 4);
  assert.deepEqual([wrapped.x, wrapped.y], [10, 20]);
});

test('sheetFrame accepts explicit frame rectangles', () => {
  const frames = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 7, w: 12, h: 9 }];
  assert.deepEqual(sheetFrame({ frames, fps: 1, frameW: 10, frameH: 10 }, { width: 100, height: 100 }, 1), { x: 40, y: 7, w: 12, h: 9 });
});

test('draw plays every state with any sheet length: the drawn source rect always stays inside the sheet', () => {
  const o = mixed(8);
  const s = snap([o, solo('s')]);
  for (const frames of [1, 2, 5, 9, 16]) {
    const overrides = Object.fromEntries(Object.entries(sheets).filter(([k]) => /^(actor-\d|orchestrator)-/.test(k))
      .map(([k, spec]) => [k, { ...assetData[k], ...spec, frames }]));
    const sprites = fakeSprites(overrides);
    for (const timeMs of [0, 130, 500, 1999]) {
      let actors: any = {};
      for (let i = 0; i < 25; i++) actors = step(actors, s, 100);
      const { images } = trace(s, { actors, sprites, timeMs });
      const drawn = actorImages(images);
      assert.ok(drawn.length > 0);
      for (const img of drawn) {
        const spec = sprites[img.key].spec;
        assert.ok(img.sx >= 0 && img.sx + img.sw <= spec.frameW * frames && img.sx % spec.frameW === 0, `${img.key} frames=${frames} sx=${img.sx}`);
        assert.equal(img.sw, spec.frameW);
      }
    }
  }
});

test('a longer sheet is actually played: with more frames, the frame index covers all of them over time', () => {
  const s = snap([solo('a', { state: 'working' })]);
  const frames = 9, spec = { ...assetData['actor-0-working'], frames };
  const sprites = fakeSprites({ 'actor-0-working': spec });
  const seen = new Set<number>();
  let actors: any = {};
  for (let i = 0; i < 20; i++) { actors = step(actors, s, 100); seen.add(trace(s, { actors, sprites }).images.find(x => x.key === 'actor-0-working')!.sx / spec.frameW); }
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: frames }, (_, i) => i));
});

test('flame and zzz effect sheets of any length also stay inside their sheet', () => {
  const sprites = fakeSprites({ flame_aura: { ...assetData.flame_aura, frameW: 50, frameH: 60, frames: 6, fps: 6, size: undefined }, zzz: { ...assetData.zzz, frameW: 40, frameH: 30, frames: 5, fps: 2, size: undefined } });
  const s = snap([group(2, 'g', { state: 'working', stateSince: 0 })]);
  const { images } = trace(s, { sprites, epoch: 1e6, timeMs: 0, actors: Object.fromEntries(layoutOffices(s).rooms[0].stations.map(st => [st.agent.id, { ...st.seat, moving: false, direction: 'right', phase: 3.3, state: 'working', changed: 0, elapsed: 100, route: [], destination: 'seat', home: st.seat }])) });
  const flames = images.filter(i => i.key === 'flame_aura');
  assert.ok(flames.length >= 3);
  for (const f of flames) assert.ok(f.sx % 50 === 0 && f.sx < 300);
});
