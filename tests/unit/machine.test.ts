import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SLEEP_AFTER_MS, IDLE_POSES, FALLBACK_NAME_ID_LENGTH } from "../../shared/state/constants.ts";
import { createOfficeStore, hashId, idlePoseFor, type AgentIdentity, type WorkspaceProject } from "../../shared/state/machine.ts";
import type { AgentView, Office } from "../../shared/state/contract.ts";

const WS_MAIN = "wks_main";
const WS_SUB = "wks_sub";
const WS_ALPHA = "wks_alpha";
const WS_EMPTY = "wks_empty";

const PRJ_TEST = "prj_test";
const PRJ_ALPHA = "prj_alpha";
const PRJ_EMPTY = "prj_empty";

function makeWorkspaces(): WorkspaceProject[] {
  return [
    { workspaceId: WS_MAIN, projectId: PRJ_TEST, projectName: "test-project" },
    { workspaceId: WS_SUB, projectId: PRJ_TEST, projectName: "test-project" },
    { workspaceId: WS_ALPHA, projectId: PRJ_ALPHA, projectName: "alpha-project" },
    { workspaceId: WS_EMPTY, projectId: PRJ_EMPTY, projectName: "empty-project" },
  ];
}

function makeAgent(
  id: string,
  overrides: Partial<AgentIdentity> = {},
): AgentIdentity {
  return {
    id,
    workspaceId: WS_MAIN,
    title: `Title ${id}`,
    provider: "claude",
    parentAgentId: null,
    ...overrides,
  };
}

function createTestEnv(initialClock = 1_000_000) {
  let clock = initialClock;
  const store = createOfficeStore({ now: () => clock });
  store.setWorkspaces(makeWorkspaces());

  const advance = (ms: number) => {
    clock += ms;
  };
  const getClock = () => clock;

  const getOffices = (projectId = PRJ_TEST): readonly Office[] => {
    const snap = store.snapshot(projectId);
    return snap.projects[0]?.offices ?? [];
  };

  const findAgent = (id: string, projectId = PRJ_TEST): AgentView | undefined => {
    for (const office of getOffices(projectId)) {
      if (office.manager?.id === id) return office.manager;
      const member = office.members.find((m) => m.id === id);
      if (member) return member;
    }
    return undefined;
  };

  return { store, advance, getClock, getOffices, findAgent };
}

