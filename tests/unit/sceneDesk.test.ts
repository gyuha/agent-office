import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, agentAtPoint, route, assetData, group, layoutOffices, manifest, mixed, snap, solo, step, trace, withState } from './helpers/scene.ts';

const M = manifest as any;
type Img = ReturnType<typeof trace>['images'][number];

/** 한 책상(station)에 속한 그리기 호출: 뒤 레이어, 앞 레이어, 명판 텍스트, 자기 variant의 앉은 캐릭터. */
function layersOf(t: ReturnType<typeof trace>, id: string) {
  const room = t.layout.rooms.find(r => r.stations.some(s => s.agent.id === id))!;
  const st = room.stations.find(s => s.agent.id === id)!;
  const at = (key: string) => t.images.filter(i => i.key === key && Math.abs(i.dx - st.x) < 1 && Math.abs(i.dy - st.y) < 1);
  const back = at(st.desk.back), front = at(st.desk.front);
  // 좁은 명판은 이름을 줄임표로 줄인다: 잘린 접두사도 같은 명판으로 본다.
  const plate = t.texts.filter(x => x.text === st.agent.name || (x.text.endsWith('…') && st.agent.name.startsWith(x.text.slice(0, -1))));
  const actorKey = st.manager ? /^orchestrator-/ : new RegExp(`^actor-${st.variant}-`);
  const figures = t.images.filter(i => actorKey.test(i.key));
  return { st, back, front, plate, figures };
}

const intersect = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), X = Math.min(a.x + a.width, b.x + b.width), Y = Math.min(a.y + a.height, b.y + b.height);
  return X > x && Y > y ? { x, y, width: X - x, height: Y - y } : null;
};
const effective = (img: Img) => {
  const d = { x: img.dx, y: img.dy, width: img.dw, height: img.dh };
  return img.clip ? img.clip.map(c => intersect(d, c)).filter(Boolean) as { x: number; y: number; width: number; height: number }[] : [d];
};
const actorId = (st: any) => (st.manager ? 'orchestrator' : `actor-${st.variant}`);
/** manifest.armOverlays[actorId][state]: 소매부터 손까지의 팔 오버레이 시트(working은 hands-*, phone/sleeping은 arms-*). */
const armKey = (st: any, state: string) => (manifest as any).armOverlays[actorId(st)][state] as string;
const handsKey = (st: any) => armKey(st, 'working');

for (const state of ['working', 'phone', 'sleeping'] as const) {
  test(`draw order per desk (${state}): chair/back < torso < whole tabletop < arm overlay (${state === 'working' ? 'hands' : 'arms'}) < nameplate, for members and the manager`, () => {
    const s = snap([group(5, 'g', { state })]);
    const t = trace(s, { actors: advance({}, s, 600), epoch: 1 });
    for (const st of t.layout.rooms[0].stations) {
      const { back, front, plate, figures } = layersOf(t, st.agent.id);
      assert.equal(back.length, 1, `${st.agent.id} desk back (chair included)`);
      assert.equal(front.length, 1, `${st.agent.id}: the whole tabletop is drawn in a single pass`);
      assert.equal(plate.length, 1, `${st.agent.id} plate`);
      const torso = figures.filter(f => f.order > back[0].order && f.order < front[0].order);
      assert.equal(torso.length, 1, `${st.agent.id}: exactly one torso between the back layer and the tabletop`);
      assert.equal(figures.filter(f => f.order > front[0].order).length, 0, 'the actor sheet itself is not repainted over the tabletop any more');
      const overlay = t.images.filter(i => i.key === armKey(st, state));
      assert.equal(overlay.length, 1, `${st.agent.id}: one arm overlay (${armKey(st, state)})`);
      assert.ok(back[0].order < torso[0].order && torso[0].order < front[0].order && front[0].order < overlay[0].order && overlay[0].order < plate[0].order, `${st.agent.id}: back < torso < tabletop < arms < nameplate`);
      // 다른 상태의 팔 시트는 쓰지 않는다.
      for (const other of ['working', 'phone', 'sleeping'].filter(x => x !== state)) assert.equal(t.images.some(i => i.key === armKey(st, other)), false, `${st.agent.id}: no ${other} arms while ${state}`);
    }
  });
}

