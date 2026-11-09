import test from 'node:test';
import assert from 'node:assert/strict';
import { actorImages, advance, assetData, fakeSprites, group, layoutOffices, manifest, runtimeScaleOf, snap, solo, step, trace, withState } from './helpers/scene.ts';

const M = manifest as any;
const RS = M.runtimeScale as number;
const key = (st: any, suffix: string) => `${st.manager ? 'orchestrator' : `actor-${st.variant}`}-${suffix}`;
const handsKey = (st: any) => `hands-${st.manager ? 'orchestrator' : `actor-${st.variant}`}-working`;
const awaitingOffice = (n = 6, extra: Record<string, unknown> = {}) => snap([group(n, 'g', { state: 'working', needsAttention: true, ...extra })]);
const settled = (s: any, ms = 600, width?: number) => advance({}, s, ms, layoutOffices(s, width)); // 폭이 다르면 좌석 위치도 다르다(상단바 높이)
const bubbles = (images: any[]) => images.filter(i => i.key === 'question_bubble');
const figuresOf = (t: ReturnType<typeof trace>, st: any, suffix: string) => t.images.filter(i => i.key === key(st, suffix));
/** 큰 방에서는 외형(i%6)이 겹치므로, 같은 시트 중 이 자리(seat) 기준으로 가장 가까운 그림이 이 에이전트의 것이다. */
const figureOf = (t: ReturnType<typeof trace>, st: any, suffix: string) => figuresOf(t, st, suffix).reduce((best, f) => (Math.abs(f.dx + f.dw / 2 - st.seat.x) + Math.abs(f.dy - st.y) < Math.abs(best.dx + best.dw / 2 - st.seat.x) + Math.abs(best.dy - st.y) ? f : best));

/** 그려진 몸통 프레임 사각형에서 머리 위 중앙(논리 프레임의 [80, 12])을 구한다. */
const headOf = (fig: { dx: number; dy: number; dw: number; sw: number }) => { const f = fig.dw * RS / fig.sw; return { x: fig.dx + 80 * f, y: fig.dy + 12 * f, f }; };

// ───────── manifest 계약 ─────────
test('awaiting art contract: seven awaiting sheets (actor-0..5 and orchestrator) with 2+ frames, plus the question bubble sheet', () => {
  for (const id of ['actor-0', 'actor-1', 'actor-2', 'actor-3', 'actor-4', 'actor-5', 'orchestrator']) {
    const name = M.actors[id].awaiting, spec = (assetData as any)[name];
    assert.equal(name, `${id}-awaiting`);
    assert.ok(spec?.uri, name);
    assert.ok(spec.frames >= 2 && spec.fps > 0, `${name}: ${spec.frames} frames @ ${spec.fps}fps`);
    const working = (assetData as any)[M.actors[id].working];
    assert.deepEqual([spec.frameW, spec.frameH], [working.frameW, working.frameH], `${name}: same cell as the working sheet`);
  }
  const q = (assetData as any).question_bubble;
  assert.ok(q?.uri && q.frames >= 2, 'question_bubble');
  assert.equal(M.effects.question_bubble, 'question_bubble');
  assert.equal(M.effectPlacement.question_bubble.preferredDisplayHeight, 64);
});

// ───────── 대기 중 착석 에이전트의 자세 ─────────
test('a seated agent waiting on a question draws its <id>-awaiting sheet once and neither the typing sheet nor the hand overlay — for all six looks and the manager', () => {
  const s = awaitingOffice(6);
  const t = trace(s, { actors: settled(s), epoch: 1 });
  const stations = t.layout.rooms[0].stations;
  assert.equal(stations.length, 7);
  assert.deepEqual(new Set(stations.filter(x => !x.manager).map(x => x.variant)).size, 6, 'six different member looks');
  for (const st of stations) {
    assert.equal(figuresOf(t, st, 'awaiting').length, 1, `${st.agent.id}: ${key(st, 'awaiting')} drawn once`);
    assert.equal(figuresOf(t, st, 'working').length, 0, `${st.agent.id}: no typing sheet`);
    assert.equal(t.images.filter(i => i.key === handsKey(st)).length, 0, `${st.agent.id}: no hand overlay`);
    assert.equal(t.images.filter(i => i.key === key(st, 'phone') || i.key === key(st, 'sleeping')).length, 0);
  }
  assert.equal(actorImages(t.images).filter(i => /-working$/.test(i.key)).length, 0);
  assert.equal(t.images.filter(i => /^hands-/.test(i.key)).length, 0);
});

