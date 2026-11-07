import test from 'node:test';
import assert from 'node:assert/strict';
import { actorImages, advance, group, layoutOffices, manifest, snap, solo, step, trace, withState, assetData } from './helpers/scene.ts';

const spec = (key: string) => (assetData as Record<string, any>)[key];
const keysOf = (images: { key: string }[]) => [...new Set(images.map(i => i.key))];
const effects = (images: { key: string }[], name: string) => images.filter(i => i.key === manifest.effects[name]);

test('working: seated agent plays the typing sheet and its frame advances at the manifest fps', () => {
  const s = snap([solo('a', { state: 'working' })]);
  const t0 = trace(s, { epoch: 1000, actors: advance({}, s, 300) });
  assert.deepEqual(keysOf(actorImages(t0.images)), ['actor-0-working']);
  const { fps, frames, frameW } = spec('actor-0-working'), rs = manifest.runtimeScale;
  for (const frame of [0, 1, 2, 3, 4]) {
    const actors = advance({}, s, Math.ceil((frame / fps) * 1000) + 1);
    const { images } = trace(s, { actors, timeMs: 0, epoch: 1000 });
    const sx = new Set(actorImages(images).map(i => i.sx));
    assert.deepEqual([...sx], [(frame % frames) * frameW * rs], `frame ${frame}`);
  }
});

test('working under 60s has no flame; at exactly 60s it gets flame_aura; other states never do', () => {
  const s = snap([solo('a', { state: 'working', stateSince: 1000 })]);
  const actors = advance({}, s, 300); // 효과는 자세가 자리 잡은 뒤(0.2초)에 나온다
  assert.equal(effects(trace(s, { actors, epoch: 1000 + 59_999 }).images, 'flame_aura').length, 0);
  assert.equal(effects(trace(s, { actors, epoch: 1000 + 60_000 }).images, 'flame_aura').length, 1);
  assert.equal(effects(trace(s, { actors, epoch: 1000 + 600_000 }).images, 'flame_aura').length, 1);
  assert.equal(effects(trace(s, { epoch: 1000 + 600_000 }).images, 'flame_aura').length, 0, 'not before the pose has settled');
  for (const state of ['away', 'phone', 'sleeping'] as const) {
    const o = withState(s, state);
    const actors = advance({}, o, 10_000);
    assert.equal(effects(trace(o, { actors, epoch: 9e9 }).images, 'flame_aura').length, 0, state);
  }
});

test('away: waits its 300ms stagger slot, walks to its beanbag (walk sheet), then plays the away sheet seated on the beanbag', () => {
  const s = snap([solo('a', { state: 'away' })]);
  const room = layoutOffices(s).rooms[0], st = room.stations[0];
  assert.ok(st.rest, 'solo agent owns the first beanbag');
  let actors = advance({}, s, 100);
  assert.equal(actors.a.moving, false, 'still in its 300ms stagger slot');
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), ['actor-0-phone'], 'waiting actor keeps its seated pose');
  actors = advance(actors, s, 2400);
  const mid = actors.a;
  assert.equal(mid.moving, true);
  assert.equal(mid.destination, 'beanbag');
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), [`actor-0-walk_${mid.direction}`]);
  actors = advance(actors, s, 40_000);
  assert.ok(Math.hypot(actors.a.x - st.away.x, actors.a.y - st.away.y) < 1, 'reached the standing arrival point below the bag');
  assert.notDeepEqual(st.away, st.seat);
  assert.equal(actors.a.moving, false);
  assert.deepEqual(keysOf(actorImages(trace(s, { actors }).images)), ['actor-0-away']);
});