// 새 계약: 몸통은 상판 뒤 모서리(tableRearY) 선보다 아래로 상판 위에 그려지지 않는다.
for (const state of ['working', 'phone', 'sleeping'] as const) {
  test(`seat-at-the-rear-edge (${state}): the seated torso is clipped at the table rear line and never painted below it over the tabletop`, () => {
    const s = snap([group(5, 'g', { state })]);
    const t = trace(s, { actors: advance({}, s, 600), epoch: 1 });
    let unclippedBelow = 0;
    for (const st of t.layout.rooms[0].stations) {
      const { back, front, figures } = layersOf(t, st.agent.id);
      const torso = figures.find(f => f.order > back[0].order && f.order < front[0].order)!;
      const rearLine = st.y + st.desk.tableRearY * st.moduleScale, clipLine = st.y + st.desk.actorClip[3] * st.moduleScale;
      assert.ok(st.desk.actorClip[3] >= st.desk.tableRearY && st.desk.actorClip[3] <= st.desk.tableRearY + 3, `${st.agent.id}: the declared clip line is the rear edge (${st.desk.actorClip[3]} vs ${st.desk.tableRearY})`);
      assert.ok(torso.clip && torso.clip.length === 1, `${st.agent.id}: the torso pass is clipped`);
      for (const r of effective(torso)) assert.ok(r.y + r.height <= clipLine + 1e-6, `${st.agent.id}: torso reaches y=${(r.y + r.height).toFixed(1)}, below the clip line ${clipLine.toFixed(1)} (rear edge ${rearLine.toFixed(1)})`);
      if (torso.dy + torso.dh > rearLine + 2) unclippedBelow++;
      // 몸통 기준점이 상판 뒤 모서리 쪽(발 위치보다 위)이다.
      assert.ok(Math.abs(st.bodySeat.y - (st.y + st.desk.seat[1] * st.moduleScale)) < 1e-6 && st.desk.seat[1] <= st.desk.tableRearY + 2, `${st.agent.id}: seat is the rear table edge`);
    }
    assert.ok(unclippedBelow >= 1, 'control: without the clip the body would have been painted below the rear line');
  });
}

test('seat-at-the-rear-edge: the typing hand overlay lies over the keyboard rectangle, centered on the target hand position, in sync with the typing frame', () => {
  const s = snap([group(5, 'g', { state: 'working' })]);
  const t = trace(s, { actors: advance({}, s, 450), epoch: 1 });
  for (const st of t.layout.rooms[0].stations) {
    const { front, figures } = layersOf(t, st.agent.id);
    const hands = t.images.filter(i => i.key === handsKey(st));
    assert.equal(hands.length, 1, `${st.agent.id}: one hand overlay`);
    const h = hands[0], ms = st.moduleScale, kb = st.desk.keyboard;
    assert.ok(h.order > front[0].order, 'drawn after the tabletop');
    const torso = figures.find(f => /-working$/.test(f.key))!;
    assert.deepEqual([h.dx, h.dy, h.dw / h.sw, h.sx === torso.sx], [torso.dx, torso.dy, torso.dw / torso.sw, true], `${st.agent.id}: hands share the actor's origin, scale and typing frame`);
    const keyboard = { x: st.x + kb.rect[0] * ms, y: st.y + kb.rect[1] * ms, width: kb.rect[2] * ms, height: kb.rect[3] * ms };
    const visible = effective(h);
    assert.ok(visible.length >= 1, `${st.agent.id}: the hand overlay has a visible region`);
    const over = visible.map(r => intersect(r, keyboard)).filter(Boolean) as { width: number; height: number }[];
    assert.ok(over.length >= 1 && over[0].width * over[0].height > 0.5 * keyboard.width * keyboard.height, `${st.agent.id}: the overlay covers most of the keyboard rectangle`);
    const target = { x: st.x + kb.targetHandCenter[0] * ms, y: st.y + kb.targetHandCenter[1] * ms };
    assert.ok(visible.some(r => target.x > r.x && target.x < r.x + r.width && target.y > r.y && target.y < r.y + r.height), `${st.agent.id}: the target hand center is inside the visible hand region`);
    assert.ok(visible.every(r => r.y >= st.y + st.desk.actorOverlay.clipInModule[1] * ms - 1e-6 && r.y + r.height <= st.y + st.desk.actorOverlay.clipInModule[3] * ms + 1e-6), 'overlay stays in the declared clip band');
  }
});