describe("1. 이벤트 → 상태 (turn_started / turn_ended / 결정성)", () => {
  it("신규 등록 시 기본 상태는 idle(away 또는 phone)이며 turn_started 시 working이 된다", () => {
    const { store, findAgent, getClock, advance } = createTestEnv();
    store.upsert(makeAgent("agent-1"));

    const initial = findAgent("agent-1");
    assert.ok(initial);
    assert.ok(IDLE_POSES.includes(initial.state as "away" | "phone"));
    assert.equal(initial.stateSince, getClock());

    advance(1500);
    store.turnStarted("agent-1");

    const working = findAgent("agent-1");
    assert.equal(working?.state, "working");
    assert.equal(working?.stateSince, getClock());
  });

  it("turn_ended 시 away 또는 phone이 나오고, 같은 에이전트 id면 항상 같은 결과다(결정성)", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    // away와 phone이 둘 다 나오는지 여러 id로 검증
    const seenPoses = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const id = `agent-det-${i}`;
      const expectedPose = idlePoseFor(id);
      assert.ok(expectedPose === "away" || expectedPose === "phone");
      assert.equal(idlePoseFor(id), expectedPose);
      assert.equal(hashId(id), hashId(id));
      seenPoses.add(expectedPose);

      store.upsert(makeAgent(id));
      store.turnStarted(id);
      advance(100);
      store.turnEnded(id);

      const view1 = findAgent(id);
      assert.equal(view1?.state, expectedPose);
      assert.equal(view1?.stateSince, getClock());

      // 다시 turnStarted -> turnEnded 반복해도 동일한 idle pose여야 함
      advance(100);
      store.turnStarted(id);
      advance(100);
      store.turnEnded(id);
      const view2 = findAgent(id);
      assert.equal(view2?.state, expectedPose);
    }
    assert.deepEqual(seenPoses, new Set(["away", "phone"]));
  });

  it("turn_started가 다시 오면 working으로 돌아오고 stateSince가 갱신된다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    store.upsert(makeAgent("agent-restart"));
    store.turnStarted("agent-restart");
    advance(1000);
    store.turnEnded("agent-restart");
    assert.notEqual(findAgent("agent-restart")?.state, "working");

    advance(2000);
    store.turnStarted("agent-restart");
    const view = findAgent("agent-restart");
    assert.equal(view?.state, "working");
    assert.equal(view?.stateSince, getClock());
  });

  it("title이 null이면 'agent <id 앞 7자리>' 폴백 이름을 쓰고, upsert 갱신 시 상태를 덮어쓰지 않는다", () => {
    const { store, findAgent, advance } = createTestEnv();
    const id = "abcdef123456";
    store.upsert(makeAgent(id, { title: null }));
    assert.equal(findAgent(id)?.name, `agent ${id.slice(0, FALLBACK_NAME_ID_LENGTH)}`);

    store.turnStarted(id);
    advance(500);
    // 이미 등록된 에이전트에 seed를 다시 주더라도 working 상태가 유지되어야 함
    store.upsert(makeAgent(id, { title: "New Title" }), { working: false, since: 0 });
    const view = findAgent(id);
    assert.equal(view?.name, "New Title");
    assert.equal(view?.state, "working");
  });
});

describe("2. idle timeout (SLEEP_AFTER_MS & stateSince)", () => {
  it("SLEEP_AFTER_MS 직전에는 away/phone, 직후(정확히 경과 시점 포함)에는 sleeping이다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    const idleStart = getClock();
    store.upsert(makeAgent("sleeper"));

    advance(SLEEP_AFTER_MS - 1);
    const beforeSleep = findAgent("sleeper");
    assert.equal(beforeSleep?.state, idlePoseFor("sleeper"));
    assert.equal(beforeSleep?.stateSince, idleStart);

    advance(1);
    const atSleep = findAgent("sleeper");
    assert.equal(atSleep?.state, "sleeping");
    // 계약 주석: "현재 state가 시작된 시각(epoch ms). sleeping은 잠들기 시작한 시각이다."
    assert.equal(atSleep?.stateSince, idleStart + SLEEP_AFTER_MS);

    // 시간이 더 지나도 stateSince는 잠들기 시작한 시각(idleStart + SLEEP_AFTER_MS)으로 유지되어야 함
    advance(50_000);
    const afterMoreSleep = findAgent("sleeper");
    assert.equal(afterMoreSleep?.state, "sleeping");
    assert.equal(afterMoreSleep?.stateSince, idleStart + SLEEP_AFTER_MS);
  });

  it("sleeping 상태에서 turn_started가 오면 working으로 깨어난다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    store.upsert(makeAgent("wake-up"));
    advance(SLEEP_AFTER_MS + 1000);
    assert.equal(findAgent("wake-up")?.state, "sleeping");

    store.turnStarted("wake-up");
    const woke = findAgent("wake-up");
    assert.equal(woke?.state, "working");
    assert.equal(woke?.stateSince, getClock());
  });

  it("working 중에는 SLEEP_AFTER_MS보다 오랜 시간이 지나도 sleeping이 되지 않는다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    store.upsert(makeAgent("hard-worker"));
    store.turnStarted("hard-worker");
    const workStart = getClock();

    advance(SLEEP_AFTER_MS * 5);
    const view = findAgent("hard-worker");
    assert.equal(view?.state, "working");
    assert.equal(view?.stateSince, workStart);
  });
});

