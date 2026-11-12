import type { PluginHandlerContext, PluginHookAgent, PluginServerContext } from "@getpaseo/plugin/server";
import { WORKSPACE_REFRESH_MS, WORKSPACE_REFRESH_UNMAPPED_MS } from "../shared/state/constants.ts";
import { createOfficeStore, type WorkspaceProject } from "../shared/state/machine.ts";
import { officeSnapshotRpc } from "../shared/state/rpc.ts";
import {
  identityFromHook,
  identityFromListed,
  runningSubagentsFromTimeline,
  seedFromListed,
  subagentUpdateFromPayload,
  workspaceProjectFromListed,
} from "./mapping.ts";

type PaseoApi = PluginHandlerContext["paseo"];

export interface OfficeOptions {
  /** 현재 시각(ms). 테스트에서 주입한다. */
  now?: () => number;
}

export function contributeOffice(server: PluginServerContext, options: OfficeOptions = {}) {
  const now = options.now ?? Date.now;
  const store = createOfficeStore({ now });
  const TIMELINE_RESTORE_LIMIT = 200;

  // 서브에이전트 이벤트 구독. paseo API 객체가 바뀌면(호출마다 새로 만들어지는 경우) 새 객체로 다시 구독하고 이전 것은 놓는다.
  // 구독이 열린 뒤 이벤트가 닿은 서브에이전트는 타임라인 복원이 덮어쓰지 못하게 기록한다(이미 끝난 항목이 되살아나는 것을 막는다).
  let subscribedPaseo: PaseoApi | null = null;
  let subscription: ReturnType<PaseoApi["observeEvents"]> | null = null;
  const liveSubagents = new Set<string>();
  function ensureSubscribed(paseo: PaseoApi): void {
    if (subscribedPaseo === paseo) return;
    const previous = subscription;
    let next: typeof subscription;
    try {
      next = paseo.observeEvents(["agent.provider_subagents.update"]);
    } catch {
      // 구독을 못 열어도 오피스 본 기능은 계속 동작한다. 다음 호출에서 다시 시도한다.
      return;
    }
    subscribedPaseo = paseo;
    subscription = next;
    next.subscribe({
      snapshot() {},
      update(message) {
        if (message.type !== "agent.provider_subagents.update") return;
        const update = subagentUpdateFromPayload(message.payload, now());
        if (!update) return;
        if (update.kind === "remove") {
          liveSubagents.add(`${update.parentAgentId}:${update.id}`);
          store.subagentRemove(update.parentAgentId, update.id);
        } else {
          liveSubagents.add(`${update.input.parentAgentId}:${update.input.id}`);
          store.subagentUpsert(update.input);
        }
      },
      error() {
        // 구독이 끊기면 다음 호출에서 다시 연다.
        if (subscription === next) subscribedPaseo = null;
      },
    });
    void previous?.release().catch(() => {});
  }

  // PluginServerContext에는 paseo가 없고 훅/RPC 컨텍스트에만 있다. 첫 호출 시점에 한 번 목록으로 초기화한다.
  let initialization: Promise<void> | null = null;
  function ensureInitialized(paseo: PaseoApi): Promise<void> {
    ensureSubscribed(paseo);
    initialization ??= loadAgents(paseo).catch((error) => {
      initialization = null;
      throw error;
    });
    return initialization;
  }

  let workspacesLoadedAt = 0;
  async function refreshWorkspaces(paseo: PaseoApi): Promise<void> {
    const maxAge = store.hasUnmappedWorkspace() ? WORKSPACE_REFRESH_UNMAPPED_MS : WORKSPACE_REFRESH_MS;
    if (now() - workspacesLoadedAt < maxAge) return;
    const entries: WorkspaceProject[] = [];
    let cursor: string | undefined;
    do {
      const result = await paseo.workspaces.list({ page: { limit: 200, cursor } });
      for (const workspace of result.entries) {
        entries.push(workspaceProjectFromListed(workspace));
      }
      cursor = result.pageInfo.hasMore ? (result.pageInfo.nextCursor ?? undefined) : undefined;
    } while (cursor);
    store.setWorkspaces(entries);
    // 성공한 뒤에만 갱신한다. 실패하면 다음 호출이 바로 다시 시도한다.
    workspacesLoadedAt = now();
  }

  async function loadAgents(paseo: PaseoApi): Promise<void> {
    let cursor: string | undefined;
    do {
      const result = await paseo.agents.list({
        filter: { statuses: ["initializing", "idle", "running", "error"], includeArchived: false },
        page: { limit: 200, cursor },
      });
      for (const { agent } of result.entries) {
        const identity = identityFromListed(agent);
        if (identity) store.upsert(identity, seedFromListed(agent));
      }
      cursor = result.pageInfo.hasMore ? (result.pageInfo.nextCursor ?? undefined) : undefined;
    } while (cursor);
    await restoreSubagents(paseo);
  }

  /** 켜지기 전부터 돌던 서브에이전트를 각 에이전트의 최근 타임라인에서 복원한다. 개별 실패는 무시하고, 이벤트가 먼저 알려 준 항목은 건드리지 않는다. */
  async function restoreSubagents(paseo: PaseoApi): Promise<void> {
    const parents = store.agentRefs();
    await Promise.allSettled(
      parents.map(async (parent) => {
        const page = await paseo.agents.ref(parent.id).timeline.refetch({ direction: "tail", limit: TIMELINE_RESTORE_LIMIT });
        for (const input of runningSubagentsFromTimeline(parent, page.entries, now())) {
          if (!liveSubagents.has(`${input.parentAgentId}:${input.id}`)) store.subagentUpsert(input);
        }
      }),
    );
  }

  /** hook 이벤트에서 에이전트를 먼저 알아 둔다(목록보다 먼저 온 이벤트 포함). */
  async function track(agent: PluginHookAgent, paseo: PaseoApi): Promise<void> {
    await ensureInitialized(paseo).catch(() => {});
    const identity = identityFromHook(agent);
    if (identity) store.upsert(identity);
  }

  server.addHook("agent.create.after", async ({ agent }, { paseo }) => {
    await track(agent, paseo);
  });
  server.addHook("agent.turn.before", async ({ agent }, { paseo }) => {
    await track(agent, paseo);
    store.turnStarted(agent.id);
  });
  server.addHook("agent.turn.after", async ({ agent }, { paseo }) => {
    await track(agent, paseo);
    store.turnEnded(agent.id);
  });
  server.addHook("agent.permission.before", async ({ agent, request }, { paseo }) => {
    await track(agent, paseo);
    store.permissionRequested(agent.id, request.id);
  });
  server.addHook("agent.permission.after", async ({ agent, requestId }, { paseo }) => {
    await track(agent, paseo);
    store.permissionResolved(agent.id, requestId);
  });
  server.addHook("agent.close.after", async ({ agent }) => {
    store.remove(agent.id);
  });
  server.addHook("agent.archive.after", async ({ agent }) => {
    store.remove(agent.id);
  });

  server.addHook("workspace.archive.after", async ({ workspace }) => {
    store.removeWorkspace(workspace.id);
  });

  server.handle(officeSnapshotRpc, async ({ projectId, workspaceId }, { paseo }) => {
    await ensureInitialized(paseo);
    await refreshWorkspaces(paseo);
    return store.snapshot(projectId, workspaceId);
  });

  return () => {};
}