test('the seated torso is drawn exactly once per desk from the whole cell (no vertical source clip, no left/right silhouette clip)', () => {
  const s = snap([group(2, 'g', { state: 'working' })]);
  const t = trace(s, { actors: advance({}, s, 300) });
  for (const state of ['working', 'phone', 'sleeping'] as const) for (const st of t.layout.rooms[0].stations) assert.deepEqual(st.desk.actorSourceClip[state], [0, 0, 160, 216], `${st.agent.id} ${state}: manifest declares the whole cell`);
  for (const state of ['working', 'phone', 'sleeping'] as const) {
    const sx = snap([group(3, 'g', { state })]);
    const tx = trace(sx, { actors: advance({}, sx, 300) });
    for (const st of tx.layout.rooms[0].stations) {
      const { back, front, figures } = layersOf(tx, st.agent.id);
      const torso = figures.filter(f => f.order > back[0].order && f.order < front[0].order);
      assert.equal(torso.length, 1, `${st.agent.id} ${state}`);
      const rs = M.runtimeScale, f = torso[0];
      assert.ok(Math.abs(f.sw - 160 * rs) < 1e-6 && Math.abs(f.sh - 216 * rs) < 1e-6, `${st.agent.id} ${state}: source is the whole 160x216 cell (${f.sw}x${f.sh})`);
      // 전체 셀이 그려진다: 대상 크기도 셀 전체(160x216)에 공통 배율을 곱한 값이다.
      assert.ok(Math.abs(f.dh - 216 * st.actorHeight / 216) < 1e-6 && Math.abs(f.dw - 160 * st.actorHeight / 216) < 1e-6, `${st.agent.id} ${state}: destination is the whole cell`);
      // 위쪽 한 줄 클립만 있고(상판 뒤 모서리), 좌우는 몸통 실루엣을 자르지 않는다.
      const [clip] = f.clip!;
      assert.ok(clip.x <= f.dx - 1e-6 && clip.x + clip.width >= f.dx + f.dw + 1e-6, `${st.agent.id} ${state}: clip spans the whole silhouette horizontally`);
      assert.ok(clip.y <= f.dy - 1e-6 || clip.y <= st.y, `${st.agent.id} ${state}: clip does not cut the top`);
    }
  }
});


test('desk back/front layers come from the pod and lead specs (two layers per desk, chair inside the back layer)', () => {
  for (let i = 0; i < 3; i++) {
    const pod = M.pods[String(i)];
    assert.ok((assetData as any)[pod.back] && (assetData as any)[pod.front], `pod-${i}`);
    assert.equal(pod.chairIncludedInBack, true);
  }
  for (const bg of ['small', 'medium', 'large']) assert.ok((assetData as any)[M.leadDesks[bg].back] && (assetData as any)[M.leadDesks[bg].front], bg);
  const t = trace(snap([group(3)]));
  const keys = t.images.map(i => i.key);
  assert.equal(keys.filter(k => /^pod-\d-back$/.test(k)).length, 3);
  assert.equal(keys.filter(k => /^pod-\d-front$/.test(k)).length, 3, 'one tabletop pass per desk');
  assert.equal(keys.filter(k => /^lead-back-/.test(k)).length, 1);
  assert.equal(keys.filter(k => /^lead-front-/.test(k)).length, 1);
});

test('the typing pose follows per-agent actorOffsets and state y-offsets of the desk spec', () => {
  const s = snap([group(3, 'g', { state: 'working' })]);
  const t = trace(s, { actors: advance({}, s, 300) });
  for (const st of t.layout.rooms[0].stations.filter(x => !x.manager)) {
    const fig = layersOf(t, st.agent.id).figures.find(f => f.key === `actor-${st.variant}-working`)!;
    const desk = st.desk, off = desk.actorOffsets[`actor-${st.variant}`].working, ms = st.moduleScale;
    const factor = st.actorHeight / 216; // 모든 자세가 방 공통 캐릭터 높이를 쓴다(frameH 216)
    const clip = desk.actorSourceClip.working;
    const anchorY = desk.actorAnchor[1];
    const expectedY = st.bodySeat.y - anchorY * factor + (desk.actorStateYOffset.working + off[1]) * ms + clip[1] * factor;
    assert.ok(Math.abs(fig.dy - expectedY) < 1e-6, `${st.agent.id}: dy ${fig.dy} vs ${expectedY}`);
  }
});