test('the awaiting pose sits in the desk layers like the typing pose: back < torso < tabletop < nameplate, same cell size and scale as typing', () => {
  const s = awaitingOffice(6);
  const t = trace(s, { actors: settled(s), epoch: 1 });
  const calm = trace(withState(s, 'working', { needsAttention: false }), { actors: settled(s), epoch: 1 });
  for (const st of t.layout.rooms[0].stations) {
    const at = (k: string) => t.images.find(i => i.key === k && Math.abs(i.dx - st.x) < 1 && Math.abs(i.dy - st.y) < 1)!;
    const back = at(st.desk.back), front = at(st.desk.front);
    const plate = t.texts.find(x => x.text === st.agent.name || (x.text.endsWith('…') && st.agent.name.startsWith(x.text.slice(0, -1))))!;
    const [fig] = figuresOf(t, st, 'awaiting'), [typing] = figuresOf(calm, st, 'working');
    assert.ok(back.order < fig.order && fig.order < front.order && front.order < plate.order, `${st.agent.id}: layer order`);
    assert.ok(Math.abs(fig.dw - typing.dw) < 1e-9 && Math.abs(fig.dh - typing.dh) < 1e-9, `${st.agent.id}: same drawn size as the typing pose`);
    assert.ok(Math.abs(fig.sw - typing.sw) < 1e-9 && Math.abs(fig.sh - typing.sh) < 1e-9, `${st.agent.id}: whole cell like typing`);
    assert.ok(fig.clip && fig.clip.length === 1, `${st.agent.id}: still clipped at the table rear line`);
  }
});

// ───────── 머리 위 '?' 말풍선 ─────────
type R = { x: number; y: number; width: number; height: number };
const cross = (a: R, b: R) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** 실제로 그려진 글자 크기·여백과 표시 폭(리드는 plateDisplayWidth)으로 구한 명판 사각형. */
function plateRectOf(t: ReturnType<typeof trace>, st: any): R {
  const vs = t.layout.viewportScale!;
  const label = t.texts.find(x => x.text === st.agent.name || (x.text.endsWith('…') && st.agent.name.startsWith(x.text.slice(0, -1))))!;
  const font = Number(/(\d+(?:\.\d+)?)px/.exec(label.font)![1]), pad = Math.max(st.manager ? 3 * st.moduleScale : 3, 1 / vs);
  const w = st.plateDisplayWidth ?? st.plateWidth, h = Math.max(font, 6.5 / vs) * 1.35 + pad * 2;
  return { x: st.plate.x - w / 2, y: st.plate.y - h / 2, width: w, height: h };
}
/** 기본 위치(머리 위): dx = head.x - tail.x * factor, 앵커가 머리 위 10px. */
function defaultBubble(t: ReturnType<typeof trace>, st: any) {
  const fig = figureOf(t, st, 'awaiting'), head = headOf(fig);
  const place = M.effectPlacement.question_bubble, anchor = (assetData as any).question_bubble.anchor;
  const height = place.preferredDisplayHeight * head.f, factor = height / 96;
  return { rect: { x: head.x - place.tailTipInSheetFrame0[0] * factor, y: head.y - 10 - anchor[1] * factor, width: 128 * factor, height }, head, factor };
}

test('a question bubble is drawn once per waiting agent over the drawn head (default: dx = head.x - 56 * factor, anchor 10px above the head); the old "!" is not drawn', () => {
  for (const n of [3, 10]) {
    const s = awaitingOffice(n);
    const t = trace(s, { actors: settled(s), epoch: 1 });
    const stations = t.layout.rooms[0].stations;
    assert.equal(bubbles(t.images).length, stations.length, 'one bubble per agent');
    assert.equal(t.images.filter(i => i.key === 'attention').length, 0, 'no "!" while a question is shown');
    for (const st of stations) {
      const def = defaultBubble(t, st);
      const plates = stations.map(o => plateRectOf(t, o));
      const free = !plates.some(p => cross(def.rect, p)) && def.rect.x >= 0 && def.rect.x + def.rect.width <= t.layout.width;
      assert.ok(free, `N=${n} ${st.agent.id}: the default spot is free in this layout (otherwise see the VQA-041 tests)`);
      const b = bubbles(t.images).find(x => Math.abs(x.dx - def.rect.x) < 1e-6);
      assert.ok(b, `${st.agent.id}: bubble at dx = head.x - 56 * factor`);
      assert.ok(Math.abs(b!.dx - (def.head.x - 56 * def.factor)) < 1e-6);
      assert.ok(Math.abs(b!.dy - def.rect.y) < 1e-6 && Math.abs(b!.dh - def.rect.height) < 1e-6 && Math.abs(b!.dw - def.rect.width) < 1e-6, `${st.agent.id}: anchor 10px above the head, size scales with the actor`);
      assert.ok(b!.dy + b!.dh < def.head.y, 'above the head, not over the face');
    }
  }
});