describe("3. needsAttention (permission_requested / permission_resolved)", () => {
  it("permission_requested가 2건 오고 1건만 resolved되면 여전히 true, 모두 resolved되면 false이며 working을 유지한다", () => {
    const { store, findAgent, advance } = createTestEnv();
    store.upsert(makeAgent("perm-agent"));
    store.turnStarted("perm-agent");
    assert.equal(findAgent("perm-agent")?.needsAttention, false);

    store.permissionRequested("perm-agent", "req-1");
    store.permissionRequested("perm-agent", "req-2");

    let view = findAgent("perm-agent");
    assert.equal(view?.state, "working");
    assert.equal(view?.needsAttention, true);

    // 권한 대기 중 시간이 오래 지나도 working 유지
    advance(SLEEP_AFTER_MS * 2);
    view = findAgent("perm-agent");
    assert.equal(view?.state, "working");
    assert.equal(view?.needsAttention, true);

    // 1건만 해결됨
    store.permissionResolved("perm-agent", "req-1");
    view = findAgent("perm-agent");
    assert.equal(view?.state, "working");
    assert.equal(view?.needsAttention, true);

    // 나머지 1건도 해결됨
    store.permissionResolved("perm-agent", "req-2");
    view = findAgent("perm-agent");
    assert.equal(view?.state, "working");
    assert.equal(view?.needsAttention, false);
  });

  it("turn_started 없이 permission_requested가 먼저 왔을 때도 needsAttention과 working 상태가 계약과 일치하는지 검증", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    // 에이전트가 idle로 등록된 직후(예: 데몬 재시작 직후 진행 중 턴에서 permission_requested가 먼저 도달하거나
    // loadAgents에서 status !== 'running'이나 pendingPermissions가 있는 경우)
    store.upsert(makeAgent("perm-while-idle"));
    advance(1500);
    const firstRequestTime = getClock();
    store.permissionRequested("perm-while-idle", "req-idle-1");

    const view = findAgent("perm-while-idle");
    assert.equal(view?.needsAttention, true);
    // 계약(contract.ts L34 & PLAN.md L25):
    // "권한 승인을 기다리는 요청이 하나 이상 있다. state는 working으로 유지된다."
    assert.equal(view?.state, "working");
    // 대기 중에는 stateSince가 대기가 처음 생긴 시각이다.
    assert.equal(view?.stateSince, firstRequestTime);

    // 두 번째 권한 요청이 추가로 오거나 시간이 SLEEP_AFTER_MS 이상 지나도
    // stateSince는 첫 권한 대기가 시작된 시각(firstRequestTime)으로 유지된다.
    advance(2000);
    store.permissionRequested("perm-while-idle", "req-idle-2");
    advance(SLEEP_AFTER_MS * 2);

    const waitingView = findAgent("perm-while-idle");
    assert.equal(waitingView?.state, "working");
    assert.equal(waitingView?.needsAttention, true);
    assert.equal(waitingView?.stateSince, firstRequestTime);

    // 첫 번째만 풀렸을 때는 여전히 대기 중이므로 working 및 firstRequestTime 유지
    store.permissionResolved("perm-while-idle", "req-idle-1");
    assert.equal(findAgent("perm-while-idle")?.state, "working");
    assert.equal(findAgent("perm-while-idle")?.stateSince, firstRequestTime);

    // 대기가 모두 풀린 직후 바로 sleeping이 되지 않는다(idle 시계를 다시 시작).
    advance(1000);
    const resolvedAt = getClock();
    store.permissionResolved("perm-while-idle", "req-idle-2");

    const afterResolved = findAgent("perm-while-idle");
    assert.equal(afterResolved?.needsAttention, false);
    assert.equal(afterResolved?.state, idlePoseFor("perm-while-idle"));
    assert.equal(afterResolved?.stateSince, resolvedAt);

    // resolvedAt으로부터 SLEEP_AFTER_MS 직전까지는 sleeping이 아니며, SLEEP_AFTER_MS 경과 시 sleeping이 된다.
    advance(SLEEP_AFTER_MS - 1);
    assert.equal(findAgent("perm-while-idle")?.state, idlePoseFor("perm-while-idle"));
    advance(1);
    const sleepingView = findAgent("perm-while-idle");
    assert.equal(sleepingView?.state, "sleeping");
    assert.equal(sleepingView?.stateSince, resolvedAt + SLEEP_AFTER_MS);
  });

  it("working 중 권한 대기(permission_requested)가 생겼고, 대기가 풀리기 전에 turn_ended가 먼저 와도 대기 중에는 working(stateSince는 첫 권한 대기 시각)을 유지하며, 이후 대기가 모두 풀린 직후 바로 sleeping이 되지 않는다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    store.upsert(makeAgent("perm-outlasts-turn"));
    store.turnStarted("perm-outlasts-turn");
    const turnStartTime = getClock();

    advance(1000);
    const firstPermTime = getClock();
    store.permissionRequested("perm-outlasts-turn", "req-a");
    advance(500);
    store.permissionRequested("perm-outlasts-turn", "req-b");

    // 아직 working=true이므로 stateSince는 turnStartTime
    assert.equal(findAgent("perm-outlasts-turn")?.state, "working");
    assert.equal(findAgent("perm-outlasts-turn")?.stateSince, turnStartTime);

    // 대기가 남아 있는 상태에서 turn_ended가 먼저 온 경우
    advance(1000);
    store.turnEnded("perm-outlasts-turn");

    // 여전히 권한 대기 중이므로 working이어야 하고, stateSince는 대기가 처음 생긴 시각(firstPermTime)이어야 함
    advance(SLEEP_AFTER_MS * 2);
    const waitingAfterTurn = findAgent("perm-outlasts-turn");
    assert.equal(waitingAfterTurn?.state, "working");
    assert.equal(waitingAfterTurn?.needsAttention, true);
    assert.equal(waitingAfterTurn?.stateSince, firstPermTime);

    // 대기가 모두 풀린 시점부터 idle 시계를 다시 시작하므로 직후에는 sleeping이 되지 않는다
    store.permissionResolved("perm-outlasts-turn", "req-a");
    advance(500);
    const allResolvedAt = getClock();
    store.permissionResolved("perm-outlasts-turn", "req-b");

    const afterAllResolved = findAgent("perm-outlasts-turn");
    assert.equal(afterAllResolved?.needsAttention, false);
    assert.equal(afterAllResolved?.state, idlePoseFor("perm-outlasts-turn"));
    assert.equal(afterAllResolved?.stateSince, allResolvedAt);
  });
});

