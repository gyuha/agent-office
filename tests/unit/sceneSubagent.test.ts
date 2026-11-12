import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { group, solo, snap, layoutOffices, step, draw, fakeSprites, agentAtPoint } from "./helpers/scene.ts"; // resolve 훅을 먼저 등록한다.

const { workerLabel, withExitingWorkers, MAX_ROOM_MEMBERS, WORKER_EXIT_SECONDS, WORKER_ENTER_SECONDS, LAYOUT_HOLD_SECONDS, nextLayoutHold, layoutCost } = await import("../../client/scene/core/workers.ts");
const { manifest } = await import("../../client/scene/core/office-assets.ts");

type Rect = { x: number; y: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const sub = (id: string, parentAgentId: string, since = 0, name = `job ${id}`) => ({ id, parentAgentId, name, provider: "claude", since });

/** N = 정규 구성원 수('solo'는 1인 오피스). parents 인덱스(0 = manager, solo는 0 = 본인)별 서브에이전트 수. */
function office(n: number | "solo", perParent: number[] | number = 0) {
  const o: any = n === "solo" ? solo("room") : group(n, "room");
  const parents = [o.manager, ...o.members].filter(Boolean);
  const counts = Array.isArray(perParent) ? perParent : parents.map(() => perParent);
  let since = 0;
  return { ...o, subagents: parents.flatMap((p: any, pi: number) => Array.from({ length: counts[pi] ?? 0 }, (_, i) => sub(`${p.id}-s${i}`, p.id, since++))) };
}
const withoutSubs = (o: any) => ({ ...o, subagents: [] });
const roomOf = (o: any, width?: number) => layoutOffices(snap([o]), width).rooms[0];
const tempStations = (room: any) => room.stations.filter((s: any) => s.temp);
const regularStations = (room: any) => room.stations.filter((s: any) => !s.temp);

/** mount-room과 같은 순서: 떠난 서브에이전트를 퇴장 동안 되돌려 넣고(withExitingWorkers) 배치한 뒤 step. */
function tick(actors: any, snapshot: any, ms: number) {
  const eff = withExitingWorkers(snapshot, actors);
  return step(actors, eff, ms, layoutOffices(eff));
}
function run(actors: any, snapshot: any, ms: number, stepMs = 100) {
  let a = actors;
  for (let t = 0; t < ms; t += stepMs) a = tick(a, snapshot, Math.min(stepMs, ms - t));
  return a;
}
const workersOf = (actors: any) => Object.values<any>(actors).filter((a) => a.worker);

/** draw를 기록용 context로 실행한다. dashed = 점선 테두리가 켜진 상태에서 그린 텍스트(임시 직원 명판·+N 표식). */
function record(snapshot: any, actors: any) {
  const layout = layoutOffices(snapshot);
  const images: any[] = [], texts: { text: string; dashed: boolean }[] = [];
  let dashed = false;
  const stack: boolean[] = [];
  const ctx: any = {
    save() { stack.push(dashed); }, restore() { dashed = stack.pop() ?? false; },
    setLineDash(d: number[]) { dashed = d.length > 0; },
    beginPath() {}, rect() {}, clip() {}, fillRect() {}, fill() {}, stroke() {}, arc() {}, setTransform() {},
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillText(text: string) { texts.push({ text, dashed }); },
    drawImage(image: any, ...a: number[]) { images.push({ key: image.key, dx: a[4], dy: a[5], alpha: ctx.globalAlpha }); },
    globalAlpha: 1, fillStyle: "", strokeStyle: "", font: "", lineWidth: 1,
  };
  draw(ctx, layout, actors, 0, fakeSprites(), 0);
  return { layout, images, texts };
}
const iconKeys = new Set(Object.values((manifest as any).providerIcons ?? {}) as string[]);

describe("임시 직원: 정규 직원과 같은 일반 책상", () => {
  it("stations에 temp 표식과 함께 들어 있고, 정규 member 뒤에 부모 순서·시작 순서로 놓인다", () => {
    // 일부러 부모 순서와 다르게 넣는다: member1, manager, member0, member1(두 번째).
    const o: any = group(3, "room");
    o.subagents = [sub("a", o.members[1].id, 1), sub("b", o.manager.id, 2), sub("c", o.members[0].id, 3), sub("d", o.members[1].id, 4)];
    const room = roomOf(o);
    const ids = room.stations.map((s: any) => s.agent.id);
    assert.deepEqual(ids.slice(0, 4), ["room-lead", "room0", "room1", "room2"], "정규 직원이 먼저");
    assert.deepEqual(ids.slice(4), ["b", "c", "a", "d"], "부모(manager, member0, member1) 순서, 같은 부모 안에서는 시작 순서");
    assert.deepEqual(room.subagents.map((s: any) => s.id).sort(), ["a", "b", "c", "d"]);
    for (const s of tempStations(room)) {
      assert.equal(s.agent.state, "working");
      assert.equal(s.agent.needsAttention, false);
      assert.equal(s.manager, false);
      assert.equal(s.temp.leaving, false);
      assert.equal(s.temp.parentId, o.subagents.find((x: any) => x.id === s.agent.id).parentAgentId);
      assert.equal(s.temp.sub.id, s.agent.id);
    }
    assert.equal(regularStations(room).some((s: any) => s.temp), false);
    assert.equal(room.hiddenSubagents, 0);
  });

  for (const [n, k] of [[2, 1], [3, 2], [5, 3], [8, 4]] as const) {
    it(`정규 member ${n}명 + 임시 ${k}명: 임시 직원 책상의 모양이 정규 member ${n + k}명일 때의 같은 자리와 같다(같은 pod·크기)`, () => {
      const o: any = group(n, "room");
      o.subagents = Array.from({ length: k }, (_, i) => sub(`t${i}`, o.manager.id, i));
      const withTemps = roomOf(o).stations;
      const real: any = group(n + k, "room");
      const reference = layoutOffices(snap([real])).rooms[0].stations;
      assert.equal(withTemps.length, reference.length);
      withTemps.forEach((s: any, i: number) => {
        const r = reference[i];
        assert.deepEqual([s.x, s.y, s.width, s.height, s.pod, s.variant, s.moduleScale, s.manager], [r.x, r.y, r.width, r.height, r.pod, r.variant, r.moduleScale, r.manager], `station ${i}`);
        assert.equal(s.desk, r.desk);
      });
    });
  }

  it("방 책상 수 N에 포함된다: 정규 3 + 임시 1이면 4명 방(medium) 배경이 된다", () => {
    assert.equal(roomOf(office(3, 0)).background, "small");
    assert.equal(roomOf(office(3, [1, 0, 0, 0])).background, "medium");
    assert.equal(roomOf(office(6, [1, 0, 0, 0, 0, 0, 0])).background, "large");
  });

  it("임시 직원은 working 상태로 자리에 앉아 타이핑한다", () => {
    const snapshot = snap([office(3, [1, 1, 0, 0])]);
    const actors = run({}, snapshot, 1000);
    const workers = workersOf(actors);
    assert.equal(workers.length, 2);
    for (const a of workers) {
      assert.equal(a.state, "working");
      assert.equal(a.moving, false);
      assert.equal(a.destination, "seat");
      assert.equal(a.worker.alpha, 1);
      assert.equal(a.worker.exit, null);
    }
    assert.equal(Object.values<any>(actors).filter((a) => !a.worker).length, 4, "정규 직원 액터는 그대로");
  });

  it("서브에이전트가 없는 방에는 temp 책상도 worker 액터도 점선 명판도 없다", () => {
    const snapshot = snap([office(3, 0)]);
    const actors = run({}, snapshot, 500);
    assert.equal(tempStations(roomOf(office(3, 0))).length, 0);
    assert.equal(workersOf(actors).length, 0);
    assert.equal(record(snapshot, actors).texts.filter((t) => t.dashed).length, 0);
  });
});

describe("임시 직원: 겹치지 않음·휴게석", () => {
  const cases: [string, number | "solo", number[] | number][] = [
    ["solo + 1", "solo", 1], ["solo + 3", "solo", 3],
    ["N=3, manager만 2", 3, [2, 0, 0, 0]], ["N=3, 모두 1", 3, 1],
    ["N=6, member 둘이 3씩", 6, [0, 3, 0, 3, 0, 0, 0]], ["N=6, 모두 1", 6, 1],
    ["N=10, manager 4", 10, [4]], ["N=10, 모두 1", 10, 1],
    ["N=16(정규 가득)", 16, 0], ["N=12 + 임시 4(합 16)", 12, [2, 1, 1]],
  ];
  for (const [name, n, per] of cases) {
    it(`${name}: 모든 책상이 서로·휴게석과 겹치지 않고 방 안에 있다`, () => {
      const room: any = roomOf(office(n, per));
      const total = room.stations.length;
      room.stations.forEach((a: any, i: number) => {
        room.stations.slice(i + 1).forEach((b: any) => assert.equal(overlaps(a, b), false, `${a.agent.id} × ${b.agent.id}`));
        for (const r of room.rests as Rect[]) assert.equal(overlaps(a, r), false, `${a.agent.id} × rest`);
        assert.ok(a.x >= 0 && a.x + a.width <= 1536, `${a.agent.id} 가로 범위`);
        assert.ok(a.y >= room.y && a.y + a.height <= room.y + room.height, `${a.agent.id} 세로 범위`);
      });
      assert.ok(total >= 1);
    });
  }

  it("휴게석은 임시 직원 소유가 아니고 station.rest도 없다. 정규 직원의 휴게석은 임시 직원 유무와 무관하다", () => {
    const o = office(4, [1, 1, 0, 0, 0]); // N 4 → 6: 같은 구간(medium), 책상 줄 수도 같다
    const room: any = roomOf(o);
    const tempIds = new Set(tempStations(room).map((s: any) => s.agent.id));
    assert.equal(tempIds.size, 2);
    for (const r of room.rests) assert.equal(tempIds.has(r.owner), false, `rest owner ${r.owner}`);
    for (const s of tempStations(room)) assert.equal(s.rest, null);
    // 같은 구간(임시 직원 없이) 정규 직원의 휴게석과 비교한다.
    const base: any = roomOf(withoutSubs(o));
    assert.deepEqual(room.rests.map((r: any) => [r.owner, r.x, r.y]), base.rests.map((r: any) => [r.owner, r.x, r.y]));
    assert.deepEqual(room.rests.length, base.rests.length);
  });

  // 현재 동작의 기록: 임시 직원 때문에 책상 줄이 늘어 방이 높아지면(예: 정규 8 → 9, 2줄 → 3줄) 쓸 수 있는 휴게석 자리 수가 늘고,
  // 정규 직원의 휴게석 배정(owner→자리)이 바뀐다. 책상 자리는 그대로다. 바뀌면 이 테스트를 뒤집으면 된다.
  it("책상 줄이 늘면 정규 직원의 휴게석 배정이 바뀌는 현재 동작을 기록한다", () => {
    const o = office(8, [1]);
    const added: any = roomOf(o), base: any = roomOf(withoutSubs(o));
    const rests = (room: any) => room.rests.map((r: any) => [r.owner, r.x, r.y]);
    assert.notDeepEqual(rests(added), rests(base));
    assert.deepEqual(regularStations(added).map((s: any) => [s.agent.id, s.x, s.y]), base.stations.map((s: any) => [s.agent.id, s.x, s.y]), "책상 자리는 그대로");
    for (const r of added.rests) assert.equal(tempStations(added).some((s: any) => s.agent.id === r.owner), false);
  });

  it("임시 직원 명판은 클릭해도 어떤 에이전트로도 선택되지 않는다", () => {
    const snapshot = snap([office(3, [1, 0, 0, 0])]);
    const actors = run({}, snapshot, 1000);
    const layout = layoutOffices(snapshot);
    const s: any = tempStations(layout.rooms[0])[0];
    assert.equal(agentAtPoint(layout, actors, s.plate.x, s.plate.y), null);
    const regular: any = regularStations(layout.rooms[0])[1];
    assert.equal(agentAtPoint(layout, actors, regular.plate.x, regular.plate.y), regular.agent.id, "정규 직원 클릭은 그대로 동작");
  });
});

describe("임시 직원: 자리 안정성", () => {
  const key = (room: any) => regularStations(room).map((s: any) => [s.agent.id, s.x, s.y, s.width, s.height]);
  // 같은 크기 구간(small ≤3, medium 4~6, large 7~) 안에서 임시 직원이 들어오고 나가도 정규 직원의 자리는 그대로다.
  const sameBracket: [number, number][] = [[1, 1], [1, 2], [2, 1], [4, 1], [4, 2], [5, 1], [7, 1], [8, 4], [10, 3], [10, 6]];
  for (const [n, k] of sameBracket) {
    it(`같은 구간: 정규 member ${n}명에 임시 ${k}명이 들어와도 정규 직원의 x·y가 같다`, () => {
      const base: any = office(n, 0);
      const added = office(n, [k]);
      assert.deepEqual(key(roomOf(added)), key(roomOf(base)));
    });
  }

  it("임시 직원이 들어왔다 나가도 정규 액터의 위치가 그대로다(같은 구간)", () => {
    const base = office(4, 0), added = office(4, [2]);
    let actors: any = run({}, snap([base]), 1000);
    const before = Object.fromEntries(Object.entries<any>(actors).map(([id, a]) => [id, [a.x, a.y]]));
    actors = run(actors, snap([added]), 1000);
    actors = run(actors, snap([base]), 1500);
    for (const [id, pos] of Object.entries(before)) assert.deepEqual([actors[id].x, actors[id].y], pos, id);
  });

  // 현재 동작의 기록: 커질 때 구간 경계(small→medium, medium→large)를 넘으면 방이 다시 배치되어 정규 직원 자리가 바뀐다.
  // 줄어들 때는 아래 "레이아웃 유지(VQA-052)"가 지연을 단언한다.
  for (const [n, k, label] of [[3, 1, "N 3→4"], [6, 1, "N 6→7"]] as const) {
    it(`구간 경계(${label}): 정규 직원 자리가 바뀌는 현재 동작을 기록한다`, () => {
      const base: any = roomOf(office(n, 0)), added: any = roomOf(office(n, [k]));
      assert.notEqual(base.background, added.background);
      assert.notDeepEqual(key(added), key(base), "경계를 넘으면 정규 직원이 이동한다(현재 동작)");
    });
  }
});

describe("임시 직원: 표식(명판)", () => {
  it("청록 점선 명판에 서브에이전트 이름이, 정규 직원은 점선이 아닌 명판이 그려진다", () => {
    const o: any = office(3, 0);
    o.subagents = [sub("s1", o.manager.id, 1, "alpha task"), sub("s2", o.members[0].id, 2, "beta job")];
    const snapshot = snap([o]);
    const { texts } = record(snapshot, run({}, snapshot, 1000));
    assert.deepEqual(texts.filter((t) => t.dashed).map((t) => t.text).sort(), ["alpha task", "beta job"]);
    assert.ok(texts.filter((t) => !t.dashed).length >= 4, "정규 명판");
  });

  it("provider 아이콘이 임시 직원 명판에도 그려진다", () => {
    assert.ok(iconKeys.size > 0, "매니페스트에 provider 아이콘이 있다");
    const o = office(3, [1, 1, 0, 0]);
    const countIcons = (s: any) => record(s, run({}, s, 1000)).images.filter((i) => iconKeys.has(i.key)).length;
    assert.equal(countIcons(snap([o])) - countIcons(snap([withoutSubs(o)])), 2);
  });

  it("workerLabel: 형제 이름의 공통 앞 단어를 뺀다", () => {
    const o: any = office(3, 0);
    o.subagents = [sub("a", o.manager.id, 1, "vqa sleeper 1"), sub("b", o.manager.id, 2, "vqa waiter 3"), sub("c", o.members[0].id, 3, "vqa solo")];
    const room: any = roomOf(o);
    const label = (id: string) => workerLabel(room, room.stations.find((s: any) => s.agent.id === id));
    assert.equal(label("a"), "sleeper 1");
    assert.equal(label("b"), "waiter 3");
    assert.equal(label("c"), "vqa solo", "형제가 없으면 전체 이름");
  });

  it("workerLabel: 남는 구별 단어가 없으면 전체 이름을 쓴다", () => {
    const o: any = office(3, 0);
    o.subagents = [sub("a", o.manager.id, 1, "worker"), sub("b", o.manager.id, 2, "worker")];
    const room: any = roomOf(o);
    assert.equal(workerLabel(room, room.stations.find((s: any) => s.agent.id === "a")), "worker");
  });
});

describe("임시 직원: 등장·퇴장 페이드", () => {
  it("나중에 생긴 서브에이전트는 alpha 0 → 0.5 → 1로 나타난다", () => {
    const base = office(3, 0);
    let actors: any = run({}, snap([base]), 500);
    const next = snap([{ ...base, subagents: [sub("late", base.manager.id)] }]);
    const alphas: number[] = [];
    for (let i = 0; i < 3; i++) { actors = tick(actors, next, 200); alphas.push(actors.late.worker.alpha); }
    assert.deepEqual(alphas.map((a) => Math.round(a * 100) / 100), [0, 0.5, 1]);
    assert.equal(WORKER_ENTER_SECONDS, 0.4);
  });

  it("첫 프레임부터 있던 서브에이전트는 페이드 없이 바로 보인다", () => {
    const actors = tick({}, snap([office(3, [1, 0, 0, 0])]), 100);
    assert.equal(workersOf(actors)[0].worker.alpha, 1);
  });

  it("빠지면 exit 0 → 0.2 → 0.4 동안 alpha 1 → 0.67 → 0.33으로 줄고 0.6초에 제거된다", () => {
    const o = office(3, [2, 0, 0, 0]);
    const id = o.subagents[0].id;
    const present = snap([o]);
    const gone = snap([{ ...o, subagents: o.subagents.filter((s: any) => s.id !== id) }]);
    let actors: any = run({}, present, 1000);
    assert.equal(actors[id].worker.alpha, 1);
    const frames: { exit: number | null; alpha: number }[] = [];
    let removedAt: number | null = null;
    for (let t = 200; t <= 1000; t += 200) {
      actors = tick(actors, gone, 200);
      if (!actors[id]) { removedAt = t; break; }
      frames.push({ exit: actors[id].worker.exit, alpha: actors[id].worker.alpha });
    }
    assert.deepEqual(frames.map((f) => Math.round((f.exit ?? -1) * 10) / 10), [0, 0.2, 0.4]);
    assert.deepEqual(frames.map((f) => Math.round(f.alpha * 100) / 100), [1, 0.67, 0.33]);
    assert.equal(removedAt, 800, "exit가 0.6에 닿는 네 번째 200ms step(첫 퇴장 프레임 + 600ms)에 제거");
    assert.equal(WORKER_EXIT_SECONDS, 0.6);
    assert.equal(workersOf(actors).length, 1, "다른 임시 직원은 그대로");
  });

  it("퇴장 중에도 책상이 남고(station.temp.leaving) 정규 직원 자리는 변하지 않으며, 끝나면 책상이 사라진다", () => {
    const o = office(4, [1, 0, 0, 0, 0]);
    const id = o.subagents[0].id;
    const gone = snap([withoutSubs(o)]);
    const regularKey = (room: any) => regularStations(room).map((s: any) => [s.agent.id, s.x, s.y]);
    let actors: any = run({}, snap([o]), 1000);
    const baseKey = regularKey(roomOf(withoutSubs(o)));
    actors = tick(actors, gone, 200);
    actors = tick(actors, gone, 200);
    const eff = withExitingWorkers(gone, actors);
    const mid = layoutOffices(eff).rooms[0];
    const desk: any = mid.stations.find((s: any) => s.agent.id === id);
    assert.ok(desk, "퇴장 중 책상 유지");
    assert.equal(desk.temp.leaving, true);
    assert.deepEqual(regularKey(mid), baseKey);
    actors = run(actors, gone, 1000);
    assert.equal(actors[id], undefined);
    assert.equal(withExitingWorkers(gone, actors), gone, "떠날 것이 없으면 스냅샷 그대로");
    assert.equal(layoutOffices(gone).rooms[0].stations.some((s: any) => s.agent.id === id), false);
  });

  it("퇴장 중에는 반투명으로 그려진다", () => {
    const o = office(3, [1, 0, 0, 0]);
    const gone = snap([withoutSubs(o)]);
    let actors: any = run({}, snap([o]), 1000);
    actors = tick(actors, gone, 200);
    actors = tick(actors, gone, 200);
    const eff = withExitingWorkers(gone, actors);
    const { images } = record(eff, actors);
    assert.ok(images.some((i) => i.alpha > 0 && i.alpha < 1), "worker alpha가 그리기에 반영된다");
  });

  it("withExitingWorkers를 거치지 않으면 퇴장 연출 없이 바로 사라진다(그래서 mount-room이 거친다)", () => {
    const o = office(3, [1, 0, 0, 0]);
    const gone = snap([withoutSubs(o)]);
    let actors: any = run({}, snap([o]), 1000);
    actors = step(actors, gone, 200, layoutOffices(gone));
    assert.equal(workersOf(actors).length, 0);
  });

  it("퇴장 뒤 같은 id가 다시 running이면 다시 나타난다", () => {
    const o = office("solo", 1);
    let actors: any = run({}, snap([o]), 1000);
    actors = run(actors, snap([withoutSubs(o)]), 1000);
    assert.equal(workersOf(actors).length, 0);
    actors = run(actors, snap([o]), 1000);
    assert.equal(workersOf(actors).length, 1);
  });
});

describe("임시 직원: 상한과 +N", () => {
  it("MAX_ROOM_MEMBERS는 16이다", () => assert.equal(MAX_ROOM_MEMBERS, 16));

  it("16명(정규 + 임시)까지는 모두 책상이 생기고 +N이 없다", () => {
    const snapshot = snap([office(10, [3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0])]); // 정규 10 + 임시 6 = 16
    const room = layoutOffices(snapshot).rooms[0];
    assert.equal(room.stations.filter((s: any) => !s.manager).length, 16);
    assert.equal(tempStations(room).length, 6);
    assert.equal(room.hiddenSubagents, 0);
    assert.equal(record(snapshot, run({}, snapshot, 500)).texts.some((t) => /^\+\d+$/.test(t.text)), false);
  });

  it("16명을 넘으면 앞에서부터 그리고 나머지는 hiddenSubagents와 마지막 책상 옆 +N으로 센다", () => {
    const o = office(10, [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 임시 8 요청, 들어갈 자리는 6
    const snapshot = snap([o]);
    const room = layoutOffices(snapshot).rooms[0];
    assert.equal(tempStations(room).length, 6);
    assert.equal(room.subagents.length, 6);
    assert.equal(room.hiddenSubagents, 2);
    assert.equal(room.stations.filter((s: any) => !s.manager).length, MAX_ROOM_MEMBERS);
    // 그려진 6명은 부모 순서·시작 순서의 앞쪽이다.
    assert.deepEqual(room.subagents.map((s: any) => s.id), o.subagents.slice(0, 6).map((s: any) => s.id));
    const actors = run({}, snapshot, 500);
    assert.equal(workersOf(actors).length, 6);
    const plus = record(snapshot, actors).texts.filter((t) => /^\+\d+$/.test(t.text));
    assert.deepEqual(plus.map((t) => t.text), ["+2"]);
    assert.equal(plus[0].dashed, true);
    // +N 배지가 들어갈 마지막 책상 오른쪽이 방 폭 안에 있다.
    const last = room.stations[room.stations.length - 1];
    assert.ok(last.x + last.width + 6 + 44 <= 1536, `배지 오른쪽 끝 ${last.x + last.width + 50}`);
  });

  it("정규 직원만으로 이미 16명이면 임시 직원은 전부 +N이다", () => {
    const snapshot = snap([office(16, [3])]);
    const room = layoutOffices(snapshot).rooms[0];
    assert.equal(tempStations(room).length, 0);
    assert.equal(room.hiddenSubagents, 3);
    assert.deepEqual(record(snapshot, run({}, snapshot, 300)).texts.filter((t) => /^\+\d+$/.test(t.text)).map((t) => t.text), ["+3"]);
  });
});

// ───────── VQA-051: 레이아웃·빈백이 바뀌면 away 직원이 새 빈백으로 걸어가 앉는다 ─────────
const A = "away", P = "phone", S = "sleeping";
function mixed(n: number, states: string[], k: number) {
  const o: any = group(n, "room");
  o.members.forEach((m: any, i: number) => { m.state = states[i]; });
  o.subagents = Array.from({ length: k }, (_, i) => sub(`x${i}`, o.manager.id, i));
  return snap([o]);
}
const layoutOf = (snapshot: any, actors: any) => layoutOffices(withExitingWorkers(snapshot, actors));
const layoutKey = (layout: any) => JSON.stringify(layout.rooms[0].stations.map((s: any) => [s.agent.id, s.seat.x, s.seat.y]).concat(layout.rooms[0].rests.map((r: any) => [r.owner, r.x, r.y])));
/** `to`를 계속 먹이다가 배치(자리·빈백)가 처음 바뀌는 step을 실행하고, 그 직후의 액터를 돌려준다. */
function stepUntilRelayout(actors: any, to: any, limitMs: number) {
  let a = actors;
  for (let t = 0; t < limitMs; t += 100) {
    const eff = withExitingWorkers(to, a);
    const layout = layoutOffices(eff);
    a = step(a, eff, 100, layout);
    if (layoutKey(layout) !== settledKey) return { actors: a, at: t + 100 };
  }
  throw new Error("layout never changed");
}
let settledKey = "";
const targetOf = (s: any, a: any) => (a.state === "away" && s.rest ? s.away : s.seat);
const arrived = (snapshot: any, a: any) => layoutOf(snapshot, a).rooms[0].stations.filter((s: any) => !s.temp).every((s: any) => {
  const x = a[s.agent.id], t = targetOf(s, x);
  return !x.moving && Math.hypot(x.x - t.x, x.y - t.y) < 2;
});

const RELAYOUT_CASES: [string, number, string[]][] = [
  ["N3 away·phone·sleeping", 3, [A, P, S]], ["N3 away 2명", 3, [A, A, P]],
  ["N6 away 3명", 6, [A, A, A, P, S, P]], ["N6 away 뒤쪽", 6, [A, P, A, A, S, A]],
  ["N8 away 3명", 8, [A, A, A, P, S, P, S, P]], ["N8 away 혼합", 8, [P, A, S, A, P, A, S, P]],
];
const ARRIVE_LIMIT_MS = 8000; // scene 보고는 약 6초. 측정(N3 1.7~4.1s, N6 2.5~4.6s, N8 5.7~6.9s)에 여유를 둔다.

describe("VQA-051: 배치가 바뀌면 away 직원이 새 빈백으로 걸어가 앉는다", () => {
  for (const [name, n, states] of RELAYOUT_CASES) {
    it(`${name}: 임시 직원이 들어와 배치가 바뀐 뒤 ${ARRIVE_LIMIT_MS / 1000}초 안에 모두 제 자리(빈백 또는 책상)에 선다`, () => {
      const lo = mixed(n, states, 0), hi = mixed(n, states, 1);
      let a: any = run({}, lo, 15000);
      settledKey = layoutKey(layoutOf(lo, a));
      assert.ok(arrived(lo, a), "배치가 바뀌기 전에는 모두 자리에 있다");
      ({ actors: a } = stepUntilRelayout(a, hi, 1000));
      // 전환 직후: 새 빈백이 배정된(옛 자리에서 벗어난) away 직원은 책상에서 출발해 걷는 중이다.
      const room = layoutOf(hi, a).rooms[0];
      const walkers = room.stations.filter((s: any) => !s.temp && a[s.agent.id].state === A && s.rest && a[s.agent.id].moving);
      assert.ok(walkers.length >= 1, "새 빈백으로 걷는 away 직원이 있다");
      for (const s of walkers) {
        const x = a[s.agent.id];
        assert.ok(x.route.length > 0, `${s.agent.id} route`);
        assert.ok(Math.hypot(x.x - s.seat.x, x.y - s.seat.y) < 30, `${s.agent.id}는 책상(seat)에서 출발한다`);
      }
      let at = -1;
      for (let t = 100; t <= ARRIVE_LIMIT_MS; t += 100) { a = tick(a, hi, 100); if (arrived(hi, a)) { at = t; break; } }
      assert.ok(at > 0, `${ARRIVE_LIMIT_MS}ms 안에 도착하지 않았다`);
      for (const s of layoutOf(hi, a).rooms[0].stations.filter((x: any) => !x.temp)) {
        assert.deepEqual(a[s.agent.id].awayHome, s.away, `${s.agent.id} awayHome이 현재 station.away와 같다`);
      }
    });
  }

  // 줄어든 방에서 빈백을 잃은 away 직원(N8)도 옛 빈백에 멈추지 않고 책상으로 돌아와야 한다.
  for (const [name, n, states] of RELAYOUT_CASES) {
    it(`${name}: 유지 시간이 지나 방이 줄어도 모두 제 자리에 선다`, () => {
      const lo = mixed(n, states, 0), hi = mixed(n, states, 1);
      let a: any = run({}, hi, 15000);
      settledKey = layoutKey(layoutOf(lo, a));
      // 임시 직원이 나간 뒤 유지 시간이 지나 방이 줄어드는 step까지 진행한다.
      let shrunk = false;
      for (let t = 0; t < 75000 && !shrunk; t += 100) {
        const eff = withExitingWorkers(lo, a), layout = layoutOffices(eff);
        a = step(a, eff, 100, layout);
        shrunk = layout.rooms[0].layoutMembers === n;
      }
      assert.ok(shrunk, "방이 줄어든다");
      let ok = false;
      for (let t = 0; t <= 20000 && !ok; t += 100) { a = tick(a, lo, 100); ok = arrived(lo, a); }
      assert.ok(ok, "20초가 지나도 일부 직원이 제 자리에 서지 못한다");
    });
  }
});

// ───────── VQA-052: 레이아웃 축소 지연(축소만 늦춘다) ─────────
describe("VQA-052: 임시 직원이 나가도 방은 LAYOUT_HOLD_SECONDS 동안 줄지 않는다", () => {
  const members = (room: any) => room.stations.filter((s: any) => !s.manager).length;
  const leadHold = (snapshot: any, actors: any) => {
    const room = layoutOf(snapshot, actors).rooms[0];
    return actors[room.stations[0].agent.id].hold;
  };
  const regularKey = (room: any) => regularStations(room).map((s: any) => [s.agent.id, s.x, s.y]);

  it("상수와 layoutCost: 구간과 줄 수 순서", () => {
    assert.equal(LAYOUT_HOLD_SECONDS, 60);
    assert.ok(layoutCost(4) > layoutCost(3), "3→4 커짐");
    assert.ok(layoutCost(7) > layoutCost(6), "6→7 커짐");
    assert.equal(layoutCost(4), layoutCost(5), "같은 줄 수면 배치도 같다");
    assert.ok(layoutCost(7) > layoutCost(4) && layoutCost(9) > layoutCost(8));
  });

  it("nextLayoutHold: 커지면 즉시, 줄면 60초 뒤, 정규 인원이 바뀌면 즉시", () => {
    assert.deepEqual(nextLayoutHold(undefined, 3, 3, 0.1), { members: 3, regular: 3, idle: 0 });
    // 3→4 즉시
    assert.deepEqual(nextLayoutHold({ members: 3, regular: 3, idle: 0 }, 4, 3, 0.1), { members: 4, regular: 3, idle: 0 });
    // 6→7 즉시
    assert.equal(nextLayoutHold({ members: 6, regular: 6, idle: 0 }, 7, 6, 0.1).members, 7);
    // 4→3(임시 직원 퇴장): 유지하며 idle이 쌓인다.
    const held = nextLayoutHold({ members: 4, regular: 3, idle: 10 }, 3, 3, 5);
    assert.deepEqual(held, { members: 4, regular: 3, idle: 15 });
    assert.equal(nextLayoutHold({ members: 4, regular: 3, idle: 59 }, 3, 3, 0.9).members, 4, "59.9초는 아직 유지");
    assert.deepEqual(nextLayoutHold({ members: 4, regular: 3, idle: 59 }, 3, 3, 1), { members: 3, regular: 3, idle: 0 }, "60초에 줄어든다");
    // 같은 배치 비용이면 바로 현재 값
    assert.deepEqual(nextLayoutHold({ members: 5, regular: 4, idle: 7 }, 4, 4, 0.1), { members: 4, regular: 4, idle: 0 });
    // 정규 인원이 바뀌면 지연 없이 재배치
    assert.deepEqual(nextLayoutHold({ members: 4, regular: 3, idle: 5 }, 2, 2, 0.1), { members: 2, regular: 2, idle: 0 });
    assert.deepEqual(nextLayoutHold({ members: 4, regular: 3, idle: 5 }, 4, 4, 0.1), { members: 4, regular: 4, idle: 0 });
  });

  for (const n of [3, 6]) {
    it(`N${n}: 임시 직원이 들어오면 즉시 커지고, 나간 뒤 60초 가까이 큰 배치가 유지되다가 줄어든다(정규 책상 위치는 유지 중 그대로)`, () => {
      const lo = snap([office(n, 0)]), hi = snap([office(n, [1])]);
      let a: any = run({}, lo, 2000);
      assert.equal(layoutOf(lo, a).rooms[0].layoutMembers, n);
      // 즉시 커진다.
      a = tick(a, hi, 100);
      assert.equal(layoutOf(hi, a).rooms[0].layoutMembers, n + 1);
      a = run(a, hi, 2000);
      const bigKey = regularKey(layoutOf(hi, a).rooms[0]);
      assert.deepEqual(bigKey, regularKey(roomOf(office(n, [1]))), "큰 배치의 정규 책상 위치");
      assert.equal(leadHold(hi, a).members, n + 1);

      // 퇴장 연출(0.6s) 뒤에도 큰 배치가 유지된다.
      let heldMs = 0, shrinkAt: number | null = null;
      for (let t = 100; t <= 70000; t += 100) {
        a = tick(a, lo, 100);
        const room = layoutOf(lo, a).rooms[0];
        if (room.layoutMembers === n) { shrinkAt = t; break; }
        assert.equal(room.layoutMembers, n + 1, `t=${t}ms 유지 중`);
        assert.deepEqual(regularKey(room), bigKey, `t=${t}ms 유지 중 정규 책상 위치`);
        heldMs = t;
      }
      assert.ok(shrinkAt !== null, "결국 줄어든다");
      assert.ok(heldMs >= 59000, `나간 뒤 약 60초(${heldMs}ms)까지 유지`);
      assert.ok(shrinkAt! >= 60000 && shrinkAt! <= 62000, `60초대에 줄어든다: ${shrinkAt}`);
      a = run(a, lo, 1000);
      assert.deepEqual(regularKey(layoutOf(lo, a).rooms[0]), regularKey(roomOf(office(n, 0))), "줄어든 뒤 원래 작은 배치");
      assert.equal(leadHold(lo, a).members, n);
    });
  }

  it("유지 시간 안에 다시 들어오면 줄어들지 않고, 다시 나가면 유지 시간이 처음부터 다시 센다", () => {
    const lo = snap([office(3, 0)]), hi = snap([office(3, [1])]);
    let a: any = run({}, hi, 2000);
    a = run(a, lo, 30000); // 30초 유지
    assert.equal(layoutOf(lo, a).rooms[0].layoutMembers, 4);
    assert.ok(leadHold(lo, a).idle > 25);
    a = run(a, hi, 1000); // 다시 들어온다
    assert.equal(leadHold(hi, a).idle, 0, "다시 들어오면 카운트가 리셋");
    a = run(a, hi, 40000);
    assert.equal(layoutOf(hi, a).rooms[0].layoutMembers, 4);
    // 다시 나가면 처음부터: 40초 전까지는 확실히 큰 배치.
    a = run(a, lo, 50000);
    assert.equal(layoutOf(lo, a).rooms[0].layoutMembers, 4, "50초 < 60초라 유지");
    a = run(a, lo, 12000);
    assert.equal(layoutOf(lo, a).rooms[0].layoutMembers, 3, "합쳐서 62초 뒤 줄어든다");
  });

  it("정규 직원 수가 바뀌면 유지 중이어도 지연 없이 바로 재배치된다", () => {
    const hi = snap([office(3, [1])]);
    let a: any = run({}, hi, 2000);
    a = run(a, snap([office(3, 0)]), 5000);
    assert.equal(layoutOf(snap([office(3, 0)]), a).rooms[0].layoutMembers, 4, "임시 직원만 나갔을 때는 유지");
    const fewer = snap([office(2, 0)]); // 정규 직원이 한 명 줄었다
    a = tick(a, fewer, 100);
    assert.equal(layoutOf(fewer, a).rooms[0].layoutMembers, 2, "바로 줄어든다");
    assert.equal(leadHold(fewer, a).members, 2);
    const more = snap([office(4, 0)]); // 정규 직원이 늘었다
    a = tick(a, more, 100);
    assert.equal(layoutOf(more, a).rooms[0].layoutMembers, 4);
  });

  it("임시 직원이 없으면 hold.members === layoutMembers === member 수이다", () => {
    for (const n of ["solo", 1, 3, 4, 6, 7, 10] as const) {
      const snapshot = snap([office(n, 0)]);
      const count = n === "solo" ? 1 : n;
      let a: any = {};
      for (let i = 0; i < 20; i++) {
        a = tick(a, snapshot, 100);
        const room = layoutOf(snapshot, a).rooms[0];
        assert.equal(room.layoutMembers, count, `N=${n} layoutMembers`);
        assert.equal(leadHold(snapshot, a).members, count, `N=${n} hold.members`);
        assert.equal(members(room), count);
      }
    }
  });

  // VQA-053: 지연 중에는 방 높이와 빈백 수도 유지 인원 기준이다(실제 책상 수로 먼저 줄지 않는다).
  for (const n of [3, 6, 8]) {
    it(`N${n}: 지연 중 sceneHeight·rests.length·layoutMembers가 그대로이고, 지연이 끝날 때 한 번만 최종값으로 바뀐다`, () => {
      const lo = snap([office(n, 0)]), hi = snap([office(n, [1])]);
      const vals = (snapshot: any, actors: any) => {
        const room: any = layoutOf(snapshot, actors).rooms[0];
        return [room.sceneHeight, room.rests.length, room.layoutMembers];
      };
      let a: any = run({}, hi, 3000);
      const held = vals(hi, a);
      assert.equal(held[2], n + 1, "유지 인원 = 실제 + 임시 1");
      const final = [roomOf(office(n, 0)).sceneHeight, roomOf(office(n, 0)).rests.length, n];
      assert.notDeepEqual(held, final, "시나리오가 유지 값과 최종 값을 구별한다");

      const seen: { t: number; v: number[] }[] = [];
      for (let t = 100; t <= 65000; t += 100) {
        a = tick(a, lo, 100); // 매 step마다 withExitingWorkers를 거친 배치를 본다.
        const v = vals(lo, a);
        if (!seen.length || JSON.stringify(seen.at(-1)!.v) !== JSON.stringify(v)) seen.push({ t, v });
        if (t < LAYOUT_HOLD_SECONDS * 1000) assert.deepEqual(v, held, `t=${t}ms 지연 중 값이 변했다`);
      }
      // 처음 값(유지)에서 최종값으로 정확히 한 번 바뀐다.
      assert.equal(seen.length, 2, `변화 횟수: ${JSON.stringify(seen)}`);
      assert.deepEqual(seen[0].v, held);
      assert.deepEqual(seen[1].v, final);
      assert.ok(seen[1].t >= 60000 && seen[1].t <= 62000, `60초대에 바뀐다: ${seen[1].t}`);
    });
  }
});
