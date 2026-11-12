import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PluginHandlerContext, PluginServerContext } from "@getpaseo/plugin/server";
import { SNAPSHOT_RPC_NAME } from "../../shared/state/constants.ts";
import type { OfficeSnapshot } from "../../shared/state/contract.ts";
import { contributeOffice } from "../../server/office.ts";

const EVENT = "agent.provider_subagents.update";

type Observer = { update(message: { type: string; payload: unknown }): void; snapshot?(): void; error?(e: unknown): void };

function harness() {
  let clock = 1_000_000;
  const observed: string[][] = [];
  let observer: Observer | null = null;
  let released = 0;
  const timelines = new Map<string, unknown[]>();
  const refetchCalls: Array<{ id: string; args: unknown }> = [];
  let failRefetch = false;
  const agents = [
    { agent: { id: "boss", workspaceId: "wks_1", provider: "claude", title: "Boss", status: "idle", updatedAt: new Date(clock - 5000).toISOString(), labels: {}, pendingPermissions: [] } },
  ];
  const paseo = {
    agents: {
      async list() { return { entries: agents, pageInfo: { hasMore: false, nextCursor: null } }; },
      ref: (id: string) => ({ timeline: { async refetch(args: unknown) { refetchCalls.push({ id, args }); if (failRefetch) throw new Error("timeline unavailable"); return { entries: timelines.get(id) ?? [] }; } } }),
    },
    workspaces: {
      async list() { return { entries: [{ id: "wks_1", name: "ws", projectId: "prj_1", project: { projectName: "Project One" } }], pageInfo: { hasMore: false, nextCursor: null } }; },
    },
    observeEvents: (events: string[]) => {
      observed.push(events);
      return { subscribe: (o: Observer) => { observer = o; return () => {}; }, release: async () => { released += 1; } };
    },
  } as unknown as PluginHandlerContext["paseo"];

  const rpcs = new Map<string, (input: unknown, ctx: { paseo: unknown }) => Promise<OfficeSnapshot>>();
  const server = { addHook() {}, handle(rpc: { name: string }, handler: never) { rpcs.set(rpc.name, handler); } } as unknown as PluginServerContext;
  contributeOffice(server, { now: () => clock });

  const snapshot = () => rpcs.get(SNAPSHOT_RPC_NAME)!({ projectId: "prj_1" }, { paseo });
  const emit = (payload: unknown, type = EVENT) => observer!.update({ type, payload });
  const upsert = (id: string, status: string, extra: Record<string, unknown> = {}) =>
    emit({ kind: "upsert", subagent: { id, parentAgentId: "boss", provider: "claude", status, createdAt: new Date(clock).toISOString(), ...extra } });
  const subs = async () => (await snapshot()).projects[0].offices[0].subagents;
  return { setFailRefetch: (v: boolean) => { failRefetch = v; }, observed, emit, upsert, snapshot, subs, timelines, refetchCalls, hasObserver: () => observer !== null, released: () => released };
}

const subCall = (callId: string, status: string, description: string) => ({
  timestamp: "2026-01-01T00:00:00.000Z",
  item: { type: "tool_call", callId, status, detail: { type: "sub_agent", description, subAgentType: "Explore" } },
});

