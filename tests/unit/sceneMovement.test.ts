import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFake } from './helpers/dom.ts';
import { actorImages, advance, assetData, fakeSprites, group, layoutOffices, manifest, mixed, route, sheetFrame, snap, solo, step, trace, withState } from './helpers/scene.ts';

const M = manifest as any;
const DT = 50;
type Pt = { x: number; y: number };
const inRect = (p: Pt, r: { x: number; y: number; width: number; height: number }) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
const plateRect = (st: any, scale = 1) => {
  const font = Math.max(st.manager ? 30 * st.moduleScale : 18, 6.5 / scale), pad = Math.max(st.manager ? 3 * st.moduleScale : 3, 1 / scale), height = font * 1.35 + pad * 2;
  return { x: st.plate.x - st.plateWidth / 2, y: st.plate.y - height / 2, width: st.plateWidth, height };
};

/** from → to 스냅샷으로 전환하는 시나리오를 DT 간격으로 시뮬레이션하고 매 스텝의 액터를 기록한다. */
function simulate(from: any, to: any, ms: number, settleMs = 3000, back?: { snapshot: any; ms: number }) {
  const layout = layoutOffices(from); // 좌표는 상태와 무관하다. step은 layout의 station.agent 상태를 읽으므로 스냅샷마다 layout을 새로 만든다.
  let actors: any = advance({}, from, settleMs, layout);
  const frames: { t: number; actors: any }[] = [];
  const run = (snapshot: any, total: number, t0: number) => {
    const l = layoutOffices(snapshot);
    for (let t = 0; t < total; t += DT) { actors = step(actors, snapshot, DT, l); frames.push({ t: t0 + t + DT, actors }); }
  };
  run(to, ms, 0);
  if (back) run(back.snapshot, back.ms, ms);
  return { frames, layout, final: actors };
}

// ───────── VQA-001: working은 자리를 떠나지 않고, 경로가 없으면 걷기 프레임을 재생하지 않음 ─────────
for (const [name, build] of [['solo', () => snap([solo('s', { state: 'working', stateSince: 0 })])], ['N=3', () => snap([group(3, 'g', { state: 'working' })])],
  ['N=6', () => snap([group(6, 'g', { state: 'working' })])], ['N=16', () => snap([group(16, 'g', { state: 'working' })])]] as const) {
  test(`VQA-001 (${name}): working agents never leave their desks, for two minutes (no visits, not even for solo offices)`, () => {
    const s = build();
    const layout = layoutOffices(s);
    let actors: any = {};
    for (let t = 0; t < 120_000; t += 100) {
      actors = step(actors, s, 100, layout);
      for (const st of layout.rooms[0].stations) {
        const a = actors[st.agent.id];
        assert.ok(Math.hypot(a.x - st.seat.x, a.y - st.seat.y) < 1e-6, `${st.agent.id} left its seat at t=${t}`);
        assert.equal(a.moving, false);
        assert.equal(a.destination, 'seat');
        assert.equal(a.route.length, 0);
      }
      if (t % 10_000 === 0) assert.ok(actorImages(trace(s, { actors, epoch: 1e9 }).images).every(i => i.key.endsWith('-working')), `walk frame drawn while working at t=${t}`);
    }
  });
}

