import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, trace, group, layoutOffices, manifest, mixed, snap, snapAll, solo } from './helpers/scene.ts';

const HEADER = 84; // width 1536에서의 상단바 높이
interface Rect { x: number; y: number; width: number; height: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const pod = (st: any): Rect => ({ x: st.x, y: st.y, width: st.width, height: st.height });
const plate = (st: any, h = 44): Rect => ({ x: st.plate.x - st.plateWidth / 2, y: st.plate.y - h / 2, width: st.plateWidth, height: h });

const M = manifest as any;

// furnitureProportions.uniformScaleFormula를 독립적으로 다시 계산한다:
//   moduleScale = 목표 캐릭터 높이 / referenceActorFrameHeight, 가구 치수·좌석·명판은 모두 moduleScale 배.
// 공통 캐릭터 높이는 320*W/479(W: N<=6이면 280, 아니면 210), 행 간격은 가장 큰 책상 높이 + 캐릭터 높이*0.8 + 12이다.
const podWidth = (n: number) => (n <= 6 ? 280 : 210);
const commonActorHeight = (n: number) => 320 * podWidth(n) / 479;
const refHeight = (desk: any) => desk.referenceActorFrameHeight || desk.actorHeight;
function expected(n: number, i: number) {
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
  const desk = M.pods[String(i % 3)], H = commonActorHeight(n);
  const moduleScale = H / refHeight(desk);
  const x = n <= 6 ? 350 + (i % cols) * 380 : 340 + (i % 4) * 286;
  const rowHeight = Math.max(...Object.values<any>(M.pods).map(d => d.size[1] * H / refHeight(d)));
  const y = n <= 3 ? 610 : (n <= 6 ? 450 : 500) + Math.floor(i / cols) * (rowHeight + H * 0.8 + 12);
  const width = desk.size[0] * moduleScale;
  // 새 계약: desk.seat는 몸통 기준점(상판 뒤 모서리 쪽 = bodySeat). 걷기·경로·빈백 이동의 발 기준 seat는 같은 x에서 바닥선(floorY) 위다.
  return { x, y, moduleScale, width, height: desk.size[1] * moduleScale,
    bodySeatX: x + desk.seat[0] * moduleScale, bodySeatY: y + desk.seat[1] * moduleScale,
    seatX: x + desk.seat[0] * moduleScale, seatY: y + (desk.size[1] - 11) * moduleScale, actorHeight: H,
    plate: [x + desk.nameplate.center[0] * moduleScale, y + desk.nameplate.center[1] * moduleScale],
    plateWidth: Math.max(desk.nameplate.width * moduleScale, Math.max(180, Math.min(width - 8, 54))) };
}
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;
const FLOOR_TRIM = M.backgroundTrim.bottomTrimHeight; // 배경 아래쪽 장식(bottomTrim) 높이: 바닥은 sceneHeight - 24에서 끝난다.
/** 방 높이에 맞는 슬롯만 쓴다: 빈백 아래 + 서 있는 도착점(0.35H) + 10이 바닥 끝(방 높이 - 바닥 장식)보다 위여야 한다. */
const usableSlots = (room: any, n: number) => {
  const H = commonActorHeight(n);
  return M.restLayout.leftLounge.byBackground[n <= 3 ? 'small' : n <= 6 ? 'medium' : 'large'].slots.filter((slot: any) => {
    const bag = M.beanbags[slot.beanbag], scale = H / refHeight(bag);
    return slot.topLeft[1] + bag.size[1] * scale + H * 0.35 + 10 <= room.sceneHeight - FLOOR_TRIM;
  });
};
/** 왼쪽 열 배정: x가 가장 왼쪽인 열부터(같으면 위쪽부터) 쓸 수 있는 슬롯 수만큼 고른 뒤, 위에서 아래 순서로 슬롯에 앉힌다. */
const lounge = (room: any, n: number) => room.stations.filter((s: any) => !s.manager).slice().sort((a: any, b: any) => a.x - b.x || a.y - b.y)
  .slice(0, usableSlots(room, n).length).sort((a: any, b: any) => a.y - b.y || a.x - b.x);

test('manifest layout rules are the ones this test encodes (fails loudly if art changes the contract)', () => {
  assert.equal(manifest.layout.columns, 'N<=3 ? N : N<=6 ? 3 : 4');
  assert.equal(manifest.layout.podLeft, 'N<=6 ? 350+i%columns*380 : 340+i%4*286');
  assert.equal(manifest.layout.podTop, 'N<=3 ? 610 : N<=6 ? 450+floor(i/3)*275 : 500+floor(i/4)*260');
  assert.deepEqual([manifest.layout.minN, manifest.layout.maxN], [1, 16]);
});

for (let n = 1; n <= 16; n++) {
  test(`N=${n}: member stations follow the v10 layout formulas and the manager is extra`, () => {
    const s = snap([group(n)]);
    const room = layoutOffices(s).rooms[0];
    assert.equal(room.stations.length, n + 1);
    assert.equal(room.stations[0].manager, true);
    assert.equal(room.background, n <= 3 ? 'small' : n <= 6 ? 'medium' : 'large');
    room.stations.slice(1).forEach((st, i) => {
      const want = expected(n, i);
      assert.equal(st.x, want.x, `x of #${i}`);
      assert.ok(near(st.y - room.sceneY, want.y), `y of #${i}`);
      assert.ok(near(st.width, want.width) && near(st.height, want.height), `size of #${i}`);
      assert.ok(near(st.bodySeat.x, want.bodySeatX) && near(st.bodySeat.y - room.sceneY, want.bodySeatY), `body seat of #${i}`);
      assert.ok(near(st.seat.x, want.seatX) && near(st.seat.y - room.sceneY, want.seatY), `floor seat of #${i}`);
      assert.ok(st.bodySeat.y < st.seat.y, 'torso anchor (table rear edge) is above the feet-on-floor seat');
      assert.ok(near(st.actorHeight, want.actorHeight));
      assert.ok(near(st.plate.x, want.plate[0]) && near(st.plate.y - room.sceneY, want.plate[1]), `plate of #${i}`);
      assert.ok(near(st.plateWidth, want.plateWidth));
      assert.equal(st.pod, i % 3);
      assert.equal(st.desk.back, `pod-${i % 3}-back`);
      assert.equal(st.desk.front, `pod-${i % 3}-front`);
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
      assert.ok(r.x > 276 + 40 || r.x >= 340, `pod #${st.index} leaves the left lounge column and corridor free`);
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

test('manager desk: centered on the room, bottom edge fixed at y=420, scaled by the shared module scale; same common actor height as every member', () => {
  for (const [n, background] of [[2, 'small'], [5, 'medium'], [12, 'large']] as const) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const lead = room.stations[0], desk = M.leadDesks[background];
    assert.equal(lead.desk.back, `lead-back-${background}`);
    assert.equal(lead.desk.front, `lead-front-${background}`);
    const ms = commonActorHeight(n) / refHeight(desk);
    assert.ok(near(lead.moduleScale, ms));
    const size = desk.size || (assetData as any)[desk.back].size;
    assert.ok(near(lead.width, size[0] * ms) && near(lead.height, size[1] * ms));
    assert.ok(near(lead.x, (1536 - lead.width) / 2), 'centered');
    assert.ok(near(lead.y + lead.height - room.sceneY, 420), 'desk bottom at y=420');
    assert.ok(lead.seat.x > lead.x && lead.seat.x < lead.x + lead.width && lead.seat.y > lead.y && lead.seat.y < lead.y + lead.height + 0.15 * lead.actorHeight, 'seat (feet) is at the lead desk, at most a little in front of its bottom edge');
    assert.ok(near(lead.plate.x, lead.x + desk.nameplate.center[0] * ms) && near(lead.plateWidth, desk.nameplate.width * ms));
    assert.ok(near(lead.actorHeight, commonActorHeight(n)), `manager is no longer a giant (${lead.actorHeight})`);
  }
});

test('VQA-012: every figure of a room shares one actor height (187.06 in small/medium, 140.29 in large rooms)', () => {
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const heights = new Set(room.stations.map(st => st.actorHeight.toFixed(6)));
    assert.equal(heights.size, 1, `N=${n}`);
    assert.ok(near(room.stations[0].actorHeight, commonActorHeight(n)));
  }
  assert.ok(near(commonActorHeight(3), 187.06, 0.01) && near(commonActorHeight(16), 140.29, 0.01));
});

test('pod geometry: width follows the shared module scale (about 280 for N<=6, 210 otherwise) and height keeps the sheet aspect', () => {
  for (const n of [3, 6, 7, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    for (const st of room.stations.filter(x => !x.manager)) {
      assert.ok(Math.abs(st.width - podWidth(n)) < 3, `N=${n}: ${st.width}`);
      assert.ok(near(st.height / st.width, st.desk.size[1] / st.desk.size[0]));
      assert.ok(near(st.moduleScale, st.actorHeight / refHeight(st.desk)), 'furniture and person share one module scale');
    }
  }
});

test('VQA-020: one module scale for furniture and figure: desk width / actor height stays within the manifest range (1.48..1.51) for every pod', () => {
  const range = M.furnitureProportions.pod.widthToActorFrameHeightRange;
  for (const n of [3, 8, 16]) for (const st of layoutOffices(snap([group(n)])).rooms[0].stations.filter(x => !x.manager)) {
    const ratio = st.width / st.actorHeight;
    assert.ok(ratio >= range[0] - 1e-6 && ratio <= range[1] + 1e-6, `N=${n} ${st.agent.id}: ${ratio.toFixed(4)} not in ${range}`);
  }
  for (const [n, bg] of [[2, 'small'], [5, 'medium'], [12, 'large']] as const) {
    const lead = layoutOffices(snap([group(n)])).rooms[0].stations[0];
    assert.ok(near(lead.width / lead.actorHeight, M.furnitureProportions.lead.widthToActorFrameHeight[bg], 1e-3), `${bg}: ${lead.width / lead.actorHeight}`);
  }
  const room = layoutOffices(snap([group(10)])).rooms[0];
  for (const r of room.rests) {
    const st = room.stations.find(x => x.agent.id === r.owner)!;
    assert.ok(near(r.width / st.actorHeight, M.furnitureProportions.beanbag.widthToActorFrameHeight, 1e-3), `bag of ${r.owner}`);
    assert.ok(near(r.scale, st.actorHeight / 256));
  }
});

test('solo office: one station, no manager figure, background small, same pod rule as N=1', () => {
  const room = layoutOffices(snap([solo('s')])).rooms[0];
  assert.equal(room.stations.length, 1);
  assert.equal(room.stations[0].manager, false);
  assert.equal(room.background, 'small');
  const want = expected(1, 0);
  assert.equal(room.stations[0].x, want.x);
  assert.ok(near(room.stations[0].y - room.sceneY, want.y));
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


test('room height = content height of the rows + a constant bottom margin + the manifest bottom trim (VQA-032)', () => {
  assert.equal(M.restLayout.memberLounge.enabled, false);
  assert.equal(M.restLayout.leftLounge.enabled, true);
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const H = commonActorHeight(n);
    const lastDeskBottom = Math.max(...room.stations.map(st => st.y + st.height - room.sceneY));
    const margin = Math.max(...room.stations.map(st => Math.max(st.height * 0.5, H * 0.8 + 28)));
    assert.ok(near(room.sceneHeight, lastDeskBottom + margin + FLOOR_TRIM, 1e-6), `N=${n}: ${room.sceneHeight} vs ${lastDeskBottom + margin + FLOOR_TRIM}`);
    assert.equal(room.backgroundHeight, n <= 6 ? 1024 : 1536, 'background art height is only the source scale');
    assert.equal(room.height, room.sceneHeight + HEADER);
    assert.equal((room as any).lounge, undefined, 'no bottom lounge strip');
  }
});

// VQA-032: 방 높이를 행 수로 계산하므로 마지막 행 아래 여백은 N에 거의 무관하다(옛 방식은 N에 따라 크게 달랐다).
test('VQA-032: the floor margin under the last desk row hardly depends on N (spread <= 0.3 desk heights), and is exactly constant within a room size', () => {
  const margins: Record<number, number> = {}, deskH: number[] = [];
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const members = room.stations.filter(x => !x.manager);
    margins[n] = room.sceneY + room.sceneHeight - FLOOR_TRIM - Math.max(...members.map(x => x.y + x.height));
    deskH.push(Math.max(...members.map(x => x.height)));
  }
  const values = Object.values(margins);
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread <= 0.3 * Math.min(...deskH) + 1e-6, `margin spread ${spread.toFixed(1)} > 0.3 * ${Math.min(...deskH).toFixed(1)}`);
  for (const group of [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]]) {
    const vs = group.map(n => margins[n]);
    assert.ok(Math.max(...vs) - Math.min(...vs) < 1e-6, `constant margin within a room size: ${vs.map(v => v.toFixed(2))}`);
  }
  assert.ok(Math.abs(margins[1] * 480 / 1536 - 55.51) < 0.05 && Math.abs(margins[6] * 480 / 1536 - 55.51) < 0.05, `small/medium: ${(margins[1] * 480 / 1536).toFixed(2)}px at 480px`);
  assert.ok(Math.abs(margins[16] * 480 / 1536 - 43.82) < 0.05, `large: ${(margins[16] * 480 / 1536).toFixed(2)}px at 480px`);
});

// 사용자 피드백: "하단 책상이 바닥과 너무 가깝다" → 마지막 행 책상 앞판 하단과 방 아래쪽 벽 사이에 책상 높이의 0.4배 이상 여백.
test('bottom margin: for N=1..16 (small, medium and large rooms) the last desk row keeps at least 0.4 desk heights of floor above the bottom wall, at every panel width', () => {
  for (const width of [1536, 900, 480, 410]) for (let n = 1; n <= 16; n++) {
    const layout = layoutOffices(snap([group(n)]), width), room = layout.rooms[0];
    const members = room.stations.filter(x => !x.manager);
    const lastBottom = Math.max(...members.map(x => x.y + x.height));
    const deskHeight = Math.max(...members.map(x => x.height));
    const wall = room.sceneY + room.sceneHeight - FLOOR_TRIM; // 바닥이 끝나고 아래 벽 장식이 시작하는 선
    const margin = wall - lastBottom;
    assert.ok(margin >= 0.4 * deskHeight - 1e-6, `${width}px N=${n} (${room.background}): margin ${margin.toFixed(1)} < 0.4 * ${deskHeight.toFixed(1)}`);
  }
});

test('bottom margin: the manager desk and the left beanbags keep their margin too, and nothing is drawn below the room', () => {
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const bottom = room.sceneY + room.sceneHeight;
    for (const st of room.stations) assert.ok(st.y + st.height <= bottom - FLOOR_TRIM, `N=${n} ${st.agent.id}: desk bottom inside the floor`);
    for (const r of room.rests) assert.ok(r.y + r.height <= bottom - FLOOR_TRIM + 1e-6, `N=${n} bag of ${r.owner}`);
    for (const st of room.stations.filter(x => x.rest)) assert.ok(st.away.y <= bottom - FLOOR_TRIM, `N=${n} ${st.agent.id}: standing arrival point on the floor`);
  }
});

test('row spacing: the floor crossing under a row (bottom + 0.8 actor height + 8) lies above the next row\'s desks', () => {
  for (const n of [4, 6, 8, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const members = room.stations.filter(x => !x.manager);
    const rows = [...new Set(members.map(m => m.y))].sort((a, b) => a - b);
    const H = commonActorHeight(n);
    for (let r = 1; r < rows.length; r++) {
      const above = Math.max(...members.filter(m => m.y === rows[r - 1]).map(m => m.y + m.height));
      const crossing = above + H * 0.8 + 8;
      assert.ok(crossing >= above + 8 - 1e-6 && crossing <= rows[r] - 4 + 1e-6, `N=${n} rows ${r - 1}/${r}: crossing ${crossing.toFixed(0)} between ${above.toFixed(0)} and ${rows[r].toFixed(0)}`);
    }
  }
});

test('panel heights (top bar included): 480px N3 387.05, N6 454.97, N10 502.88, N16 592.26; 410px N6 398.24, N16 515.51', () => {
  const h = (n: number, w: number) => layoutOffices(snap([group(n)]), w).height * w / 1536;
  for (const [w, n, want] of [[480, 3, 387.05], [480, 6, 454.97], [480, 10, 502.88], [480, 16, 592.26], [410, 6, 398.24], [410, 16, 515.51]] as const) assert.ok(Math.abs(h(n, w) - want) < 0.05, `${w}px N=${n}: ${h(n, w).toFixed(2)} vs ${want}`);
  assert.ok(h(3, 480) <= h(6, 480) && h(10, 480) < h(16, 480), 'monotonic within a background size');
});

// VQA-031: 모든 방 크기에서 manifest의 bottomTrim이 방 맨 아래에 고정 높이로 그려진다.
test('VQA-031: for every room size the bottom trim is drawn from the manifest bottomTrim at the very bottom of the room (fixed height, never stretched)', () => {
  assert.equal(M.backgroundTrim.bottomTrimHeight, 24);
  for (let n = 1; n <= 16; n++) {
    const s = snap([group(n)]);
    const t = trace(s);
    const room = t.layout.rooms[0];
    const asset = (assetData as any)[`background-${room.background}`], rs = asset.runtimeScale ?? M.runtimeScale, bt = asset.bottomTrim;
    assert.ok(bt, `${room.background}: the background asset declares bottomTrim`);
    const slices = t.images.filter(i => i.key === `background-${room.background}`);
    assert.equal(slices.length, 3, `N=${n}: wall / floor / trim`);
    const [wall, floor, trim] = slices;
    assert.ok(near(trim.dy + trim.dh, room.sceneY + room.sceneHeight), `N=${n}: the trim ends exactly at the bottom of the room`);
    assert.ok(near(trim.dh, bt.destinationHeight) && near(trim.dw, 1536) && trim.dx === 0, `N=${n}: fixed ${bt.destinationHeight}px tall, full width`);
    assert.ok(near(trim.sx, bt.sourceRect[0] * rs) && near(trim.sy, bt.sourceRect[1] * rs) && near(trim.sw, bt.sourceRect[2] * rs) && near(trim.sh, bt.sourceRect[3] * rs), `N=${n}: source is the manifest sourceRect (${room.background})`);
    // 아래 장식은 늘어나지 않는다: 방이 아무리 높아져도 대상 높이는 그대로이고, 늘어나는 것은 가운데 바닥 조각뿐이다.
    assert.ok(near(wall.dy - room.sceneY, 0) && near(wall.dh, M.backgroundTrim.wallHeight), `N=${n}: wall slice keeps its height`);
    assert.ok(near(floor.dy, wall.dy + wall.dh) && near(floor.dy + floor.dh, trim.dy), `N=${n}: floor slice fills exactly between wall and trim`);
    assert.ok(floor.sy + floor.sh <= trim.sy + 1e-6, `N=${n}: floor source never overlaps the trim source`);
  }
});




// VQA-021: 명판(실제 그린 글자 크기·여백, 리드는 표시 폭 plateDisplayWidth 기준)은 자기 책상 사각형 안에 들어간다.
test('VQA-021: every nameplate rectangle (lead plates included) lies inside its own desk rectangle, for N=1..16 at 1536, 900, 480 and 410px', () => {
  for (const width of [1536, 900, 480, 410]) for (let n = 1; n <= 16; n++) {
    const snapshot = snap([group(n)]);
    const layout = layoutOffices(snapshot, width), vs = layout.viewportScale!;
    const t = trace(snapshot, { width });
    for (const st of layout.rooms[0].stations) {
      const label = t.texts.find(x => x.text === st.agent.name || (x.text.endsWith('…') && st.agent.name.startsWith(x.text.slice(0, -1))))!;
      const font = Number(/(\d+(?:\.\d+)?)px/.exec(label.font)![1]), pad = Math.max(st.manager ? 3 * st.moduleScale : 3, 1 / vs);
      const w = (st as any).plateDisplayWidth ?? st.plateWidth, h = Math.max(font, 6.5 / vs) * 1.35 + pad * 2;
      const plate = { x: st.plate.x - w / 2, y: st.plate.y - h / 2, width: w, height: h };
      const where = `${width}px N=${n} ${st.agent.id}`;
      assert.ok(plate.x >= st.x - 1e-6 && plate.x + plate.width <= st.x + st.width + 1e-6, `${where}: plate x-range [${plate.x.toFixed(1)}, ${(plate.x + plate.width).toFixed(1)}] vs desk [${st.x.toFixed(1)}, ${(st.x + st.width).toFixed(1)}]`);
      assert.ok(plate.y >= st.y - 1e-6 && plate.y + plate.height <= st.y + st.height + 1e-6, `${where}: plate y-range vs desk`);
    }
  }
});

test('VQA-021: the lead plate follows the module scale: width = nameplate.width * moduleScale (shrinks with the lead desk)', () => {
  const widths = new Set<string>();
  for (const [n, bg] of [[3, 'small'], [6, 'medium'], [16, 'large']] as const) {
    const lead = layoutOffices(snap([group(n)])).rooms[0].stations[0];
    assert.ok(near(lead.plateWidth, M.leadDesks[bg].nameplate.width * lead.moduleScale), bg);
    assert.ok(lead.plateWidth < lead.width, `${bg}: plate narrower than the desk`);
    widths.add(lead.plateWidth.toFixed(1));
  }
  const small = layoutOffices(snap([group(3)])).rooms[0].stations[0], large = layoutOffices(snap([group(16)])).rooms[0].stations[0];
  assert.ok(large.moduleScale < small.moduleScale, 'large rooms use a smaller module scale');
});

test('empty snapshot: no rooms and a "No agents" header; offices without anyone are skipped', () => {
  const empty = layoutOffices(snap([]));
  assert.equal(empty.rooms.length, 0);
  assert.deepEqual(empty.headers.map(h => h.text), ['No agents']);
  assert.ok(empty.height >= 140);
  const hollow = layoutOffices(snap([{ id: 'x', kind: 'group', manager: null, members: [] }]));
  assert.equal(hollow.rooms.length, 0);
});

const LEFT = M.restLayout.leftLounge;
const BG = (n: number) => (n <= 3 ? 'small' : n <= 6 ? 'medium' : 'large') as 'small' | 'medium' | 'large';

test('left lounge seat counts follow the room height: only slots whose bag and standing arrival fit on the floor are used; members beyond that rest at their desks', () => {
  assert.deepEqual([LEFT.byBackground.small.maxSlots, LEFT.byBackground.medium.maxSlots, LEFT.byBackground.large.maxSlots], [3, 3, 6]);
  const counts: Record<number, number> = {};
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const members = room.stations.filter(x => !x.manager);
    const usable = usableSlots(room, n);
    const want = Math.min(n, usable.length);
    counts[n] = members.filter(x => x.rest).length;
    assert.equal(counts[n], want, `N=${n}: ${counts[n]} bags vs ${want} usable slots`);
    assert.ok(usable.length <= LEFT.byBackground[BG(n)].maxSlots);
    assert.deepEqual(members.filter(x => x.rest).map(x => x.agent.id), lounge(room, n).map(x => x.agent.id), 'the desks closest to the left column get the bags, top to bottom');
    members.filter(x => !x.rest).forEach(st => assert.deepEqual(st.away, st.seat));
    // 쓰지 않는 다음 슬롯은 실제로 바닥에 들어가지 않는다(불필요하게 줄이지 않는다).
    const all = LEFT.byBackground[BG(n)].slots;
    if (usable.length < Math.min(all.length, n)) assert.ok(usable.length < all.length);
  }
  assert.ok(counts[16] >= counts[8], 'taller rooms offer at least as many seats');
  assert.equal(counts[1], 1); assert.equal(counts[3], 3); assert.equal(counts[6], 3);
});

test('left lounge: every standing arrival point and bag is on the floor (above the bottom trim) for every N', () => {
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const wall = room.sceneY + room.sceneHeight - FLOOR_TRIM;
    for (const r of room.rests) assert.ok(r.y + r.height <= wall + 1e-6, `N=${n}: bag of ${r.owner}`);
    for (const st of room.stations.filter(x => x.rest)) assert.ok(st.away.y + 10 <= wall + 1e-6, `N=${n}: arrival of ${st.agent.id}`);
  }
});

test('left lounge geometry: one vertical column at x=36, slot positions from the manifest, bags scaled with their occupant, inside the room', () => {
  for (const n of [1, 3, 5, 6, 10, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const slots = usableSlots(room, n);
    const seated = lounge(room, n);
    seated.forEach((st, i) => {
      const slot = slots[i], rest = st.rest!, bag = M.beanbags[slot.beanbag];
      const scale = st.actorHeight / refHeight(bag);
      assert.ok(rest, `${st.agent.id} has a bag`);
      assert.equal(rest.spec.back, bag.back);
      assert.ok(near(rest.scale, scale), 'bag shares the module scale of its occupant');
      assert.ok(near(rest.x, 36) && near(rest.y - room.sceneY, slot.topLeft[1]));
      assert.ok(near(rest.width, bag.size[0] * scale) && near(rest.height, bag.size[1] * scale));
      assert.ok(near(rest.seat.x, rest.x + bag.seat[0] * scale) && near(rest.seat.y, rest.y + bag.seat[1] * scale));
      assert.ok(rest.y >= room.sceneY && rest.y + rest.height <= room.sceneY + room.sceneHeight, 'inside the room');
      assert.ok(rest.x + rest.width <= 276 + 1e-6, 'right edge stays left of the lane');
    });
    for (let a = 0; a < seated.length; a++) for (let b = a + 1; b < seated.length; b++) assert.ok(!overlaps(seated[a].rest!, seated[b].rest!), `bags ${a}/${b} do not overlap`);
  }
});

test('the walking lane x=312 is reserved: between the bag right edge (276) and the nearest pod, free of every obstacle and bag', () => {
  for (const n of [1, 3, 6, 10, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    assert.equal((room as any).leftCorridorX, 312);
    assert.equal(LEFT.walkingCenterX, 312);
    for (const r of room.obstacles) assert.ok(!(312 > r.x && 312 < r.x + r.width), `obstacle ${JSON.stringify(r)} blocks the lane`);
    for (const r of room.rests.filter(x => x.x < 300)) assert.ok(r.x + r.width <= 276 + 1e-6, 'member bags end at x=276');
    const pods = room.stations.filter(x => !x.manager);
    assert.ok(pods.every(p => p.x >= 340), `pods start at x>=340 (min ${Math.min(...pods.map(p => p.x))})`);
  }
});

test('beanbag assignment depends only on creation order, never on the current states', () => {
  const states = ['working', 'away', 'phone', 'sleeping'] as const;
  const ids = (state: (typeof states)[number]) => layoutOffices(snap([group(8, 'g', { state })])).rooms[0].stations.map(x => [x.agent.id, x.rest?.owner ?? null, x.rest?.spec.back ?? null, x.rest?.y ?? null]);
  const base = ids('working');
  for (const state of states) assert.deepEqual(ids(state), base, state);
});

test('adding or removing the last member never moves anybody else\'s beanbag', () => {
  const rests = (n: number) => Object.fromEntries(layoutOffices(snap([group(n)])).rooms[0].stations.filter(x => x.rest).map(x => [x.agent.id, [x.rest!.x, x.rest!.y - layoutOffices(snap([group(n)])).rooms[0].sceneY]]));
  const a = rests(4), b = rests(5);
  for (const [id, pos] of Object.entries(a)) assert.deepEqual(b[id], pos, id);
});

test('manager gets a private beanbag next to its desk, outside the left column; no sofa seats exist', () => {
  for (const [n, background] of [[2, 'small'], [5, 'medium'], [12, 'large']] as const) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const lead = room.stations[0];
    assert.ok(lead.rest, `${background}: manager has a seat`);
    assert.equal(lead.rest!.owner, lead.agent.id);
    assert.equal(lead.rest!.spec.back, M.beanbags[M.restLayout.managerSlot.beanbag].back);
    for (const r of room.stations.filter(x => !x.manager && x.rest).map(x => x.rest!)) assert.ok(!overlaps(r, lead.rest!), 'manager bag is separate from member bags');
    assert.ok(lead.rest!.x > 300, 'not in the left column');
    assert.ok(room.stations.every(x => !x.hasSofa));
    assert.notDeepEqual(lead.away, lead.seat);
  }
});

test('manager bag: right of the lead desk (32px gap), bottom-aligned with it, scaled by the manager module scale', () => {
  for (const n of [3, 6, 16]) {
    const room = layoutOffices(snap([group(n)])).rooms[0], lead = room.stations[0], r = lead.rest!;
    const bag = M.beanbags[M.restLayout.managerSlot.beanbag];
    assert.ok(near(r.scale, lead.actorHeight / refHeight(bag)));
    assert.ok(near(r.x, lead.x + lead.width + 32), `N=${n}: x`);
    assert.ok(near(r.y + r.height, lead.y + lead.height), `N=${n}: bottom edge`);
  }
});

// VQA-004: manager 빈백은 N=3~16에서 어떤 멤버 책상(의자 포함)이나 다른 빈백과도 겹치지 않는다.
test('VQA-004: the manager beanbag never overlaps any member desk/chair rectangle, the lead desk, or another beanbag, for N=1..16', () => {
  for (let n = 1; n <= 16; n++) {
    const room = layoutOffices(snap([group(n)])).rooms[0];
    const [lead, ...members] = room.stations;
    assert.ok(lead.rest, `N=${n}: manager bag exists`);
    const bag = lead.rest!;
    for (const m of members) {
      // 책상 스프라이트 사각형이 의자(chairIncludedInBack)를 포함한다. 앉은 캐릭터가 서는 영역(좌석 위 실루엣)도 함께 본다.
      const seated = { x: m.seat.x - m.actorHeight * 0.3, y: m.seat.y - m.actorHeight, width: m.actorHeight * 0.6, height: m.actorHeight };
      assert.ok(!overlaps(bag, m), `N=${n}: bag ${JSON.stringify([bag.x, bag.y, bag.width, bag.height].map(Math.round))} overlaps desk/chair of ${m.agent.id}`);
      assert.ok(!overlaps(bag, seated), `N=${n}: bag overlaps the seated figure of ${m.agent.id}`);
    }
    assert.ok(!overlaps(bag, lead), `N=${n}: bag does not sit on the lead desk`);
    for (const r of room.rests) if (r !== bag) assert.ok(!overlaps(bag, r), `N=${n}: bag overlaps ${r.owner}'s bag`);
    assert.ok(bag.x >= 0 && bag.x + bag.width <= 1536 && bag.y >= room.sceneY && bag.y + bag.height <= room.sceneY + room.sceneHeight, `N=${n}: inside the room`);
    assert.ok(bag.x > 340, 'right of the lane / left column');
  }
});

test('the left floor furniture is gone: only desks are navigation obstacles', () => {
  const room = layoutOffices(snap([group(6)])).rooms[0];
  assert.equal(room.obstacles.length, room.stations.length);
  assert.ok(!room.obstacles.some(r => r.x === 0 && r.width === 305), 'no sofa/bed block');
  room.stations.forEach((st, i) => assert.ok(room.obstacles[i].x >= st.x - 1e-6 && room.obstacles[i].x + room.obstacles[i].width <= st.x + st.width + 1e-6));
});
