import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, group, layoutOffices, manifest, mixed, snap, snapAll, solo } from './helpers/scene.ts';

const HEADER = 84; // width 1536에서의 상단바 높이
interface Rect { x: number; y: number; width: number; height: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const pod = (st: any): Rect => ({ x: st.x, y: st.y, width: st.width, height: st.height });
const plate = (st: any, h = 44): Rect => ({ x: st.plate.x - st.plateWidth / 2, y: st.plate.y - h / 2, width: st.plateWidth, height: h });

// assets/office/manifest.json의 layout 규칙(v10 목업)을 구현과 독립적으로 다시 계산한다.
function expected(n: number, i: number) {
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
  const width = n <= 6 ? 310 : 258;
  const x = n <= 6 ? 350 + (i % cols) * 380 : 340 + (i % 4) * 286;
  const y = n <= 3 ? 610 : n <= 6 ? 450 + Math.floor(i / 3) * 275 : 500 + Math.floor(i / 4) * 260;
  return { x, y, width, seatX: x + width * 0.27, seatY: y + width * 0.61, actorHeight: n <= 6 ? 240 : 200 };
}

test('manifest layout rules are the ones this test encodes (fails loudly if art changes the contract)', () => {
  assert.equal(manifest.layout.columns, 'N<=3 ? N : N<=6 ? 3 : 4');
  assert.equal(manifest.layout.podLeft, 'N<=6 ? 350+i%columns*380 : 340+i%4*286');
  assert.equal(manifest.layout.podTop, 'N<=3 ? 610 : N<=6 ? 450+floor(i/3)*275 : 500+floor(i/4)*260');
  assert.equal(manifest.layout.podWidth, 'N<=6 ? 310 : 258');
  assert.deepEqual([manifest.layout.minN, manifest.layout.maxN], [1, 16]);
});

for (let n = 1; n <= 16; n++) {
  test(`N=${n}: member stations follow the v10 layout formulas and the manager is extra`, () => {
    const s = snap([group(n)]);
    const room = layoutOffices(s).rooms[0];
    assert.equal(room.stations.length, n + 1);
    assert.equal(room.stations[0].manager, true);
    assert.equal(room.background, n <= 3 ? 'small' : n <= 6 ? 'medium' : 'large');
    assert.equal(room.sceneHeight, n <= 6 ? 1024 : 1536);
    room.stations.slice(1).forEach((st, i) => {
      const want = expected(n, i);
      assert.equal(st.x, want.x, `x of #${i}`);
      assert.equal(st.y - room.sceneY, want.y, `y of #${i}`);
      assert.equal(st.width, want.width);
      assert.ok(Math.abs(st.seat.x - want.seatX) < 1e-9 && Math.abs(st.seat.y - room.sceneY - want.seatY) < 1e-9, `seat of #${i}`);
      assert.equal(st.actorHeight, want.actorHeight);
      assert.equal(st.pod, i % 3);
      assert.equal(st.manager, false);
    });
  });

  test(`N=${n}: nothing overlaps and everything stays inside the room`, () => {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const members = room.stations.filter(st => !st.manager);
    for (const st of members) {
      const r = pod(st);
      assert.ok(r.x >= 0 && r.x + r.width <= 1536, `pod #${st.index} inside the width`);
      assert.ok(r.y >= room.sceneY && r.y + r.height <= room.sceneY + room.sceneHeight, `pod #${st.index} inside the height`);
      assert.ok(st.seat.x > r.x && st.seat.x < r.x + r.width && st.seat.y > r.y && st.seat.y < r.y + r.height, 'seat is on its own desk');
    }
    for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) {
      assert.ok(!overlaps(pod(members[a]), pod(members[b])), `pods ${a}/${b}`);
      assert.ok(!overlaps(plate(members[a], 30), plate(members[b], 30)), `plates ${a}/${b}`);
    }
    const all = room.stations;
    assert.equal(new Set(all.map(st => `${st.seat.x},${st.seat.y}`)).size, all.length, 'seats are unique');
    assert.equal(new Set(all.map(st => `${st.plate.x},${st.plate.y}`)).size, all.length, 'plates are unique');
    assert.equal(new Set(all.map(st => st.agent.id)).size, all.length);
  });
}

