import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, draw, fakeSprites, group, layoutOffices, manifest, runtimeScaleOf, sheetFrame, snap, solo, trace, withState } from './helpers/scene.ts';
import { mountFake } from './helpers/dom.ts';

const RS: number = (manifest as any).runtimeScale;
const MAX = 480; // scene 최대 폭(CSS px)
async function withMount<T>(snapshot: any, opts: Parameters<typeof mountFake>[1], fn: (m: Awaited<ReturnType<typeof mountFake>>) => T | Promise<T>) {
  const m = await mountFake(snapshot, opts);
  try { return await fn(m); } finally { m.handle.dispose(); m.restore(); }
}

// ───────── 최대 폭 480px, 중앙 정렬, backing store 상한 ─────────
test('the scene wrapper is centered and capped at 480px; the canvas never exceeds 480 CSS px', async () => {
  await withMount(snap([group(3)]), { clientWidth: 1536 }, m => {
    assert.match(m.root.style.cssText, /max-width:480px/);
    assert.match(m.root.style.cssText, /margin:0 auto/);
    assert.equal(m.canvas.style.width, `${MAX}px`);
    assert.equal(m.metrics().backing[0], MAX);
  });
  for (const clientWidth of [3000, 1200, 640, 481]) await withMount(snap([solo()]), { clientWidth }, m => assert.equal(m.canvas.style.width, `${MAX}px`, String(clientWidth)));
});

test('narrower panels are not enlarged: the canvas follows the panel width below 480px', async () => {
  for (const clientWidth of [480, 410, 300]) await withMount(snap([group(3)]), { clientWidth }, m => {
    assert.equal(m.canvas.style.width, `${clientWidth}px`);
    assert.equal(m.metrics().backing[0], clientWidth);
  });
});

test('backing store = display size × min(DPR, 2), floored; invalid DPR counts as 1', async () => {
  const cases: [number, number][] = [[1, 1], [1.5, 1.5], [2, 2], [3, 2], [4.5, 2], [0, 1], [-2, 1], [NaN, 1]];
  for (const [dpr, ratio] of cases) await withMount(snap([group(3)]), { clientWidth: 1200, devicePixelRatio: dpr }, m => {
    const layout = m.handle.inspect().layout;
    const cssW = MAX, cssH = MAX * layout.height / layout.width;
    assert.deepEqual(m.metrics().backing, [Math.floor(cssW * ratio), Math.floor(cssH * ratio)], `dpr ${dpr}`);
    assert.ok(m.metrics().backing[0] <= 2 * MAX, 'never above 2x of the max width');
  });
});

test('scope all: every card (one canvas per room) keeps its own backing store within the 2x rule and the 480px card cap, even at DPR 3', async () => {
  const all = { scope: 'all', generatedAt: 0, projects: [0, 1, 2].map(i => ({ projectId: `p${i}`, projectName: `P${i}`, offices: [group(12, `g${i}`)] })) };
  await withMount(all, { clientWidth: 1536, devicePixelRatio: 3 }, m => {
    const cards = m.handle.inspect().cards as any[];
    assert.equal(cards.length, 3);
    for (const c of cards) assert.ok(c.metrics.backing[0] <= 2 * MAX, `card backing ${c.metrics.backing}`);
  });
});


test('the static background cache has exactly the backing-store size (no CSS-resolution resample), for every DPR', async () => {
  for (const dpr of [1, 1.5, 2, 3]) await withMount(snap([group(3, 'g', { state: 'working' })]), { clientWidth: 1200, devicePixelRatio: dpr }, m => {
    m.run(1000);
    const x = m.metrics();
    assert.deepEqual(x.backgroundBacking, x.backing, `dpr ${dpr}: cache must equal the canvas backing store`);
    assert.ok(x.drawCount >= 5);
    assert.equal(x.cacheBuilds, 1, 'one build for many frames');
  });
});