// ───────── 빈백 그리기 순서 ─────────
test('beanbag draw order: bag back < seated actor < bag front; the front layer is clipped to the legs-exit region only', () => {
  const s = withState(snap([solo('a')]), 'away');
  const t = trace(s, { actors: advance({}, s, 30_000) });
  const st = t.layout.rooms[0].stations[0], rest = st.rest!;
  const at = (key: string) => t.images.filter(i => i.key === key && Math.abs(i.dx - rest.x) < 1 && Math.abs(i.dy - rest.y) < 1);
  const back = at(rest.spec.back), front = at(rest.spec.front);
  assert.equal(back.length, 1); assert.equal(front.length, 1);
  const actor = t.images.filter(i => i.key === 'actor-0-away');
  assert.equal(actor.length, 1);
  assert.ok(back[0].order < actor[0].order && actor[0].order < front[0].order);
});

test('a seated-away actor is anchored at the beanbag seat point (not at the walking foot point)', () => {
  const s = withState(snap([solo('a')]), 'away');
  const t = trace(s, { actors: advance({}, s, 30_000) });
  const st = t.layout.rooms[0].stations[0], rest = st.rest!;
  const fig = t.images.find(i => i.key === 'actor-0-away')!;
  const factor = st.actorHeight / 216; // 앉은 자세도 방 공통 높이
  const anchor = rest.spec.actorAnchor;
  assert.ok(Math.abs(fig.dx - (rest.seat.x - anchor[0] * factor + rest.spec.actorOffset[0] * rest.scale)) < 1e-6);
  assert.ok(Math.abs(fig.dy - (rest.seat.y - anchor[1] * factor + rest.spec.actorOffset[1] * rest.scale)) < 1e-6);
});

test('empty beanbags are still drawn (back and front) when nobody is resting on them', () => {
  const s = snap([group(4, 'g', { state: 'working' })]);
  const t = trace(s, { actors: advance({}, s, 300) });
  const room = t.layout.rooms[0];
  assert.equal(room.rests.length, 3 + 1, 'three member bags (medium room) + the manager bag');
  for (const r of room.rests) {
    assert.equal(t.images.filter(i => i.key === r.spec.back && Math.abs(i.dx - r.x) < 1 && Math.abs(i.dy - r.y) < 1).length, 1);
    assert.equal(t.images.filter(i => i.key === r.spec.front && Math.abs(i.dx - r.x) < 1 && Math.abs(i.dy - r.y) < 1).length, 1);
  }
});

test('no bottom rug / lounge strip is drawn any more', () => {
  const t = trace(snap([group(3)]));
  assert.equal(t.images.filter(i => i.key.startsWith('rug-lounge')).length, 0);
});

// ───────── 왼쪽 빈백 그룹 y 정렬 ─────────
function groupsOf(t: ReturnType<typeof trace>) {
  return t.layout.rooms[0].rests.filter(r => r.x < 300).map(r => {
    const back = t.images.find(i => i.key === r.spec.back && Math.abs(i.dx - r.x) < 1 && Math.abs(i.dy - r.y) < 1)!;
    const front = t.images.find(i => i.key === r.spec.front && Math.abs(i.dx - r.x) < 1 && Math.abs(i.dy - r.y) < 1)!;
    return { rest: r, back, front };
  }).sort((a, b) => a.rest.y - b.rest.y);
}

test('left beanbag groups are drawn as complete units (back -> actor -> front) from top to bottom: a lower bag never covers the face of the occupant above', () => {
  const s = withState(snap([group(10)]), 'away');
  const t = trace(s, { actors: advance({}, s, 120_000) });
  const groups = groupsOf(t);
  assert.equal(groups.length, t.layout.rooms[0].stations.filter(x => !x.manager && x.rest).length);
  assert.ok(groups.length >= 5, `N=10 offers ${groups.length} left bags`);
  const members = t.layout.rooms[0].stations.filter(x => !x.manager && x.rest);
  const figures = (id: string) => { const st = members.find(m => m.agent.id === id)!; return t.images.filter(i => i.key === `actor-${st.variant}-away`); };
  groups.forEach((g, i) => {
    const owner = g.rest.owner, fig = figures(owner);
    assert.equal(fig.length, 1, owner);
    assert.ok(g.back.order < fig[0].order && fig[0].order < g.front.order, `${owner}: back < actor < front`);
    if (i > 0) {
      const above = groups[i - 1];
      assert.ok(above.front.order < g.back.order, `group ${i - 1} is fully drawn before group ${i} starts`);
      // 위 캐릭터의 얼굴·컵 영역(빈백 로컬 y<130)은 아래 빈백의 윗면보다 위에 있어야 한다.
      assert.ok(g.back.dy >= above.rest.y + 130 - 1e-6, `lower bag top ${g.back.dy} must not reach the face region above (${above.rest.y + 130})`);
    }
  });
});