test('manager sits at the lead position of the room background and gets the lead nameplate', () => {
  for (const [n, background] of [[2, 'small'], [5, 'medium'], [12, 'large']] as const) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const lead = room.stations[0], want = (manifest.lead as any)[background];
    assert.deepEqual([lead.seat.x, lead.seat.y - room.sceneY], want.foot);
    assert.equal(lead.actorHeight, want.height);
    assert.deepEqual([lead.plate.x, lead.plate.y - room.sceneY], (manifest.ui.nameplates.leadAnchors as any)[background]);
    assert.equal(lead.plateWidth, manifest.ui.nameplates.leadWidth);
  }
});

test('pod geometry comes from the pod sheet sizes in the manifest', () => {
  const room = layoutOffices(snap([group(6)])).rooms[0];
  for (const st of room.stations.filter(x => !x.manager)) {
    const [w, h] = (assetData as any)[`pod-${st.pod}-back`].size;
    assert.ok(Math.abs(st.height - st.width * h / w) < 1e-9);
  }
});

test('solo office: one station, no manager figure, background small, same pod rule as N=1', () => {
  const room = layoutOffices(snap([solo('s')])).rooms[0];
  assert.equal(room.stations.length, 1);
  assert.equal(room.stations[0].manager, false);
  assert.equal(room.background, 'small');
  const want = expected(1, 0);
  assert.equal(room.stations[0].x, want.x);
  assert.equal(room.stations[0].y - room.sceneY, want.y);
  assert.equal(room.title, 'Solo Agent');
});

test('scope all: every project office gets its own room, stacked top to bottom without overlap, in snapshot order', () => {
  const s = snapAll([
    { name: 'alpha', offices: [group(3, 'a'), solo('as')] },
    { name: 'beta', offices: [mixed(10, 'b')] },
    { name: 'gamma', offices: [solo('c')] },
  ]);
  const layout = layoutOffices(s);
  assert.deepEqual(layout.rooms.map(r => r.projectName), ['alpha', 'alpha', 'beta', 'gamma']);
  assert.deepEqual(layout.rooms.map(r => r.id), ['a', 'as', 'b', 'c']);
  for (let i = 1; i < layout.rooms.length; i++) {
    const prev = layout.rooms[i - 1], cur = layout.rooms[i];
    assert.ok(cur.y >= prev.y + prev.height, `room ${i} starts below room ${i - 1}`);
    assert.equal(cur.sceneY, cur.y + HEADER);
  }
  const last = layout.rooms.at(-1)!;
  assert.equal(layout.height, last.y + last.height);
  assert.equal(layout.width, 1536);
  // 서로 다른 방의 좌석·이름표는 겹치지 않는다.
  const all = layout.rooms.flatMap(r => r.stations);
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) assert.notDeepEqual(all[a].seat, all[b].seat);
});

test('room count and size: every N from 1 to 16 stays within the canvas sizes of the manifest', () => {
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const [, h] = n <= 6 ? manifest.layout.canvas : manifest.layout.largeCanvas;
    assert.equal(room.sceneHeight, h);
    assert.equal(room.height, h + HEADER);
  }
});

test('empty snapshot: no rooms and a "No agents" header; offices without anyone are skipped', () => {
  const empty = layoutOffices(snap([]));
  assert.equal(empty.rooms.length, 0);
  assert.deepEqual(empty.headers.map(h => h.text), ['No agents']);
  assert.ok(empty.height >= 140);
  const hollow = layoutOffices(snap([{ id: 'x', kind: 'group', manager: null, members: [] }]));
  assert.equal(hollow.rooms.length, 0);
});

test('away slots on the sofa never coincide with each other', () => {
  const room = layoutOffices(snap([group(10)])).rooms[0];
  const sofas = room.stations.filter(st => st.hasSofa);
  assert.equal(sofas.length, 2);
  assert.notDeepEqual(sofas[0].away, sofas[1].away);
});
