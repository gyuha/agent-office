import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_NAME_ID_LENGTH } from "../../shared/state/constants.ts";
import { createOfficeStore, type AgentIdentity, type SubagentInput } from "../../shared/state/machine.ts";
import type { Office } from "../../shared/state/contract.ts";

const PRJ = "prj_test";
const WS_A = "wks_a";
const WS_B = "wks_b";

function env() {
  let clock = 1_000_000;
  const store = createOfficeStore({ now: () => clock });
  store.setWorkspaces([
    { workspaceId: WS_A, projectId: PRJ, projectName: "test-project" },
    { workspaceId: WS_B, projectId: PRJ, projectName: "test-project" },
  ]);
  const agent = (id: string, parentAgentId: string | null = null, workspaceId = WS_A): AgentIdentity => ({ id, workspaceId, title: `Title ${id}`, provider: "claude", parentAgentId });
  const sub = (id: string, parentAgentId: string, extra: Partial<SubagentInput> = {}): SubagentInput => ({
    id, parentAgentId, parentSubagentId: null, provider: "claude", title: null, description: null, status: "running", since: clock, ...extra,
  });
  const offices = (): readonly Office[] => store.snapshot(PRJ).projects[0]?.offices ?? [];
  const office = (id: string) => offices().find((o) => o.id === id);
  const allSubs = () => offices().flatMap((o) => o.subagents);
  return { store, agent, sub, offices, office, allSubs, advance: (ms: number) => { clock += ms; } };
}

describe("서브에이전트 스토어 → 스냅샷", () => {
  it("running 서브에이전트는 manager 부모의 오피스에 들어간다", () => {
    const { store, agent, sub, office } = env();
    store.upsert(agent("boss"));
    store.upsert(agent("worker", "boss"));
    store.subagentUpsert(sub("s1", "boss", { description: "탐색" }));
    const o = office("boss")!;
    assert.deepEqual(o.subagents.map((s) => [s.id, s.parentAgentId, s.name, s.provider]), [["s1", "boss", "탐색", "claude"]]);
  });

  it("member 부모의 서브에이전트도 그 member가 속한 오피스에 들어간다", () => {
    const { store, agent, sub, office, offices } = env();
    store.upsert(agent("boss"));
    store.upsert(agent("worker", "boss"));
    store.upsert(agent("loner"));
    store.subagentUpsert(sub("s1", "worker"));
    assert.equal(offices().length, 2);
    assert.deepEqual(office("boss")!.subagents.map((s) => [s.id, s.parentAgentId]), [["s1", "worker"]]);
    assert.deepEqual(office("loner")!.subagents, []);
  });

  it("solo 오피스의 서브에이전트도 들어간다", () => {
    const { store, agent, sub, office } = env();
    store.upsert(agent("loner"));
    store.subagentUpsert(sub("s1", "loner"));
    assert.equal(office("loner")!.kind, "solo");
    assert.deepEqual(office("loner")!.subagents.map((s) => s.id), ["s1"]);
  });

  it("서브에이전트가 없으면 subagents는 빈 배열이다", () => {
    const { store, agent, office } = env();
    store.upsert(agent("loner"));
    assert.deepEqual(office("loner")!.subagents, []);
  });

  for (const status of ["completed", "failed", "canceled"] as const) {
    it(`${status}가 되면 빠진다`, () => {
      const { store, agent, sub, allSubs } = env();
      store.upsert(agent("boss"));
      store.subagentUpsert(sub("s1", "boss"));
      store.subagentUpsert(sub("s2", "boss"));
      assert.equal(allSubs().length, 2);
      store.subagentUpsert(sub("s1", "boss", { status }));
      assert.deepEqual(allSubs().map((s) => s.id), ["s2"]);
    });

    it(`처음부터 ${status}면 추가하지 않는다`, () => {
      const { store, agent, sub, allSubs } = env();
      store.upsert(agent("boss"));
      store.subagentUpsert(sub("s1", "boss", { status }));
      assert.deepEqual(allSubs(), []);
    });
  }

  it("subagentRemove로 제거하고, 없는 항목 제거는 무시한다", () => {
    const { store, agent, sub, allSubs } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("s1", "boss"));
    store.subagentRemove("boss", "nope");
    store.subagentRemove("other", "s1");
    assert.equal(allSubs().length, 1);
    store.subagentRemove("boss", "s1");
    assert.deepEqual(allSubs(), []);
  });

  it("다시 running 갱신하면 이름·provider만 바뀌고 since와 순서는 유지된다", () => {
    const { store, agent, sub, allSubs, advance } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("s1", "boss", { since: 100, title: "old" }));
    store.subagentUpsert(sub("s2", "boss", { since: 200 }));
    advance(5000);
    store.subagentUpsert(sub("s1", "boss", { since: 9999, title: "new", provider: "codex" }));
    const list = allSubs();
    assert.deepEqual(list.map((s) => s.id), ["s1", "s2"]);
    assert.equal(list[0].since, 100);
    assert.equal(list[0].name, "new");
    assert.equal(list[0].provider, "codex");
  });

  it("시작 순서(since)대로 정렬된다", () => {
    const { store, agent, sub, allSubs } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("late", "boss", { since: 300 }));
    store.subagentUpsert(sub("early", "boss", { since: 100 }));
    store.subagentUpsert(sub("mid", "boss", { since: 200 }));
    assert.deepEqual(allSubs().map((s) => s.id), ["early", "mid", "late"]);
  });

  it("이름 우선순위: description → title → 'subagent <id7>'", () => {
    const { store, agent, sub, allSubs } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("a1", "boss", { since: 1, description: "desc", title: "title" }));
    store.subagentUpsert(sub("a2", "boss", { since: 2, description: null, title: "title" }));
    store.subagentUpsert(sub("abcdefghijk", "boss", { since: 3 }));
    const names = allSubs().map((s) => s.name);
    assert.equal(names[0], "desc");
    assert.equal(names[1], "title");
    assert.equal(names[2], `subagent ${"abcdefghijk".slice(0, FALLBACK_NAME_ID_LENGTH)}`);
    assert.equal(FALLBACK_NAME_ID_LENGTH, 7);
  });
});

