import test from 'node:test';
import assert from 'node:assert/strict';
import { draw, layoutOffices } from './helpers/scene.ts';
import type { OfficeSnapshot } from '../../shared/state/contract.ts';

const PROVIDER_ASSETS = ['claude', 'codex', 'antigravity', 'copilot', 'muse', 'opencode', 'unknown'];

// 모니터·아이콘 자산만 등록하고 drawImage에 넘어온 image의 key를 기록한다.
const entry = (key: string) => [key, { image: { key }, metadata: { viewBox: [0, 0, 10, 10], size: [10, 10], pivot: [0, 0] } }];
const sprites = Object.fromEntries([
  ...PROVIDER_ASSETS.flatMap(name => [entry(`monitors/monitor-${name}`), entry(`icons/${name}`)]),
  entry('monitors/monitor-screen'),
]);

function drawnKeys(snapshot: OfficeSnapshot): string[] {
  const keys: string[] = [];
  const noop = () => {};
  const ctx = { drawImage: (image: { key: string }) => keys.push(image.key), fillRect: noop, fillText: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop };
  draw(ctx, layoutOffices(snapshot, 800), {}, 0, sprites);
  return keys.filter(key => key.startsWith('monitors/') || key.startsWith('icons/'));
}

const agent = (id: string, provider: string) => ({ id, name: id, provider, state: 'working', stateSince: 0, needsAttention: false });
const snapshot = (offices: unknown[]) => ({ scope: 'project', generatedAt: 0,
  projects: [{ projectId: 'p', projectName: 'P', offices }] }) as unknown as OfficeSnapshot;

// 매니저·창가가 아닌 섬 자리 중 앞 두 칸은 facing front(모니터 뒷면 아이콘),
// 뒤 두 칸은 facing back(모니터 화면 쪽 아이콘)이다.
const CASES: [string, string][] = [
  ['claude', 'claude'], ['codex', 'codex'], ['antigravity', 'antigravity'], ['gemini', 'antigravity'],
  ['copilot', 'copilot'], ['muse', 'muse'], ['opencode', 'opencode'],
  ['pi', 'unknown'], ['omp', 'unknown'], ['', 'unknown'], ['Claude', 'claude'], ['CODEX', 'codex'], ['Gemini', 'antigravity'],
  ['unrecognised', 'unknown'],
  // 일반 객체 프로토타입 키가 매핑 테이블 조회에 걸리면 안 된다.
  ['constructor', 'unknown'], ['toString', 'unknown'], ['__proto__', 'unknown'], ['hasOwnProperty', 'unknown'],
];

for (const [provider, asset] of CASES) {
  test(`provider ${JSON.stringify(provider)}: front seat draws the back-casing monitor of ${asset}`, () => {
    const solo = snapshot([{ id: 's', kind: 'solo', manager: null, members: [agent('s', provider)] }]);
    assert.deepEqual(drawnKeys(solo), [`monitors/monitor-${asset}`]);
  });

  test(`provider ${JSON.stringify(provider)}: back seat draws the screen monitor with the ${asset} icon`, () => {
    // 매니저 1 + 멤버 4: 멤버 0,1은 섬 앞 줄(front), 멤버 2,3은 섬 뒷 줄(back).
    const members = [0, 1, 2, 3].map(i => agent(`m${i}`, provider));
    const keys = drawnKeys(snapshot([{ id: 'g', kind: 'group', manager: agent('boss', provider), members }]));
    const layout = layoutOffices(snapshot([{ id: 'g', kind: 'group', manager: agent('boss', provider), members }]), 800);
    const facings = layout.rooms[0].stations.map((station: { facing: string }) => station.facing);
    assert.deepEqual(facings, ['front', 'front', 'front', 'back', 'back']);
    assert.deepEqual(keys.filter(key => key !== `monitors/monitor-${asset}`), [`monitors/monitor-screen`, `icons/${asset}`, `monitors/monitor-screen`, `icons/${asset}`]);
    assert.equal(keys.filter(key => key === `monitors/monitor-${asset}`).length, 3);
  });
}

test('each agent gets its own provider on both sides, in drawing order', () => {
  const providers = ['claude', 'codex', 'gemini', 'copilot'];
  const members = providers.map((p, i) => agent(`m${i}`, p));
  const keys = drawnKeys(snapshot([{ id: 'g', kind: 'group', manager: agent('boss', 'muse'), members }]));
  // 매니저(독립석) → 앞 줄 front 모니터 → 뒷 줄 back 모니터(screen + icon).
  assert.deepEqual(keys, ['monitors/monitor-muse', 'monitors/monitor-claude', 'monitors/monitor-codex',
    'monitors/monitor-screen', 'icons/antigravity', 'monitors/monitor-screen', 'icons/copilot']);
});
