import { register } from 'node:module';
import type { OfficeSnapshot } from '../../../shared/state/contract.ts';

// client/scene/core는 번들러용 확장자 없는 상대 import를 쓰므로, 로드 전에 `.ts`를 보충하는 resolve 훅을 등록한다.
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) {
  if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]s$/.test(specifier)) specifier += '.ts';
  return next(specifier, context);
}`));

export const { draw } = await import('../../../client/scene/core/draw.ts');
export const { layoutOffices } = await import('../../../client/scene/core/layout.ts');
export const { step } = await import('../../../client/scene/core/actors.ts');

const STATES = ['working', 'away', 'phone', 'sleeping'] as const;

/** 매니저 1명 + (count-1)명 구성의 오피스. count가 1이면 solo. */
export function office(count: number, id = 'o', state?: (typeof STATES)[number]) {
  const list = Array.from({ length: count }, (_, i) => ({
    id: `${id}${i}`, name: i === 0 ? 'Orchestrator' : `Agent ${i}`,
    provider: ['claude', 'codex', 'gemini', 'unknown'][i % 4],
    state: state ?? STATES[i % 4], stateSince: 0, needsAttention: i === 2,
  }));
  return { id, kind: count > 1 ? 'group' : 'solo', manager: count > 1 ? list.shift()! : null, members: list };
}

export function project(offices: ReturnType<typeof office>[], scope: 'project' | 'all' = 'project'): OfficeSnapshot {
  return { scope, generatedAt: 0, projects: [{ projectId: 'p', projectName: 'P', offices }] } as unknown as OfficeSnapshot;
}

const { clayData } = await import('../../../client/scene/generated/clay.ts');

export interface Box { x: number; y: number; width: number; height: number }
export interface Traced { key: string; box: Box }

/** 실제 자산 메타데이터로 draw를 실행하고, 변환(translate/scale/rotate)이 반영된 그리기 사각형을 기록한다. */
export function trace(snapshot: OfficeSnapshot, state: Record<string, string> = {}, timeMs = 0) {
  const sprites = Object.fromEntries(Object.entries(clayData).map(([key, data]) =>
    [key, { image: { key }, metadata: data.metadata }]));
  const layout = layoutOffices(snapshot, 800);
  const actors = step({}, snapshot, 0, layout);
  const images: Traced[] = [];
  const labels: Box[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const mul = (n: number[]) => { m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; };
  const ctx: any = { fillStyle: '', strokeStyle: '', font: '', textAlign: 'left', globalAlpha: 1, imageSmoothingEnabled: true,
    save: () => stack.push(m), restore: () => { m = stack.pop()!; },
    translate: (x: number, y: number) => mul([1, 0, 0, 1, x, y]),
    scale: (x: number, y: number) => mul([x, 0, 0, y, 0, 0]),
    rotate: (a: number) => mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]),
    fillText() {},
    fillRect(x: number, y: number, width: number, height: number) {
      if (ctx.fillStyle === '#fffefa') labels.push({ x, y, width, height });
    },
    drawImage(image: { key: string }, x: number, y: number, w: number, h: number) {
      const xs = [x, x + w].flatMap(px => [y, y + h].map(py => m[0] * px + m[2] * py + m[4]));
      const ys = [x, x + w].flatMap(px => [y, y + h].map(py => m[1] * px + m[3] * py + m[5]));
      images.push({ key: image.key, box: { x: Math.min(...xs), y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } });
    } };
  draw(ctx, layout, actors, timeMs, sprites);
  return { layout, actors, images, labels };
}

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
