import type { AgentState, AgentView, Office, OfficeSnapshot, ProjectOffices, SubagentView } from "./contract.ts";
import { FALLBACK_NAME_ID_LENGTH, IDLE_POSES, SLEEP_AFTER_MS } from "./constants.ts";

/** 에이전트의 정체. 상태와 무관하고, 서버가 hook이나 목록에서 얻는다. */
export interface AgentIdentity {
  id: string;
  workspaceId: string;
  title: string | null;
  provider: string;
  parentAgentId: string | null;
}

/** 처음 등록되는 에이전트의 시작 상태. 이미 등록된 에이전트에는 적용하지 않는다. */
export interface AgentSeed {
  working: boolean;
  /** working 또는 idle이 시작된 시각(ms). */
  since: number;
  permissionIds?: readonly string[];
}

/** 워크스페이스가 속한 프로젝트. 서버가 워크스페이스 목록에서 얻는다. */
export interface WorkspaceProject {
  workspaceId: string;
  projectId: string;
  projectName: string;
  /** 워크스페이스 제목. */
  workspaceName: string;
}

/** provider 서브에이전트 하나의 최신 상태. 서버가 agent.provider_subagents.update나 타임라인에서 얻는다. */
export interface SubagentInput {
  id: string;
  /** 서브에이전트를 띄운 Paseo 에이전트 id. */
  parentAgentId: string;
  /** 중첩이면 바로 위 서브에이전트 id. */
  parentSubagentId: string | null;
  provider: string;
  title: string | null;
  description: string | null;
  status: "running" | "completed" | "failed" | "canceled";
  /** 시작 시각(ms). */
  since: number;
}

export interface OfficeStoreOptions {
  /** 현재 시각(ms). 테스트에서 주입한다. 타이머는 쓰지 않고 snapshot 시점에 계산한다. */
  now: () => number;
  sleepAfterMs?: number;
}

interface AgentRecord extends AgentIdentity {
  order: number;
  working: boolean;
  /** working이면 turn 시작 시각, 아니면 idle 시작 시각. */
  since: number;
  permissionIds: Set<string>;
  /** 대기 중인 권한 요청이 처음 생긴 시각. 대기 중일 때 working의 stateSince로 쓴다. */
  permissionSince: number;
}

interface SubagentRecord extends Omit<SubagentInput, "status"> {
  order: number;
}

function subagentKey(parentAgentId: string, id: string): string {
  return `${parentAgentId}:${id}`;
}

