import { PARENT_AGENT_LABEL } from "../shared/state/constants.ts";
import type { AgentIdentity, AgentSeed, WorkspaceProject } from "../shared/state/machine.ts";

/** PluginHookAgent 중 매핑에 쓰는 필드. */
export interface HookAgentLike {
  id: string;
  workspaceId: string | null;
  parentAgentId: string | null;
  provider: string;
  title: string | null;
}

/** paseo.agents.list() 항목의 agent 중 매핑에 쓰는 필드. */
export interface ListedAgentLike {
  id: string;
  workspaceId?: string | undefined;
  provider: string;
  title: string | null;
  status: string;
  updatedAt: string;
  labels: Readonly<Record<string, string>>;
  pendingPermissions: ReadonlyArray<{ id: string }>;
}

/** paseo.workspaces.list() 항목 중 매핑에 쓰는 필드. */
export interface ListedWorkspaceLike {
  id: string;
  name: string;
  projectId: string;
  project?: { projectName: string } | undefined;
}

/** 빈 문자열은 값 없음으로 본다. */
function nonEmpty(value: string | null | undefined): string | null {
  return value ? value : null;
}

/** 워크스페이스가 없는 에이전트는 오피스에 둘 수 없어 null. */
export function identityFromHook(agent: HookAgentLike): AgentIdentity | null {
  const workspaceId = nonEmpty(agent.workspaceId);
  if (workspaceId === null) return null;
  return {
    id: agent.id,
    workspaceId,
    title: nonEmpty(agent.title),
    provider: agent.provider,
    parentAgentId: nonEmpty(agent.parentAgentId),
  };
}

/**
 * agents.list()의 payload에는 parentAgentId가 없어 데몬이 복제해 두는 라벨에서 읽는다.
 * 이 라벨은 문서화되지 않은 내부 규약이라 데몬 버전에 따라 사라질 수 있다. 훅의 parentAgentId는 공식 필드다.
 */
export function parentFromLabels(labels: Readonly<Record<string, string>>): string | null {
  return nonEmpty(labels[PARENT_AGENT_LABEL]);
}

export function identityFromListed(agent: ListedAgentLike): AgentIdentity | null {
  const workspaceId = nonEmpty(agent.workspaceId);
  if (workspaceId === null) return null;
  return {
    id: agent.id,
    workspaceId,
    title: nonEmpty(agent.title),
    provider: agent.provider,
    parentAgentId: parentFromLabels(agent.labels),
  };
}

export function seedFromListed(agent: ListedAgentLike): AgentSeed {
  return {
    working: agent.status === "running",
    since: Date.parse(agent.updatedAt),
    permissionIds: agent.pendingPermissions.map((request) => request.id),
  };
}

export function workspaceProjectFromListed(workspace: ListedWorkspaceLike): WorkspaceProject {
  return {
    workspaceId: workspace.id,
    projectId: workspace.projectId,
    projectName: workspace.project?.projectName ?? workspace.name,
  };
}
