import { PARENT_AGENT_LABEL } from "../shared/state/constants.ts";
import type { AgentIdentity, AgentSeed, SubagentInput, WorkspaceProject } from "../shared/state/machine.ts";

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
    workspaceName: workspace.name,
  };
}

const SUBAGENT_STATUSES = ["running", "completed", "failed", "canceled"] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function startedAt(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type SubagentUpdate =
  | { kind: "upsert"; input: SubagentInput }
  | { kind: "remove"; parentAgentId: string; id: string };

/**
 * `agent.provider_subagents.update` 이벤트의 payload를 스토어 입력으로 바꾼다.
 * kind "upsert"만 상태를 담고, "remove"는 제거, "timeline"은 진행 로그라 상태 판단에 쓰지 않는다(null).
 */
export function subagentUpdateFromPayload(payload: unknown, now: number): SubagentUpdate | null {
  const value = record(payload);
  if (value?.kind === "remove") {
    const parentAgentId = text(value.parentAgentId);
    const id = text(value.subagentId);
    return parentAgentId && id ? { kind: "remove", parentAgentId, id } : null;
  }
  if (value?.kind !== "upsert") return null;
  const agent = record(value.subagent);
  const id = text(agent?.id);
  const parentAgentId = text(agent?.parentAgentId);
  const status = SUBAGENT_STATUSES.find((candidate) => candidate === agent?.status);
  if (!agent || !id || !parentAgentId || !status) return null;
  return {
    kind: "upsert",
    input: {
      id,
      parentAgentId,
      parentSubagentId: text(agent.parentSubagentId),
      provider: text(agent.provider) ?? "unknown",
      title: text(agent.title),
      description: text(agent.description),
      status,
      since: startedAt(agent.createdAt, now),
    },
  };
}

/**
 * 부모 에이전트의 타임라인 항목에서 running인 sub_agent 도구 호출을 복원한다(플러그인이 켜지기 전부터 돌던 서브에이전트).
 * 타임라인에는 중첩 정보와 provider가 없어 부모의 provider를 쓰고 중첩은 부모 직속으로 본다. 대시보드의 fallback과 같은 규칙이다.
 */
export function runningSubagentsFromTimeline(
  parent: { id: string; provider: string },
  entries: readonly unknown[],
  now: number,
): SubagentInput[] {
  return entries.flatMap((entry) => {
    const row = record(entry);
    const item = record(row?.item);
    const detail = record(item?.detail);
    const callId = text(item?.callId);
    if (item?.type !== "tool_call" || detail?.type !== "sub_agent" || item.status !== "running" || !callId) return [];
    return [
      {
        id: callId,
        parentAgentId: parent.id,
        parentSubagentId: null,
        provider: parent.provider,
        title: text(detail.subAgentType),
        description: text(detail.description),
        status: "running" as const,
        since: startedAt(row?.timestamp, now),
      },
    ];
  });
}
