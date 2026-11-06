import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PluginHandlerContext, PluginHookAgent, PluginServerContext } from "@getpaseo/plugin/server";
import {
  PARENT_AGENT_LABEL,
  SLEEP_AFTER_MS,
  SNAPSHOT_RPC_NAME,
  WORKSPACE_REFRESH_MS,
  WORKSPACE_REFRESH_UNMAPPED_MS,
} from "../../shared/state/constants.ts";
import type { OfficeSnapshot } from "../../shared/state/contract.ts";
import { idlePoseFor } from "../../shared/state/machine.ts";
import { contributeOffice } from "../../server/office.ts";
import type { ListedAgentLike, ListedWorkspaceLike } from "../../server/mapping.ts";

type HookHandler = (payload: any, context: { paseo: any }) => Promise<void> | void;
type RpcHandler = (input: { projectId?: string }, context: { paseo: any }) => Promise<OfficeSnapshot>;

interface FakePaseoState {
  agentsPages: Array<Array<{ agent: ListedAgentLike }>>;
  workspacesPages: Array<Array<ListedWorkspaceLike>>;
  failAgentsNext: boolean;
  failWorkspacesNext: boolean;
  agentsListCalls: number;
  workspacesListCalls: number;
}

function createFakeOfficeHarness(initialClock = 1_000_000) {
  let clock = initialClock;
  const hooks = new Map<string, HookHandler>();
  const rpcs = new Map<string, RpcHandler>();

  const state: FakePaseoState = {
    agentsPages: [[]],
    workspacesPages: [
      [
        {
          id: "wks_1",
          name: "ws-one",
          projectId: "prj_1",
          project: { projectName: "Project One" },
        },
      ],
    ],
    failAgentsNext: false,
    failWorkspacesNext: false,
    agentsListCalls: 0,
    workspacesListCalls: 0,
  };

  const paseo = {
    agents: {
      async list({ page }: { page?: { limit?: number; cursor?: string } }) {
        state.agentsListCalls += 1;
        if (state.failAgentsNext) {
          state.failAgentsNext = false;
          throw new Error("Simulated agents.list failure");
        }
        const idx = page?.cursor ? Number(page.cursor) : 0;
        const entries = state.agentsPages[idx] ?? [];
        const hasMore = idx + 1 < state.agentsPages.length;
        return {
          entries,
          pageInfo: {
            hasMore,
            nextCursor: hasMore ? String(idx + 1) : null,
          },
        };
      },
    },
    workspaces: {
      async list({ page }: { page?: { limit?: number; cursor?: string } }) {
        state.workspacesListCalls += 1;
        if (state.failWorkspacesNext) {
          state.failWorkspacesNext = false;
          throw new Error("Simulated workspaces.list failure");
        }
        const idx = page?.cursor ? Number(page.cursor) : 0;
        const entries = state.workspacesPages[idx] ?? [];
        const hasMore = idx + 1 < state.workspacesPages.length;
        return {
          entries,
          pageInfo: {
            hasMore,
            nextCursor: hasMore ? String(idx + 1) : null,
          },
        };
      },
    },
  } as unknown as PluginHandlerContext["paseo"];

  const server = {
    addHook(name: string, handler: HookHandler) {
      hooks.set(name, handler);
    },
    handle(rpc: { name: string }, handler: RpcHandler) {
      rpcs.set(rpc.name, handler);
    },
  } as unknown as PluginServerContext;

  const dispose = contributeOffice(server, { now: () => clock });

  const advance = (ms: number) => {
    clock += ms;
  };
  const getClock = () => clock;

  const emitHook = async (name: string, payload: Record<string, unknown>) => {
    const handler = hooks.get(name);
    assert.ok(handler, `Hook ${name} should be registered`);
    await handler(payload, { paseo });
  };

  const callSnapshot = async (projectId?: string): Promise<OfficeSnapshot> => {
    const handler = rpcs.get(SNAPSHOT_RPC_NAME);
    assert.ok(handler, `RPC ${SNAPSHOT_RPC_NAME} should be registered`);
    return handler({ projectId }, { paseo });
  };

  return {
    state,
    advance,
    getClock,
    emitHook,
    callSnapshot,
    dispose,
  };
}

function makeHookAgent(
  id: string,
  overrides: Partial<PluginHookAgent> = {},
): PluginHookAgent {
  return {
    id,
    workspaceId: "wks_1",
    parentAgentId: null,
    provider: "claude",
    title: `Agent ${id}`,
    ...overrides,
  } as PluginHookAgent;
}

