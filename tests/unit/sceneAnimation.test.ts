import test from 'node:test';
import assert from 'node:assert/strict';
import { actorImages, advance, group, layoutOffices, manifest, snap, solo, step, trace, withState, assetData } from './helpers/scene.ts';

const spec = (key: string) => (assetData as Record<string, any>)[key];
const keysOf = (images: { key: string }[]) => [...new Set(images.map(i => i.key))];
const effects = (images: { key: string }[], name: string) => images.filter(i => i.key === manifest.effects[name]);

test('working: seated agent plays the typing sheet and its frame advances at the manifest fps', () => {
  const s = snap([solo('a', { state: 'working' })]);
  const t0 = trace(s, { epoch: 1000 });
  assert.deepEqual(keysOf(actorImages(t0.images)), ['actor-0-working']);
  const { fps, frames, frameW } = spec('actor-0-working');
  for (const frame of [0, 1, 2, 3, 4]) {
    const actors = advance({}, s, Math.ceil((frame / fps) * 1000) + 1);
    const { images } = trace(s, { actors, timeMs: 0, epoch: 1000 });
    const sx = new Set(actorImages(images).map(i => i.sx));
    assert.deepEqual([...sx], [(frame % frames) * frameW], `frame ${frame}`);
  }
});

test('working under 60s has no flame; at exactly 60s it gets flame_aura; other states never do', () => {
  const s = snap([solo('a', { state: 'working', stateSince: 1000 })]);
  assert.equal(effects(trace(s, { epoch: 1000 + 59_999 }).images, 'flame_aura').length, 0);
  assert.equal(effects(trace(s, { epoch: 1000 + 60_000 }).images, 'flame_aura').length, 1);
  assert.equal(effects(trace(s, { epoch: 1000 + 600_000 }).images, 'flame_aura').length, 1);
  for (const state of ['away', 'phone', 'sleeping'] as const) {
    const o = withState(s, state);
    const actors = advance({}, o, 10_000);
    assert.equal(effects(trace(o, { actors, epoch: 9e9 }).images, 'flame_aura').length, 0, state);
  }
});

test('away: walks to the sofa (walk sheet), then loops the away sheet at the sofa slot', () => {
  const s = snap([solo('a', { state: 'away' })]);
  const room = layoutOffices(s).rooms[0], st = room.stations[0];
  let actors = advance({}, s, 600);
  const mid = actors.a;
  assert.equal(mid.moving, true);
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), [`actor-0-walk_${mid.direction}`]);
  actors = advance(actors, s, 20_000);
  assert.ok(Math.hypot(actors.a.x - st.away.x, actors.a.y - st.away.y) < 1, 'reached the sofa');
  assert.notDeepEqual(st.away, st.seat);
  assert.equal(actors.a.moving, false);
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), ['actor-0-away']);
});

test('away with a full sofa: two member-only sofa slots, other members stay at the desk, the manager rests beside its own desk', () => {
  const s = withState(snap([group(5)]), 'away');
  const stations = layoutOffices(s).rooms[0].stations;
  const [manager, ...members] = stations;
  assert.equal(manager.hasSofa, false);
  assert.deepEqual(members.map(x => x.hasSofa), [true, true, false, false, false]);
  assert.notDeepEqual(members[0].away, members[1].away);
  assert.notDeepEqual(manager.away, manager.seat, 'manager has its own rest spot');
  assert.ok(![members[0].away, members[1].away].some(p => p.x === manager.away.x && p.y === manager.away.y), 'manager does not take a sofa slot');
  const actors = advance({}, s, 30_000);
  for (const st of stations) {
    const a = actors[st.agent.id];
    const target = st.hasSofa || st.manager ? st.away : st.seat;
    assert.ok(Math.hypot(a.x - target.x, a.y - target.y) < 1, `${st.agent.id} -> ${st.manager ? 'manager spot' : st.hasSofa ? 'sofa' : 'desk'}`);
    assert.equal(a.moving, false);
  }
  const keys = actorImages(trace(s, { actors }).images).map(i => i.key);
  assert.ok(keys.every(k => k.endsWith('-away')), keys.join());
  assert.ok(keys.some(k => k.startsWith('orchestrator-')), 'manager plays its own away sheet');
});

test('with more members than sofa seats the sofa assignment is stable across state changes', () => {
  const s = withState(snap([group(6)]), 'away');
  const before = layoutOffices(s).rooms[0].stations.map(x => [x.agent.id, x.hasSofa]);
  const after = layoutOffices(withState(s, 'working')).rooms[0].stations.map(x => [x.agent.id, x.hasSofa]);
  assert.deepEqual(after, before);
});

test('away agents return to the desk when they wake up', () => {
  const s = snap([solo('a', { state: 'away' })]);
  let actors = advance({}, s, 20_000);
  actors = advance(actors, withState(s, 'working'), 20_000);
  const st = layoutOffices(s).rooms[0].stations[0];
  assert.ok(Math.hypot(actors.a.x - st.seat.x, actors.a.y - st.seat.y) < 1);
});

