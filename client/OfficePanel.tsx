import type { PluginScreenProps, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useWorkspace } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import { Text, View } from "react-native";
import { SceneAdapter } from "./SceneAdapter";
import { useOfficeSnapshot } from "./useOfficeSnapshot";

function Loading({ theme }: { theme: PluginTheme }) {
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.surface0 }}>
      <Text style={{ color: theme.colors.foregroundMuted }}>Loading office…</Text>
    </View>
  );
}

function OfficeScope({ projectId, workspaceId, theme, onAgentSelect }: { projectId?: string; workspaceId?: string; theme: PluginTheme; onAgentSelect?: (agentId: string) => void }) {
  const snapshot = useOfficeSnapshot(projectId, workspaceId);
  return snapshot ? <SceneAdapter snapshot={snapshot} theme={theme} onAgentSelect={onAgentSelect} /> : <Loading theme={theme} />;
}

/** 워크스페이스 패널: 현재 프로젝트의 오피스들. */
export function OfficePanel({ workspaceId, theme, navigation }: PluginWorkspacePanelProps) {
  const projectId = useWorkspace(workspaceId, (workspace) => workspace.projectId);
  return projectId ? <OfficeScope projectId={projectId} workspaceId={workspaceId} theme={theme} onAgentSelect={navigation ? (agentId) => navigation.openAgent({ agentId }) : undefined} /> : <Loading theme={theme} />;
}

/** 사이드바 화면: 모든 프로젝트. */
export function AllOfficesScreen({ theme, navigation }: PluginScreenProps) {
  return <OfficeScope theme={theme} onAgentSelect={navigation ? (agentId) => navigation.openAgent({ agentId }) : undefined} />;
}