test('the background cache is rebuilt when the backing size changes, not on every frame', async () => {
  const s = snap([group(3, 'g', { state: 'working' })]);
  await withMount(s, { clientWidth: 480 }, m => {
    m.run(500);
    assert.equal(m.metrics().cacheBuilds, 1);
    m.parent.clientWidth = 300; m.run(300);
    const x = m.metrics();
    assert.equal(x.cacheBuilds, 2, 'resize rebuilds once');
    assert.deepEqual(x.backgroundBacking, x.backing);
    assert.equal(x.backing[0], 300);
    m.run(1000);
    assert.equal(m.metrics().cacheBuilds, 2);
  });
});

test('draw blits the background cache 1:1 (identity transform, no scaling) once, and without a cache paints the background as wall / stretched floor / trim slices', () => {
  const s = snap([group(3)]);
  const cache = { width: 960, height: 777, key: 'cache' };
  const withCache = trace(s, { background: cache });
  const blits = withCache.images.filter(i => i.key === 'cache');
  assert.equal(blits.length, 1);
  assert.deepEqual([blits[0].dx, blits[0].dy, blits[0].dw, blits[0].dh], [0, 0, 960, 777], 'pixel-for-pixel at the origin');
  assert.deepEqual([blits[0].sx, blits[0].sy, blits[0].sw, blits[0].sh], [0, 0, 960, 777]);
  assert.deepEqual(blits[0].transform, [1, 0, 0, 1, 0, 0], 'drawn with an identity transform');
  assert.equal(withCache.images.filter(i => i.key.startsWith('background-')).length, 0);
  assert.ok(withCache.images.findIndex(i => i.key === 'cache') < withCache.images.findIndex(i => i.key.startsWith('pod-')), 'cache goes under the furniture');
  const slices = trace(s).images.filter(i => i.key.startsWith('background-'));
  const room = layoutOffices(s).rooms[0];
  assert.equal(slices.length, 3);
  // 벽(400)과 아래 장식(24)은 비율을 지키고, 늘어나는 것은 맨바닥 가운데 조각뿐이다.
  assert.deepEqual(slices.map(i => [i.dy - room.sceneY, i.dh]).map(([y, h]) => [Math.round(y * 100) / 100, Math.round(h * 100) / 100]),
    [[0, 400], [400, Math.round((room.sceneHeight - 424) * 100) / 100], [Math.round((room.sceneHeight - 24) * 100) / 100, 24]]);
  const rs = slices[0].sh / 400;
  assert.ok(Math.abs(slices[2].sh / 24 - rs) < 1e-9, 'wall and trim share the source scale');
  assert.ok(slices.every(i => i.dw === 1536 && i.dx === 0));
});

// ───────── 렌더 루프: ~12fps, 숨김/화면 밖 정지와 복귀, 언마운트 ─────────
test('the live loop is limited to about 12 fps regardless of how often it is woken', async () => {
  await withMount(snap([group(3)]), { clientWidth: 800 }, m => {
    const before = m.drawCount();
    m.run(1000);
    const frames = m.drawCount() - before;
    assert.ok(frames >= 11 && frames <= 13, `drew ${frames} frames in 1s`);
    m.run(9000);
    const perSecond = (m.drawCount() - before) / 10;
    assert.ok(perSecond > 11 && perSecond < 13.5, `${perSecond}/s`);
  });
});

test('frame spacing is at least ~83ms: no two draws closer than one frame interval', async () => {
  await withMount(snap([solo()]), { clientWidth: 800 }, m => {
    const times: number[] = [];
    let last = m.drawCount();
    for (let t = 0; t < 1500; t += 5) { m.run(5); if (m.drawCount() !== last) { times.push(m.now()); last = m.drawCount(); } }
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 1000 / 12 - 5.01, `${times[i] - times[i - 1]}ms`);
  });
});

test('document.hidden stops the loop (no timers pending); becoming visible resumes it', async () => {
  await withMount(snap([group(3)]), { clientWidth: 800 }, m => {
    m.run(500);
    const drawn = m.drawCount();
    assert.ok(drawn > 0);
    m.doc.hidden = true; m.fire('visibilitychange');
    assert.equal(m.pendingTimers(), 0, 'nothing scheduled while hidden');
    m.run(5000);
    assert.equal(m.drawCount(), drawn, 'no draws while hidden');
    m.doc.hidden = false; m.fire('visibilitychange');
    m.run(1000);
    assert.ok(m.drawCount() - drawn >= 10, 'resumed at ~12fps');
  });
});

