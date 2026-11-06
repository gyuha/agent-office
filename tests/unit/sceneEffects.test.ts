import test from 'node:test';
import assert from 'node:assert/strict';
import { office, project, trace, overlaps, type Box } from './helpers/scene.ts';

// 이미지 박스는 투명 여백을 포함하므로 이름표 쪽을 2px 안으로 줄여 비교한다.
const shrink = (b: Box): Box => ({ x: b.x + 2, y: b.y + 2, width: b.width - 4, height: b.height - 4 });
const STATES = ['working', 'away', 'phone', 'sleeping'] as const;

// 앞/뒤 좌석, 독립석을 모두 포함하도록 매니저 + 멤버 4명(섬 앞줄 2, 뒷줄 2)과 solo를 쓴다.
const OFFICES = [1, 5];

function withAttention(count: number, state: (typeof STATES)[number]) {
  const o = office(count, 'o', state);
  const all = [...(o.manager ? [o.manager] : []), ...o.members];
  for (const agent of all) (agent as { needsAttention: boolean }).needsAttention = true;
  return project([o]);
}

for (const count of OFFICES) {
  for (const state of STATES) {
    test(`attention badge never overlaps any name plate (${count} agents, ${state})`, () => {
      const { images, labels } = trace(withAttention(count, state), {}, 1000);
      const badges = images.filter(item => item.key === 'effects/attention');
      assert.equal(badges.length, count);
      for (const badge of badges) {
        for (const label of labels) assert.ok(!overlaps(badge.box, label), `badge ${JSON.stringify(badge.box)} / label ${JSON.stringify(label)}`);
      }
    });
  }
}

for (const count of OFFICES) {
  test(`zzz never overlaps any name plate while sleeping, over a full animation period (${count} agents)`, () => {
    const snapshot = project([office(count, 'o', 'sleeping')]);
    for (const time of [0, 250, 500, 750, 1000, 1250, 1500]) {
      const { images, labels } = trace(snapshot, {}, time);
      const zzz = images.filter(item => item.key === 'effects/zzz');
      assert.equal(zzz.length, count, `t=${time}`);
      for (const item of zzz) {
        for (const label of labels) assert.ok(!overlaps(item.box, shrink(label)), `t=${time} zzz ${JSON.stringify(item.box)} / label ${JSON.stringify(label)}`);
      }
    }
  });
}

test('floor-shadow is drawn only under desks that exist, one per island seat', () => {
  for (const count of [2, 3, 4, 5, 6, 7, 11, 15]) {
    const { layout, images } = trace(project([office(count)]));
    const room = layout.rooms[0];
    const shadows = images.filter(item => item.key === 'room/floor-shadow').map(item => item.box);
    const seats = room.stations.filter(station => station.island !== null);
    assert.equal(shadows.length, seats.length, `count=${count}`);
    // 각 그림자는 자기 책상 발치(x-44, deskY+21, 88x22)에 정확히 하나씩 있고, 그 밖의 그림자는 없다.
    const expected = seats.map(seat => ({ x: seat.seat.x - 44,
      y: seat.seat.y + (seat.facing === 'back' ? -33 : 5) + 21, width: 88, height: 22 }));
    for (const want of expected) {
      const found = shadows.filter(got => Math.abs(got.x - want.x) < 0.01 && Math.abs(got.y - want.y) < 0.01);
      assert.equal(found.length, 1, `count=${count} shadow ${JSON.stringify(want)}`);
    }
  }
});

test('with two agents in an island row, no floor-shadow is drawn over the empty back row', () => {
  const { layout, images } = trace(project([office(3)]));
  const island = layout.rooms[0].islands[0];
  const backRowY = island.y + 49;
  const shadows = images.filter(item => item.key === 'room/floor-shadow');
  assert.equal(shadows.length, 2);
  for (const shadow of shadows) assert.ok(shadow.box.y + shadow.box.height <= backRowY + 8, JSON.stringify(shadow.box));
});

test('solo rooms draw no water cooler and group rooms draw both pantry items', () => {
  const solo = trace(project([office(1)])).images.map(item => item.key);
  assert.ok(solo.includes('furniture/coffee-machine'));
  assert.ok(!solo.includes('furniture/water-cooler'));
  const group = trace(project([office(3)])).images.map(item => item.key);
  assert.ok(group.includes('furniture/water-cooler'));
});