test('group y order does not depend on station order: scrambled actor states still draw groups top to bottom', () => {
  const o = group(6, 'g');
  ['away', 'working', 'away', 'phone', 'away', 'sleeping'].forEach((st, i) => { (o.members[i] as any).state = st; });
  const s = snap([o]);
  const t = trace(s, { actors: advance({}, s, 120_000) });
  const groups = groupsOf(t);
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].front.order < groups[i].back.order);
  assert.deepEqual(groups.map(g => g.rest.y), [...groups.map(g => g.rest.y)].sort((a, b) => a - b));
});

// ───────── 걷기 경로 ─────────
const strictlyInside = (p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

/** 경로를 20ms 간격으로 따라가며 모든 위치를 모은다. */
function walk(snapshot: any, to: any, from: any = {}, ms = 25_000) {
  let actors: any = from;
  const layout = layoutOffices(snapshot);
  const trail: Record<string, { x: number; y: number }[]> = {};
  actors = step(actors, snapshot, 0, layout);
  for (let t = 0; t < ms; t += 50) {
    actors = step(actors, t === 0 ? to : to, 50, layout);
    for (const [id, a] of Object.entries<any>(actors)) (trail[id] ??= []).push({ x: a.x, y: a.y });
  }
  return { trail, layout, actors };
}

for (const n of [3, 6, 10, 16]) {
  test(`N=${n}: walking to the beanbags and back never crosses another desk, the sofa/bed block, or another agent's beanbag`, () => {
    const start = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(start, 'away');
    const out = walk(away, away, advance({}, start, 100), 40_000);
    const back = walk(start, start, out.actors, 40_000);
    for (const { trail, layout } of [out, back]) {
      const room = layout.rooms[0];
      room.stations.forEach((st, idx) => {
        if (st.manager) return; // manager는 아래 전용 테스트에서 다룬다
        const own = room.obstacles[idx];
        for (const p of trail[st.agent.id]) {
          room.obstacles.forEach((r, k) => { if (r !== own) assert.ok(!strictlyInside(p, r), `${st.agent.id} at (${p.x.toFixed(0)},${p.y.toFixed(0)}) inside obstacle #${k}`); });
          for (const rest of room.rests) if (rest.owner !== st.agent.id) {
            const lower = { x: rest.x, y: rest.y + 60 * rest.scale, width: rest.width, height: rest.height - 60 * rest.scale };
            assert.ok(!strictlyInside(p, lower), `${st.agent.id} walked through ${rest.owner}'s beanbag`);
          }
        }
      });
    }
    const longest = Math.max(...Object.values(out.trail).map(tr => Math.max(...tr.map(p => Math.hypot(p.x - tr[0].x, p.y - tr[0].y)))));
    assert.ok(longest > 150, `agents really walked (max ${longest.toFixed(0)}px)`);
    // 걷기가 실제로 끝났는지: 되돌아온 뒤 모두 자기 자리에 있다.
    for (const st of back.layout.rooms[0].stations) {
      const a = back.actors[st.agent.id];
      assert.ok(Math.hypot(a.x - st.seat.x, a.y - st.seat.y) < 1, `${st.agent.id} is back at its desk`);
    }
  });
}

test('a walking agent is hit where it is, and the hit still resolves by depth against desks it passes behind', () => {
  const s = withState(snap([group(3)]), 'away');
  const layout = layoutOffices(s);
  let actors: any = step({}, snap([group(3)]), 0, layout);
  actors = advance(actors, s, 700, layout);
  const walkers = Object.entries<any>(actors).filter(([, a]) => a.moving);
  assert.ok(walkers.length > 0);
  for (const [id, a] of walkers) {
    const st = layout.rooms[0].stations.find(x => x.agent.id === id)!;
    const hit = agentAtPoint(layout, actors, a.x, a.y - st.actorHeight * 0.3);
    assert.ok(hit !== null, `${id} is clickable while walking`);
  }
});

test('rest-bound routes use the two reserved lanes (x=312 and x=212 by slot parity): enter the lane at the walker\'s own y, travel vertically, then step into the bag', () => {
  const s = snap([group(6, 'g', { state: 'phone' })]);
  const room = layoutOffices(s).rooms[0];
  for (const st of room.stations.filter(x => !x.manager && x.rest)) {
    const slot = room.rests.filter(r => r.x < 300).findIndex(r => r.owner === st.agent.id);
    const lane = slot % 2 ? (room as any).leftCorridorX : (room as any).leftCorridorX - 100;
    const path = route(room, st, st.seat, st.away);
    const first = path.findIndex(p => Math.abs(p.x - lane) < 1e-6);
    assert.ok(first >= 0, `${st.agent.id}: route touches its lane x=${lane}`);
    const rest = path.slice(first);
    assert.ok(rest.length >= 2 && Math.abs(rest[rest.length - 1].x - st.away.x) < 1e-6 && Math.abs(rest[rest.length - 1].y - st.away.y) < 1e-6, 'ends at the standing arrival point');
    assert.ok(rest.slice(0, -1).every(p => Math.abs(p.x - lane) < 1e-6), `${st.agent.id}: stays in the lane until the last step into the bag`);
    const back = route(room, st, st.away, st.seat);
    assert.ok(back.length >= 2 && Math.abs(back[0].x - lane) < 1e-6, 'leaving a bag first steps into the lane');
  }
});

for (const n of [1, 3, 4, 5, 6, 7, 10, 16]) {
  test(`manager walks to its beanbag and back without entering any member desk (N=${n})`, () => {
    const start = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(start, 'away');
    const out = walk(away, away, advance({}, start, 100), 40_000);
    const back = walk(start, start, out.actors, 40_000);
    for (const { trail, layout } of [out, back]) {
      const room = layout.rooms[0], lead = room.stations[0];
      for (const p of trail[lead.agent.id]) for (const o of room.stations) if (o !== lead) assert.ok(!strictlyInside(p, room.obstacles[room.stations.indexOf(o)]), `manager at (${p.x.toFixed(0)},${p.y.toFixed(0)}) inside the desk of ${o.agent.id}`);
    }
  });
}

// VQA-028: 팔 오버레이(소매부터 손까지)는 working·phone·sleeping 모두에서 몸통과 같은 원점·배율·프레임으로 그려진다.
for (const state of ['working', 'phone', 'sleeping'] as const) {
  for (const settle of [0, 130, 380, 910]) {
    test(`VQA-028 (${state}, +${settle}ms): the arm overlay shares the torso's origin, scale and animation frame`, () => {
      const s = snap([group(5, 'g', { state })]);
      const t = trace(s, { actors: advance({}, s, 300 + settle), epoch: 1 });
      for (const st of t.layout.rooms[0].stations) {
        const { back, front, figures } = layersOf(t, st.agent.id);
        const torso = figures.find(f => f.order > back[0].order && f.order < front[0].order)!;
        const arms = t.images.find(i => i.key === armKey(st, state))!;
        assert.ok(arms, `${st.agent.id}: ${armKey(st, state)} is drawn`);
        assert.ok(arms.order > front[0].order, 'over the tabletop');
        assert.ok(Math.abs(arms.dx - torso.dx) < 1e-6 && Math.abs(arms.dy - torso.dy) < 1e-6, `${st.agent.id}: same origin`);
        assert.ok(Math.abs(arms.dw / arms.sw - torso.dw / torso.sw) < 1e-9 && Math.abs(arms.dh / arms.sh - torso.dh / torso.sh) < 1e-9, `${st.agent.id}: same scale`);
        assert.equal(arms.sx, torso.sx, `${st.agent.id}: same animation frame (arms sx ${arms.sx} vs torso sx ${torso.sx})`);
        assert.equal(arms.sy, torso.sy);
        assert.ok(arms.sw <= torso.sw + 1e-6 && arms.sh <= torso.sh + 1e-6, 'the overlay never exceeds the torso cell');
      }
    });
  }
}

test('VQA-028: every arm sheet in the manifest exists, for all seven actors and three seated states, with the same cell size and frame count as the torso sheet', () => {
  const arm = (manifest as any).armOverlays;
  for (const id of ['actor-0', 'actor-1', 'actor-2', 'actor-3', 'actor-4', 'actor-5', 'orchestrator']) for (const state of ['working', 'phone', 'sleeping']) {
    const key = arm[id][state], spec = (assetData as any)[key], body = (assetData as any)[M.actors[id][state]];
    assert.ok(spec?.uri, `${id}.${state} -> ${key}`);
    assert.deepEqual([spec.frameW, spec.frameH, spec.frames, spec.fps], [body.frameW, body.frameH, body.frames, body.fps], `${id}.${state}: arm sheet matches its torso sheet`);
  }
});