describe("4. 생명주기 (closed/archived 제거 및 부모 부재 처리)", () => {
  it("closed/archived(remove)된 에이전트는 스냅샷에서 빠지고 빈 오피스도 사라진다", () => {
    const { store, getOffices } = createTestEnv();
    store.upsert(makeAgent("solo-1"));
    assert.equal(getOffices().length, 1);
    assert.equal(store.has("solo-1"), true);

    store.remove("solo-1");
    assert.equal(store.has("solo-1"), false);
    assert.equal(getOffices().length, 0);
  });

  it("부모 에이전트가 사라지면(remove) 자식들은 solo 또는 새로운 루트로 처리된다", () => {
    const { store, getOffices } = createTestEnv();
    store.upsert(makeAgent("boss"));
    store.upsert(makeAgent("mid", { parentAgentId: "boss" }));
    store.upsert(makeAgent("leaf", { parentAgentId: "mid" }));
    store.upsert(makeAgent("worker", { parentAgentId: "boss" }));

    assert.equal(getOffices().length, 1);
    assert.equal(getOffices()[0].kind, "group");
    assert.equal(getOffices()[0].manager?.id, "boss");
    assert.deepEqual(
      getOffices()[0].members.map((m) => m.id),
      ["mid", "leaf", "worker"],
    );

    // 최상위 부모(boss)가 제거되면:
    // - mid는 자식이(leaf) 있으므로 mid가 manager인 group이 됨
    // - worker는 자식이 없으므로 solo가 됨
    store.remove("boss");
    const afterRemove = getOffices();
    assert.equal(afterRemove.length, 2);

    const midOffice = afterRemove.find((o) => o.id === "mid");
    const workerOffice = afterRemove.find((o) => o.id === "worker");

    assert.ok(midOffice);
    assert.equal(midOffice.kind, "group");
    assert.equal(midOffice.manager?.id, "mid");
    assert.deepEqual(
      midOffice.members.map((m) => m.id),
      ["leaf"],
    );

    assert.ok(workerOffice);
    assert.equal(workerOffice.kind, "solo");
    assert.equal(workerOffice.manager, null);
    assert.deepEqual(
      workerOffice.members.map((m) => m.id),
      ["worker"],
    );
  });

  it("워크스페이스가 아카이브(removeWorkspace)되면 해당 워크스페이스의 에이전트만 제거된다", () => {
    const { store, getOffices } = createTestEnv();
    store.upsert(makeAgent("a-main", { workspaceId: WS_MAIN }));
    store.upsert(makeAgent("a-sub", { workspaceId: WS_SUB }));
    assert.equal(getOffices().length, 2);

    store.removeWorkspace(WS_SUB);
    const remaining = getOffices();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "a-main");
  });
});