// VQA-041 + VQA-043: 말풍선은 어떤 명판도 가리지 않고, 항상 질문하는 사람의 것으로 읽혀야 한다.
// 기본 위치가 명판과 겹치면 꼬리 끝을 머리 쪽으로 낮추고(머리 박스 위쪽 약 45%까지), 그래도 겹치면 0.85배, 0.7배로 줄인다.
const BUBBLE = () => (assetData as any).question_bubble;
const FIG_SUFFIXES = ['awaiting', 'working', 'phone', 'sleeping'];
/** 이 자리에서 실제로 그려진 몸통 그림(어떤 자세든): 시트가 같은 다른 자리의 그림과 섞이지 않게 가장 가까운 것을 고른다. */
function bodyOf(t: ReturnType<typeof trace>, st: any) {
  const cands = FIG_SUFFIXES.flatMap(suf => figuresOf(t, st, suf));
  return cands.reduce((best, f) => (Math.abs(f.dx + f.dw / 2 - st.seat.x) + Math.abs(f.dy - st.y) < Math.abs(best.dx + best.dw / 2 - st.seat.x) + Math.abs(best.dy - st.y) ? f : best));
}
/** 머리 박스(논리 프레임 [52,18]-[108,80])와 머리 중심(프레임 y=49), 장면 좌표. */
function headBox(fig: { dx: number; dy: number; dw: number; sw: number }) {
  const f = fig.dw * RS / fig.sw;
  return { f, x0: fig.dx + 52 * f, x1: fig.dx + 108 * f, y0: fig.dy + 18 * f, y1: fig.dy + 80 * f, cx: fig.dx + 80 * f, cy: fig.dy + 49 * f };
}
const boxDistance = (px: number, py: number, h: { x0: number; x1: number; y0: number; y1: number }) => Math.hypot(Math.max(h.x0 - px, 0, px - h.x1), Math.max(h.y0 - py, 0, py - h.y1));
/** 그려진 말풍선의 꼬리 끝(시트 프레임 0의 꼬리 끝 x, 앵커 y를 현재 배율로). */
function tipOf(b: { dx: number; dy: number; dw: number; dh: number }) {
  const tail = M.effectPlacement.question_bubble.tailTipInSheetFrame0, anchor = BUBBLE().anchor;
  return { x: b.dx + tail[0] * (b.dw / 128), y: b.dy + anchor[1] * (b.dh / 96) };
}

/** 말풍선 → 주인 연결: 말풍선 중심에서 가장 가까운 머리(모든 캐릭터 중)의 자리. */
function ownerOf(t: ReturnType<typeof trace>, b: any) {
  const cx = b.dx + b.dw / 2, cy = b.dy + b.dh / 2;
  let best: any = null, bestD = Infinity;
  for (const st of t.layout.rooms[0].stations) { const h = headBox(bodyOf(t, st)); const d = Math.hypot(cx - h.cx, cy - h.cy); if (d < bestD) { bestD = d; best = st; } }
  return best;
}

function checkBubbles(t: ReturnType<typeof trace>, width: number, label: string, waiting: Set<string>) {
  const stations = t.layout.rooms[0].stations, vs = t.layout.viewportScale!;
  const plates = stations.map(o => plateRectOf(t, o));
  const all = bubbles(t.images);
  assert.equal(all.length, waiting.size, `${label}: one bubble per waiting agent`);
  const owners = new Set<string>();
  const place = M.effectPlacement.question_bubble;
  for (const b of all) {
    const rect = { x: b.dx, y: b.dy, width: b.dw, height: b.dh };
    const owner = ownerOf(t, b);
    owners.add(owner.agent.id);
    assert.ok(waiting.has(owner.agent.id), `${label}: the bubble nearest to ${owner.agent.id}'s head belongs to a waiting agent`);
    // 명판 겹침 0, 장면 밖 0.
    for (const [i, p] of plates.entries()) assert.ok(!cross(rect, p), `${label}: bubble ${JSON.stringify(rect)} covers the plate of ${stations[i].agent.id}`);
    assert.ok(rect.x >= -1e-6 && rect.x + rect.width <= t.layout.width + 1e-6, `${label}: bubble leaves the scene`);
    // 꼬리 끝이 자기 머리 박스에서 12 CSS px 이내(장면 단위로는 12 / viewportScale).
    const head = headBox(bodyOf(t, owner)), tip = tipOf(b), reach = Math.max(12 / vs, 6 * head.f + 11);
    assert.ok(boxDistance(tip.x, tip.y, head) <= reach + 1e-6, `${label} ${owner.agent.id}: tail tip is ${boxDistance(tip.x, tip.y, head).toFixed(1)} scene px from the head box (limit ${reach.toFixed(1)} = ${(reach * vs).toFixed(1)} CSS px)`);
    if (width < 1536) assert.ok(boxDistance(tip.x, tip.y, head) * vs <= 12 + 1e-6 || reach * vs > 12, `${label}: within 12 CSS px`);
    // 크기: 1배, 0.85배, 0.7배 중 하나. 꼬리 끝은 기본 위치(머리 위 10px)에서 머리 박스 위쪽 약 45%까지만 내려온다.
    const full = place.preferredDisplayHeight * head.f, k = b.dh / full;
    assert.ok([1, 0.85, 0.7].some(v => Math.abs(k - v) < 1e-6), `${label} ${owner.agent.id}: scale ${k}`);
    const tip0 = head.y0 - 18 * head.f + 12 * head.f - 10, tipLow = head.y0 + 0.45 * (head.y1 - head.y0);
    assert.ok(tip.y >= tip0 - 1e-6 && tip.y <= tipLow + 1e-6, `${label}: tail tip y ${tip.y.toFixed(1)} between the default (${tip0.toFixed(1)}) and the hair line (${tipLow.toFixed(1)})`);
    // 중심이 다른 캐릭터의 머리보다 자기 머리에 더 가깝다(ownerOf가 자기 자리를 가리킨다).
    const cx = b.dx + b.dw / 2, cy = b.dy + b.dh / 2, mine = Math.hypot(cx - head.cx, cy - head.cy);
    for (const o of stations) if (o !== owner) { const h = headBox(bodyOf(t, o)); assert.ok(Math.hypot(cx - h.cx, cy - h.cy) > mine - 1e-6, `${label}: bubble center is nearer to ${owner.agent.id}'s head than to ${o.agent.id}'s`); }
  }
  assert.deepEqual([...owners].sort(), [...waiting].sort(), `${label}: bubbles map one-to-one onto the waiting agents`);
}

