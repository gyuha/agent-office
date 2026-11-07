import React, { useEffect, useRef, type JSX } from "react";

import { Platform, ScrollView, Text, View } from 'react-native';
import type { OfficeSnapshot } from '../../shared/state/contract';
import { mountOfficeScene } from './mount-scene';

function WebOffice({ snapshot, onAgentSelect }: { snapshot: OfficeSnapshot; onAgentSelect?: (agentId: string) => void }): JSX.Element {
  const holder = useRef<any>(null);
  const current = useRef(snapshot); current.current = snapshot;
  const select = useRef(onAgentSelect); select.current = onAgentSelect;
  useEffect(() => {
    if (!holder.current) return;
    const scene = mountOfficeScene(holder.current, () => current.current, id => select.current?.(id));
    return () => scene.dispose();
  }, []);
  return React.createElement('div' as any, { ref: holder, style: { width: '100%', height: '100%', minHeight: 0, minWidth: 0, flex: '1 1 0%', overflowY: 'auto', overflowX: 'hidden', background: '#f2e6d1' } });
}

export function OfficeView({ snapshot, onAgentSelect }: { snapshot: OfficeSnapshot; onAgentSelect?: (agentId: string) => void }): JSX.Element {
  if (Platform.OS === 'web') return <WebOffice snapshot={snapshot} onAgentSelect={onAgentSelect} />;
  return <ScrollView><View style={{ padding: 16, gap: 12 }}>{snapshot.projects.map(project => <View key={project.projectId} style={{ gap: 6 }}>
    <Text>{project.projectName}</Text>{project.offices.map(office => <View key={office.id} style={{ paddingLeft: 10 }}><Text>{office.kind}</Text>{[...(office.manager ? [office.manager] : []), ...office.members].map(agent => <Text key={agent.id} onPress={onAgentSelect ? () => onAgentSelect(agent.id) : undefined}>{agent.name} · {agent.state}{agent.needsAttention ? ' · ?' : ''}</Text>)}</View>)}
  </View>)}</View></ScrollView>;
}
