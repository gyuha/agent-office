import React, { useEffect, useRef, type JSX } from "react";

import { Platform, ScrollView, Text, View } from 'react-native';
import type { OfficeSnapshot } from '../../shared/state/contract';
import { mountOfficeScene } from './mount-scene';
import { parseOfficeFilter } from './core/officeFilter';

function WebOffice({ snapshot, onAgentSelect, filter }: { snapshot: OfficeSnapshot; onAgentSelect?: (agentId: string) => void; filter?: string }): JSX.Element {
  const holder = useRef<any>(null);
  const current = useRef(snapshot); current.current = snapshot;
  const select = useRef(onAgentSelect); select.current = onAgentSelect;
  const initialFilter = useRef(filter);
  const scene = useRef<ReturnType<typeof mountOfficeScene> | null>(null);
  useEffect(() => {
    if (!holder.current) return;
    scene.current = mountOfficeScene(holder.current, () => current.current, id => select.current?.(id), { initialFilter: initialFilter.current });
    return () => { scene.current?.dispose(); scene.current = null; };
  }, []);
  // 사용자가 필터 바에서 고른 값은 건드리지 않고, 전달받은 filter 값이 바뀔 때만 적용한다.
  useEffect(() => { scene.current?.setFilter(parseOfficeFilter(filter)); }, [filter]);
  return React.createElement('div' as any, { ref: holder, style: { width: '100%', height: '100%', minHeight: 0, minWidth: 0, flex: '1 1 0%', overflowY: 'auto', overflowX: 'hidden', background: '#f2e6d1' } });
}

export function OfficeView({ snapshot, onAgentSelect, filter }: { snapshot: OfficeSnapshot; onAgentSelect?: (agentId: string) => void; filter?: string }): JSX.Element {
  if (Platform.OS === 'web') return <WebOffice snapshot={snapshot} onAgentSelect={onAgentSelect} filter={filter} />;
  return <ScrollView><View style={{ padding: 16, gap: 12 }}>{snapshot.projects.map(project => <View key={project.projectId} style={{ gap: 6 }}>
    <Text>{project.projectName}</Text>{project.offices.map(office => <View key={office.id} style={{ paddingLeft: 10 }}><Text>{office.kind}</Text>{[...(office.manager ? [office.manager] : []), ...office.members].map(agent => <Text key={agent.id} onPress={onAgentSelect ? () => onAgentSelect(agent.id) : undefined}>{agent.name} · {agent.state}{agent.needsAttention ? ' · ?' : ''}</Text>)}</View>)}
  </View>)}</View></ScrollView>;
}