test('away with a full lounge: three members take the left beanbags (medium room), the rest stay at their desks (phone pose), the manager uses its private bag', () => {
  const s = withState(snap([group(6)]), 'away');
  const room = layoutOffices(s).rooms[0];
  const stations = room.stations;
  const [manager, ...members] = stations;
  const seated = members.filter(x => x.rest);
  assert.equal(seated.length, 3);
  assert.deepEqual(seated.map(x => x.agent.id).sort(), members.slice().sort((a, b) => a.x - b.x || a.y - b.y).slice(0, 3).map(x => x.agent.id).sort(), 'the desks nearest the left column');
  assert.ok(manager.rest, 'manager has its own bag');
  const actors = advance({}, s, 90_000);
  for (const st of stations) {
    const a = actors[st.agent.id];
    const target = st.rest ? st.away : st.seat;
    assert.ok(Math.hypot(a.x - target.x, a.y - target.y) < 1, `${st.agent.id} -> ${st.rest ? 'beanbag' : 'desk'}`);
    assert.equal(a.moving, false);
    assert.equal(a.destination, st.rest ? 'beanbag' : 'seat');
  }
  const keys = actorImages(trace(s, { actors }).images).map(i => i.key);
  const byVariant = (variant: string) => keys.filter(k => k.startsWith(`actor-${variant}-`));
  for (const st of seated) assert.ok(byVariant(st.variant).every(k => k.endsWith('-away')), st.agent.id);
  for (const st of members.filter(x => !x.rest)) assert.ok(byVariant(st.variant).every(k => k.endsWith('-phone')), `${st.agent.id}: ${byVariant(st.variant)}`);
  assert.ok(keys.some(k => k.startsWith('orchestrator-')), 'manager is drawn');
});

test('large rooms seat as many members on the left as fit on the floor; the other members rest at their desks', () => {
  const s = withState(snap([group(10)]), 'away');
  const room = layoutOffices(s).rooms[0];
  const members = room.stations.filter(x => !x.manager);
  assert.ok(members.filter(x => x.rest).length >= 5 && members.filter(x => x.rest).length < members.length, `${members.filter(x => x.rest).length} of ${members.length} have a bag`);
  const actors = advance({}, s, 120_000);
  for (const st of members) {
    const a = actors[st.agent.id], target = st.rest ? st.away : st.seat;
    assert.ok(Math.hypot(a.x - target.x, a.y - target.y) < 1, st.agent.id);
  }
});

test('the left floor furniture is gone: resting agents arrive under their bags in the left column', () => {
  const s = withState(snap([group(3)]), 'away');
  const actors = advance({}, s, 60_000);
  const room = layoutOffices(s).rooms[0];
  for (const st of room.stations.filter(x => !x.manager)) {
    const a = actors[st.agent.id];
    assert.ok(a.x < 300 && Math.abs(a.x - st.rest!.seat.x) < 1, `${st.agent.id} x=${a.x}`);
  }
});

test('beanbag owners are stable: a member keeps its bag when other members change state', () => {
  const o = group(5);
  const s1 = snap([o]);
  const owners = (s: any) => layoutOffices(s).rooms[0].rests.map(r => r.owner);
  const before = owners(s1);
  (o.members[0] as { state: string }).state = 'away';
  (o.members[3] as { state: string }).state = 'sleeping';
  assert.deepEqual(owners(snap([o])), before);
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
  const actors = advance({}, s, 1000);
  const { images } = trace(s, { actors, epoch: 1 });
  assert.equal(effects(images, 'attention').length, 1);
  assert.ok(actorImages(images).every(i => i.key.endsWith('-working')));
  assert.equal(effects(trace(withState(s, 'working', { needsAttention: false }), { actors }).images, 'attention').length, 0);
  assert.equal(effects(trace(s, { actors, epoch: 1 }).images, 'attention').length, 1);
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
  let actors: any = advance({}, s, 2000);
  assert.equal(actors.a.moving, true);
  let last = dist(actors.a);
  for (let i = 0; i < 4; i++) {
    const polled = JSON.parse(JSON.stringify(s));
    actors = step(actors, polled, 100, layoutOffices(polled));
    assert.ok(dist(actors.a) < last, 'closer to the beanbag after each poll');
    last = dist(actors.a);
  }
  void st;
});

test('crossfade is gone: a state change is an opaque hard cut with exactly one fully opaque actor silhouette per figure', () => {
  const s = snap([solo('a', { state: 'phone' })]);
  let actors: any = advance({}, s, 1000);
  const phase = actors.a.phase;
  actors = step(actors, withState(s, 'sleeping'), 100);
  assert.equal(actors.a.state, 'sleeping');
  assert.ok(Math.abs(actors.a.phase - (phase + 0.1)) < 1e-9, 'the animation clock keeps running');
  for (const mid of [0, 50, 100, 250, 349, 350, 400]) {
    const moved = advance(actors, withState(s, 'sleeping'), mid);
    const fig = actorImages(trace(withState(s, 'sleeping'), { actors: moved }).images);
    assert.deepEqual(keysOf(fig), ['actor-0-sleeping'], `+${mid}ms: only the new pose`);
    assert.ok(fig.every(i => i.alpha === 1), `+${mid}ms: opaque`);
  }
});

