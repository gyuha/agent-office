import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutOffices, step, office, project, trace } from './helpers/scene.ts';

type Rect = { x: number; y: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (room: Rect, p: { x: number; y: number }) =>
  p.x >= room.x && p.x <= room.x + room.width && p.y >= room.y && p.y <= room.y + room.height;
const STATES = ['working', 'away', 'phone', 'sleeping'] as const;

// 그룹 오피스에서 매니저를 뺀 멤버 수 기준: count명이면 office(count + 1).
const room = (members: number, state?: (typeof STATES)[number]) => layoutOffices(project([office(members + 1, 'o', state)]), 800).rooms[0];

test('an island seats at most four agents, and every island seat points at an existing island', () => {
  for (let members = 1; members <= 30; members++) {
    const r = room(members);
    const perIsland = new Map<number, number>();
    for (const station of r.stations) {
      if (station.island === null) continue;
      assert.ok(station.island >= 0 && station.island < r.islands.length, `members=${members}`);
      perIsland.set(station.island, (perIsland.get(station.island) ?? 0) + 1);
    }
    for (const [island, seats] of perIsland) assert.ok(seats <= 4, `members=${members} island=${island} seats=${seats}`);
    assert.equal(r.stations.length, members + 1);
  }
});

test('more agents never shrink the room, and the island count follows ceil(shared seats / 4)', () => {
  let previousIslands = 0, previousHeight = 0, previousWidth = 0;
  for (let members = 1; members <= 30; members++) {
    const r = room(members);
    const shared = r.stations.filter(station => station.island !== null).length;
    assert.equal(r.islands.length, Math.ceil(shared / 4), `members=${members}`);
    // 6명째부터 창가 자리 2개가 생겨 섬이 일시적으로 하나 줄 수 있다(5→6). 그 외에는 줄지 않는다.
    if (members !== 6) assert.ok(r.islands.length >= previousIslands, `members=${members}`);
    assert.ok(r.height >= previousHeight && r.width >= previousWidth, `members=${members}`);
    previousIslands = r.islands.length; previousHeight = r.height; previousWidth = r.width;
  }
});

test('adding a third island row makes the room taller, and a new island adds a seat row', () => {
  const heights = new Map<number, number>();
  for (let members = 1; members <= 30; members++) {
    const r = room(members);
    heights.set(r.islands.length, Math.max(heights.get(r.islands.length) ?? 0, r.height));
  }
  const counts = [...heights.keys()].sort((a, b) => a - b).filter(count => count > 0);
  for (let i = 1; i < counts.length; i++) {
    const rowsBefore = Math.ceil(counts[i - 1] / 2), rowsAfter = Math.ceil(counts[i] / 2);
    if (rowsAfter > rowsBefore) assert.ok(heights.get(counts[i])! > heights.get(counts[i - 1])!, `islands ${counts[i - 1]} -> ${counts[i]}`);
  }
  assert.ok(room(14).height > room(3).height);
  assert.ok(room(7).islands.length > room(3).islands.length || room(7).height >= room(3).height);
});

test('room area grows strictly across 1, 3, 7 and 15 agents', () => {
  const areas = [1, 3, 7, 15].map(n => { const r = layoutOffices(project([office(n)]), 800).rooms[0]; return r.width * r.height; });
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] > areas[i - 1], areas.join(','));
});

for (const state of [undefined, 'working', 'away'] as const) {
  test(`15 agents (${state ?? 'mixed states'}): every seat, away slot and settled actor is inside the room`, () => {
    const snapshot = project([office(15, 'o', state)]);
    const layout = layoutOffices(snapshot, 800);
    const r = layout.rooms[0];
    assert.equal(r.stations.length, 15);
    let actors = step({}, snapshot, 0, layout);
    for (let i = 0; i < 400; i++) actors = step(actors, snapshot, 100, layout);
    for (const station of r.stations) {
      const id = station.agent.id;
      assert.ok(inside(r, station.seat), `seat of ${id} ${JSON.stringify(station.seat)}`);
      assert.ok(inside(r, station.away), `away of ${id} ${JSON.stringify(station.away)}`);
      assert.ok(inside(r, actors[id]), `actor ${id} ${JSON.stringify(actors[id])}`);
      assert.equal(actors[id].moving, false, id);
    }
    assert.ok(r.x + r.width <= layout.width && r.y + r.height <= layout.height);
  });
}

test('away slots never coincide, even with the maximum 15 agents', () => {
  for (const members of [1, 3, 6, 14, 20, 30]) {
    const stations = room(members).stations;
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        assert.notDeepEqual(stations[i].away, stations[j].away, `members=${members}: ${stations[i].agent.id}/${stations[j].agent.id}`);
      }
    }
  }
});

