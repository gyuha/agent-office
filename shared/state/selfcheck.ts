/**
 * 상태 기계 최소 자체 검증. 테스트 프레임워크 없이 실행한다: `npm run check:state`
 * (node --experimental-strip-types shared/state/selfcheck.ts). 정식 테스트는 tests/에서 qa가 맡는다.
 */
import assert from "node:assert/strict";
import { SLEEP_AFTER_MS } from "./constants.ts";
import { createOfficeStore, idlePoseFor, type AgentIdentity } from "./machine.ts";

const WS = "wks_test";
const PROJECT = "prj_test";
/** 테스트 워크스페이스 두 개(WS, WS2)는 같은 프로젝트, OTHER_WS는 다른 프로젝트. */
const WS2 = "wks_test2";
const OTHER_WS = "wks_other";
let clock = 1_000_000;
const advance = (ms: number) => {
  clock += ms;
};
const agent = (id: string, parentAgentId: string | null = null): AgentIdentity => ({
  id,
  workspaceId: WS,
  title: id,
  provider: "claude",
  parentAgentId,
});
const newStore = () => {
  const store = createOfficeStore({ now: () => clock });
  store.setWorkspaces([
    { workspaceId: WS, projectId: PROJECT, projectName: "test" },
    { workspaceId: WS2, projectId: PROJECT, projectName: "test" },
    { workspaceId: OTHER_WS, projectId: "prj_other", projectName: "alpha" },
  ]);
  return store;
};
const offices = (store: ReturnType<typeof createOfficeStore>) => store.snapshot(PROJECT).projects[0].offices;
const find = (store: ReturnType<typeof createOfficeStore>, id: string) =>
  offices(store).flatMap((office) => [office.manager, ...office.members])
    .find((view) => view?.id === id);