for (const width of [480, 410]) {
  test(`VQA-041/043 (${width}px): for N=1..16 every bubble clears the plates, stays in the scene, keeps its tail within 12 CSS px of its own head and is nearest to its owner`, () => {
    let lowered = 0;
    for (let n = 1; n <= 16; n++) {
      const s = n === 1 ? snap([solo('a', { state: 'working', needsAttention: true })]) : awaitingOffice(n);
      const t = trace(s, { actors: settled(s, 600, width), epoch: 1, width });
      const waiting = new Set(t.layout.rooms[0].stations.map(x => x.agent.id));
      checkBubbles(t, width, `${width}px N=${n} (all waiting)`, waiting);
      for (const st of t.layout.rooms[0].stations) {
        const b = bubbles(t.images).find(x => ownerOf(t, x) === st)!;
        const def = defaultBubble(t, st);
        if (Math.abs(b.dx - def.rect.x) > 1e-6 || Math.abs(b.dy - def.rect.y) > 1e-6 || Math.abs(b.dh - def.rect.height) > 1e-6) lowered++;
      }
    }
    assert.ok(lowered >= 1, `${width}px: at least one bubble left the default spot (the avoidance is exercised)`);
  });

  test(`VQA-043 (${width}px): when only one agent waits, the bubble stays with that agent for N=2..16 (any member, not just the first row)`, () => {
    for (let n = 2; n <= 16; n++) for (const who of [0, 1, Math.min(2, n - 1), n - 1]) {
      const o = group(n, 'g', { state: 'working' });
      (o.members[who] as { needsAttention: boolean }).needsAttention = true;
      const s = snap([o]);
      const t = trace(s, { actors: settled(s, 600, width), epoch: 1, width });
      checkBubbles(t, width, `${width}px N=${n} only g${who} waits`, new Set([`g${who}`]));
    }
  });
}

for (const n of [5, 6]) for (const width of [480, 410]) {
  test(`VQA-043 regression (N=${n}, ${width}px): only scene#3C71 (first-row middle member) waits: the bubble hugs that agent, not the Orchestrator desk or plate`, () => {
    const o = group(n, 'g', { state: 'working' });
    (o.members[1] as { needsAttention: boolean }).needsAttention = true;
    const s = snap([o]);
    const t = trace(s, { actors: settled(s, 600, width), epoch: 1, width });
    const stations = t.layout.rooms[0].stations, lead = stations[0], me = stations.find(x => x.agent.id === 'g1')!;
    const def = defaultBubble(t, me);
    assert.ok(cross(def.rect, plateRectOf(t, lead)), 'precondition: the default spot covers the lead plate (VQA-041)');
    const [b] = bubbles(t.images);
    const vs = t.layout.viewportScale!, head = headBox(bodyOf(t, me)), tip = tipOf(b);
    assert.equal(ownerOf(t, b), me, 'the nearest head is the waiting agent, not the Orchestrator');
    assert.ok(boxDistance(tip.x, tip.y, head) * vs <= 12 + 1e-6, `tail tip ${(boxDistance(tip.x, tip.y, head) * vs).toFixed(1)} CSS px from the agent's head box (limit 12)`);
    assert.ok(!cross({ x: b.dx, y: b.dy, width: b.dw, height: b.dh }, plateRectOf(t, lead)), 'no overlap with the lead plate');
    const leadHead = headBox(bodyOf(t, lead)), cx = b.dx + b.dw / 2, cy = b.dy + b.dh / 2;
    assert.ok(Math.hypot(cx - head.cx, cy - head.cy) < Math.hypot(cx - leadHead.cx, cy - leadHead.cy), 'the bubble is closer to its owner than to the Orchestrator');
    // 꼬리가 향하는 곳은 리드 책상이 아니다: 꼬리 끝은 질문하는 사람의 머리 박스 근처에 있다.
    assert.ok(boxDistance(tip.x, tip.y, head) < boxDistance(tip.x, tip.y, leadHead), 'the tail points at the asker, not at the lead desk');
    // 말풍선은 줄어들더라도 읽을 수 있는 크기다.
    assert.ok(b.dh >= 0.7 * M.effectPlacement.question_bubble.preferredDisplayHeight * head.f - 1e-6);
  });
}

test('VQA-041: large and small rooms (N3, N10, N16) never needed the avoidance: their bubbles are all at the default spot', () => {
  for (const n of [3, 10, 16]) for (const width of [480, 410]) {
    const s = awaitingOffice(n);
    const t = trace(s, { actors: settled(s, 600, width), epoch: 1, width });
    for (const st of t.layout.rooms[0].stations) { const d = defaultBubble(t, st); assert.ok(bubbles(t.images).some(b => Math.abs(b.dx - d.rect.x) < 1e-6 && Math.abs(b.dh - d.rect.height) < 1e-6), `${width}px N=${n} ${st.agent.id}`); }
  }
});