describe("5. 그룹 규칙 (parentAgentId 트리, solo, 순환 방지, 다중 워크스페이스)", () => {
  it("parentAgentId 트리는 group(manager + members, members에 manager 없음, 생성 순서), 단독은 solo가 된다", () => {
    const { store, getOffices } = createTestEnv();
    // 자식(child-early)이 부모(root)보다 먼저 등록된 경우에도 root가 manager이고 members는 생성 순서여야 함
    store.upsert(makeAgent("child-early", { parentAgentId: "root" }));
    store.upsert(makeAgent("root"));
    store.upsert(makeAgent("child-late", { parentAgentId: "root" }));
    store.upsert(makeAgent("grandchild", { parentAgentId: "child-early" }));
    store.upsert(makeAgent("solo-agent"));

    const offices = getOffices();
    assert.equal(offices.length, 2);

    const group = offices.find((o) => o.id === "root");
    assert.ok(group);
    assert.equal(group.kind, "group");
    assert.equal(group.manager?.id, "root");
    // members에 manager가 없어야 하며, 생성(upsert) 순서대로 정렬되어야 함
    assert.deepEqual(
      group.members.map((m) => m.id),
      ["child-early", "child-late", "grandchild"],
    );
    assert.ok(!group.members.some((m) => m.id === "root"));

    const solo = offices.find((o) => o.id === "solo-agent");
    assert.ok(solo);
    assert.equal(solo.kind, "solo");
    assert.equal(solo.manager, null);
    assert.equal(solo.members.length, 1);
    assert.equal(solo.members[0].id, "solo-agent");
  });

  it("부모 사슬에 순환(자기 참조, 2-노드, 3-노드 순환)이 있어도 무한 루프 없이 동작한다", () => {
    const { store, getOffices } = createTestEnv();
    // 자기 자신이 부모
    store.upsert(makeAgent("self-loop", { parentAgentId: "self-loop" }));
    // 2-노드 순환
    store.upsert(makeAgent("c1", { parentAgentId: "c2" }));
    store.upsert(makeAgent("c2", { parentAgentId: "c1" }));
    // 3-노드 순환
    store.upsert(makeAgent("t1", { parentAgentId: "t2" }));
    store.upsert(makeAgent("t2", { parentAgentId: "t3" }));
    store.upsert(makeAgent("t3", { parentAgentId: "t1" }));

    const offices = getOffices();
    assert.equal(offices.length, 6);
    assert.ok(offices.every((o) => o.kind === "solo"));
  });

  it("부모 사슬 상위가 순환(x <-> y)이고 그 아래에 자식(z -> x)이 달린 경우에도 무한 루프 없이 처리된다", () => {
    const { store, getOffices } = createTestEnv();
    store.upsert(makeAgent("x", { parentAgentId: "y" }));
    store.upsert(makeAgent("y", { parentAgentId: "x" }));
    store.upsert(makeAgent("z", { parentAgentId: "x" }));

    const offices = getOffices();
    // 무한 루프 없이 스냅샷이 생성되어야 함
    assert.ok(offices.length > 0);
  });

  it("같은 프로젝트의 다른 워크스페이스에 있는 자식도 같은 오피스로 묶인다", () => {
    const { store, getOffices } = createTestEnv();
    store.upsert(makeAgent("manager-ws1", { workspaceId: WS_MAIN }));
    store.upsert(
      makeAgent("member-ws2", {
        workspaceId: WS_SUB,
        parentAgentId: "manager-ws1",
      }),
    );
    store.upsert(
      makeAgent("grandchild-ws1", {
        workspaceId: WS_MAIN,
        parentAgentId: "member-ws2",
      }),
    );

    const offices = getOffices(PRJ_TEST);
    assert.equal(offices.length, 1);
    assert.equal(offices[0].kind, "group");
    assert.equal(offices[0].manager?.id, "manager-ws1");
    assert.deepEqual(
      offices[0].members.map((m) => m.id),
      ["member-ws2", "grandchild-ws1"],
    );
  });
});