test('arriving at a destination is also a hard cut: no ghost of the walking pose is drawn after the walk ends', () => {
  const s = snap([solo('a', { state: 'away' })]);
  let actors: any = advance({}, s, 3000);
  let guard = 0;
  while (actors.a.moving && guard++ < 1000) actors = step(actors, s, 50, layoutOffices(s));
  for (const extra of [0, 50, 100, 200]) {
    const moved = advance(actors, s, extra);
    const fig = actorImages(trace(s, { actors: moved }).images);
    assert.ok(fig.every(i => i.alpha === 1));
    assert.deepEqual(keysOf(fig), ['actor-0-away'], `+${extra}ms`);
  }
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

// ───────── VQA-019: flame_aura 128×160, anchor [44,166], 키보드·모니터·명판 제외 클립 ─────────
test('VQA-019: the flame sheet is 128x160; it is placed by the actor-frame anchor [44,166] minus the sheet anchor, behind a single actor', () => {
  const place = (manifest as any).effectPlacement.flame_aura;
  assert.deepEqual([spec('flame_aura').frameW, spec('flame_aura').frameH], [128, 160]);
  assert.deepEqual(place.anchorInActorFrame, [44, 166]);
  const s = snap([group(3, 'g', { state: 'working', stateSince: 0 })]);
  const t = trace(s, { actors: advance({}, s, 600), epoch: 90_000 });
  const flames = effects(t.images, 'flame_aura');
  assert.equal(flames.length, 4, 'every working agent burns (manager included)');
  for (const st of t.layout.rooms[0].stations) {
    const keyRe = st.manager ? /^orchestrator-working$/ : new RegExp(`^actor-${st.variant}-working$`);
    const figs = t.images.filter(i => keyRe.test(i.key));
    assert.equal(figs.length, 1, `${st.agent.id}: the actor is drawn once (no torso re-composite)`);
    const f = st.actorHeight / 216;
    const fig = figs[0];
    const flame = flames.find(x => Math.abs(x.dx - (fig.dx + (place.anchorInActorFrame[0] - place.sheetAnchor[0]) * f)) < 1e-6)!;
    assert.ok(flame, `${st.agent.id}: flame x from the anchors`);
    assert.ok(Math.abs(flame.dy - (fig.dy + (place.anchorInActorFrame[1] - place.sheetAnchor[1]) * f)) < 1e-6, 'flame y from the anchors');
    assert.ok(Math.abs(flame.dw - 128 * f) < 1e-6 && Math.abs(flame.dh - 160 * f) < 1e-6, 'render size = sheet size * actorHeight/216');
    assert.ok(flame.order < fig.order, `${st.agent.id}: flame is behind the actor`);
  }
});

test('VQA-019: the flame is clipped to the area left of the monitor and above the keyboard (keyboard, monitor and nameplate stay clean)', () => {
  const s = snap([group(3, 'g', { state: 'working', stateSince: 0 })]);
  const t = trace(s, { actors: advance({}, s, 600), epoch: 90_000 });
  const room = t.layout.rooms[0];
  for (const st of room.stations) {
    const keyRe = st.manager ? /^orchestrator-working$/ : new RegExp(`^actor-${st.variant}-working$`);
    const fig = t.images.find(i => keyRe.test(i.key))!;
    const place = (manifest as any).effectPlacement.flame_aura, f = st.actorHeight / 216;
    const flame = effects(t.images, 'flame_aura').find(x => Math.abs(x.dx - (fig.dx + (place.anchorInActorFrame[0] - place.sheetAnchor[0]) * f)) < 1e-6)!;
    assert.ok(flame.clip && flame.clip.length === 1, `${st.agent.id}: flame is clipped`);
    const [clip] = flame.clip!;
    const kb = st.desk.keyboard, ms = st.moduleScale;
    assert.ok(Math.abs(clip.x + clip.width - (st.x + (kb.keycapRect[0] + kb.keycapRect[2] + 4) * ms)) < 1e-6, `${st.agent.id}: right edge stops left of the monitor`);
    assert.ok(Math.abs(clip.y + clip.height - (st.y + kb.rect[1] * ms)) < 1e-6, `${st.agent.id}: bottom edge stops above the keyboard`);
    const plate = { y: st.plate.y - 11 };
    assert.ok(clip.y + clip.height < plate.y, 'never reaches the nameplate');
  }
});

// ───────── VQA-024: needsAttention이면 장식 말풍선·+숫자를 띄우지 않는다 ─────────
const DECOR = ['pop_plus3', 'pop_plus10', 'bubble_done', 'bubble_prup'];
const decorKeys = () => new Set(DECOR.map(n => (manifest as any).effects[n]));

test('VQA-024: agents that need attention never show Done!/PR up!/+number decorations; the attention mark is always there', () => {
  const o = group(15, 'g', { state: 'working', needsAttention: true });
  const s = snap([o]);
  const keys = decorKeys();
  let actors: any = advance({}, s, 300);
  for (let t = 0; t < 60_000; t += 500) {
    actors = advance(actors, s, 500);
    const { images } = trace(s, { actors, epoch: 1e9, timeMs: t });
    assert.equal(images.filter(i => keys.has(i.key)).length, 0, `t=${t}: decoration drawn over an attention request`);
    assert.equal(effects(images, 'attention').length, 16, `t=${t}: every flagged agent shows the attention mark`);
  }
});

test('VQA-024 (control): the same office without attention does show decorations during the 13s bubble / 6s pop cycles, and only on the unflagged agents when mixed', () => {
  const keys = decorKeys();
  const calm = snap([group(15, 'g', { state: 'working' })]);
  let actors: any = advance({}, calm, 300), seen = 0;
  for (let t = 0; t < 30_000; t += 500) { actors = advance(actors, calm, 500); seen += trace(calm, { actors, epoch: 1e9 }).images.filter(i => keys.has(i.key)).length; }
  assert.ok(seen > 10, `decorations appear when nobody needs attention (${seen})`);
  const o = group(7, 'g', { state: 'working' });
  (o.members[2] as { needsAttention: boolean }).needsAttention = true;
  const mixedSnap = snap([o]);
  actors = advance({}, mixedSnap, 300);
  for (let t = 0; t < 30_000; t += 500) {
    actors = advance(actors, mixedSnap, 500);
    const { images } = trace(mixedSnap, { actors, epoch: 1e9 });
    // 깃발 에이전트 머리 위 영역에는 장식이 없다: attention 효과의 사각형과 겹치는 장식이 하나도 없다.
    const mark = effects(images, 'attention')[0];
    for (const img of images.filter(i => keys.has(i.key))) {
      const overlap = Math.min(img.dx + img.dw, mark.dx + mark.dw) > Math.max(img.dx, mark.dx) && Math.min(img.dy + img.dh, mark.dy + mark.dh) > Math.max(img.dy, mark.dy);
      assert.ok(!overlap, `t=${t}: a decoration overlaps the attention mark`);
    }
  }
});

test('VQA-024: when the request is resolved the decorations come back, and when it appears they disappear at once', () => {
  const keys = decorKeys();
  const base = snap([group(7, 'g', { state: 'working' })]);
  const flagged = withState(base, 'working', { needsAttention: true });
  let actors: any = advance({}, base, 300);
  let gone = true, back = false;
  for (let t = 0; t < 40_000; t += 250) {
    actors = advance(actors, flagged, 250);
    if (trace(flagged, { actors, epoch: 1e9 }).images.some(i => keys.has(i.key))) gone = false;
  }
  assert.ok(gone, 'no decoration while flagged');
  for (let t = 0; t < 40_000 && !back; t += 250) { actors = advance(actors, base, 250); if (trace(base, { actors, epoch: 1e9 }).images.some(i => keys.has(i.key))) back = true; }
  assert.ok(back, 'decorations resume once the request is resolved');
});