test('the question bubble is drawn on top of the room: after every figure, tabletop and nameplate', () => {
  const s = awaitingOffice(3);
  const t = trace(s, { actors: settled(s), epoch: 1 });
  const last = Math.max(...bubbles(t.images).map(b => b.order)), first = Math.min(...bubbles(t.images).map(b => b.order));
  assert.ok(first > Math.max(...t.texts.map(x => x.order)), 'above every nameplate');
  assert.ok(first > Math.max(...actorImages(t.images).map(i => i.order)), 'above every figure');
  assert.ok(first > Math.max(...t.images.filter(i => /^(pod-\d|lead)-(back|front)/.test(i.key)).map(i => i.order)), 'above every desk layer');
  assert.ok(last >= first);
});

// ───────── 불꽃 / 장식 ─────────
test('no flame aura while waiting, even after 60s of work; unflagged workers in the same office keep theirs', () => {
  const o = group(5, 'g', { state: 'working', stateSince: 0 });
  (o.members[1] as { needsAttention: boolean }).needsAttention = true;
  const s = snap([o]);
  const t = trace(s, { actors: settled(s), epoch: 90_000 });
  const flames = t.images.filter(i => i.key === 'flame_aura');
  const stations = t.layout.rooms[0].stations;
  assert.equal(flames.length, stations.length - 1, 'every worker burns except the one waiting');
  const waiting = stations.find(x => x.agent.id === 'g1')!;
  const [fig] = figuresOf(t, waiting, 'awaiting');
  const f = waiting.actorHeight / 216, place = M.effectPlacement.flame_aura;
  const where = fig.dx + (place.anchorInActorFrame[0] - place.sheetAnchor[0]) * f;
  assert.equal(flames.some(x => Math.abs(x.dx - where) < 1e-6), false, 'no flame at the waiting agent');
  const all = awaitingOffice(5);
  assert.equal(trace(all, { actors: settled(all), epoch: 9e9 }).images.filter(i => i.key === 'flame_aura').length, 0, 'nobody burns while everybody waits');
});

test('VQA-024 still holds with the question pose: Done!/PR up!/+number decorations never appear on a waiting agent', () => {
  const keys = new Set(['pop_plus3', 'pop_plus10', 'bubble_done', 'bubble_prup'].map(n => M.effects[n]));
  const s = awaitingOffice(12);
  let actors: any = settled(s, 300);
  for (let t = 0; t < 40_000; t += 500) {
    actors = advance(actors, s, 500);
    const { images } = trace(s, { actors, epoch: 1e9 });
    assert.equal(images.filter(i => keys.has(i.key)).length, 0, `t=${t}`);
    assert.equal(bubbles(images).length, 13, `t=${t}: every waiting agent shows its question`);
  }
});

// ───────── 복귀 ─────────
test('when the wait ends the next refresh brings typing back: working sheet, hand overlay and flame return, the question bubble is gone', () => {
  const s = awaitingOffice(4, { stateSince: 0 });
  const calm = withState(s, 'working', { needsAttention: false });
  const actors = settled(s);
  const asking = trace(s, { actors, epoch: 90_000 });
  assert.equal(bubbles(asking.images).length, 5);
  const resumed = trace(calm, { actors: advance(actors, calm, 100), epoch: 90_000 });
  for (const st of resumed.layout.rooms[0].stations) {
    assert.equal(figuresOf(resumed, st, 'working').length, 1, `${st.agent.id}: typing sheet is back`);
    assert.equal(figuresOf(resumed, st, 'awaiting').length, 0, `${st.agent.id}: no awaiting sheet`);
    assert.equal(resumed.images.filter(i => i.key === handsKey(st)).length, 1, `${st.agent.id}: hand overlay is back`);
  }
  assert.equal(bubbles(resumed.images).length, 0, 'the question bubble disappears');
  assert.equal(resumed.images.filter(i => i.key === 'attention').length, 0);
  assert.equal(resumed.images.filter(i => i.key === 'flame_aura').length, 5, 'flames come back for 60s+ workers');
  // 다시 대기하면 곧바로 손 든 자세로 돌아간다.
  const again = trace(s, { actors: advance(advance(actors, calm, 400), s, 100), epoch: 1 });
  assert.equal(bubbles(again.images).length, 5);
  assert.equal(again.images.filter(i => /-working$/.test(i.key) && !/^hands-/.test(i.key)).length, 0);
});

test('changing the wait state is a hard cut with one opaque figure per agent (no crossfade ghost of the typing pose)', () => {
  const s = awaitingOffice(2);
  const calm = withState(s, 'working', { needsAttention: false });
  let actors: any = advance({}, calm, 1000);
  for (const ms of [0, 50, 150, 400]) {
    const moved = advance(actors, s, ms);
    const t = trace(s, { actors: moved, epoch: 1 });
    const figs = actorImages(t.images);
    assert.ok(figs.every(i => /-awaiting$/.test(i.key) && i.alpha === 1), `+${ms}ms: ${figs.map(i => i.key)}`);
  }
});