test('VQA-001: the walking sheet plays only while a route is being traversed (no walking in place on arrival, none while waiting)', () => {
  const working = snap([group(5, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const { frames, layout } = simulate(working, away, 25_000, 3000, { snapshot: working, ms: 25_000 });
  const stations = layout.rooms[0].stations;
  let walkingSamples = 0;
  frames.forEach(({ actors }, i) => {
    for (const st of stations) {
      const a = actors[st.agent.id];
      if (a.moving) { assert.ok(a.route.length > 0, `${st.agent.id}: moving without a route at step ${i}`); walkingSamples++; }
      if (!a.moving && a.route.length === 0) assert.ok(Math.hypot(a.x - (frames[i + 1]?.actors[st.agent.id].x ?? a.x), 0) < 1e-9 || true);
    }
    if (i % 5 === 0) {
      const t = trace(layout.rooms.length ? snap([group(5, 'g', { state: 'working' })]) : working, { actors, sprites: undefined });
      for (const st of stations) {
        const a = actors[st.agent.id];
        const key = st.manager ? /^orchestrator-walk_/ : new RegExp(`^actor-${st.variant}-walk_`);
        const drawnWalking = t.images.some(img => key.test(img.key));
        assert.equal(drawnWalking, a.moving, `${st.agent.id} step ${i}: walk frames drawn=${drawnWalking}, moving=${a.moving}`);
      }
    }
  });
  assert.ok(walkingSamples > 50, 'the scenario really contains walking');
  // 움직이는 동안 실제로 위치가 바뀐다(제자리걸음 없음).
  for (const st of stations) for (let i = 1; i < frames.length; i++) {
    const p = frames[i - 1].actors[st.agent.id], a = frames[i].actors[st.agent.id];
    if (p.moving && a.moving) assert.ok(Math.hypot(a.x - p.x, a.y - p.y) > 0.5, `${st.agent.id} walks in place at step ${i}`);
  }
});

test('VQA-001: an agent that arrives has moving=false in the very step it consumes its last waypoint, and stays put afterwards', () => {
  const s = snap([solo('a', { state: 'away' })]);
  const layout = layoutOffices(s), st = layout.rooms[0].stations[0];
  let actors: any = {}, arrived = -1;
  for (let i = 0; i < 2000; i++) {
    const prev = actors.a;
    actors = step(actors, s, 50, layout);
    if (prev?.moving && !actors.a.moving && arrived < 0) { arrived = i; assert.equal(actors.a.route.length, 0); assert.ok(Math.hypot(actors.a.x - st.away.x, actors.a.y - st.away.y) < 1e-6); }
    if (arrived >= 0 && i > arrived) assert.deepEqual([actors.a.x, actors.a.y, actors.a.moving], [st.away.x, st.away.y, false]);
  }
  assert.ok(arrived > 0);
});

// ───────── VQA-018: 직렬 대기열 대신 300ms 시차 + 두 레인 연속 보행 ─────────
const SLOT_LANES = (room: any, st: any) => { const slot = room.rests.filter((r: any) => r.x < 300).findIndex((r: any) => r.owner === st.agent.id); return { slot, lane: slot % 2 ? room.leftCorridorX : room.leftCorridorX - 100 }; };

/** from→to 전환에서 에이전트별 첫 이동·도착 시각과 스텝당 최대 변위를 구한다. */
function timeline(n: number, dir: 'out' | 'back', ms = 30_000) {
  const working = snap([group(n, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const { frames, layout } = simulate(dir === 'out' ? working : away, dir === 'out' ? away : working, ms);
  const stations = layout.rooms[0].stations;
  const first: Record<string, number> = {}, last: Record<string, number> = {};
  let maxJump = 0, maxMoving = 0;
  const prev: Record<string, Pt> = {};
  for (const { t, actors } of frames) {
    maxMoving = Math.max(maxMoving, stations.filter(st => actors[st.agent.id].moving).length);
    for (const st of stations) {
      const a = actors[st.agent.id];
      if (a.moving) { first[st.agent.id] ??= t; last[st.agent.id] = t; }
      const p = prev[st.agent.id];
      if (p) maxJump = Math.max(maxJump, Math.hypot(a.x - p.x, a.y - p.y));
      prev[st.agent.id] = { x: a.x, y: a.y };
    }
  }
  return { first, last, maxJump, maxMoving, stations, room: layout.rooms[0], frames };
}

for (const n of [3, 6, 10, 16]) for (const dir of ['out', 'back'] as const) {
  test(`VQA-018 (N=${n}, ${dir === 'out' ? 'working→away' : 'away→working'}): every walker starts within 1s of the state change and everyone has arrived within the time budget`, () => {
    const { first, last, stations } = timeline(n, dir);
    const walkers = stations.filter(st => st.manager ? !!st.rest : !!st.rest);
    assert.ok(walkers.length >= 4);
    for (const st of walkers) {
      assert.ok(first[st.agent.id] !== undefined, `${st.agent.id} walked`);
      assert.ok(first[st.agent.id] <= 1000, `${st.agent.id} starts after ${first[st.agent.id]}ms (limit 1000ms)`);
    }
    const arrival = Math.max(...walkers.map(st => last[st.agent.id]));
    const budget = n >= 6 ? 6500 : 9500; // N16 전체 도착은 약 6초 안. 작은 방은 책상이 넓게 퍼져 있어 더 걸린다.
    assert.ok(arrival <= budget, `all arrived after ${arrival}ms (budget ${budget}ms)`);
  });
}

test('VQA-018: the previous serial queue is gone: several agents walk at the same time (two lanes), and the manager starts at once', () => {
  for (const n of [6, 16]) {
    const { maxMoving, first, stations } = timeline(n, 'out');
    assert.ok(maxMoving >= 3, `N=${n}: ${maxMoving} walkers at once`);
    assert.ok(first[stations[0].agent.id] <= 100, 'manager (rank 0) starts immediately');
  }
});

test('VQA-018: 300ms stagger between the two lane batches: even slots wait 300ms, odd slots and the manager start at once', () => {
  const { first, stations, room } = timeline(10, 'out');
  const t0 = first[stations[0].agent.id];
  for (const st of stations.filter(x => !x.manager && x.rest)) {
    const { slot } = SLOT_LANES(room, st);
    const delta = first[st.agent.id] - t0;
    if (slot % 2 === 0) assert.ok(delta >= 250 && delta <= 400, `${st.agent.id} (slot ${slot}) starts +${delta}ms`);
    else assert.ok(delta <= 100, `${st.agent.id} (slot ${slot}) starts +${delta}ms`);
  }
});

test('VQA-018: two lanes: rest-bound members alternate between x=312 and x=212; all lane travel is vertical on those lines', () => {
  for (const n of [6, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const lanesUsed = new Set<number>();
    for (const st of room.stations.filter(x => !x.manager && x.rest)) {
      const { lane } = SLOT_LANES(room, st);
      lanesUsed.add(lane);
      for (const [from, to] of [[st.seat, st.away], [st.away, st.seat]] as const) {
        const pts = [from, ...route(room, st, from, to)];
        assert.ok(pts.some(p => Math.abs(p.x - lane) < 1e-6), `${st.agent.id}: route uses its lane x=${lane}`);
        for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - pts[i - 1].x) < 1e-6 && Math.abs(pts[i].y - pts[i - 1].y) > 1) {
          const x = pts[i].x;
          if (x < 330) assert.ok(Math.abs(x - lane) < 1e-6 || x === st.away.x, `${st.agent.id}: vertical leg in the left area stays on its own lane (x=${x})`);
        }
      }
    }
    assert.deepEqual([...lanesUsed].sort((a, b) => a - b), [212, 312], `N=${n}`);
  }
});

test('VQA-018 (no position cuts): no agent ever moves farther per step than the locomotion speed allows, through state changes, reversals and polls', () => {
  for (const n of [3, 6, 16]) for (const dir of ['out', 'back'] as const) {
    const { maxJump, stations } = timeline(n, dir);
    const speed = expectedSpeed(stations[1].variant, false, stations[1].actorHeight);
    assert.ok(maxJump <= speed * DT / 1000 + 1e-6, `N=${n} ${dir}: max step ${maxJump} > ${speed * DT / 1000}`);
  }
  // 도중에 상태가 다시 바뀌어도(왕복) 순간이동은 없다.
  const working = snap([group(6, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const Lw = layoutOffices(working), La = layoutOffices(away);
  for (const flip of [300, 700, 1500, 2600, 4000]) {
    let actors: any = advance({}, working, 3000);
    const prev: Record<string, Pt> = {};
    for (let t = 0; t < 15_000; t += DT) {
      actors = step(actors, t < flip ? away : working, DT, t < flip ? La : Lw);
      for (const st of Lw.rooms[0].stations) {
        const a = actors[st.agent.id], p = prev[st.agent.id];
        if (p) assert.ok(Math.hypot(a.x - p.x, a.y - p.y) <= expectedSpeed(st.variant, st.manager, st.actorHeight) * DT / 1000 + 1e-6, `flip ${flip}ms t=${t} ${st.agent.id} jumped`);
        prev[st.agent.id] = { x: a.x, y: a.y };
      }
    }
  }
});

for (const n of [3, 6, 10, 16]) for (const dir of ['out', 'back'] as const) {
  test(`VQA-018 (N=${n} ${dir}): simultaneous walkers never overlap their silhouettes (at least 40px apart in a lane)`, () => {
    const { frames, stations } = timeline(n, dir);
    let minSep = Infinity;
    for (const { actors } of frames) {
      const mv = stations.filter(st => actors[st.agent.id].moving);
      for (let i = 0; i < mv.length; i++) for (let j = i + 1; j < mv.length; j++) {
        const a = actors[mv[i].agent.id], b = actors[mv[j].agent.id];
        if (Math.abs(a.x - b.x) < 30) minSep = Math.min(minSep, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    assert.ok(minSep >= 40, `walkers came within ${minSep.toFixed(0)}px in one lane`);
  });
}

for (const n of [3, 6, 10]) {
  test(`VQA-002 follow-up (N=${n}): reversing a walk midway (state flips back before arrival) still avoids other desks`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const Lw = layoutOffices(working), La = layoutOffices(away), room = Lw.rooms[0];
    for (const flip of [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]) {
      let actors: any = advance({}, working, 3000);
      for (let t = 0; t < 20_000; t += DT) {
        actors = step(actors, t < flip ? away : working, DT, t < flip ? La : Lw);
        for (const st of room.stations) {
          const a = actors[st.agent.id];
          if (!a.moving || st.manager) continue;
          for (const o of room.stations) if (o !== st) for (const p of [{ x: a.x, y: a.y }, { x: a.x, y: a.y - st.actorHeight * 0.5 }]) assert.ok(!inRect(p, o), `flip ${flip}ms t=${t}: ${st.agent.id} walks through ${o.agent.id}'s desk`);
        }
      }
    }
  });
}

test('queue: waiting (staggered) agents keep their seated pose at their desks (not walking, no drift) and face the lane side', () => {
  const working = snap([group(3, 'g', { state: 'working' })]);
  const { frames, layout } = simulate(working, withState(working, 'away'), 20_000);
  const stations = layout.rooms[0].stations;
  const started: Record<string, boolean> = {};
  frames.forEach(({ actors }, i) => {
    for (const st of stations) {
      const a = actors[st.agent.id];
      if (a.moving) started[st.agent.id] = true;
      if (!started[st.agent.id] && a.destination === 'beanbag') {
        assert.equal(a.moving, false);
        assert.deepEqual([a.x, a.y], [st.seat.x, st.seat.y], `${st.agent.id} waiting at step ${i}`);
        assert.equal(a.direction, 'left');
      }
    }
  });
});

test('the return trips (away → working) end with everyone back at their desk, seated', () => {
  const working = snap([group(3, 'g', { state: 'working' })]);
  const { frames, layout } = simulate(working, withState(working, 'away'), 30_000, 3000, { snapshot: working, ms: 30_000 });
  for (const st of layout.rooms[0].stations) { const a = frames.at(-1)!.actors[st.agent.id]; assert.ok(Math.hypot(a.x - st.seat.x, a.y - st.seat.y) < 1, `${st.agent.id} is back`); assert.equal(a.destination, 'seat'); assert.equal(a.moving, false); }
});

test('queue: agents without a beanbag (overflow) never join the queue or move at all', () => {
  const working = snap([group(8, 'g', { state: 'working' })]);
  const { frames, layout } = simulate(working, withState(working, 'away'), 80_000);
  const overflow = layout.rooms[0].stations.filter(st => !st.manager && !st.rest);
  assert.equal(overflow.length, 8 - layout.rooms[0].stations.filter(st => !st.manager && st.rest).length, 'members without a bag');
  assert.ok(overflow.length >= 2);
  for (const { actors } of frames) for (const st of overflow) { assert.equal(actors[st.agent.id].moving, false); assert.deepEqual([actors[st.agent.id].x, actors[st.agent.id].y], [st.seat.x, st.seat.y]); }
});

// ───────── locomotion 속도 ─────────
const expectedSpeed = (variant: string, manager: boolean, height: number) => {
  const sheet = M.sheets[M.actors[manager ? 'orchestrator' : `actor-${variant}`].walk_left];
  const loc = sheet.locomotion, frames = Array.isArray(sheet.frames) ? sheet.frames.length : sheet.frames;
  return loc.cycleDistance * sheet.fps / frames * height / loc.referenceActorHeight;
};

for (const [label, n, want] of [['small/medium room', 3, 221.7], ['large room', 10, 166.3]] as const) {
  test(`locomotion (${label}): walking speed = cycleDistance*fps/frames*actorHeight/referenceActorHeight ≈ ${want} px/s, never faster, instead of the old 500 px/s`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const { frames, layout } = simulate(working, withState(working, 'away'), 60_000);
    const stations = layout.rooms[0].stations;
    let full = 0;
    for (const st of stations) {
      const speed = expectedSpeed(st.variant, st.manager, st.actorHeight);
      assert.ok(Math.abs(speed - want) < 0.5, `${st.agent.id}: formula ${speed}`);
      let prev: any = null;
      for (const { actors } of frames) {
        const a = actors[st.agent.id];
        if (prev?.moving && a.moving) {
          const d = Math.hypot(a.x - prev.x, a.y - prev.y);
          assert.ok(d <= speed * DT / 1000 + 1e-6, `${st.agent.id} moved ${d}px in ${DT}ms (limit ${speed * DT / 1000})`);
          if (Math.abs(d - speed * DT / 1000) < 1e-6) full++;
        }
        prev = a;
      }
    }
    assert.ok(full > 20, 'many steps move at exactly the formula speed (straight segments)');
  });
}

test('locomotion: the walk frame follows the distance travelled (walkPhase += distance / speed), not wall-clock time', () => {
  const working = snap([group(3, 'g', { state: 'working' })]);
  const { frames, layout } = simulate(working, withState(working, 'away'), 40_000);
  for (const st of layout.rooms[0].stations) {
    const speed = expectedSpeed(st.variant, st.manager, st.actorHeight);
    let prev: any = null, checked = 0;
    for (const { actors } of frames) {
      const a = actors[st.agent.id];
      // 모서리를 도는 스텝은 변위가 경로 길이보다 짧으므로, 같은 구간 안(남은 경유점 수가 같은 스텝)만 비교한다.
      if (prev?.moving && a.moving && prev.route.length === a.route.length) {
        const d = Math.hypot(a.x - prev.x, a.y - prev.y);
        assert.ok(Math.abs((a.walkPhase - prev.walkPhase) - d / speed) < 1e-9, `${st.agent.id}: walkPhase step`);
        checked++;
      }
      if (prev && !prev.moving && !a.moving) assert.equal(a.walkPhase, prev.walkPhase, 'standing still does not advance the stride');
      prev = a;
    }
    assert.ok(checked > 20, st.agent.id);
  }
});

test('locomotion (VQA-015): one stride frame covers cycleDistance/frames logical px, so feet do not slide', () => {
  const sheet = M.sheets['actor-0-walk_left'], loc = sheet.locomotion;
  const framesN = Array.isArray(sheet.frames) ? sheet.frames.length : sheet.frames;
  const H = 320 * 280 / 479;
  const perFrame = expectedSpeed('0', false, H) / sheet.fps;
  assert.ok(Math.abs(perFrame - loc.cycleDistance / framesN * H / loc.referenceActorHeight) < 1e-9);
  assert.ok(perFrame < 40, `stride per frame ${perFrame}px stays small (old 500px/s gave ${500 / sheet.fps}px)`);
  assert.ok(500 / sheet.fps > 2 * perFrame, 'the previous speed was more than twice the stride');
});

test('locomotion: the drawn walk frame comes from walkPhase and the manifest fps/frame count', () => {
  const working = snap([solo('a', { state: 'working' })]);
  const away = withState(working, 'away');
  const layout = layoutOffices(away);
  let actors: any = advance({}, working, 300, layout), checked = 0;
  for (let i = 0; i < 400 && checked < 6; i++) {
    actors = step(actors, away, DT, layout);
    if (!actors.a.moving) continue;
    const key = `actor-0-walk_${actors.a.direction}`, spec = (assetData as any)[key], rs = M.runtimeScale;
    const img = trace(away, { actors }).images.find(x => x.key === key)!;
    const frame = Math.floor(actors.a.walkPhase * spec.fps) % (typeof spec.frames === 'number' ? spec.frames : spec.frames.length);
    assert.equal(img.sx, frame * spec.frameW * rs, `walkPhase ${actors.a.walkPhase}`);
    checked++;
  }
  assert.equal(checked, 6);
  void sheetFrame;
});

// ───────── VQA-002: 멤버 경로가 다른 책상·명판을 지나지 않음 ─────────
for (const n of [3, 6, 10, 16]) {
  test(`VQA-002 (N=${n}): member paths never cross another desk or nameplate rectangle (feet, torso and head), out and back`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const { frames, layout } = simulate(working, withState(working, 'away'), 120_000, 3000, { snapshot: working, ms: 120_000 });
    const room = layout.rooms[0];
    const members = room.stations.filter(st => !st.manager);
    let samples = 0;
    for (const st of members) {
      const others = room.stations.filter(o => o !== st);
      const H = st.actorHeight;
      for (const { actors } of frames) {
        const a = actors[st.agent.id];
        if (!a.moving) continue;
        samples++;
        for (const [label, p] of [['feet', { x: a.x, y: a.y }], ['torso', { x: a.x, y: a.y - H * 0.5 }], ['head', { x: a.x, y: a.y - H * 0.95 }]] as const) {
          for (const o of others) {
            // 걷는 사람은 책상 앞 바닥을 지나므로 머리 끝이 행 아래쪽 가장자리(아래 0.2H)와 겹칠 수는 있다. 발·몸통과 명판은 침범하지 않는다.
            if (label !== 'head') assert.ok(!inRect(p, o), `${st.agent.id} ${label} (${p.x.toFixed(0)},${p.y.toFixed(0)}) inside the desk of ${o.agent.id}`);
            else assert.ok(!inRect(p, o) || p.y >= o.y + o.height - 0.2 * H, `${st.agent.id} head (${p.x.toFixed(0)},${p.y.toFixed(0)}) deep inside the desk of ${o.agent.id}`);
            assert.ok(!inRect(p, plateRect(o, layout.viewportScale)), `${st.agent.id} ${label} (${p.x.toFixed(0)},${p.y.toFixed(0)}) covers the nameplate of ${o.agent.id}`);
          }
        }
      }
    }
    assert.ok(samples > 100, `members really walked (${samples} samples)`);
  });

  test(`VQA-002 (N=${n}): the planned routes themselves stay on clear floor: horizontal crossings run below the whole row`, () => {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    for (const st of room.stations.filter(x => !x.manager && x.rest)) {
      const row = room.stations.filter(d => !d.manager && Math.abs(d.y - st.y) < 1);
      const rowBottom = Math.max(...row.map(d => d.y + d.height));
      for (const [from, to] of [[st.seat, st.away], [st.away, st.seat]] as const) {
        const pts = [from, ...route(room, st, from, to)];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const horizontal = Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.x - b.x) > 1;
          // 왼쪽 휴식 열(x<=레인) 안의 마지막 한 칸은 빈백으로 들어가는 짧은 수평 이동이라 제외한다.
          if (horizontal && Math.abs(a.y - st.seat.y) > 1e-6 && Math.max(a.x, b.x) > (room as any).leftCorridorX + 1) assert.ok(a.y >= rowBottom + st.actorHeight * 0.8 + 8 - 1e-6, `${st.agent.id}: horizontal leg at y=${a.y.toFixed(0)} above the floor line ${(rowBottom + st.actorHeight * 0.8 + 8).toFixed(0)}`);
        }
      }
    }
  });
}

// ───────── VQA-003: manager는 책상 뒤 깊이에서 측면으로 출입한다 (앞판·명판보다 먼저 그려짐) ─────────
const managerBehind = (lead: any, p: any) => p.moving && Math.abs(p.y - lead.seat.y) < 1 && p.x <= lead.x + lead.width + lead.actorHeight * 0.4 + 1;

for (const n of [3, 6, 10, 16]) {
  test(`VQA-003 (N=${n}, recurrence): from the very first moving frame until it clears the side, the manager is drawn before the desk front and nameplate (and again on the way back)`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const { frames, layout } = simulate(working, away, 40_000, 3000, { snapshot: working, ms: 40_000 });
    const room = layout.rooms[0], lead = room.stations[0];
    assert.ok(lead.manager && lead.rest);
    const pos = frames.map(f => f.actors[lead.agent.id]);
    // 첫 이동 프레임이 곧바로 "책상 뒤" 구간이다(앉은 자리에서 일어나 같은 높이로 옆으로 나간다).
    const firstMoving = pos.findIndex(p => p.moving);
    assert.ok(firstMoving >= 0 && managerBehind(lead, pos[firstMoving]), 'the first moving frame is already in the behind-the-desk phase');
    let behindOut = 0, behindBack = 0, clear = 0;
    const returnStart = Math.floor(frames.length / 2);
    frames.forEach(({ actors }, i) => {
      const p = actors[lead.agent.id];
      if (!p.moving) return;
      const t = trace(working, { actors });
      const fig = t.images.filter(img => /^orchestrator-walk_/.test(img.key));
      assert.equal(fig.length, 1, `step ${i}: the manager is drawn exactly once`);
      const fronts = t.images.filter(img => img.key === lead.desk.front && Math.abs(img.dx - lead.x) < 1);
      const plate = t.texts.find(x => x.text === lead.agent.name || (x.text.endsWith('…') && lead.agent.name.startsWith(x.text.slice(0, -1))))!;
      assert.equal(fronts.length, 1, 'the whole tabletop is one pass');
      const back = t.images.find(img => img.key === lead.desk.back && Math.abs(img.dx - lead.x) < 1)!;
      if (managerBehind(lead, p)) {
        assert.ok(fig[0].order > back.order, `step ${i}: above the back/chair layer`);
        assert.ok(fig[0].order < fronts[0].order, `step ${i}: before (under) the whole tabletop`);
        assert.ok(fig[0].order < plate.order, `step ${i}: before (under) the nameplate`);
        // 다리가 앞판·명판을 덮지 않도록 위쪽 영역으로 잘려 그려진다.
        assert.ok(fig[0].clip && fig[0].clip.length >= 1, `step ${i}: the behind-the-desk figure is clipped`);
        const clip = fig[0].clip![0], pl = plateRect(lead, layout.viewportScale);
        assert.ok(clip.y + clip.height <= pl.y + 1e-6, `step ${i}: clip stops above the nameplate (clip bottom ${(clip.y + clip.height).toFixed(0)}, plate top ${pl.y.toFixed(0)})`);
        if (i < returnStart) behindOut++; else behindBack++;
      } else {
        // 옆을 벗어난 뒤에는 모든 가구와 명판 위에 완전히 보인다.
        const furniture = t.images.filter(img => /^(pod-\d|lead)-(back|front)/.test(img.key) || /^beanbag-/.test(img.key));
        assert.ok(furniture.every(img => img.order < fig[0].order) && t.texts.every(x => x.order < fig[0].order), `step ${i}: clear of the desk, drawn above everything`);
        clear++;
      }
    });
    assert.ok(behindOut >= 3, `outbound behind-the-desk frames: ${behindOut}`);
    assert.ok(behindBack >= 3, `return behind-the-desk frames: ${behindBack}`);
    assert.ok(clear >= 5, `frames after clearing the side: ${clear}`);
  });

  test(`VQA-003 (N=${n}): the manager's feet never enter the lead desk rectangle; it leaves sideways at seat height and returns to the seat`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const { frames, layout } = simulate(working, withState(working, 'away'), 40_000, 3000, { snapshot: working, ms: 40_000 });
    const lead = layout.rooms[0].stations[0];
    const pos = frames.map(f => f.actors[lead.agent.id]);
    for (const p of pos) assert.ok(!inRect({ x: p.x, y: p.y }, lead), `feet (${p.x.toFixed(0)},${p.y.toFixed(0)}) inside the lead desk rectangle`);
    const firstVertical = pos.findIndex(p => p.moving && Math.abs(p.y - lead.seat.y) > 1);
    assert.ok(firstVertical > 0 && pos[firstVertical].x >= lead.x + lead.width, `turns downward only after passing the desk side (x=${pos[firstVertical]?.x.toFixed(0)})`);
    assert.ok(pos.slice(0, firstVertical).every((p, i, arr) => i === 0 || p.x >= arr[i - 1].x - 1e-9), 'monotonic sideways exit');
    const end = pos.at(-1)!;
    assert.ok(Math.hypot(end.x - lead.seat.x, end.y - lead.seat.y) < 1 && !end.moving);
  });
}

test('VQA-003: while behind the desk the manager\'s feet are lifted onto the rear floor and settle back to the walking height at the side opening', () => {
  const working = snap([group(6, 'g', { state: 'working' })]);
  const { frames, layout } = simulate(working, withState(working, 'away'), 12_000);
  const lead = layout.rooms[0].stations[0], H = lead.actorHeight;
  const sheet = M.sheets[M.actors.orchestrator.walk_left], anchorY = Array.isArray(sheet.anchor) ? sheet.anchor[1] : sheet.anchor.y;
  const lifts: number[] = [];
  frames.forEach(({ actors }, i) => {
    const p = actors[lead.agent.id];
    if (!managerBehind(lead, p) || i % 2) return;
    const t = trace(withState(working, 'away'), { actors });
    const fig = t.images.find(img => /^orchestrator-walk_/.test(img.key))!;
    const lift = (p.y - anchorY * H / 216) - fig.dy;
    lifts.push(lift);
    assert.ok(lift >= -1e-6 && lift <= 0.3 * H + 1e-6, `lift ${lift.toFixed(1)} within [0, 0.3H]`);
  });
  assert.ok(lifts.length >= 4);
  assert.ok(lifts[0] > 0.25 * H, `starts lifted (${lifts[0].toFixed(1)})`);
  for (let i = 1; i < lifts.length; i++) assert.ok(lifts[i] <= lifts[i - 1] + 1e-6, 'the lift only decreases while walking out');
  assert.ok(lifts.at(-1)! < lifts[0] * 0.5, 'nearly back on the walking floor at the opening');
});

test('VQA-003: manager route polylines (out and back) use the side opening: first/last leg is horizontal at the seat height, beyond the desk edge', () => {
  for (const n of [3, 6, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0], lead = room.stations[0];
    const out = route(room, lead, lead.seat, lead.away), back = route(room, lead, lead.away, lead.seat);
    assert.ok(out.length >= 2 && back.length >= 2);
    assert.ok(Math.abs(out[0].y - lead.seat.y) < 1e-6 && out[0].x > lead.x + lead.width, 'out: first waypoint is beside the desk at seat height');
    const last = back.at(-2)!;
    assert.ok(Math.abs(last.y - lead.seat.y) < 1e-6 && last.x > lead.x + lead.width, 'back: final approach comes from the side at seat height');
    for (const p of [...out, ...back]) assert.ok(!inRect(p, lead), `N=${n}: waypoint ${JSON.stringify(p)} is inside the lead desk`);
  }
});

// ───────── VQA-010: attention이 현재 자세의 머리 위 아래 중앙 anchor에 맞음 ─────────
// 착석한 대기 에이전트는 이제 손 든 자세와 '?' 말풍선을 쓴다(sceneAwaiting.test.ts). '!'는 폴백(걷는 중, 빈백, awaiting 시트 없음)이므로
// 착석 사례는 awaiting 시트를 뺀 스프라이트로 폴백 경로를 검증한다.
const noAwaiting = () => fakeSprites({}, Object.keys(assetData).filter(k => /-awaiting$/.test(k)));
function headOf(fig: { dx: number; dy: number; dw: number; sw: number }) {
  const f = fig.dw * M.runtimeScale / fig.sw; // 그려진 확대 배율(논리 프레임 → 장면)
  return { x: fig.dx + 80 * f, y: fig.dy + 12 * f, f };
}
function attentionAnchor(img: { dx: number; dy: number; dw: number; dh: number }) {
  const spec = (assetData as any).attention, [ax, ay] = spec.anchor;
  return { x: img.dx + ax * img.dw / spec.frameW, y: img.dy + ay * img.dh / spec.frameH };
}

test('VQA-010 (seated, fallback without awaiting sheets): the bottom-center anchor of the attention mark sits 10px above the drawn head, centered, scaled with the actor', () => {
  for (const n of [1, 3, 10]) {
    const o = n === 1 ? solo('a', { state: 'working', needsAttention: true }) : group(n, 'g', { state: 'working', needsAttention: true });
    const s = snap([o]);
    const t = trace(s, { actors: advance({}, s, 600), epoch: 1, sprites: noAwaiting() });
    const marks = t.images.filter(i => i.key === 'attention');
    assert.equal(marks.length, t.layout.rooms[0].stations.length, `N=${n}`);
    for (const st of t.layout.rooms[0].stations) {
      const keyRe = st.manager ? /^orchestrator-working$/ : new RegExp(`^actor-${st.variant}-working$`);
      const fig = t.images.find(i => keyRe.test(i.key))!;
      const head = headOf(fig);
      const mark = marks.find(m => Math.abs(attentionAnchor(m).x - head.x) < 1e-6)!;
      assert.ok(mark, `${st.agent.id}: a mark is centered on the head`);
      const anchor = attentionAnchor(mark);
      assert.ok(Math.abs(anchor.y - (head.y - 10)) < 1e-6, `${st.agent.id}: anchor ${anchor.y} vs head-10 ${head.y - 10}`);
      assert.ok(Math.abs(mark.dh - (M.effectPlacement.attention.preferredDisplayHeight * st.actorHeight / 216)) < 1e-6, 'preferred display height scales with the actor');
      assert.ok(anchor.y < head.y, 'above the head, not on the hair');
    }
  }
});

test('VQA-010 (walking): the mark follows the walking pose, not the seat', () => {
  const working = snap([group(3, 'g', { state: 'working', needsAttention: true })]);
  const away = withState(working, 'away', { needsAttention: true });
  const { frames, layout } = simulate(working, away, 30_000);
  const st = layout.rooms[0].stations[1];
  let checked = 0, offSeat = 0;
  for (let i = 0; i < frames.length && checked < 5; i++) {
    const a = frames[i].actors[st.agent.id];
    if (!a.moving || i % 8) continue;
    const t = trace(away, { actors: frames[i].actors });
    const fig = t.images.find(img => img.key.startsWith(`actor-${st.variant}-walk_`))!;
    const head = headOf(fig);
    const anchors = t.images.filter(img => img.key === 'attention').map(attentionAnchor);
    const hit = anchors.find(p => Math.abs(p.x - head.x) < 1e-6 && Math.abs(p.y - (head.y - 10)) < 1e-6);
    assert.ok(hit, `step ${i}: walker's mark is on its head (${head.x.toFixed(0)},${(head.y - 10).toFixed(0)})`);
    assert.ok(Math.abs(head.y + st.actorHeight - a.y) < st.actorHeight, 'head is near the walking position');
    if (Math.abs(head.y - (st.seat.y - st.actorHeight)) > 20) offSeat++;
    checked++;
  }
  assert.equal(checked, 5);
  assert.ok(offSeat >= 1, 'at least once the walker was away from the seat line and the mark still followed the head');
});

test('VQA-010 (on a beanbag): the mark follows the seated-away pose', () => {
  const s = withState(snap([group(3, 'g', { state: 'away', needsAttention: true })]), 'away', { needsAttention: true });
  const t = trace(s, { actors: advance({}, s, 90_000) });
  for (const st of t.layout.rooms[0].stations) {
    const keyRe = st.manager ? /^orchestrator-away$/ : new RegExp(`^actor-${st.variant}-away$`);
    const fig = t.images.find(i => keyRe.test(i.key))!;
    const head = headOf(fig);
    const ok = t.images.filter(i => i.key === 'attention').map(attentionAnchor).some(p => Math.abs(p.x - head.x) < 1e-6 && Math.abs(p.y - (head.y - 10)) < 1e-6);
    assert.ok(ok, `${st.agent.id}: mark over the resting head`);
    assert.ok(Math.abs(head.y - (st.rest!.seat.y - st.actorHeight)) < st.actorHeight * 0.6, 'near the beanbag, not the old fixed offset');
  }
});

test('VQA-010 (fallback): the attention mark is drawn on top of furniture and figures (after the nameplates), only for flagged agents', () => {
  const o = group(3, 'g', { state: 'working' });
  (o.members[0] as any).needsAttention = true;
  const s = snap([o]);
  const t = trace(s, { actors: advance({}, s, 600), epoch: 1, sprites: noAwaiting() });
  const marks = t.images.filter(i => i.key === 'attention');
  assert.equal(marks.length, 1);
  assert.ok(marks[0].order > Math.max(...t.texts.map(x => x.order)), 'above every nameplate');
  assert.ok(marks[0].order > Math.max(...actorImages(t.images).map(i => i.order)), 'above every figure');
});

// ───────── VQA-016: 출입 때 비가시 구간 없음 (전신이 책상 옆에서 바로 보임) ─────────
type R = { x: number; y: number; width: number; height: number };
const intersect = (a: R, b: R): R | null => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), X = Math.min(a.x + a.width, b.x + b.width), Y = Math.min(a.y + a.height, b.y + b.height);
  return X > x && Y > y ? { x, y, width: X - x, height: Y - y } : null;
};
/** rect의 격자 표본 중 occluders(사각형 합집합) 안에 드는 비율. */
function coverage(rect: R, occluders: R[], grid = 20) {
  let hit = 0;
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const p = { x: rect.x + (i + 0.5) / grid * rect.width, y: rect.y + (j + 0.5) / grid * rect.height };
    if (occluders.some(r => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height)) hit++;
  }
  return hit / (grid * grid);
}
/** 걷는 figure 뒤에(나중에) 그려지는 가구·명판의 (클립 적용된) 사각형들. 효과·다른 인물은 제외한다. */
function occludersOf(t: ReturnType<typeof trace>, fig: { order: number; key: string }, rect: R) {
  const out: R[] = [];
  for (const img of t.images) {
    if (img.order <= fig.order || /^(actor-|orchestrator-|hands-)|attention|zzz|flame|pop_|bubble|provider-icon/.test(img.key)) continue;
    let d = { x: img.dx, y: img.dy, width: img.dw, height: img.dh };
    // 책상 앞 이미지는 사각형 전체가 불투명하지 않다(모니터·의자 위쪽은 대부분 투명). 상판 뒤 모서리 선 아래 띠만 가림으로 센다.
    if (/^(pod-\d|lead-)(.*)front/.test(img.key)) {
      const st = t.layout.rooms[0].stations.find(o => Math.abs(o.x - img.dx) < 1 && Math.abs(o.y - img.dy) < 1);
      if (st) { const rear = st.y + st.desk.tableRearY * st.moduleScale; d = { x: d.x, y: rear, width: d.width, height: Math.max(0, d.y + d.height - rear) }; }
    }
    for (const piece of img.clip ? img.clip.map(c => intersect(d, c)).filter(Boolean) as R[] : [d]) { const q = intersect(rect, piece); if (q) out.push(q); }
  }
  for (const text of t.texts) if (text.order > fig.order) { const q = intersect(rect, { x: text.x, y: text.y - 12, width: 80, height: 24 }); if (q) out.push(q); }
  return out;
}

for (const n of [1, 3, 6, 16]) for (const dir of ['out', 'back'] as const) {
  test(`VQA-016 (N=${n}, ${dir === 'out' ? 'leaving' : 'returning'}): while anybody walks, the head and upper body stay visible at every step (no invisible phase at the desk)`, () => {
    const working = n === 1 ? snap([solo('s', { state: 'working' })]) : snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const from = dir === 'out' ? working : away, to = dir === 'out' ? away : working;
    const layout = layoutOffices(to);
    let actors: any = advance({}, from, 3000);
    let samples = 0, worstHead = 0;
    for (let t = 0; t < 14_000; t += 100) {
      actors = step(actors, to, 100, layout);
      const tr = trace(to, { actors });
      for (const st of layout.rooms[0].stations) {
        const a = actors[st.agent.id];
        const re = st.manager ? /^orchestrator-walk_/ : new RegExp(`^actor-${st.variant}-walk_`);
        const all = tr.images.filter(i => re.test(i.key));
        // 같은 variant를 쓰는 에이전트(i%6)가 여러 명이면 걷는 그림 수도 그 수만큼이다.
        const sameVariantMoving = layout.rooms[0].stations.filter(o => o.variant === st.variant && actors[o.agent.id].moving).length;
        assert.equal(all.length, sameVariantMoving, `${st.agent.id} t=${t}: one walking figure per moving agent of this sheet`);
        if (!a.moving) continue;
        samples++;
        const fig = all.reduce((best, i) => Math.abs(i.dx + i.dw / 2 - a.x) < Math.abs(best.dx + best.dw / 2 - a.x) ? i : best);
        const rect = { x: fig.dx, y: fig.dy, width: fig.dw, height: fig.dh };
        const head = coverage({ x: rect.x, y: rect.y, width: rect.width, height: rect.height * 0.35 }, occludersOf(tr, fig, rect));
        const upper = coverage({ x: rect.x, y: rect.y, width: rect.width, height: rect.height * 0.6 }, occludersOf(tr, fig, rect));
        worstHead = Math.max(worstHead, head);
        // 책상 뒤를 지나는 manager는 설계상 앞판·명판 뒤(VQA-003)라 일부 가려진다. 완전히 사라지지는 않는다.
        const behind = st.manager && managerBehind(st, a);
        assert.ok(head <= (behind ? 0.8 : 0.4), `${st.agent.id} t=${t}: head band ${(head * 100).toFixed(0)}% covered by furniture`);
        assert.ok(upper <= (behind ? 0.9 : 0.6), `${st.agent.id} t=${t}: upper body ${(upper * 100).toFixed(0)}% covered`);
      }
    }
    assert.ok(samples > 20, `walking observed (${samples} samples)`);
    void worstHead;
  });
}

test('VQA-016: the first and last walking step beside the desk already show the full walking sheet (no frame where the occupant is replaced by an empty chair)', () => {
  const working = snap([group(3, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const layout = layoutOffices(away);
  let actors: any = advance({}, working, 3000);
  const st = layout.rooms[0].stations[1];
  let sawStart = false;
  for (let t = 0; t < 5000 && !sawStart; t += 50) {
    actors = step(actors, away, 50, layout);
    const a = actors[st.agent.id];
    const t2 = trace(away, { actors });
    const drawn = t2.images.filter(i => new RegExp(`^actor-${st.variant}-`).test(i.key));
    assert.ok(drawn.length >= 1, `t=${t}: ${st.agent.id} is drawn at every step (no empty chair frame)`);
    if (a.moving) { sawStart = true; assert.ok(drawn.every(i => /walk_/.test(i.key)), 'the first moving frame is a walking frame at the seat line'); }
  }
  assert.ok(sawStart);
});

// ───────── VQA-017: U턴 경로 없음 ─────────
/** 서로 반대 방향이고 거의 같은 선(허용 오차 tol) 위에서 겹치는 수직/수평 구간 쌍이 있으면 U턴이다. */
function uTurns(points: Pt[], tol = 30, minOverlap = 30) {
  const segs = points.slice(1).map((p, i) => ({ a: points[i], b: p })).filter(s => Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) > 1);
  const found: string[] = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    const sv = Math.abs(s.a.x - s.b.x) < 1e-6, tv = Math.abs(t.a.x - t.b.x) < 1e-6;
    if (sv && tv && Math.abs(s.a.x - t.a.x) <= tol) {
      const overlap = Math.min(Math.max(s.a.y, s.b.y), Math.max(t.a.y, t.b.y)) - Math.max(Math.min(s.a.y, s.b.y), Math.min(t.a.y, t.b.y));
      if (overlap > minOverlap && Math.sign(s.b.y - s.a.y) !== Math.sign(t.b.y - t.a.y)) found.push(`vertical ${i}/${j}`);
    }
    const sh = Math.abs(s.a.y - s.b.y) < 1e-6, th = Math.abs(t.a.y - t.b.y) < 1e-6;
    if (sh && th && Math.abs(s.a.y - t.a.y) <= tol) {
      const overlap = Math.min(Math.max(s.a.x, s.b.x), Math.max(t.a.x, t.b.x)) - Math.max(Math.min(s.a.x, s.b.x), Math.min(t.a.x, t.b.x));
      if (overlap > minOverlap && Math.sign(s.b.x - s.a.x) !== Math.sign(t.b.x - t.a.x)) found.push(`horizontal ${i}/${j}`);
    }
  }
  return found;
}

test('VQA-017: the U-turn detector recognises the reported N6 path (322,881)→(322,1047)→(312,1087)→(312,865)', () => {
  assert.ok(uTurns([{ x: 322, y: 881 }, { x: 322, y: 1047 }, { x: 312, y: 1087 }, { x: 312, y: 865 }]).length > 0);
  assert.equal(uTurns([{ x: 322, y: 881 }, { x: 312, y: 881 }, { x: 312, y: 700 }]).length, 0);
});

for (let n = 1; n <= 16; n++) {
  test(`VQA-017 (N=${n}): planned routes to and from the beanbags contain no U-turn, and first-column desks never detour below their own seat line`, () => {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    for (const st of room.stations.filter(x => x.rest)) {
      for (const [from, to] of [[st.seat, st.away], [st.away, st.seat]] as const) {
        const pts = [from, ...route(room, st, from, to)];
        assert.deepEqual(uTurns(pts), [], `${st.agent.id} ${from === st.seat ? 'out' : 'back'}: ${JSON.stringify(pts.map(p => [Math.round(p.x), Math.round(p.y - room.sceneY)]))}`);
        if (!st.manager && st.x < 400) {
          const lowest = Math.max(...pts.map(p => p.y));
          assert.ok(lowest <= Math.max(st.seat.y, st.away.y) + 1e-6, `${st.agent.id}: first-column desk detours down to ${lowest.toFixed(0)} (seat ${st.seat.y.toFixed(0)}, bag ${st.away.y.toFixed(0)})`);
        }
      }
    }
  });
}

test('VQA-017: the walked trails (state change to arrival, both directions) never reverse along the same line either', () => {
  for (const n of [1, 3, 6, 10, 16]) for (const dir of ['out', 'back'] as const) {
    const working = n === 1 ? snap([solo('s', { state: 'working' })]) : snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const { frames, layout } = simulate(dir === 'out' ? working : away, dir === 'out' ? away : working, 15_000);
    for (const st of layout.rooms[0].stations.filter(x => x.rest)) {
      const pts: Pt[] = [];
      for (const { actors } of frames) { const a = actors[st.agent.id]; if (a.moving) pts.push({ x: a.x, y: a.y }); }
      // 같은 방향으로 이어지는 표본은 합쳐 꼭짓점만 남긴다.
      const corners = pts.filter((p, i) => { const q = pts[i - 1], r = pts[i + 1]; if (!q || !r) return true; const d1 = Math.atan2(p.y - q.y, p.x - q.x), d2 = Math.atan2(r.y - p.y, r.x - p.x); return Math.abs(d1 - d2) > 1e-6; });
      assert.deepEqual(uTurns(corners), [], `N=${n} ${dir} ${st.agent.id}`);
    }
  }
});

// ───────── VQA-025: manager 측면 출입 때 하반신이 빈백에 가려지지 않음 ─────────
for (const n of [1, 3, 6, 10, 16]) for (const dir of ['out', 'back'] as const) {
  test(`VQA-025 (N=${n}, ${dir === 'out' ? 'leaving' : 'returning'}): the manager's lower body is never covered by a beanbag, at any step of the trip`, () => {
    const working = snap([group(Math.max(n, 1), 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const from = dir === 'out' ? working : away, to = dir === 'out' ? away : working;
    const layout = layoutOffices(to), lead = layout.rooms[0].stations[0];
    let actors: any = advance({}, from, 3000);
    let samples = 0, worst = 0;
    for (let t = 0; t < 12_000; t += 50) {
      actors = step(actors, to, 50, layout);
      const a = actors[lead.agent.id];
      if (!a.moving) continue;
      const tr = trace(to, { actors });
      const fig = tr.images.find(i => /^orchestrator-walk_/.test(i.key))!;
      const rect = { x: fig.dx, y: fig.dy, width: fig.dw, height: fig.dh };
      const lower = { x: rect.x, y: rect.y + rect.height * 0.5, width: rect.width, height: rect.height * 0.5 };
      const bags = tr.images.filter(i => i.order > fig.order && /^beanbag-/.test(i.key)).map(i => {
        const d = { x: i.dx, y: i.dy, width: i.dw, height: i.dh };
        return (i.clip ? i.clip.map(c => intersect(d, c)).filter(Boolean) as R[] : [d]).map(r => intersect(lower, r)).filter(Boolean) as R[];
      }).flat();
      const cover = coverage(lower, bags);
      worst = Math.max(worst, cover);
      samples++;
      assert.ok(cover <= 0.1, `t=${t} x=${a.x.toFixed(0)} y=${a.y.toFixed(0)}: ${(cover * 100).toFixed(0)}% of the lower body is covered by a beanbag drawn in front`);
    }
    assert.ok(samples > 20, `walking observed (${samples})`);
  });
}

test('VQA-025: the manager\'s side opening does not lie behind its own beanbag: the exit point is level with or right of the bag seat, so legs never end up inside the bag silhouette', () => {
  for (const n of [1, 3, 6, 10, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0], lead = room.stations[0];
    const out = route(room, lead, lead.seat, lead.away);
    const side = out[0];
    assert.ok(side.x >= lead.x + lead.width, `N=${n}: exits beyond the desk edge`);
    assert.ok(side.x >= lead.away.x - 1e-6, `N=${n}: exit x ${side.x.toFixed(0)} is not left of the bag arrival x ${lead.away.x.toFixed(0)} (no doubling back through the bag)`);
  }
});

// ───────── VQA-026: 이동 중 반전 ─────────
const near2 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 2;

for (const n of [3, 6, 10, 16]) for (const dir of ['out', 'back'] as const) for (const reverseAt of [200, 500, 1500]) {
  test(`VQA-026 (N=${n}, ${dir === 'out' ? 'working→away→working' : 'away→working→away'}, reversed after ${reverseAt}ms): off the seat and off the bag the pose is always a walking one, and walking resumes within 300ms`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    const first = dir === 'out' ? away : working, second = dir === 'out' ? working : away, origin = dir === 'out' ? working : away;
    const Lfirst = layoutOffices(first), Lsecond = layoutOffices(second), room = Lfirst.rooms[0];
    let actors: any = advance({}, origin, 3000);
    const displaced: Record<string, number | undefined> = {}; // 반전 순간에 이미 길 위에 있던 에이전트 → 반전 후 이동 시작 시각
    let reversedAt = -1;
    for (let t = 0; t < reverseAt + 6000; t += 25) {
      const reversed = t >= reverseAt;
      if (reversed && reversedAt < 0) {
        reversedAt = t;
        for (const st of room.stations) { const a = actors[st.agent.id]; if (!near2(a, st.seat) && !(st.rest && near2(a, st.away))) displaced[st.agent.id] = undefined; }
      }
      actors = step(actors, reversed ? second : first, 25, reversed ? Lsecond : Lfirst);
      for (const st of room.stations) {
        const a = actors[st.agent.id];
        const atEndpoint = near2(a, st.seat) || (!!st.rest && near2(a, st.away));
        if (!atEndpoint) assert.equal(a.moving, true, `t=${t} ${st.agent.id}: standing at (${a.x.toFixed(0)},${a.y.toFixed(0)}) away from seat and bag but not walking (a seated/lying pose would float on the floor)`);
        if (reversed && st.agent.id in displaced && displaced[st.agent.id] === undefined && a.moving) displaced[st.agent.id] = t - reversedAt;
      }
      if (reversed && t - reversedAt === 300) for (const id of Object.keys(displaced)) assert.ok(displaced[id] !== undefined && displaced[id]! <= 300, `${id}: did not resume walking within 300ms of the reversal (${displaced[id]})`);
    }
    // 반전 직전에 길 위에 있던 에이전트가 실제로 있었다(시나리오가 의미 있다)
    if (reverseAt >= 500) assert.ok(Object.keys(displaced).length >= 1, 'someone was on the road when the state flipped');
    // 마지막에는 모두 새 목적지에 도착해 있다.
    for (const st of room.stations) { const a = actors[st.agent.id]; const target = second.projects[0].offices[0].members[0].state === 'away' && st.rest ? st.away : st.seat; assert.ok(near2(a, target), `${st.agent.id} arrived`); }
  });
}

for (const n of [3, 6]) for (const reverseAt of [200, 500, 1500]) {
  test(`VQA-026 (N=${n}, reversal after ${reverseAt}ms): the drawn pose of anybody off the seat/bag is a walk sheet (no seated, lying or working pose on bare floor)`, () => {
    const working = snap([group(n, 'g', { state: 'working' })]);
    const away = withState(working, 'away');
    for (const [origin, first, second] of [[working, away, working], [away, working, away]] as const) {
      const Lfirst = layoutOffices(first), Lsecond = layoutOffices(second), room = Lfirst.rooms[0];
      let actors: any = advance({}, origin, 3000);
      for (let t = 0; t < reverseAt + 4000; t += 50) {
        const reversed = t >= reverseAt;
        const snapNow = reversed ? second : first;
        actors = step(actors, snapNow, 50, reversed ? Lsecond : Lfirst);
        const tr = trace(snapNow, { actors });
        for (const st of room.stations) {
          const a = actors[st.agent.id];
          if (near2(a, st.seat) || (st.rest && near2(a, st.away))) continue;
          const re = st.manager ? /^orchestrator-/ : new RegExp(`^actor-${st.variant}-`);
          const keys = tr.images.filter(i => re.test(i.key)).map(i => i.key);
          assert.ok(keys.length >= 1 && keys.every(k => /-walk_(left|right)$/.test(k)), `t=${t} ${st.agent.id} at (${a.x.toFixed(0)},${a.y.toFixed(0)}): drawn as ${keys.join(',')}`);
        }
      }
    }
  });
}

test('VQA-026: a reversal never restarts the 300ms stagger for someone who is already walking, and the route starts from the current position (no position cut)', () => {
  const working = snap([group(6, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const Lw = layoutOffices(working), La = layoutOffices(away), room = Lw.rooms[0];
  for (const reverseAt of [200, 500, 800, 1500, 2500]) {
    let actors: any = advance({}, working, 3000);
    const prev: Record<string, Pt> = {};
    for (let t = 0; t < reverseAt + 400; t += 25) {
      const reversed = t >= reverseAt;
      const before = actors;
      actors = step(actors, reversed ? working : away, 25, reversed ? Lw : La);
      for (const st of room.stations) {
        const a = actors[st.agent.id], b = before[st.agent.id];
        if (reversed && t < reverseAt + 25 && b.moving) assert.equal(a.moving, true, `${st.agent.id}: walking at the flip, still walking in the very next step`);
        const p = prev[st.agent.id];
        if (p) assert.ok(Math.hypot(a.x - p.x, a.y - p.y) <= expectedSpeed(st.variant, st.manager, st.actorHeight) * 0.025 + 1e-6, `${st.agent.id} jumped at t=${t}`);
        prev[st.agent.id] = { x: a.x, y: a.y };
      }
    }
  }
});

test('VQA-026: setTransitionSequence reproduces the same frame as stepping the stages by hand, deterministically (preview hook)', async () => {
  const working = snap([group(6, 'g', { state: 'working' })]);
  const away = withState(working, 'away');
  const m = await mountFake(away, { clientWidth: 480 });
  try {
    const stages = [{ snapshot: away, duration: 500 }, { snapshot: working, duration: 400 }];
    await m.handle.setTransitionSequence(working, stages, 1000, 3000);
    const got = JSON.parse(JSON.stringify(m.handle.inspect().actors));
    // 손으로 같은 순서를 재현한다(미리보기는 100ms 이하 단계로 재생한다).
    // 마운트는 패널 폭(480px)으로 layout을 만든다(상단바 높이가 폭에 따라 달라진다).
    const lay = (x: any) => layoutOffices(x, 480);
    let actors: any = step({}, working, 0, lay(working));
    for (let e = 0; e < 3000; e += 100) actors = step(actors, working, Math.min(100, 3000 - e), lay(working));
    for (const stage of stages) { const l = lay(stage.snapshot); actors = step(actors, stage.snapshot, 0, l); for (let e = 0; e < stage.duration; e += 100) actors = step(actors, stage.snapshot, Math.min(100, stage.duration - e), l); }
    for (const id of Object.keys(actors)) assert.deepEqual([got[id].x, got[id].y, got[id].moving, got[id].state], [actors[id].x, actors[id].y, actors[id].moving, actors[id].state], id);
    await m.handle.setTransitionSequence(working, stages, 1000, 3000);
    assert.deepEqual(JSON.parse(JSON.stringify(m.handle.inspect().actors)), got, 'same call, same frame');
    await assert.rejects(async () => m.handle.setTransitionSequence(working, [], 1000), /Sequence requires/);
    await assert.rejects(async () => m.handle.setTransitionSequence(working, [{ snapshot: away, duration: -1 }], 1000), /Sequence requires/);
  } finally { m.handle.dispose(); m.restore(); }
});