describe("서브에이전트 중첩·부모 수명", () => {
  it("중첩(parentSubagentId)은 맨 위 Paseo 에이전트의 오피스로 간다", () => {
    const { store, agent, sub, office, allSubs } = env();
    store.upsert(agent("boss"));
    store.upsert(agent("worker", "boss"));
    store.upsert(agent("loner"));
    store.subagentUpsert(sub("s1", "worker", { since: 1 }));
    store.subagentUpsert(sub("s2", "worker", { since: 2, parentSubagentId: "s1" }));
    // 부모를 서브에이전트 id로 가리키는 형태도 맨 위로 올라간다(3단 중첩).
    store.subagentUpsert(sub("s3", "s2", { since: 3 }));
    assert.deepEqual(office("boss")!.subagents.map((s) => [s.id, s.parentAgentId]), [["s1", "worker"], ["s2", "worker"], ["s3", "worker"]]);
    assert.deepEqual(office("loner")!.subagents, []);
    assert.equal(allSubs().length, 3);
  });

  it("부모를 모르는 서브에이전트는 보이지 않고, 부모가 등록되면 나타난다", () => {
    const { store, agent, sub, allSubs, office } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("s1", "ghost"));
    store.subagentUpsert(sub("s2", "other-ghost", { parentSubagentId: "unknown" }));
    assert.deepEqual(allSubs(), []);
    store.upsert(agent("ghost"));
    assert.deepEqual(office("ghost")!.subagents.map((s) => s.id), ["s1"]);
    assert.deepEqual(office("boss")!.subagents, []);
  });

  it("부모 사슬이 순환이면 그 스냅샷에서 제외된다(멈추지 않는다)", () => {
    const { store, agent, sub, allSubs } = env();
    store.upsert(agent("boss"));
    store.subagentUpsert(sub("a", "ghost", { parentSubagentId: "b" }));
    store.subagentUpsert(sub("b", "ghost", { parentSubagentId: "a" }));
    assert.deepEqual(allSubs(), []);
  });

  it("부모 remove(closed/archived)는 그 서브에이전트도 함께 지운다", () => {
    const { store, agent, sub, allSubs, office } = env();
    store.upsert(agent("boss"));
    store.upsert(agent("worker", "boss"));
    store.upsert(agent("loner"));
    store.subagentUpsert(sub("s1", "worker"));
    store.subagentUpsert(sub("s2", "loner"));
    store.remove("worker");
    assert.deepEqual(allSubs().map((s) => s.id), ["s2"]);
    // 같은 id로 다시 등록해도 서브에이전트는 되살아나지 않는다.
    store.upsert(agent("worker", "boss"));
    assert.deepEqual(office("boss")!.subagents, []);
  });

  it("removeWorkspace는 그 워크스페이스 에이전트의 서브에이전트를 함께 지운다", () => {
    const { store, agent, sub, allSubs } = env();
    store.upsert(agent("a1", null, WS_A));
    store.upsert(agent("b1", null, WS_B));
    store.subagentUpsert(sub("sa", "a1"));
    store.subagentUpsert(sub("sb", "b1"));
    store.removeWorkspace(WS_B);
    assert.deepEqual(allSubs().map((s) => s.id), ["sa"]);
  });

  it("서브에이전트가 있어도 부모의 state·needsAttention·stateSince는 그대로다", () => {
    const { store, agent, sub, advance, office } = env();
    store.upsert(agent("boss"));
    store.upsert(agent("worker", "boss"));
    store.turnStarted("boss");
    store.permissionRequested("worker", "req1");
    advance(1000);
    const before = office("boss")!;
    store.subagentUpsert(sub("s1", "boss"));
    store.subagentUpsert(sub("s2", "worker"));
    const after = office("boss")!;
    assert.deepEqual(after.manager, before.manager);
    assert.deepEqual(after.members, before.members);
    assert.equal(after.manager!.state, "working");
    assert.equal(after.manager!.needsAttention, false);
    assert.equal(after.members[0].needsAttention, true);
    // 서브에이전트가 끝나도 마찬가지다.
    store.subagentUpsert(sub("s1", "boss", { status: "completed" }));
    store.subagentUpsert(sub("s2", "worker", { status: "failed" }));
    assert.deepEqual(office("boss")!.manager, before.manager);
    assert.deepEqual(office("boss")!.members, before.members);
  });

  it("서브에이전트만 있는 오피스는 working으로 바뀌지 않는다(idle 부모는 idle)", () => {
    const { store, agent, sub, office } = env();
    store.upsert(agent("loner"));
    store.subagentUpsert(sub("s1", "loner"));
    assert.notEqual(office("loner")!.members[0].state, "working");
  });
});