// ───────── 대기가 아닌 working은 바뀌지 않음 ─────────
test('workers that are not waiting draw exactly what they drew before: only the waiting agent changes', () => {
  const o = group(5, 'g', { state: 'working', stateSince: 0 });
  const calmSnap = snap([o]);
  const flagged: any = JSON.parse(JSON.stringify(o));
  flagged.members[1].needsAttention = true; // g1만 대기
  const askSnap = snap([flagged]);
  const calm = trace(calmSnap, { actors: settled(calmSnap), epoch: 90_000 }), ask = trace(askSnap, { actors: settled(askSnap), epoch: 90_000 });
  const sig = (t: ReturnType<typeof trace>, st: any) => t.images.filter(i => [key(st, 'working'), handsKey(st), key(st, 'phone')].includes(i.key)).map(i => [i.key, i.sx, i.sy, i.sw, i.sh, i.dx, i.dy, i.dw, i.dh]);
  for (const st of calm.layout.rooms[0].stations) {
    if (st.agent.id === 'g1') {
      assert.deepEqual(sig(ask, st), [], 'the waiting agent no longer types');
      assert.equal(figuresOf(ask, st, 'awaiting').length, 1);
    } else {
      assert.ok(sig(calm, st).length >= 2, `${st.agent.id}: typing + hands drawn`);
      assert.deepEqual(sig(ask, st), sig(calm, st), `${st.agent.id}: unchanged`);
    }
  }
  assert.equal(bubbles(ask.images).length, 1, 'one question bubble in the office');
  assert.equal(bubbles(calm.images).length, 0);
});

// ───────── 폴백 ─────────
test('fallback: a waiting agent that is walking keeps the "!" attention mark (no question bubble, no awaiting sheet)', () => {
  const rest = snap([solo('a', { state: 'away' })]);
  const back = snap([solo('a', { state: 'working', needsAttention: true })]);
  const layout = layoutOffices(back);
  let actors: any = advance({}, rest, 30_000);
  let walking = 0;
  for (let i = 0; i < 400 && walking < 4; i++) {
    actors = step(actors, back, 50, layout);
    if (!actors.a.moving) continue;
    walking++;
    const t = trace(back, { actors });
    assert.equal(t.images.filter(i => i.key === 'attention').length, 1, 'the "!" mark while walking');
    assert.equal(bubbles(t.images).length, 0);
    assert.equal(t.images.filter(i => /-awaiting$/.test(i.key)).length, 0);
    assert.ok(t.images.some(i => /^actor-0-walk_/.test(i.key)));
  }
  assert.equal(walking, 4);
});

test('fallback: without an awaiting sheet the agent keeps typing with hands and the "!" mark (no question bubble)', () => {
  const s = snap([solo('a', { state: 'working', needsAttention: true })]);
  const omit = ['actor-0-awaiting'];
  const t = trace(s, { actors: settled(s), sprites: fakeSprites({}, omit), epoch: 1 });
  assert.equal(t.images.filter(i => i.key === 'actor-0-working').length, 1);
  assert.equal(t.images.filter(i => i.key === 'hands-actor-0-working').length, 1);
  assert.equal(t.images.filter(i => i.key === 'attention').length, 1);
  assert.equal(bubbles(t.images).length, 0);
  // 말풍선 시트가 없으면 손은 들지만 '!'를 쓴다.
  const noBubble = trace(s, { actors: settled(s), sprites: fakeSprites({}, ['question_bubble']), epoch: 1 });
  assert.equal(noBubble.images.filter(i => i.key === 'actor-0-awaiting').length, 1);
  assert.equal(bubbles(noBubble.images).length, 0);
});

test('fallback: an agent that is not seated (resting on a beanbag) never shows the awaiting pose', () => {
  const s = snap([solo('a', { state: 'away', needsAttention: false })]);
  const t = trace(s, { actors: advance({}, s, 30_000) });
  assert.equal(t.images.filter(i => /-awaiting$/.test(i.key)).length, 0);
  assert.equal(bubbles(t.images).length, 0);
});

// ───────── 프레임: 시트 frames·fps ─────────
for (const frames of [1, 2, 3, 7, 12]) {
  test(`awaiting frames follow the sheet: ${frames} frame(s) at the manifest fps play in order and stay inside the sheet`, () => {
    const s = snap([solo('a', { state: 'working', needsAttention: true })]);
    const spec = { ...(assetData as any)['actor-0-awaiting'], frames };
    const sprites = fakeSprites({ 'actor-0-awaiting': spec });
    const rs = runtimeScaleOf('actor-0-awaiting', spec), cell = spec.frameW * rs;
    const seen: number[] = [];
    let actors: any = settled(s, 300);
    for (let i = 0; i < 40; i++) {
      actors = advance(actors, s, 100);
      const fig = trace(s, { actors, sprites, epoch: 1 }).images.find(x => x.key === 'actor-0-awaiting')!;
      const index = Math.floor(actors.a.phase * spec.fps) % frames;
      assert.ok(Math.abs(fig.sx - index * cell) < 1e-6, `phase ${actors.a.phase.toFixed(2)}: sx ${fig.sx} vs frame ${index}`);
      assert.ok(fig.sx + fig.sw <= sprites['actor-0-awaiting'].image.width + 1e-6);
      if (seen.at(-1) !== index) seen.push(index);
    }
    assert.deepEqual([...new Set(seen)].sort((a, b) => a - b), Array.from({ length: frames }, (_, i) => i), 'every frame is shown over time');
    for (let i = 1; i < seen.length; i++) assert.equal((seen[i] - seen[i - 1] + frames) % frames <= Math.ceil(spec.fps * 0.1 + 1), true, 'frames advance in order');
  });
}

