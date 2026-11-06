import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { AgentView, OfficeSnapshot } from "../shared/state/contract";

type OfficeViewComponent = ComponentType<{ snapshot: OfficeSnapshot; onAgentSelect?: (agentId: string) => void }>;

// scene이 client/scene/index.tsx를 만들기 전에도 typecheck와 번들이 깨지지 않도록 동적으로 불러온다.
// 파일이 없으면 null이 되어 개발용 텍스트 폴백을 쓴다.
let sceneLoad: Promise<OfficeViewComponent | null> | null = null;
function loadScene(): Promise<OfficeViewComponent | null> {
  sceneLoad ??= (
    // @ts-ignore client/scene은 scene 역할이 만든다. 없을 수 있다.
    import("./scene/index") as Promise<{ OfficeView?: OfficeViewComponent }>
  ).then(
    (module) => module.OfficeView ?? null,
    () => null,
  );
  return sceneLoad;
}

function agentLine(agent: AgentView): string {
  return `${agent.name} [${agent.provider}] ${agent.state}${agent.needsAttention ? " !" : ""}`;
}

function SnapshotText({ snapshot, theme, onAgentSelect }: { snapshot: OfficeSnapshot; theme: PluginTheme; onAgentSelect?: (agentId: string) => void }) {
  const text = { color: theme.colors.foreground };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.colors.foregroundMuted }}>
        Agent Office (scene 없음, 텍스트 폴백) · scope {snapshot.scope} · projects {snapshot.projects.length}
      </Text>
      {snapshot.projects.map((project) => (
        <View key={project.projectId} style={{ gap: 6 }}>
          <Text style={[text, { fontWeight: "600" }]}>{project.projectName}</Text>
          {project.offices.map((office) => (
            <View key={office.id} style={{ gap: 2, paddingLeft: 8 }}>
              <Text style={text}>
                {office.kind}
              </Text>
              {office.manager && <Text style={text} onPress={onAgentSelect ? () => onAgentSelect(office.manager!.id) : undefined}>{`  manager ${agentLine(office.manager)}`}</Text>}
              {office.members.map((member) => (
                <Text key={member.id} style={text} onPress={onAgentSelect ? () => onAgentSelect(member.id) : undefined}>
                  {"  "}
                  {agentLine(member)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/** scene의 OfficeView가 있으면 그것을, 없으면 개발용 텍스트 폴백을 그린다. */
export function SceneAdapter({ snapshot, theme, onAgentSelect }: { snapshot: OfficeSnapshot; theme: PluginTheme; onAgentSelect?: (agentId: string) => void }) {
  const [OfficeView, setOfficeView] = useState<OfficeViewComponent | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadScene().then((component) => {
      if (!cancelled && component) setOfficeView(() => component);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return OfficeView ? <OfficeView snapshot={snapshot} onAgentSelect={onAgentSelect} /> : <SnapshotText snapshot={snapshot} theme={theme} onAgentSelect={onAgentSelect} />;
}
