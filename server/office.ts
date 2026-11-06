import type { PluginHandlerContext, PluginHookAgent, PluginServerContext } from "@getpaseo/plugin/server";
import { WORKSPACE_REFRESH_MS, WORKSPACE_REFRESH_UNMAPPED_MS } from "../shared/state/constants.ts";
import { createOfficeStore, type WorkspaceProject } from "../shared/state/machine.ts";
import { officeSnapshotRpc } from "../shared/state/rpc.ts";
import { identityFromHook, identityFromListed, seedFromListed, workspaceProjectFromListed } from "./mapping.ts";

type PaseoApi = PluginHandlerContext["paseo"];

export interface OfficeOptions {
  /** 현재 시각(ms). 테스트에서 주입한다. */
  now?: () => number;
}

export function contributeOffice(server: PluginServerContext, options: OfficeOptions = {}) {
  const now = options.now ?? Date.now;
  const store = createOfficeStore({ now });

  // PluginServerContext에는 paseo가 없고 훅/RPC 컨텍스트에만 있다. 첫 호출 시점에 한 번 목록으로 초기화한다.
  let initialization: Promise<void> | null = null;
  function ensureInitialized(paseo: PaseoApi): Promise<void> {
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

  server.handle(officeSnapshotRpc, async ({ projectId }, { paseo }) => {
    await ensureInitialized(paseo);
    await refreshWorkspaces(paseo);
    return store.snapshot(projectId);
  });

  return () => {};
}