test('the real awaiting sheets animate: frame index follows phase * fps over 3 frames, hands wave in sync for every look', () => {
  const s = awaitingOffice(6);
  const spec = (assetData as any)['actor-0-awaiting'];
  assert.deepEqual([spec.frames, spec.fps], [3, 4]);
  const frames = new Set<number>();
  let actors: any = settled(s, 100);
  for (let i = 0; i < 20; i++) {
    actors = advance(actors, s, 100);
    const t = trace(s, { actors, epoch: 1 });
    for (const st of t.layout.rooms[0].stations) {
      const [fig] = figuresOf(t, st, 'awaiting');
      const idx = Math.floor(actors[st.agent.id].phase * spec.fps) % spec.frames;
      assert.ok(Math.abs(fig.sx - idx * spec.frameW * RS) < 1e-6, `${st.agent.id}`);
      if (st.agent.id === 'g0') frames.add(idx);
    }
    // 말풍선 시트도 같은 방식으로 돈다.
    const q = (assetData as any).question_bubble;
    const [b] = bubbles(t.images);
    assert.ok(Math.abs(b.sx - (Math.floor(actors.g0.phase * q.fps) % q.frames) * q.frameW * RS) < 1e-6, 'question bubble frame');
  }
  assert.equal(frames.size, 3);
});

// ───────── 대기 자세의 앉은 높이: 진입·해제 때 0.2초 동안 부드럽게 오르내린다 ─────────
const RISE_MS = 200;
/** 한 자리의 그려진 몸통 y(셀 위쪽 dy)를 ms 간격으로 따라간다. */
function bodyYSeries(from: any, to: any, dt: number, ms: number, settle = 1000, width = 1536) {
  const lFrom = layoutOffices(from, width), lTo = layoutOffices(to, width);
  let actors: any = advance({}, from, settle, lFrom);
  const stations = lTo.rooms[0].stations;
  const series: Record<string, number[]> = Object.fromEntries(stations.map(st => [st.agent.id, [bodyOf(trace(from, { actors, width, epoch: 1 }), st).dy]]));
  for (let t = 0; t < ms; t += dt) {
    actors = step(actors, to, dt, lTo);
    const tr = trace(to, { actors, width, epoch: 1 });
    for (const st of lTo.rooms[0].stations) series[st.agent.id].push(bodyOf(tr, st).dy);
  }
  return { series, stations };
}
const manifestRise = (st: any) => { const id = st.manager ? 'orchestrator' : `actor-${st.variant}`, o = st.desk.actorOffsets[id]; return ((o.awaiting?.[1] ?? o.working[1]) - o.working[1] + ((st.desk.actorStateYOffset.awaiting ?? 0) - (st.desk.actorStateYOffset.working ?? 0))) * st.moduleScale; };

test('the awaiting pose sits higher than typing by the manifest offset (members 27-38 module px, manager 27): measured on the drawn body, N=6', () => {
  const calm = withState(awaitingOffice(6), 'working', { needsAttention: false }), ask = awaitingOffice(6);
  const { series, stations } = bodyYSeries(calm, ask, 25, 600);
  for (const st of stations) {
    const s = series[st.agent.id], total = s.at(-1)! - s[0], want = manifestRise(st);
    assert.ok(want < 0, `${st.agent.id}: manifest raises the seat (${want.toFixed(1)})`);
    assert.ok(Math.abs(total - want) < 1e-6, `${st.agent.id}: drawn rise ${total.toFixed(2)} vs manifest ${want.toFixed(2)}`);
    const module = Math.abs(want) / st.moduleScale;
    assert.ok(module >= 20 && module <= 45, `${st.agent.id}: rise of ${module.toFixed(1)} module px is the intended 27..38`);
  }
});

for (const dt of [25, 50, 83]) {
  test(`entering the question pose: the body rises monotonically within 0.2s with no jump larger than the linear rate (${dt}ms steps)`, () => {
    const calm = withState(awaitingOffice(6), 'working', { needsAttention: false }), ask = awaitingOffice(6);
    const { series, stations } = bodyYSeries(calm, ask, dt, 600);
    for (const st of stations) {
      const s = series[st.agent.id], total = s.at(-1)! - s[0];
      assert.ok(total < -5, `${st.agent.id}: the body really rises (${total.toFixed(1)})`);
      for (let i = 1; i < s.length; i++) {
        assert.ok(s[i] <= s[i - 1] + 1e-9, `${st.agent.id} step ${i}: moves up only (${s[i - 1].toFixed(2)} → ${s[i].toFixed(2)})`);
        assert.ok(Math.abs(s[i] - s[i - 1]) <= Math.abs(total) * dt / RISE_MS + 1e-6, `${st.agent.id} step ${i}: no jump (${(s[i] - s[i - 1]).toFixed(2)} per ${dt}ms)`);
      }
      const done = s.findIndex(v => Math.abs(v - s.at(-1)!) < 1e-9);
      assert.ok(done >= 1 && done * dt <= RISE_MS + dt, `${st.agent.id}: settled after ${done * dt}ms (about ${RISE_MS}ms)`);
      assert.ok(done * dt >= RISE_MS - dt, `${st.agent.id}: not instant (${done * dt}ms)`);
      assert.ok(s.slice(done).every(v => Math.abs(v - s.at(-1)!) < 1e-9), `${st.agent.id}: stays put once settled`);
    }
  });

  test(`leaving the question pose: the body sinks monotonically within 0.2s with no jump larger than the linear rate (${dt}ms steps)`, () => {
    const calm = withState(awaitingOffice(6), 'working', { needsAttention: false }), ask = awaitingOffice(6);
    const { series, stations } = bodyYSeries(ask, calm, dt, 600);
    for (const st of stations) {
      const s = series[st.agent.id], total = s.at(-1)! - s[0];
      assert.ok(total > 5, `${st.agent.id}: the body really sinks (${total.toFixed(1)})`);
      for (let i = 1; i < s.length; i++) {
        assert.ok(s[i] >= s[i - 1] - 1e-9, `${st.agent.id} step ${i}: moves down only`);
        assert.ok(Math.abs(s[i] - s[i - 1]) <= total * dt / RISE_MS + 1e-6, `${st.agent.id} step ${i}: no jump`);
      }
      const done = s.findIndex(v => Math.abs(v - s.at(-1)!) < 1e-9);
      assert.ok(done * dt <= RISE_MS + dt && done * dt >= RISE_MS - dt, `${st.agent.id}: ${done * dt}ms`);
    }
  });
}

