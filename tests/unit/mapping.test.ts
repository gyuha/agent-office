import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PARENT_AGENT_LABEL } from "../../shared/state/constants.ts";
import {
  identityFromHook,
  parentFromLabels,
  identityFromListed,
  seedFromListed,
  workspaceProjectFromListed,
  type HookAgentLike,
  type ListedAgentLike,
  type ListedWorkspaceLike,
} from "../../server/mapping.ts";

describe("server/mapping.ts — 순수 함수 단위 테스트", () => {
  describe("identityFromHook", () => {
    it("workspaceId가 있는 에이전트를 AgentIdentity로 매핑하며 알 수 없는 provider도 그대로 보존한다", () => {
      const hookAgent: HookAgentLike = {
        id: "ag_1",
        workspaceId: "wks_1",
        parentAgentId: "ag_root",
        provider: "custom-unknown-provider",
        title: "Worker 1",
      };
      assert.deepEqual(identityFromHook(hookAgent), {
        id: "ag_1",
        workspaceId: "wks_1",
        title: "Worker 1",
        provider: "custom-unknown-provider",
        parentAgentId: "ag_root",
      });
    });

    it("workspaceId가 null 또는 빈 문자열('')이면 오피스에 배치할 수 없으므로 null을 반환한다", () => {
      const hookAgentNull: HookAgentLike = {
        id: "ag_no_ws",
        workspaceId: null,
        parentAgentId: null,
        provider: "claude",
        title: null,
      };
      assert.equal(identityFromHook(hookAgentNull), null);

      const hookAgentEmpty: HookAgentLike = {
        ...hookAgentNull,
        workspaceId: "",
      };
      assert.equal(identityFromHook(hookAgentEmpty), null);
    });
  });

  describe("parentFromLabels", () => {
    it("PARENT_AGENT_LABEL 키가 있으면 그 값을 반환하고, 라벨이 누락되었으면 null을 반환한다", () => {
      assert.equal(parentFromLabels({ [PARENT_AGENT_LABEL]: "parent_123" }), "parent_123");
      assert.equal(parentFromLabels({ other: "val" }), null);
      assert.equal(parentFromLabels({}), null);
    });

    it("라벨 값이 빈 문자열('')인 경우 null을 반환한다", () => {
      assert.equal(parentFromLabels({ [PARENT_AGENT_LABEL]: "" }), null);
    });
  });

  describe("identityFromListed", () => {
    const baseListed: ListedAgentLike = {
      id: "ag_listed",
      workspaceId: "wks_1",
      provider: "mystery-llm",
      title: null,
      status: "idle",
      updatedAt: "2026-11-06T00:00:00.000Z",
      labels: { [PARENT_AGENT_LABEL]: "boss_id" },
      pendingPermissions: [],
    };

    it("정상적인 목록 항목에서 라벨의 부모 ID와 알 수 없는 provider를 포함해 AgentIdentity를 생성한다", () => {
      assert.deepEqual(identityFromListed(baseListed), {
        id: "ag_listed",
        workspaceId: "wks_1",
        title: null,
        provider: "mystery-llm",
        parentAgentId: "boss_id",
      });
    });

    it("라벨이 누락된 목록 항목은 parentAgentId가 null이 된다", () => {
      const noLabel = { ...baseListed, labels: {} };
      assert.equal(identityFromListed(noLabel)?.parentAgentId, null);
    });

    it("workspaceId가 undefined이거나 빈 문자열('')이면 null을 반환한다", () => {
      assert.equal(identityFromListed({ ...baseListed, workspaceId: undefined }), null);
      assert.equal(identityFromListed({ ...baseListed, workspaceId: "" }), null);
    });
  });

  describe("seedFromListed", () => {
    it("status가 'running'일 때만 working=true이고 updatedAt과 pendingPermissions를 변환한다", () => {
      const iso = "2026-11-06T05:00:00.000Z";
      const runningAgent: ListedAgentLike = {
        id: "ag_run",
        workspaceId: "wks_1",
        provider: "codex",
        title: "Runner",
        status: "running",
        updatedAt: iso,
        labels: {},
        pendingPermissions: [{ id: "perm_1" }, { id: "perm_2" }],
      };
      assert.deepEqual(seedFromListed(runningAgent), {
        working: true,
        since: Date.parse(iso),
        permissionIds: ["perm_1", "perm_2"],
      });

      for (const status of ["initializing", "idle", "error", "unknown"]) {
        const seed = seedFromListed({ ...runningAgent, status, pendingPermissions: [] });
        assert.equal(seed.working, false);
        assert.deepEqual(seed.permissionIds, []);
      }
    });
  });

  describe("workspaceProjectFromListed", () => {
    it("project.projectName이 있으면 우선 사용하고, 없으면 workspace.name을 폴백으로 쓴다", () => {
      const withProject: ListedWorkspaceLike = {
        id: "wks_1",
        name: "ws-fallback-name",
        projectId: "prj_1",
        project: { projectName: "Actual Project" },
      };
      assert.deepEqual(workspaceProjectFromListed(withProject), {
        workspaceId: "wks_1",
        projectId: "prj_1",
        projectName: "Actual Project",
      });

      const withoutProject: ListedWorkspaceLike = {
        id: "wks_2",
        name: "ws-fallback-name",
        projectId: "prj_2",
        project: undefined,
      };
      assert.deepEqual(workspaceProjectFromListed(withoutProject), {
        workspaceId: "wks_2",
        projectId: "prj_2",
        projectName: "ws-fallback-name",
      });
    });
  });
});