test('starting hidden draws nothing until the page becomes visible', async () => {
  await withMount(snap([group(3)]), { clientWidth: 800, hidden: true }, m => {
    m.run(3000);
    assert.equal(m.drawCount(), 0);
    m.doc.hidden = false; m.fire('visibilitychange');
    m.run(500);
    assert.ok(m.drawCount() > 0);
  });
});

// 카드마다 관찰자가 둘이다: 미리 그리기(rootMargin 1200px)와 메모리 유지(rootMargin 2400px). [prepaint, retention] 순서로 만들어진다.
const PREPAINT = 0, RETENTION = 1;
const margin = (o: any) => Number(/(\d+)px/.exec(o.rootMargin ?? '0px')![1]);

test('IntersectionObserver: each card has a prepaint observer (1200px) and a farther retention observer (2400px) — hysteresis so the cache does not thrash', async () => {
  await withMount(snap([group(3)]), { clientWidth: 800 }, m => {
    assert.equal(m.io.observed.length, 2, 'prepaint + retention observe the card root');
    assert.ok(m.io.observed.every((el: any) => el === m.root));
    const [prepaint, retention] = [margin(m.io.options[PREPAINT]), margin(m.io.options[RETENTION])];
    assert.equal(prepaint, 1200);
    assert.equal(retention, 2400);
    assert.ok(retention > prepaint, 'release distance is larger than the prepaint distance');
    assert.ok(retention >= 2 * prepaint, 'a whole prepaint band separates "start drawing" from "release memory"');
  });
});

test('hysteresis: beyond 1200px a card stops drawing but keeps its canvas; beyond 2400px the memory is released; coming back inside 1200px resumes drawing and rebuilds the canvas', async () => {
  await withMount(snap([group(3)]), { clientWidth: 800 }, m => {
    m.run(300);
    assert.ok(m.canvas.width > 0);
    const widthBefore = m.canvas.width;
    // 1) 1200px 밖(2400px 안): 그리기만 멈추고 캔버스는 유지한다.
    m.io.callbacks[PREPAINT]([{ isIntersecting: false }]);
    const drawn = m.drawCount();
    m.run(3000);
    assert.equal(m.drawCount(), drawn, 'no draw calls beyond the prepaint band');
    assert.equal(m.canvas.width, widthBefore, 'canvas kept: scrolling back soon costs nothing');
    assert.equal(m.handle.inspect().scheduler.subscribers, 1, 'only the collection layout task stays subscribed');
    // 2) 2400px 밖: 메모리 해제.
    m.io.callbacks[RETENTION]([{ isIntersecting: false }]);
    assert.deepEqual([m.canvas.width, m.canvas.height], [0, 0], 'backing store released beyond the retention band');
    m.run(3000);
    assert.equal(m.drawCount(), drawn);
    // 3) 2400px 안으로 돌아와도(아직 1200px 밖) 그리지 않는다. 메모리는 필요할 때만 다시 만든다.
    m.io.callbacks[RETENTION]([{ isIntersecting: true }]);
    m.run(1000);
    assert.equal(m.drawCount(), drawn, 'inside 2400px but outside 1200px: still not drawing');
    // 4) 1200px 안으로 들어오면 다시 그리고 캔버스를 다시 만든다.
    m.io.callbacks[PREPAINT]([{ isIntersecting: true }]);
    m.run(1000);
    assert.ok(m.drawCount() - drawn >= 10, 'drawing resumes');
    assert.ok(m.canvas.width > 0, 'canvas rebuilt');
  });
});