test('the transition is symmetric: the typing height after a round trip equals the starting height exactly', () => {
  const calm = withState(awaitingOffice(6), 'working', { needsAttention: false }), ask = awaitingOffice(6);
  const l = layoutOffices(calm);
  let actors: any = advance({}, calm, 1000, l);
  const start = trace(calm, { actors, epoch: 1 });
  actors = advance(actors, ask, 400, layoutOffices(ask));
  actors = advance(actors, calm, 400, l);
  const end = trace(calm, { actors, epoch: 1 });
  for (const st of l.rooms[0].stations) assert.ok(Math.abs(bodyOf(end, st).dy - bodyOf(start, st).dy) < 1e-9, st.agent.id);
});

test('reversing in the middle of the rise turns around smoothly: no jump, the motion stays monotonic on each side of the turn', () => {
  const calm = withState(awaitingOffice(4), 'working', { needsAttention: false }), ask = awaitingOffice(4);
  const lc = layoutOffices(calm), la = layoutOffices(ask);
  let actors: any = advance({}, calm, 1000, lc);
  const stations = lc.rooms[0].stations, dy = (a: any, snapshot: any) => { const tr = trace(snapshot, { actors: a, epoch: 1 }); return Object.fromEntries(stations.map(st => [st.agent.id, bodyOf(tr, st).dy])); };
  const seq: Record<string, number>[] = [dy(actors, calm)];
  for (let t = 0; t < 100; t += 25) { actors = step(actors, ask, 25, la); seq.push(dy(actors, ask)); }   // 0.1초 올라가다가
  const turn = seq.length - 1;
  for (let t = 0; t < 300; t += 25) { actors = step(actors, calm, 25, lc); seq.push(dy(actors, calm)); } // 다시 내려간다
  for (const st of stations) {
    const s = seq.map(x => x[st.agent.id]), total = Math.abs(manifestRise(st));
    for (let i = 1; i <= turn; i++) assert.ok(s[i] <= s[i - 1] + 1e-9, `${st.agent.id}: rising before the turn`);
    for (let i = turn + 1; i < s.length; i++) assert.ok(s[i] >= s[i - 1] - 1e-9, `${st.agent.id}: sinking after the turn`);
    for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i] - s[i - 1]) <= total * 25 / RISE_MS + 1e-6, `${st.agent.id} step ${i}: no jump`);
    assert.ok(Math.abs(s.at(-1)! - s[0]) < 1e-9, `${st.agent.id}: back at the typing height`);
    assert.ok(s[turn] < s[0] - 0.2 * total && s[turn] > s[0] - 0.8 * total, `${st.agent.id}: the turn happened mid-way (${(s[0] - s[turn]).toFixed(1)} of ${total.toFixed(1)})`);
  }
});

test('a card or agent that appears already waiting starts at the raised height (no rise animation on first sight)', () => {
  const ask = awaitingOffice(6);
  const l = layoutOffices(ask);
  const first = trace(ask, { actors: step({}, ask, 0, l), epoch: 1 });
  const settledTrace = trace(ask, { actors: settled(ask, 1000), epoch: 1 });
  for (const st of l.rooms[0].stations) assert.ok(Math.abs(bodyOf(first, st).dy - bodyOf(settledTrace, st).dy) < 1e-9, `${st.agent.id}: first frame is already raised`);
});

test('only waiting agents move: an unflagged typist next to a waiting one keeps its height throughout the transition', () => {
  const o = group(5, 'g', { state: 'working' });
  const ask: any = JSON.parse(JSON.stringify(o)); ask.members[1].needsAttention = true;
  const { series } = bodyYSeries(snap([o]), snap([ask]), 25, 500);
  for (const [id, s] of Object.entries(series)) {
    if (id === 'g1') assert.ok(s.at(-1)! < s[0] - 5, 'the waiting agent rises');
    else assert.ok(s.every(v => Math.abs(v - s[0]) < 1e-9), `${id} stays where it is`);
  }
});