describe("6. 스냅샷 범위 (project vs all, 정렬, 빈 프로젝트, 모르는 projectId)", () => {
  it("project 범위는 projects 1개이고 에이전트가 없어도 알려진 프로젝트면 빈 offices로 1개 반환한다", () => {
    const { store } = createTestEnv();
    store.upsert(makeAgent("a1", { workspaceId: WS_MAIN }));
    store.upsert(makeAgent("a2", { workspaceId: WS_ALPHA }));

    const snapTest = store.snapshot(PRJ_TEST);
    assert.equal(snapTest.scope, "project");
    assert.equal(snapTest.projects.length, 1);
    assert.equal(snapTest.projects[0].projectId, PRJ_TEST);
    assert.equal(snapTest.projects[0].offices.length, 1);

    // 에이전트가 없는 프로젝트(PRJ_EMPTY)를 project 범위로 조회할 때도 길이 1
    const snapEmpty = store.snapshot(PRJ_EMPTY);
    assert.equal(snapEmpty.scope, "project");
    assert.equal(snapEmpty.projects.length, 1);
    assert.equal(snapEmpty.projects[0].projectId, PRJ_EMPTY);
    assert.deepEqual(snapEmpty.projects[0].offices, []);
  });

  it("all 범위는 projectName 오름차순(동일 이름이면 projectId 순)이고, 에이전트가 없는 프로젝트는 빠진다", () => {
    const { store } = createTestEnv();
    store.upsert(makeAgent("a-test", { workspaceId: WS_MAIN }));
    store.upsert(makeAgent("a-alpha", { workspaceId: WS_ALPHA }));
    // PRJ_EMPTY에는 에이전트 없음

    const allSnap = store.snapshot();
    assert.equal(allSnap.scope, "all");
    assert.deepEqual(
      allSnap.projects.map((p) => p.projectName),
      ["alpha-project", "test-project"],
    );
    assert.ok(!allSnap.projects.some((p) => p.projectId === PRJ_EMPTY));
  });

  it("모르는 projectId로 조회하면 scope는 'project'이고 projects는 빈 배열이다", () => {
    const { store } = createTestEnv();
    store.upsert(makeAgent("a1"));

    const unknownSnap = store.snapshot("prj_does_not_exist");
    assert.equal(unknownSnap.scope, "project");
    assert.deepEqual(unknownSnap.projects, []);
  });

  it("워크스페이스 매핑이 없는 에이전트는 스냅샷에서 빠지고 hasUnmappedWorkspace()가 true를 반환한다", () => {
    const { store } = createTestEnv();
    assert.equal(store.hasUnmappedWorkspace(), false);

    store.upsert(makeAgent("unmapped-agent", { workspaceId: "wks_unmapped" }));
    assert.equal(store.hasUnmappedWorkspace(), true);
    assert.deepEqual(store.snapshot().projects, []);
  });
});