describe("server/office.ts — contributeOffice 통합 및 회귀 테스트", () => {
  it("초기 목록(페이지네이션 포함) 로드 후 훅(create/turn/permission/close/archive/workspace.archive) → 스냅샷 흐름이 정확히 동작한다", async () => {
    const { state, advance, getClock, emitHook, callSnapshot, dispose } = createFakeOfficeHarness();

    // 2페이지에 걸친 초기 에이전트 목록 설정
    const seedTimeIso = new Date(getClock() - 5000).toISOString();
    state.agentsPages = [
      [
        {
          agent: {
            id: "root_1",
            workspaceId: "wks_1",
            provider: "claude",
            title: "Manager",
            status: "running",
            updatedAt: seedTimeIso,
            labels: {},
            pendingPermissions: [],
          },
        },
      ],
      [
        {
          agent: {
            id: "child_seeded",
            workspaceId: "wks_1",
            provider: "custom-agent",
            title: "Seeded Child",
            status: "idle",
            updatedAt: seedTimeIso,
            labels: { [PARENT_AGENT_LABEL]: "root_1" },
            pendingPermissions: [],
          },
        },
      ],
    ];

    // 1) 첫 스냅샷 호출 시 초기 목록(2페이지)과 워크스페이스 목록을 가져온다
    const snap1 = await callSnapshot("prj_1");
    assert.equal(state.agentsListCalls, 2);
    assert.equal(state.workspacesListCalls, 1);
    assert.equal(snap1.projects.length, 1);
    assert.equal(snap1.projects[0].offices.length, 1);
    assert.equal(snap1.projects[0].offices[0].kind, "group");
    assert.equal(snap1.projects[0].offices[0].manager?.id, "root_1");
    assert.equal(snap1.projects[0].offices[0].manager?.state, "working");
    assert.deepEqual(
      snap1.projects[0].offices[0].members.map((m) => m.id),
      ["child_seeded"],
    );

    // 2) agent.create.after 로 새 자식 등록 -> agent.turn.before -> working
    advance(1000);
    const childHook = makeHookAgent("child_hook", { parentAgentId: "root_1", provider: "codex" });
    await emitHook("agent.create.after", { agent: childHook });
    await emitHook("agent.turn.before", { agent: childHook });

    let snap = await callSnapshot("prj_1");
    const office = snap.projects[0].offices[0];
    assert.deepEqual(
      office.members.map((m) => m.id),
      ["child_seeded", "child_hook"],
    );
    assert.equal(office.members[1].state, "working");

    // 3) agent.turn.after -> idle(away/phone), 이어서 permission.before -> working + needsAttention
    advance(500);
    await emitHook("agent.turn.after", { agent: childHook });
    snap = await callSnapshot("prj_1");
    assert.equal(snap.projects[0].offices[0].members[1].state, idlePoseFor("child_hook"));

    advance(500);
    const permStart = getClock();
    await emitHook("agent.permission.before", { agent: childHook, request: { id: "perm_99" } });
    snap = await callSnapshot("prj_1");
    assert.equal(snap.projects[0].offices[0].members[1].state, "working");
    assert.equal(snap.projects[0].offices[0].members[1].needsAttention, true);
    assert.equal(snap.projects[0].offices[0].members[1].stateSince, permStart);

    // 4) agent.permission.after -> needsAttention 해제 및 idle 복귀, SLEEP_AFTER_MS 경과 시 sleeping
    advance(2000);
    const permEnd = getClock();
    await emitHook("agent.permission.after", { agent: childHook, requestId: "perm_99" });
    snap = await callSnapshot("prj_1");
    assert.equal(snap.projects[0].offices[0].members[1].needsAttention, false);
    assert.equal(snap.projects[0].offices[0].members[1].state, idlePoseFor("child_hook"));
    assert.equal(snap.projects[0].offices[0].members[1].stateSince, permEnd);

    advance(SLEEP_AFTER_MS);
    snap = await callSnapshot("prj_1");
    assert.equal(snap.projects[0].offices[0].members[1].state, "sleeping");

    // 5) agent.close.after & agent.archive.after
    await emitHook("agent.close.after", { agent: { id: "child_seeded" } });
    await emitHook("agent.archive.after", { agent: { id: "child_hook" } });
    snap = await callSnapshot("prj_1");
    assert.equal(snap.projects[0].offices.length, 1);
    assert.equal(snap.projects[0].offices[0].kind, "solo");
    assert.equal(snap.projects[0].offices[0].id, "root_1");

    // 6) workspace.archive.after
    await emitHook("workspace.archive.after", { workspace: { id: "wks_1" } });
    snap = await callSnapshot("prj_1");
    assert.deepEqual(snap.projects[0].offices, []);

    dispose();
  });

  it("결함 2 회귀: refreshWorkspaces가 실패하면 쿨다운이 시작되지 않고 다음 호출이 즉시 재시도한다", async () => {
    const { state, advance, emitHook, callSnapshot } = createFakeOfficeHarness();

    await emitHook("agent.create.after", { agent: makeHookAgent("ag_1") });

    // 첫 번째 snapshot 호출 시 workspaces.list가 일시적 오류로 실패하도록 설정
    state.failWorkspacesNext = true;
    await assert.rejects(() => callSnapshot("prj_1"), /Simulated workspaces\.list failure/);
    assert.equal(state.workspacesListCalls, 1);

    // 시간이 전혀 흐르지 않았어도(0ms), 이전 호출이 실패했으므로 쿨다운에 걸리지 않고 즉시 재시도하여 성공해야 한다
    const snap = await callSnapshot("prj_1");
    assert.equal(state.workspacesListCalls, 2);
    assert.equal(snap.projects.length, 1);
    assert.equal(snap.projects[0].offices.length, 1);
    assert.equal(snap.projects[0].offices[0].id, "ag_1");

    // 성공한 직후에는 WORKSPACE_REFRESH_MS(10초) 동안 캐시를 재사용하므로 workspaces.list를 다시 부르지 않는다
    advance(WORKSPACE_REFRESH_MS - 1);
    await callSnapshot("prj_1");
    assert.equal(state.workspacesListCalls, 2);

    // WORKSPACE_REFRESH_MS 경과 후에는 다시 새로고침한다
    advance(1);
    await callSnapshot("prj_1");
    assert.equal(state.workspacesListCalls, 3);
  });

  it("매핑에 없는 워크스페이스의 에이전트가 들어오면 짧은 주기(WORKSPACE_REFRESH_UNMAPPED_MS)로 워크스페이스를 다시 조회한다", async () => {
    const { state, advance, emitHook, callSnapshot } = createFakeOfficeHarness();

    await callSnapshot();
    assert.equal(state.workspacesListCalls, 1);

    // 아직 매핑에 없는 wks_2 소속 에이전트가 생성됨
    await emitHook("agent.create.after", {
      agent: makeHookAgent("ag_unmapped", { workspaceId: "wks_2" }),
    });
    state.workspacesPages = [
      [
        { id: "wks_1", name: "ws-one", projectId: "prj_1", project: { projectName: "Project One" } },
        { id: "wks_2", name: "ws-two", projectId: "prj_2", project: { projectName: "Project Two" } },
      ],
    ];

    // WORKSPACE_REFRESH_UNMAPPED_MS 직전에는 아직 재조회하지 않음
    advance(WORKSPACE_REFRESH_UNMAPPED_MS - 1);
    await callSnapshot();
    assert.equal(state.workspacesListCalls, 1);

    // WORKSPACE_REFRESH_UNMAPPED_MS 도달 시 재조회하여 wks_2가 매핑에 반영됨
    advance(1);
    const snap = await callSnapshot("prj_2");
    assert.equal(state.workspacesListCalls, 2);
    assert.equal(snap.projects[0]?.offices[0]?.id, "ag_unmapped");
  });

  it("초기 loadAgents(ensureInitialized)가 실패하면 캐시되지 않고 다음 호출에서 다시 시도한다", async () => {
    const { state, callSnapshot } = createFakeOfficeHarness();

    state.agentsPages = [
      [
        {
          agent: {
            id: "ag_retry",
            workspaceId: "wks_1",
            provider: "claude",
            title: "Retry Agent",
            status: "idle",
            updatedAt: "2026-11-06T00:00:00.000Z",
            labels: {},
            pendingPermissions: [],
          },
        },
      ],
    ];
    state.failAgentsNext = true;

    await assert.rejects(() => callSnapshot("prj_1"), /Simulated agents\.list failure/);
    assert.equal(state.agentsListCalls, 1);

    // 다음 호출에서 다시 loadAgents를 수행하여 성공한다
    const snap = await callSnapshot("prj_1");
    assert.equal(state.agentsListCalls, 2);
    assert.equal(snap.projects[0]?.offices[0]?.id, "ag_retry");
  });
});
