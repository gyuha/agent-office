import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAtPoint, advance, group, layoutOffices, mixed, scenePoint, snap, snapAll, solo, step, withState } from './helpers/scene.ts';
import { fitSceneWidth } from '../../client/scene/core/viewport.ts';

const everyone = (layout: any) => layout.rooms.flatMap((r: any) => r.stations);

for (const n of [1, 3, 6, 10, 16]) {
  test(`N=${n}: a click on each nameplate and on each seated figure returns that agent's id`, () => {
    const s = snap([group(n)]);
    const layout = layoutOffices(s);
    const actors = step({}, s, 0, layout);
    for (const st of everyone(layout)) {
      assert.equal(agentAtPoint(layout, actors, st.plate.x, st.plate.y), st.agent.id, `plate ${st.agent.id}`);
      assert.equal(agentAtPoint(layout, actors, st.plate.x - st.plateWidth / 2 + 2, st.plate.y), st.agent.id, `plate edge ${st.agent.id}`);
      assert.equal(agentAtPoint(layout, actors, st.seat.x, st.seat.y - st.actorHeight * 0.4), st.agent.id, `desk ${st.agent.id}`);
    }
  });
}

test('the desk body (middle of the pod) selects the owner of that desk', () => {
  const s = snap([group(6)]);
  const layout = layoutOffices(s);
  const actors = step({}, s, 0, layout);
  for (const st of everyone(layout).filter((x: any) => !x.manager)) {
    assert.equal(agentAtPoint(layout, actors, st.x + st.width * 0.4, st.y + st.height * 0.4), st.agent.id, st.agent.id);
  }
});

test('solo office: desk and nameplate both select the solo agent', () => {
  const s = snap([solo('only')]);
  const layout = layoutOffices(s);
  const st = layout.rooms[0].stations[0];
  const actors = step({}, s, 0, layout);
  assert.equal(agentAtPoint(layout, actors, st.plate.x, st.plate.y), 'only');
  assert.equal(agentAtPoint(layout, actors, st.seat.x, st.seat.y - 60), 'only');
});

test('scope all: clicks resolve in the right room, ids stay unique per room', () => {
  const s = snapAll([{ name: 'a', offices: [group(3, 'a'), solo('as')] }, { name: 'b', offices: [mixed(9, 'b')] }]);
  const layout = layoutOffices(s);
  const actors = step({}, s, 0, layout);
  for (const st of everyone(layout)) assert.equal(agentAtPoint(layout, actors, st.plate.x, st.plate.y), st.agent.id);
});

test('empty space, headers and out-of-scene points return null', () => {
  const s = snap([group(3)]);
  const layout = layoutOffices(s);
  const actors = step({}, s, 0, layout);
  assert.equal(agentAtPoint(layout, actors, 5, 5), null);
  assert.equal(agentAtPoint(layout, actors, -50, -50), null);
  assert.equal(agentAtPoint(layout, actors, 99999, 99999), null);
  assert.equal(agentAtPoint(layout, actors, 700, 10), null, 'top bar');
});

test('an agent without an actor yet is hit at its seat', () => {
  const layout = layoutOffices(snap([solo('a')]));
  const st = layout.rooms[0].stations[0];
  assert.equal(agentAtPoint(layout, {}, st.seat.x, st.seat.y - 50), 'a');
  assert.equal(agentAtPoint(layout, {}, st.seat.x + 400, st.seat.y), null);
});

test('a walking agent is hit where it is now, not at its seat', () => {
  const s = snap([solo('a', { state: 'away' })]);
  const layout = layoutOffices(s);
  const st = layout.rooms[0].stations[0];
  const actors = advance({}, s, 700, layout);
  const a = actors.a;
  assert.ok(a.moving);
  assert.equal(agentAtPoint(layout, actors, a.x, a.y - st.actorHeight * 0.4), 'a');
  assert.equal(agentAtPoint(layout, actors, st.seat.x - 200, st.seat.y), null);
});