describe("7. 순서 가정 위반에 대한 내성 (중복/역순/미등록 이벤트)", () => {
  it("turn_ended가 turn_started 없이 와도 깨지지 않고 idle(since) 시각도 리셋되지 않는다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    const initialTime = getClock();
    store.upsert(makeAgent("idle-agent"));

    advance(3000);
    // 이미 idle인데 turn_ended가 온 경우
    store.turnEnded("idle-agent");

    const view = findAgent("idle-agent");
    assert.equal(view?.state, idlePoseFor("idle-agent"));
    assert.equal(view?.stateSince, initialTime);
  });

  it("turn_started나 turn_ended가 중복으로 연속해서 와도 stateSince가 덮어써지지 않는다", () => {
    const { store, findAgent, advance, getClock } = createTestEnv();
    store.upsert(makeAgent("dup-agent"));

    advance(1000);
    const startTime = getClock();
    store.turnStarted("dup-agent");
    assert.equal(findAgent("dup-agent")?.stateSince, startTime);

    advance(2000);
    // 중복 turn_started
    store.turnStarted("dup-agent");
    assert.equal(findAgent("dup-agent")?.state, "working");
    assert.equal(findAgent("dup-agent")?.stateSince, startTime);

    advance(2000);
    const endTime = getClock();
    store.turnEnded("dup-agent");
    assert.equal(findAgent("dup-agent")?.stateSince, endTime);

    advance(2000);
    // 중복 turn_ended
    store.turnEnded("dup-agent");
    assert.equal(findAgent("dup-agent")?.stateSince, endTime);
  });

  it("같은 permission requestId가 중복 요청되거나 없는 requestId가 resolved되어도 깨지지 않는다", () => {
    const { store, findAgent } = createTestEnv();
    store.upsert(makeAgent("perm-dup"));
    store.turnStarted("perm-dup");

    // 없는 requestId 먼저 resolve
    store.permissionResolved("perm-dup", "non-existent");
    assert.equal(findAgent("perm-dup")?.needsAttention, false);

    // 같은 requestId 중복 요청 후 1회 resolve 시 바로 false가 되어야 함 (Set 기반)
    store.permissionRequested("perm-dup", "req-same");
    store.permissionRequested("perm-dup", "req-same");
    assert.equal(findAgent("perm-dup")?.needsAttention, true);

    store.permissionResolved("perm-dup", "req-same");
    assert.equal(findAgent("perm-dup")?.needsAttention, false);

    // 이미 resolve된 requestId 재차 resolve
    store.permissionResolved("perm-dup", "req-same");
    assert.equal(findAgent("perm-dup")?.needsAttention, false);
  });

  it("등록되지 않은 에이전트 id에 대한 이벤트 호출이나 삭제가 와도 예외 없이 무시된다", () => {
    const { store } = createTestEnv();
    assert.doesNotThrow(() => {
      store.turnStarted("ghost");
      store.turnEnded("ghost");
      store.permissionRequested("ghost", "r1");
      store.permissionResolved("ghost", "r1");
      store.remove("ghost");
      store.removeWorkspace("wks_ghost");
    });
  });
});
