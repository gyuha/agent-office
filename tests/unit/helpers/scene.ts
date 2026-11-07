import { register } from 'node:module';
import type { OfficeSnapshot } from '../../../shared/state/contract.ts';

// client/scene/core는 번들러용 확장자 없는 상대 import를 쓰므로, 로드 전에 `.ts`를 보충하는 resolve 훅을 등록한다.
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) {
  if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(specifier + '.ts', context); } catch { return next(specifier + '/index.ts', context); }
  }
  return next(specifier, context);
}`));

export const { draw, sheetFrame, providerColor } = await import('../../../client/scene/core/draw.ts');
export const { layoutOffices } = await import('../../../client/scene/core/layout.ts');
export const { step } = await import('../../../client/scene/core/actors.ts');
export const { manifest, assetData } = await import('../../../client/scene/core/office-assets.ts');
export const { agentAtPoint, scenePoint } = await import('../../../client/scene/core/hitTest.ts');

export type State = 'working' | 'away' | 'phone' | 'sleeping';
const STATES: State[] = ['working', 'away', 'phone', 'sleeping'];

export interface AgentOpts { state?: State; stateSince?: number; needsAttention?: boolean; provider?: string }

export function agent(id: string, name: string, opts: AgentOpts = {}) {
  return { id, name, provider: opts.provider ?? 'claude', state: opts.state ?? 'working',
    stateSince: opts.stateSince ?? 0, needsAttention: opts.needsAttention ?? false };
}

/** 관리자 1명 + 구성원 `members`명(v10의 N = 구성원 수). 관리자는 별도 인원이다. */
export function group(members: number, id = 'g', opts: AgentOpts = {}) {
  return { id, kind: 'group' as const, manager: agent(`${id}-lead`, 'Orchestrator', opts),
    members: Array.from({ length: members }, (_, i) => agent(`${id}${i}`, `Agent ${i}`, opts)) };
}

export function solo(id = 's', opts: AgentOpts = {}) {
  return { id, kind: 'solo' as const, manager: null, members: [agent(id, 'Solo Agent', opts)] };
}

export const mixed = (members: number, id = 'm') => {
  const o = group(members, id);
  o.members.forEach((m, i) => { (m as { state: State }).state = STATES[i % 4]; });
  return o;
};

export function snap(offices: unknown[], extra: Partial<OfficeSnapshot> = {}): OfficeSnapshot {
  return { scope: 'project', generatedAt: 0, projects: [{ projectId: 'p', projectName: 'P', offices }], ...extra } as unknown as OfficeSnapshot;
}

export function snapAll(projects: { name: string; offices: unknown[] }[]): OfficeSnapshot {
  return { scope: 'all', generatedAt: 0, projects: projects.map((p, i) => ({ projectId: `p${i}`, projectName: p.name, offices: p.offices })) } as unknown as OfficeSnapshot;
}

/** 스냅샷 안의 모든 에이전트 상태를 바꾼 사본(2초 폴링처럼 새 객체로 만든다). */
export function withState(snapshot: OfficeSnapshot, state: State, patch: Partial<{ stateSince: number; needsAttention: boolean }> = {}): OfficeSnapshot {
  const copy = JSON.parse(JSON.stringify(snapshot));
  for (const p of copy.projects) for (const o of p.offices) for (const a of [o.manager, ...o.members]) if (a) Object.assign(a, { state }, patch);
  return copy;
}

/** 시간을 `ms`만큼 100ms 단위로 진행한다(렌더러와 같은 dt 상한). */
export function advance(actors: any, snapshot: OfficeSnapshot, ms: number, layout = layoutOffices(snapshot)) {
  let a = actors;
  for (let t = 0; t < ms; t += 100) a = step(a, snapshot, Math.min(100, ms - t), layout);
  return a;
}

export interface Drawn { key: string; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number; alpha: number; order: number }
export interface DrawnText { text: string; x: number; y: number; order: number; font: string }
export interface DrawnArc { x: number; y: number; r: number; fill: string; order: number }

/** 매니페스트 메타데이터만으로 만든 가짜 이미지. 시트 길이는 frames·frameW에서 계산된다. */
export function fakeSprites(overrides: Record<string, any> = {}, omit: string[] = []) {
  const sprites: Record<string, { image: any; spec: any }> = {};
  for (const [key, spec] of Object.entries<any>({ ...assetData, ...overrides })) {
    if (omit.includes(key)) continue;
    const frames = Array.isArray(spec.frames) ? spec.frames.length : spec.frames || 1;
    const width = spec.frameW ? spec.frameW * frames : spec.size?.[0] ?? 1;
    const height = spec.frameH ?? spec.size?.[1] ?? 1;
    sprites[key] = { image: { key, width, height }, spec };
  }
  return sprites;
}

/**
 * draw를 실제 매니페스트로 실행하고 drawImage·fillText·arc 호출을 그리는 순서(order)와 함께 기록한다.
 * 명판은 canvas로 그려지므로 fillText(이름)와 arc(provider 폴백 원)로 식별한다. `epoch`로 flame 판정 시각을 고정한다.
 */
export function trace(snapshot: OfficeSnapshot, opts: { actors?: any; timeMs?: number; epoch?: number; sprites?: any; width?: number } = {}) {
  const layout = layoutOffices(snapshot, opts.width ?? 1536);
  const actors = opts.actors ?? step({}, snapshot, 0, layout);
  const images: Drawn[] = [], texts: DrawnText[] = [], arcs: DrawnArc[] = [];
  const stack: number[] = [];
  let order = 0;
  const ctx: any = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, textAlign: '', textBaseline: '', globalAlpha: 1, imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
    save() { stack.push(ctx.globalAlpha); }, restore() { ctx.globalAlpha = stack.pop() ?? 1; },
    beginPath() {}, rect() {}, clip() {}, fillRect() {}, fill() {}, stroke() {},
    measureText: (text: string) => ({ width: Array.from(text).length * 10 }),
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y, order: order++, font: ctx.font }); },
    arc(x: number, y: number, r: number) { arcs.push({ x, y, r, fill: ctx.fillStyle, order: order++ }); },
    drawImage(image: { key: string }, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
      images.push({ key: image.key, sx, sy, sw, sh, dx, dy, dw, dh, alpha: ctx.globalAlpha, order: order++ });
    } };
  draw(ctx, layout, actors, opts.timeMs ?? 0, opts.sprites ?? fakeSprites(), opts.epoch ?? 0);
  return { layout, actors, images, texts, arcs };
}

export const actorImages = (images: Drawn[]) => images.filter(i => /^(actor-\d|orchestrator)-/.test(i.key));