test('hysteresis: a card that only left the prepaint band is not rebuilt when it returns (cache survives a short scroll)', async () => {
  await withMount(snap([group(6)]), { clientWidth: 800 }, m => {
    m.run(300);
    const builds = m.metrics().cacheBuilds;
    for (let i = 0; i < 5; i++) { m.io.callbacks[PREPAINT]([{ isIntersecting: false }]); m.run(500); m.io.callbacks[PREPAINT]([{ isIntersecting: true }]); m.run(500); }
    assert.equal(m.metrics().cacheBuilds, builds, 'no background cache rebuild while the card stays inside the retention band');
  });
});



test('both hidden and off-screen must clear before the loop resumes', async () => {
  await withMount(snap([solo()]), { clientWidth: 800 }, m => {
    m.doc.hidden = true; m.fire('visibilitychange');
    m.io.callbacks[PREPAINT]([{ isIntersecting: false }]);
    const drawn = m.drawCount();
    m.doc.hidden = false; m.fire('visibilitychange');
    m.run(1000);
    assert.equal(m.drawCount(), drawn, 'still off-screen');
    m.io.callbacks[PREPAINT]([{ isIntersecting: true }]);
    m.run(500);
    assert.ok(m.drawCount() > drawn);
  });
});

test('without IntersectionObserver support the loop still runs (treated as visible)', async () => {
  await withMount(snap([solo()]), { clientWidth: 800, intersectionObserver: false }, m => { m.run(500); assert.ok(m.drawCount() >= 5); });
});

test('a stopped loop does not accumulate a backlog: resuming after a long pause draws a normal cadence, and animation time advances by at most one step', async () => {
  await withMount(snap([group(3, 'g', { state: 'working' })]), { clientWidth: 800 }, m => {
    m.run(500);
    const phase = () => Object.values<any>(m.handle.inspect().actors)[0].phase;
    const before = phase();
    m.doc.hidden = true; m.fire('visibilitychange');
    m.run(60_000);
    m.doc.hidden = false; m.fire('visibilitychange');
    m.run(200);
    assert.ok(phase() - before < 1, `phase jumped by ${phase() - before}s after a 60s pause`);
  });
});

test('dispose stops everything: timers, observer, visibility listener, canvas memory, DOM', async () => {
  const m = await mountFake(snap([group(3)]), { clientWidth: 800 });
  try {
    m.run(300);
    assert.ok(m.listenerCount('visibilitychange') >= 1, 'room and shared scheduler listen to visibility');
    m.handle.dispose();
    assert.equal(m.pendingTimers(), 0);
    assert.equal(m.listenerCount('visibilitychange'), 0);
    assert.equal(m.io.disconnected, true);
    assert.equal(m.root.removed, true);
    assert.deepEqual([m.canvas.width, m.canvas.height], [0, 0]);
    // 언마운트 뒤에는 어떤 이벤트에도 다시 예약되지 않는다(예약이 없으면 draw도 없다).
    m.run(5000);
    m.fire('visibilitychange');
    for (const cb of m.io.callbacks) cb([{ isIntersecting: true }]);
    m.run(1000);
    assert.equal(m.pendingTimers(), 0, 'nothing is scheduled after unmount');
  } finally { m.restore(); }
});

test('pause()/resume() controls (used by the preview) also stop and restart the loop', async () => {
  await withMount(snap([solo()]), { clientWidth: 800 }, m => {
    m.run(300);
    m.handle.pause();
    const drawn = m.drawCount();
    m.run(2000);
    assert.equal(m.drawCount(), drawn);
    m.handle.resume();
    m.run(500);
    assert.ok(m.drawCount() > drawn);
  });
});

test('setTime renders one fixed frame and leaves the live loop stopped; same time gives the same actors', async () => {
  await withMount(snap([group(3, 'g', { state: 'working' })]), { clientWidth: 800 }, async m => {
    await m.handle.setTime(3000, 1000);
    const a = JSON.stringify(m.handle.inspect().actors);
    const drawn = m.drawCount();
    m.run(5000);
    assert.equal(m.drawCount(), drawn, 'live loop stays paused after setTime');
    await m.handle.setTime(500, 1000);
    await m.handle.setTime(3000, 1000);
    assert.equal(JSON.stringify(m.handle.inspect().actors), a);
  });
});