const checks: Array<[string, () => void]> = [
  [
    "turn_started → working, turn_ended → away|phone (id 해시로 결정적)",
    () => {
      const store = newStore();
      store.upsert(agent("a1"));
      store.turnStarted("a1");
      assert.equal(find(store, "a1")?.state, "working");
      advance(500);
      store.turnEnded("a1");
      const view = find(store, "a1");
      assert.equal(view?.state, idlePoseFor("a1"));
      assert.ok(view?.state === "away" || view?.state === "phone");
      assert.equal(view?.stateSince, clock);
    },
  ],
  [
    "idle이 SLEEP_AFTER_MS를 넘기면 sleeping, turn 시작하면 working으로 복귀",
    () => {
      const store = newStore();
      store.upsert(agent("a2"));
      advance(SLEEP_AFTER_MS - 1);
      assert.notEqual(find(store, "a2")?.state, "sleeping");
      advance(1);
      const sleeping = find(store, "a2");
      assert.equal(sleeping?.state, "sleeping");
      assert.equal(sleeping?.stateSince, clock);
      store.turnStarted("a2");
      assert.equal(find(store, "a2")?.state, "working");
    },
  ],
  [
    "permission_requested/resolved가 needsAttention을 켜고 끈다(working 유지, 요청이 둘이면 둘 다 풀려야 꺼짐)",
    () => {
      const store = newStore();
      store.upsert(agent("a3"));
      store.turnStarted("a3");
      store.permissionRequested("a3", "r1");
      store.permissionRequested("a3", "r2");
      assert.deepEqual([find(store, "a3")?.state, find(store, "a3")?.needsAttention], ["working", true]);
      store.permissionResolved("a3", "r1");
      assert.equal(find(store, "a3")?.needsAttention, true);
      store.permissionResolved("a3", "r2");
      assert.equal(find(store, "a3")?.needsAttention, false);
    },
  ],
  [
    "closed/archived는 오피스에서 제거, 빈 오피스는 사라진다",
    () => {
      const store = newStore();
      store.upsert(agent("solo"));
      assert.equal(offices(store).length, 1);
      store.remove("solo");
      assert.equal(offices(store).length, 0);
    },
  ],
  [
    "parentAgentId로 그룹 구성: 관리자 + 구성원, 부모 없는 단독은 solo",
    () => {
      const store = newStore();
      store.upsert(agent("boss"));
      store.upsert(agent("w1", "boss"));
      store.upsert(agent("w2", "boss"));
      store.upsert(agent("loner"));
      const list = offices(store);
      assert.equal(list.length, 2);
      const [group, solo] = list;
      assert.equal(group.kind, "group");
      assert.equal(group.manager?.id, "boss");
      assert.deepEqual(group.members.map((member) => member.id), ["w1", "w2"]);
      assert.equal(solo.kind, "solo");
      assert.equal(solo.manager, null);
      assert.deepEqual(solo.members.map((member) => member.id), ["loner"]);
    },
  ],
  [
    "부모가 오피스에 없거나(제거됨/다른 워크스페이스) 순환이면 단독/루트로 처리하고 크래시하지 않는다",
    () => {
      const store = newStore();
      store.upsert(agent("orphan", "gone"));
      store.upsert(agent("x", "y"));
      store.upsert(agent("y", "x"));
      const list = offices(store);
      assert.equal(list.length, 3);
      assert.ok(list.every((office) => office.kind === "solo"));
    },
  ],
  [
    "시작 seed: 이미 오래 idle이면 처음부터 sleeping, 이미 등록된 에이전트의 상태는 seed가 덮어쓰지 않음",
    () => {
      const store = newStore();
      store.upsert(agent("old"), { working: false, since: clock - SLEEP_AFTER_MS - 5 });
      assert.equal(find(store, "old")?.state, "sleeping");
      store.upsert(agent("busy"));
      store.turnStarted("busy");
      store.upsert(agent("busy"), { working: false, since: 0 });
      assert.equal(find(store, "busy")?.state, "working");
    },
  ],
  [
    "프로젝트별 분리: project 범위는 그 프로젝트만, all 범위는 이름순 전체",
    () => {
      const store = newStore();
      store.upsert(agent("here"));
      store.upsert({ ...agent("there"), workspaceId: OTHER_WS });
      assert.deepEqual(offices(store).map((office) => office.id), ["here"]);
      const project = store.snapshot(PROJECT);
      assert.equal(project.scope, "project");
      assert.equal(project.projects.length, 1);
      const all = store.snapshot();
      assert.equal(all.scope, "all");
      assert.deepEqual(all.projects.map((entry) => entry.projectName), ["alpha", "test"]);
      assert.deepEqual(store.snapshot("prj_unknown").projects, []);
    },
  ],
  [
    "같은 프로젝트의 다른 워크스페이스: 부모 트리가 같으면 한 오피스, 아니면 별도",
    () => {
      const store = newStore();
      store.upsert(agent("boss"));
      store.upsert({ ...agent("far", "boss"), workspaceId: WS2 });
      store.upsert({ ...agent("other-tree"), workspaceId: WS2 });
      const list = offices(store);
      assert.equal(list.length, 2);
      assert.deepEqual(list[0].members.map((member) => member.id), ["far"]);
      assert.equal(list[1].kind, "solo");
    },
  ],
  [
    "워크스페이스 매핑이 없는 에이전트는 스냅샷에서 빠지고 hasUnmappedWorkspace가 알린다. 프로젝트에 에이전트가 없으면 all에서 빠진다",
    () => {
      const store = newStore();
      store.upsert({ ...agent("ghost"), workspaceId: "wks_unknown" });
      assert.equal(store.hasUnmappedWorkspace(), true);
      assert.equal(store.snapshot().projects.length, 0);
      assert.deepEqual(offices(store), []);
      store.removeWorkspace("wks_unknown");
      assert.equal(store.hasUnmappedWorkspace(), false);
    },
  ],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n     ${(error as Error).message}`);
  }
}
if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log(`${checks.length} passed`);