/** FNV-1a. 같은 id는 항상 같은 값을 낸다. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function idlePoseFor(id: string): (typeof IDLE_POSES)[number] {
  return IDLE_POSES[hashId(id) % IDLE_POSES.length];
}

export function createOfficeStore(options: OfficeStoreOptions) {
  const { now } = options;
  const sleepAfterMs = options.sleepAfterMs ?? SLEEP_AFTER_MS;
  const agents = new Map<string, AgentRecord>();
  const subagents = new Map<string, SubagentRecord>();
  let nextOrder = 0;
  let workspaceProjects = new Map<string, WorkspaceProject>();

  function toView(record: AgentRecord, at: number): AgentView {
    let state: AgentState;
    let stateSince = record.since;
    if (record.working) {
      state = "working";
    } else if (record.permissionIds.size > 0) {
      // 권한 대기 중에는 turn 여부와 상관없이 working으로 본다. 모두 풀리면 idle 시계가 그 시점부터 다시 시작한다.
      state = "working";
      stateSince = record.permissionSince;
    } else if (at - record.since >= sleepAfterMs) {
      state = "sleeping";
      stateSince = record.since + sleepAfterMs;
    } else {
      state = idlePoseFor(record.id);
    }
    return {
      id: record.id,
      name: record.title ?? `agent ${record.id.slice(0, FALLBACK_NAME_ID_LENGTH)}`,
      provider: record.provider,
      state,
      stateSince,
      needsAttention: record.permissionIds.size > 0,
    };
  }

  /** 같은 프로젝트 안에서 부모를 따라 올라간 최상위 에이전트. 부모 사슬이 순환이면 자기 자신을 루트로 본다. */
  function rootOf(record: AgentRecord, inWorkspace: Map<string, AgentRecord>): AgentRecord {
    const seen = new Set<string>([record.id]);
    let current = record;
    while (current.parentAgentId !== null) {
      const parent = inWorkspace.get(current.parentAgentId);
      if (!parent) break;
      if (seen.has(parent.id)) return record;
      seen.add(parent.id);
      current = parent;
    }
    return current;
  }

  /** 서브에이전트가 붙을 맨 위 Paseo 에이전트 id. parentAgentId가 Paseo 에이전트면 그것, 아니면 부모 서브에이전트를 따라 올라간다. 모르는 부모나 순환이면 null. */
  function topAgentOf(record: SubagentRecord): string | null {
    const seen = new Set<SubagentRecord>();
    let current: SubagentRecord | undefined = record;
    while (current && !seen.has(current)) {
      if (agents.has(current.parentAgentId)) return current.parentAgentId;
      seen.add(current);
      const upId: string = current.parentSubagentId ?? current.parentAgentId;
      const parentAgentId: string = current.parentAgentId;
      current = subagents.get(subagentKey(parentAgentId, upId)) ?? [...subagents.values()].find((other) => other.id === upId);
    }
    return null;
  }

  function toSubagentView(record: SubagentRecord, parentAgentId: string): SubagentView {
    return {
      id: record.id,
      parentAgentId,
      name: record.description ?? record.title ?? `subagent ${record.id.slice(0, FALLBACK_NAME_ID_LENGTH)}`,
      provider: record.provider,
      since: record.since,
    };
  }

  function buildOffices(members: AgentRecord[], at: number): Office[] {
    const inProject = new Map(members.map((record) => [record.id, record]));
    const groups = new Map<string, AgentRecord[]>();
    for (const record of [...members].sort((a, b) => a.order - b.order)) {
      const root = rootOf(record, inProject);
      const children = groups.get(root.id) ?? [];
      if (root.id !== record.id) children.push(record);
      groups.set(root.id, children);
    }
    const officeOf = new Map<string, string>();
    for (const [rootId, children] of groups) {
      officeOf.set(rootId, rootId);
      for (const child of children) officeOf.set(child.id, rootId);
    }
    const subagentsByOffice = new Map<string, SubagentView[]>();
    for (const record of [...subagents.values()].sort((a, b) => a.since - b.since || a.order - b.order)) {
      const parentId = topAgentOf(record);
      const rootId = parentId === null ? undefined : officeOf.get(parentId);
      if (parentId === null || rootId === undefined) continue;
      const list = subagentsByOffice.get(rootId) ?? [];
      list.push(toSubagentView(record, parentId));
      subagentsByOffice.set(rootId, list);
    }
    const offices: Office[] = [];
    for (const [rootId, children] of groups) {
      const extra = subagentsByOffice.get(rootId) ?? [];
      const root = inProject.get(rootId) as AgentRecord;
      offices.push(
        children.length > 0
          ? {
              id: rootId,
              kind: "group",
              manager: toView(root, at),
              members: children.map((child) => toView(child, at)),
              subagents: extra,
            }
          : { id: rootId, kind: "solo", manager: null, members: [toView(root, at)], subagents: extra },
      );
    }
    return offices;
  }

  function removeSubagentsOf(agentId: string): void {
    for (const [key, record] of subagents) {
      if (record.parentAgentId === agentId) subagents.delete(key);
    }
  }

  return {
    has(id: string): boolean {
      return agents.has(id);
    },

    /** 등록된 에이전트의 id와 provider. 서버가 시작 시 서브에이전트를 복원할 대상을 고를 때 쓴다. */
    agentRefs(): Array<{ id: string; provider: string }> {
      return [...agents.values()].map(({ id, provider }) => ({ id, provider }));
    },

    /** 정체를 등록하거나 갱신한다. 상태는 새로 등록될 때만 seed로 정한다(기본은 지금부터 idle). */
    upsert(identity: AgentIdentity, seed?: AgentSeed): void {
      const existing = agents.get(identity.id);
      if (existing) {
        existing.workspaceId = identity.workspaceId;
        existing.title = identity.title ?? existing.title;
        existing.provider = identity.provider;
        existing.parentAgentId = identity.parentAgentId ?? existing.parentAgentId;
        return;
      }
      agents.set(identity.id, {
        ...identity,
        order: nextOrder++,
        working: seed?.working ?? false,
        since: seed?.since ?? now(),
        permissionIds: new Set(seed?.permissionIds ?? []),
        permissionSince: seed?.since ?? now(),
      });
    },

    turnStarted(id: string): void {
      const record = agents.get(id);
      if (!record || record.working) return;
      record.working = true;
      record.since = now();
    },

    turnEnded(id: string): void {
      const record = agents.get(id);
      if (!record || !record.working) return;
      record.working = false;
      record.since = now();
    },

    permissionRequested(id: string, requestId: string): void {
      const record = agents.get(id);
      if (!record) return;
      if (record.permissionIds.size === 0) record.permissionSince = now();
      record.permissionIds.add(requestId);
    },

    permissionResolved(id: string, requestId: string): void {
      const record = agents.get(id);
      if (!record?.permissionIds.delete(requestId)) return;
      if (record.permissionIds.size === 0 && !record.working) record.since = now();
    },

    /**
     * 서브에이전트의 최신 상태를 반영한다. running만 유지한다: 새 running은 추가(시작 시각은 처음 값 유지),
     * 이미 있는 항목의 running은 이름·provider 갱신, running이 아닌 상태는 제거(처음부터 running이 아니면 추가하지 않음).
     * 부모를 아직 모르는 서브에이전트도 보관하고, 부모가 알려지면 스냅샷에 나타난다.
     */
    subagentUpsert(input: SubagentInput): void {
      const key = subagentKey(input.parentAgentId, input.id);
      if (input.status !== "running") {
        subagents.delete(key);
        return;
      }
      const existing = subagents.get(key);
      subagents.set(key, { ...input, since: existing?.since ?? input.since, order: existing?.order ?? nextOrder++ });
    },

    subagentRemove(parentAgentId: string, id: string): void {
      subagents.delete(subagentKey(parentAgentId, id));
    },

    /** closed/archived. 이 에이전트가 띄운 서브에이전트도 함께 지운다. */
    remove(id: string): void {
      agents.delete(id);
      removeSubagentsOf(id);
    },

    removeWorkspace(workspaceId: string): void {
      for (const [id, record] of agents) {
        if (record.workspaceId === workspaceId) {
          agents.delete(id);
          removeSubagentsOf(id);
        }
      }
    },

    /** 워크스페이스→프로젝트 매핑을 통째로 바꾼다. */
    setWorkspaces(entries: readonly WorkspaceProject[]): void {
      workspaceProjects = new Map(entries.map((entry) => [entry.workspaceId, entry]));
    },

    /** 매핑에 없는 워크스페이스의 에이전트가 있으면 true. 서버가 목록을 다시 가져올 신호로 쓴다. */
    hasUnmappedWorkspace(): boolean {
      for (const record of agents.values()) {
        if (!workspaceProjects.has(record.workspaceId)) return true;
      }
      return false;
    },

    /** projectId가 있으면 그 프로젝트만(scope "project"), 없으면 에이전트가 있는 모든 프로젝트(scope "all"). workspaceId는 scope "project"일 때 workspaceName을 채우는 데만 쓴다. */
    snapshot(projectId?: string, workspaceId?: string): OfficeSnapshot {
      const at = now();
      const byProject = new Map<string, AgentRecord[]>();
      for (const record of agents.values()) {
        const project = workspaceProjects.get(record.workspaceId);
        if (!project) continue;
        const list = byProject.get(project.projectId) ?? [];
        list.push(record);
        byProject.set(project.projectId, list);
      }
      const names = new Map<string, string>();
      for (const project of workspaceProjects.values()) names.set(project.projectId, project.projectName);

      const projectIds = projectId === undefined ? [...byProject.keys()] : names.has(projectId) ? [projectId] : [];
      const projects: ProjectOffices[] = projectIds
        .map((id) => ({ projectId: id, projectName: names.get(id) ?? id, offices: buildOffices(byProject.get(id) ?? [], at) }))
        .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.projectId.localeCompare(b.projectId));
      const scope = projectId === undefined ? "all" : "project";
      const workspaceName = scope === "project" && workspaceId !== undefined ? (workspaceProjects.get(workspaceId)?.workspaceName ?? null) : null;
      return { scope, projects, generatedAt: at, workspaceName };
    },
  };
}

export type OfficeStore = ReturnType<typeof createOfficeStore>;