// ───────── runtimeScale: 원본 사각형 계산 ─────────
test('the manifest declares a runtimeScale in (0, 1] and the loader applies it to everything except provider icons', () => {
  assert.ok(RS > 0 && RS <= 1, `runtimeScale ${RS}`);
  assert.equal(runtimeScaleOf('actor-0-working', assetData['actor-0-working']), RS);
  assert.equal(runtimeScaleOf('provider-icon-claude', assetData['provider-icon-claude']), 1);
  assert.equal(runtimeScaleOf('x', { runtimeScale: 0.25 }), 0.25, 'a per-sheet value wins');
});

test('the embedded sprite sheets really are scaled: pixel size of each frame = logical size × manifest runtimeScale', async () => {
  // data URI의 WebP/PNG 헤더에서 실제 픽셀 크기를 읽는다.
  const size = (uri: string) => {
    const buf = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
    if (buf.toString('ascii', 0, 4) === 'RIFF') {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
      if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
      return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    }
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  };
  for (const key of ['actor-0-working', 'actor-3-sleeping', 'zzz', 'flame_aura']) {
    const spec: any = (assetData as any)[key];
    const [w, h] = size(spec.uri);
    assert.ok(Math.abs(w - spec.frameW * spec.frames * RS) <= 1, `${key} width ${w}`);
    assert.ok(Math.abs(h - spec.frameH * RS) <= 1, `${key} height ${h}`);
  }
  const bg: any = (assetData as any)['background-small'];
  const [bw, bh] = size(bg.uri);
  assert.ok(Math.abs(bw - bg.size[0] * RS) <= 1 && Math.abs(bh - bg.size[1] * RS) <= 1, `background ${bw}x${bh}`);
});

test('sheetFrame returns logical frame rectangles for any runtimeScale (rows wrap by the scaled width)', () => {
  for (const rs of [1, 0.5, 0.25]) {
    const spec = { frameW: 160, frameH: 216, frames: 4, fps: 8, loop: true, runtimeScale: rs };
    for (let i = 0; i < 4; i++) assert.deepEqual(sheetFrame(spec, { width: 160 * 4 * rs, height: 216 * rs }, i / 8), { x: i * 160, y: 0, w: 160, h: 216 }, `rs=${rs} i=${i}`);
  }
  // 한 줄에 3칸(논리 30px 폭 × rs 0.5 = 15px)으로 감싼 시트
  const wrapped = sheetFrame({ frameW: 10, frameH: 20, frames: 6, fps: 1, loop: true, runtimeScale: 0.5 }, { width: 15, height: 20 }, 4);
  assert.deepEqual([wrapped.x, wrapped.y], [10, 20]);
  // frameW가 없는 정적 이미지: 논리 크기 = 픽셀 / runtimeScale
  assert.deepEqual(sheetFrame({ runtimeScale: 0.5 }, { width: 400, height: 200 }, 0), { x: 0, y: 0, w: 800, h: 400 });
});

test('draw reads the source rectangle in image pixels (logical × runtimeScale) but keeps destination sizes independent of it', () => {
  const s = snap([solo('a', { state: 'working' })]);
  const rs1 = Object.fromEntries(Object.entries(assetData).map(([k, spec]) => [k, { ...spec, runtimeScale: 1 }]));
  const full = trace(s, { sprites: fakeSprites(rs1), timeMs: 0 });
  const half = trace(s, { sprites: fakeSprites() });
  const pick = (t: typeof full) => t.images.filter(i => i.key === 'actor-0-working');
  assert.equal(pick(full).length, pick(half).length);
  pick(full).forEach((a, i) => {
    const b = pick(half)[i];
    assert.deepEqual([b.sx, b.sy, b.sw, b.sh], [a.sx * RS, a.sy * RS, a.sw * RS, a.sh * RS], 'source rect scales');
    assert.deepEqual([b.dx, b.dy, b.dw, b.dh], [a.dx, a.dy, a.dw, a.dh], 'destination is unchanged');
  });
  assert.equal(pick(half)[0].sw, 160 * RS);
  assert.equal(pick(half)[0].sh, (manifest as any).pods['0'].actorSourceClip.working[3] * RS, 'source clip of the typing pose');
});