test('hit box: x within ±0.36 of the figure height, y from 0.92 height above the feet to 10px below', () => {
  const s = snap([solo('a', { state: 'phone' })]);
  const layout = layoutOffices(s);
  const st = layout.rooms[0].stations[0], h = st.actorHeight, a = { x: st.seat.x, y: st.seat.y };
  const actors = step({}, s, 0, layout);
  const hit = (dx: number, dy: number) => agentAtPoint(layout, actors, a.x + dx, a.y + dy) === 'a';
  const e = 0.01; // 부동소수 경계 오차를 피한다.
  assert.ok(hit(h * 0.36 - e, -h * 0.4) && hit(-h * 0.36 + e, -h * 0.4));
  assert.ok(!hit(h * 0.36 + e, -h * 0.4) && !hit(-h * 0.36 - e, -h * 0.4));
  assert.ok(hit(0, -h * 0.92 + e) && !hit(0, -h * 0.92 - e));
  // 발치 바로 아래는 같은 높이의 이름표 영역이라 아래쪽 경계 바깥은 검사하지 않는다.
  assert.ok(hit(0, 10 - e));
});

test('overlapping walking figures: the one standing in front (larger y) wins, even if the other is nearer; equal depth goes to the later one', () => {
  const s = snap([group(3)]);
  const layout = layoutOffices(s);
  const [, m0, m1] = layout.rooms[0].stations;
  const base: any = step({}, s, 0, layout);
  const walk = (id: string, x: number, y: number) => ({ ...base[id], moving: true, x, y });
  const actors: any = { ...base, [m0.agent.id]: walk(m0.agent.id, 200, 300), [m1.agent.id]: walk(m1.agent.id, 240, 320) };
  const h = m0.actorHeight, y = 300 - h * 0.4;
  assert.equal(agentAtPoint(layout, actors, 205, y), m1.agent.id, 'in front wins although m0 is nearer');
  assert.equal(agentAtPoint(layout, actors, 150, y), m0.agent.id, 'outside the front figure box');
  actors[m1.agent.id] = walk(m1.agent.id, 240, 300);
  assert.equal(agentAtPoint(layout, actors, 220, y), m1.agent.id, 'equal depth -> later station');
});

for (const width of [1536, 900, 410]) {
  test(`plate click at ${width}px panel width hits the plate rectangle exactly (plate grows when the scene is scaled down)`, () => {
    const s = snap([group(6)]);
    const layout = layoutOffices(s, width);
    const actors = step({}, s, 0, layout);
    const scale = Math.min(1, width / 1536);
    assert.equal(layout.viewportScale, scale);
    for (const st of layout.rooms[0].stations) {
      const font = Math.max(18, 6.5 / scale), pad = Math.max(3, 1 / scale), height = font * 1.35 + pad * 2;
      const left = st.plate.x - st.plateWidth / 2, top = st.plate.y - height / 2, e = 0.01;
      for (const [dx, dy] of [[e, e], [st.plateWidth - e, e], [e, height - e], [st.plateWidth - e, height - e], [st.plateWidth / 2, height / 2]]) {
        assert.equal(agentAtPoint(layout, actors, left + dx, top + dy), st.agent.id, `${st.agent.id} +(${dx},${dy})`);
      }
      assert.ok(height * scale >= 6.5 * 1.35, 'plate stays readable on screen');
    }
  });
}

test('plate depth: a walker in front of a desk owns the plate area, a walker behind it does not', () => {
  const s = snap([group(3)]);
  const layout = layoutOffices(s);
  const [, owner, other] = layout.rooms[0].stations;
  const base: any = step({}, s, 0, layout);
  const depth = owner.y + owner.height;
  const walk = (y: number) => ({ ...base, [other.agent.id]: { ...base[other.agent.id], moving: true, x: owner.plate.x, y } });
  assert.equal(agentAtPoint(layout, walk(depth + 20), owner.plate.x, owner.plate.y), other.agent.id, 'front');
  assert.equal(agentAtPoint(layout, walk(depth - 20), owner.plate.x, owner.plate.y), owner.agent.id, 'behind');
});

test('scenePoint maps a scaled canvas click to scene coordinates, including fractional offsets and fit-to-width', () => {
  const layout = layoutOffices(snap([group(6)]));
  assert.deepEqual(scenePoint(225, 150, { left: 50, top: 50, width: 768, height: layout.height / 2 }, layout), { x: 350, y: 200 });
  assert.equal(scenePoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }, layout), null);
  const shown = fitSceneWidth(layout.width, layout.height, 400);
  const bounds = { left: 40, top: 10, ...shown };
  const s = snap([group(6)]);
  const actors = step({}, s, 0, layout);
  for (const st of everyone(layout)) {
    const p = scenePoint(bounds.left + st.plate.x * shown.width / layout.width, bounds.top + st.plate.y * shown.height / layout.height, bounds, layout)!;
    assert.equal(agentAtPoint(layout, actors, p.x, p.y), st.agent.id);
  }
});