describe("server/office.ts — provider 서브에이전트", () => {
  it("첫 RPC에서 정확히 agent.provider_subagents.update만 구독한다", async () => {
    const h = harness();
    assert.deepEqual(h.observed, [], "RPC 전에는 구독하지 않는다(paseo 객체가 아직 없다)");
    await h.snapshot();
    assert.deepEqual(h.observed, [[EVENT]]);
    await h.snapshot();
    assert.equal(h.observed.length, 1, "같은 paseo로는 다시 구독하지 않는다");
  });

  it("upsert 이벤트가 RPC 스냅샷의 부모 오피스에 반영된다", async () => {
    const h = harness();
    await h.snapshot();
    h.upsert("s1", "running", { description: "코드 탐색", provider: "codex" });
    const subs = await h.subs();
    assert.deepEqual(subs.map((s) => [s.id, s.parentAgentId, s.name, s.provider]), [["s1", "boss", "코드 탐색", "codex"]]);
  });

  it("remove 이벤트는 제거한다", async () => {
    const h = harness();
    await h.snapshot();
    h.upsert("s1", "running");
    h.upsert("s2", "running");
    h.emit({ kind: "remove", parentAgentId: "boss", subagentId: "s1" });
    assert.deepEqual((await h.subs()).map((s) => s.id), ["s2"]);
  });

  for (const status of ["completed", "failed", "canceled"]) {
    it(`${status} upsert는 제거한다`, async () => {
      const h = harness();
      await h.snapshot();
      h.upsert("s1", "running");
      h.upsert("s1", status);
      assert.deepEqual(await h.subs(), []);
    });
  }

  it("처음부터 running이 아닌 upsert, 알 수 없는 kind·type, 깨진 payload는 무시한다", async () => {
    const h = harness();
    await h.snapshot();
    h.upsert("s0", "completed");
    h.emit({ kind: "timeline", parentAgentId: "boss", subagentId: "s1", item: {} });
    h.emit({ kind: "upsert", subagent: { id: "s2" } });
    h.emit(null);
    h.emit({ kind: "upsert", subagent: { id: "s3", parentAgentId: "boss", status: "running" } }, "agent.other");
    assert.deepEqual(await h.subs(), []);
  });

  it("초기 복원: 타임라인의 running sub_agent만 복원하고 completed는 제외한다", async () => {
    const h = harness();
    h.timelines.set("boss", [subCall("t1", "running", "조사"), subCall("t2", "completed", "끝난 일"), { item: { type: "assistant_message" } }]);
    const subs = await h.subs();
    assert.deepEqual(subs.map((s) => [s.id, s.name]), [["t1", "조사"]]);
    assert.equal(h.refetchCalls.length, 1);
    assert.equal(h.refetchCalls[0].id, "boss");
    assert.deepEqual(h.refetchCalls[0].args, { direction: "tail", limit: 200 });
  });

  it("이벤트로 이미 끝난 항목을 타임라인 복원이 되살리지 않는다", async () => {
    const h = harness();
    // 복원(첫 RPC 초기화) 도중에 구독이 열려 있으므로, 타임라인을 읽기 전에 도착한 이벤트가 우선한다.
    const original = h.timelines;
    original.set("boss", [subCall("t1", "running", "오래된 running")]);
    let fired = false;
    const refetch = h.refetchCalls;
    Object.defineProperty(refetch, "push", { value: (call: unknown) => { if (!fired) { fired = true; h.upsert("t1", "completed"); } return Array.prototype.push.call(refetch, call); } });
    // 첫 RPC: 구독 → 목록 → 타임라인 읽기(이 시점에 completed 이벤트가 먼저 도착)
    const subs = await h.subs();
    assert.ok(fired, "복원 중 이벤트가 주입되었다");
    assert.deepEqual(subs, [], "completed 이벤트가 이긴다");
  });

  it("이벤트가 먼저 알린 running 항목은 타임라인 복원이 덮어쓰지 않는다(이름 유지)", async () => {
    const h = harness();
    h.timelines.set("boss", [subCall("t1", "running", "타임라인 이름")]);
    let fired = false;
    Object.defineProperty(h.refetchCalls, "push", { value: (call: unknown) => { if (!fired) { fired = true; h.upsert("t1", "running", { description: "이벤트 이름" }); } return Array.prototype.push.call(h.refetchCalls, call); } });
    const subs = await h.subs();
    assert.deepEqual(subs.map((s) => s.name), ["이벤트 이름"]);
  });

  it("복원이 끝난 뒤 온 completed 이벤트는 복원된 항목을 제거한다", async () => {
    const h = harness();
    h.timelines.set("boss", [subCall("t1", "running", "조사")]);
    assert.equal((await h.subs()).length, 1);
    h.upsert("t1", "completed");
    assert.deepEqual(await h.subs(), []);
  });

  it("타임라인 읽기가 실패해도 오피스 스냅샷은 정상이고, 이후 이벤트는 반영된다", async () => {
    const h = harness();
    h.setFailRefetch(true);
    const snap = await h.snapshot();
    assert.equal(snap.projects[0].offices[0].members[0].id, "boss");
    assert.deepEqual(snap.projects[0].offices[0].subagents, []);
    h.upsert("s1", "running");
    assert.deepEqual((await h.subs()).map((s) => s.id), ["s1"]);
  });
});