test('every drawn source rectangle lies inside its image for all assets (no out-of-range crops at half resolution)', () => {
  const sprites = fakeSprites();
  const o = group(8);
  o.members.forEach((m, i) => { (m as any).state = ['working', 'away', 'phone', 'sleeping'][i % 4]; (m as any).needsAttention = i % 3 === 0; });
  const s = snap([o, solo('x', { state: 'sleeping' })]);
  const { images } = trace(s, { sprites, epoch: 1e9, timeMs: 777 });
  for (const img of images) {
    const { image } = (sprites as any)[img.key] ?? { image: { width: Infinity, height: Infinity } };
    assert.ok(img.sx >= 0 && img.sy >= 0 && img.sx + img.sw <= image.width + 1e-6 && img.sy + img.sh <= image.height + 1e-6, `${img.key}: ${img.sx},${img.sy} ${img.sw}x${img.sh} in ${image.width}x${image.height}`);
  }
});

test('provider icons (runtimeScale 1) are drawn from their full 64px source', () => {
  const { images } = trace(snap([solo('s', { provider: 'claude' })]));
  const icon = images.find(i => i.key === 'provider-icon-claude')!;
  assert.deepEqual([icon.sx, icon.sy, icon.sw, icon.sh], [0, 0, 64, 64]);
});

// ───────── 프리뷰 setTransition(from, ms, epoch, settleMs) ─────────
test('setTransition settles the "from" snapshot, then replays the target for exactly ms; repeated and backward seeks are deterministic', async () => {
  const working = snap([group(3, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  await withMount(away, { clientWidth: 480 }, async m => {
    const state = () => JSON.stringify(m.handle.inspect().actors);
    await m.handle.setTransition(working, 0, 1000, 5000);
    const atZero = JSON.parse(state());
    const stations0 = m.handle.inspect().layout.rooms[0].stations;
    for (const st of stations0) {
      const a = atZero[st.agent.id];
      assert.equal(a.state, 'away', 'the target state is registered at t=0');
      assert.deepEqual([a.x, a.y], [st.seat.x, st.seat.y], 'nobody has moved yet at t=0');
    }
    await m.handle.setTransition(working, 2500, 1000, 5000);
    const mid = state();
    assert.ok(Object.values<any>(JSON.parse(mid)).some(a => a.moving), 'someone is walking 2.5s after the switch');
    await m.handle.setTransition(working, 9000, 1000, 5000);
    await m.handle.setTransition(working, 2500, 1000, 5000);
    assert.equal(state(), mid, 'seeking backwards reproduces the same frame');
    await m.handle.setTransition(working, 2500, 1000, 5000);
    assert.equal(state(), mid, 'same arguments, same frame');
    await m.handle.setTransition(working, 60_000, 1000, 5000);
    for (const st of m.handle.inspect().layout.rooms[0].stations) {
      const a = m.handle.inspect().actors[st.agent.id];
      assert.ok(Math.hypot(a.x - (st.rest ? st.away.x : st.seat.x), a.y - (st.rest ? st.away.y : st.seat.y)) < 1, `${st.agent.id} settled at its destination`);
    }
    // 정착 시간은 from 상태의 시계에 반영된다.
    await m.handle.setTransition(working, 0, 1000, 20_000);
    assert.ok(Object.values<any>(m.handle.inspect().actors).every(a => a.elapsed >= 20), 'the from state ran for the settle time first');
  });
});

test('setTransition is a preview hook: it renders one fixed frame and leaves the live loop stopped', async () => {
  const working = snap([solo('a', { state: 'working' })]);
  await withMount(withState(working, 'away'), { clientWidth: 480 }, async m => {
    await m.handle.setTransition(working, 3000, 1000);
    const drawn = m.drawCount();
    m.run(5000);
    assert.equal(m.drawCount(), drawn);
  });
});