test('phone: stays at the desk with the phone sheet, never walks', () => {
  const s = snap([solo('a', { state: 'phone' })]);
  const st = layoutOffices(s).rooms[0].stations[0];
  let actors = {};
  for (let i = 0; i < 100; i++) {
    actors = step(actors, s, 100);
    const a = (actors as any).a;
    assert.equal(a.moving, false);
    assert.deepEqual([a.x, a.y], [st.seat.x, st.seat.y]);
  }
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), ['actor-0-phone']);
});

test('sleeping: seated with the sleeping sheet and a zzz effect', () => {
  const s = snap([solo('a', { state: 'sleeping' })]);
  const actors = advance({}, s, 3000);
  const { images } = trace(s, { actors, timeMs: 0 });
  assert.deepEqual(keysOf(actorImages(images)), ['actor-0-sleeping']);
  assert.equal(effects(images, 'zzz').length, 1);
  const awake = trace(withState(s, 'phone'), { actors: advance({}, withState(s, 'phone'), 3000) }).images;
  assert.equal(effects(awake, 'zzz').length, 0);
});

test('needsAttention draws the attention effect on the flagged agent only, state stays working', () => {
  const o = group(3);
  (o.members[1] as { needsAttention: boolean }).needsAttention = true;
  const s = snap([o]);
  const { images } = trace(s, { actors: advance({}, s, 1000), epoch: 1 });
  assert.equal(effects(images, 'attention').length, 1);
  const st = layoutOffices(s).rooms[0].stations.find(x => x.agent.id === 'g1')!;
  const [fx] = effects(images, 'attention');
  assert.ok(Math.abs(fx.dx + 35 - st.seat.x) < 1, 'effect sits over the flagged desk');
  assert.ok(actorImages(images).every(i => i.key.endsWith('-working')));
  assert.equal(effects(trace(withState(s, 'working', { needsAttention: false }), { actors: advance({}, s, 1000) }).images, 'attention').length, 0);
});

test('repeated identical snapshots (2s polling, new object each time) never reset animation clocks', () => {
  const base = snap([group(3, 'g', { state: 'working' })]);
  let actors: any = advance({}, base, 500);
  const before = JSON.parse(JSON.stringify(actors));
  for (let poll = 1; poll <= 5; poll++) {
    const polled = JSON.parse(JSON.stringify(base));
    actors = step(actors, polled, 2000, layoutOffices(polled));
    for (const id of Object.keys(before)) {
      assert.equal(actors[id].state, 'working');
      assert.equal(actors[id].changed, before[id].changed, 'state clock untouched');
      assert.equal(actors[id].previous, undefined, 'no crossfade is started');
      assert.ok(Math.abs(actors[id].phase - (before[id].phase + 2 * poll)) < 1e-9, `phase ${id}`);
    }
  }
});

test('a poll in the middle of a walk keeps walking instead of restarting the route', () => {
  const s = snap([solo('a', { state: 'away' })]);
  const st = layoutOffices(s).rooms[0].stations[0];
  // 경유점을 거치므로 직선거리가 아니라 남은 경로 길이로 진행을 본다.
  const dist = (a: any) => { let d = 0, p = a; for (const q of [...a.route]) { d += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return d; };
  let actors: any = advance({}, s, 600);
  let last = dist(actors.a);
  for (let i = 0; i < 4; i++) {
    const polled = JSON.parse(JSON.stringify(s));
    actors = step(actors, polled, 100, layoutOffices(polled));
    assert.ok(dist(actors.a) < last, 'closer to the sofa after each poll');
    last = dist(actors.a);
  }
});

test('a real state change starts a crossfade from the previous state and keeps the clock running', () => {
  const s = snap([solo('a', { state: 'phone' })]);
  let actors: any = advance({}, s, 1000);
  const phase = actors.a.phase;
  actors = step(actors, withState(s, 'sleeping'), 100);
  assert.equal(actors.a.previous, 'phone');
  assert.equal(actors.a.state, 'sleeping');
  assert.ok(Math.abs(actors.a.phase - (phase + 0.1)) < 1e-9);
  const keys = keysOf(actorImages(trace(withState(s, 'sleeping'), { actors }).images));
  assert.deepEqual(keys.sort(), ['actor-0-phone', 'actor-0-sleeping']);
});

test('a window resize moves the seated figure with its desk instead of snapping or restarting', () => {
  const s = snap([group(3, 'g', { state: 'phone' })]);
  let actors: any = advance({}, s, 1000);
  const phases = Object.fromEntries(Object.entries<any>(actors).map(([id, a]) => [id, a.phase]));
  const narrow = layoutOffices(s, 420);
  actors = step(actors, s, 0, narrow);
  for (const st of narrow.rooms[0].stations) {
    const a = actors[st.agent.id];
    assert.ok(Math.hypot(a.x - st.seat.x, a.y - st.seat.y) < 1);
    assert.equal(a.phase, phases[st.agent.id]);
  }
});