test('away slots stay at least one body width apart', () => {
  for (const members of [3, 6, 14]) {
    const stations = room(members).stations;
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        const d = Math.hypot(stations[i].away.x - stations[j].away.x, stations[i].away.y - stations[j].away.y);
        assert.ok(d >= 30, `members=${members}: ${stations[i].agent.id}/${stations[j].agent.id} distance ${d.toFixed(1)}`);
      }
    }
  }
});

// draw.ts의 이름표 사각형 계산을 그대로 따른다.
function labelBoxes(state: (typeof STATES)[number] | undefined, count: number) {
  const snapshot = project([office(count, 'o', state)]);
  const layout = layoutOffices(snapshot, 800);
  const actors = step({}, snapshot, 0, layout);
  return layout.rooms.flatMap(r => r.stations.map(station => {
    const actor = actors[station.agent.id];
    const name = station.agent.name.slice(0, 18);
    const width = Math.max(30, name.length * 5.3 + 10);
    const rear = station.facing === 'back' && !actor.moving && station.agent.state !== 'away';
    return { id: station.agent.id, x: actor.x - width / 2, y: actor.y + (rear ? 15 : -54), width, height: 13 };
  }));
}

for (const state of [undefined, 'working', 'away', 'sleeping'] as const) {
  for (const count of [1, 3, 7, 15]) {
    test(`name plates do not overlap each other (${count} agents, ${state ?? 'mixed'})`, () => {
      const boxes = labelBoxes(state, count);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          assert.ok(!overlaps(boxes[i], boxes[j]), `${boxes[i].id} overlaps ${boxes[j].id}`);
        }
      }
    });
  }
}

test('offices never overlap, in project scope with several offices and in all scope', () => {
  const offices = [1, 3, 7, 15].map((n, i) => office(n, `office-${i}-`));
  const multi = layoutOffices(project(offices), 800);
  const all = layoutOffices({ scope: 'all', generatedAt: 0, projects: [7, 3, 1, 15].map((n, i) => ({
    projectId: `p${i}`, projectName: `P${i}`, offices: [office(n, `p${i}-`)] })) } as never, 800);
  for (const [label, layout] of [['multi-office', multi], ['all', all]] as const) {
    assert.equal(layout.rooms.length, 4);
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        assert.ok(!overlaps(layout.rooms[i], layout.rooms[j]), `${label}: ${layout.rooms[i].id} / ${layout.rooms[j].id}`);
      }
    }
    for (const r of layout.rooms) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= layout.width && r.y + r.height <= layout.height, label);
  }
});

test('the manager desk and seat are inside the glass manager room', () => {
  for (const members of [1, 3, 7, 14]) {
    const r = room(members);
    const manager = r.stations.find(station => station.manager)!;
    assert.ok(r.managerRoom, `members=${members}`);
    const desk = { x: manager.seat.x - 44, y: manager.seat.y + 5, width: 88, height: 39 };
    const glass = r.managerRoom!;
    assert.ok(desk.x >= glass.x && desk.x + desk.width <= glass.x + glass.width, `members=${members}`);
    assert.ok(desk.y >= glass.y && desk.y + desk.height <= glass.y + glass.height, `members=${members}`);
    assert.ok(manager.seat.y >= glass.y && manager.seat.y <= glass.y + glass.height, `members=${members}`);
  }
});

// 서 있는 캐릭터의 그림 영역(측정값: x±31, y-47..y+32)과 이름표를 모두 고려한다.
for (const count of [3, 7, 15]) {
  test(`all-away with ${count} agents: bodies and name plates never overlap and stay inside the room`, () => {
    const snapshot = project([office(count, 'o', 'away')]);
    const { layout, actors, labels } = trace(snapshot);
    const r = layout.rooms[0];
    const bodies = r.stations.map(station => {
      const a = actors[station.agent.id];
      return { x: a.x - 31, y: a.y - 47, width: 62, height: 79 };
    });
    const parts = bodies.map((body, i) => ({ body, label: labels[i] }));
    for (let i = 0; i < parts.length; i++) {
      assert.ok(inside(r, parts[i].body) && inside(r, { x: parts[i].body.x + 62, y: parts[i].body.y + 79 }), `body ${i}`);
      assert.ok(parts[i].label.x >= r.x && parts[i].label.x + parts[i].label.width <= r.x + r.width, `label ${i} clipped`);
      for (let j = 0; j < parts.length; j++) {
        if (i === j) continue;
        if (j > i) assert.ok(!overlaps(parts[i].body, parts[j].body), `body ${i} / body ${j}`);
        assert.ok(!overlaps(parts[i].label, parts[j].body), `label ${i} / body ${j}`);
      }
    }
  });
}
