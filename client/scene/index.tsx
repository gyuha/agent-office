import React, { useEffect, useRef, type JSX } from "react";

import { Platform, ScrollView, Text, View } from 'react-native';
import type { OfficeSnapshot } from '../../shared/state/contract';
import { draw, layoutOffices, step, type Actors, type Sprites } from './core';
import { spriteData } from './generated/sprites';
import { fitSceneWidth } from './core/viewport';

declare const document: any;
declare const window: any;
declare const Image: any;
declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(id: number): void;

function WebOffice({ snapshot }: { snapshot: OfficeSnapshot }): JSX.Element {
  const holder = useRef<any>(null);
  const current = useRef(snapshot); current.current = snapshot;
  useEffect(() => {
    const parent = holder.current; if (!parent) return;
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block'; canvas.style.imageRendering = 'pixelated'; canvas.style.maxWidth = '100%'; parent.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const sprites: Sprites = {};
    for (const [key, data] of Object.entries(spriteData)) {
      const image = new Image(); image.onload = () => { sprites[key] = { image, metadata: data.metadata }; }; image.src = data.uri;
    }
    let actors: Actors = {}, last = 0, frame = 0, active = true;
    const tick = (time: number) => {
      if (!active) return;
      const panelWidth = parent.clientWidth || 700;
      const scale = panelWidth < 500 ? 1 : 2;
      const layout = layoutOffices(current.current, Math.max(192, Math.floor(panelWidth / scale)));
      const w = layout.width * scale, h = layout.height * scale;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const fitted = fitSceneWidth(w, h, panelWidth);
      canvas.style.width = `${fitted.width}px`; canvas.style.height = `${fitted.height}px`;
      actors = step(actors, current.current, last ? Math.min(100, time - last) : 0, layout); last = time;
      ctx.setTransform(scale, 0, 0, scale, 0, 0); draw(ctx, layout, actors, time, sprites);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); parent.removeChild(canvas); };
  }, []);
  return React.createElement('div' as any, { ref: holder, style: { width: '100%', height: '100%', overflow: 'auto', background: '#172130' } });
}

export function OfficeView({ snapshot }: { snapshot: OfficeSnapshot }): JSX.Element {
  if (Platform.OS === 'web') return <WebOffice snapshot={snapshot} />;
  return <ScrollView><View style={{ padding: 16, gap: 12 }}>{snapshot.projects.map(project => <View key={project.projectId} style={{ gap: 6 }}>
    <Text>{project.projectName}</Text>{project.offices.map(office => <View key={office.id} style={{ paddingLeft: 10 }}><Text>{office.kind}</Text>{[...(office.manager ? [office.manager] : []), ...office.members].map(agent => <Text key={agent.id}>{agent.name} · {agent.state}{agent.needsAttention ? ' · ?' : ''}</Text>)}</View>)}
  </View>)}</View></ScrollView>;
}
