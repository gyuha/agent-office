import test from 'node:test';
import assert from 'node:assert/strict';
import { group, providerColor, snap, snapAll, solo } from './helpers/scene.ts';
import { mountFake } from './helpers/dom.ts';

async function mount(snapshot: any, clientWidth = 1200) {
  const m = await mountFake(snapshot, { clientWidth });
  try {
    const layout = m.handle.inspect().layout;
    return { headers: m.headers(), plates: m.plates(), clicks: m.clicks, layout, clickScene: m.clickScene, cells: m.cells };
  } finally { m.handle.dispose(); m.restore(); }
}

test('top bar of a group office: PROJECT / WORKSPACE / AGENT(manager name)', async () => {
  const m = await mount(snap([group(3)], { workspaceName: 'Fix the login bug' } as any));
  assert.equal(m.headers.length, 1);
  assert.deepEqual(m.cells(m.headers[0]), [['PROJECT', 'P'], ['WORKSPACE', 'Fix the login bug'], ['AGENT', 'Orchestrator']]);
  assert.ok(!m.headers[0].className.includes('no-workspace'));
});

test('top bar of a solo office shows the solo agent name', async () => {
  const m = await mount(snap([solo('s')], { workspaceName: 'ws' } as any));
  assert.deepEqual(m.cells(m.headers[0]).map(c => c[1]), ['P', 'ws', 'Solo Agent']);
});

test('workspaceName null, undefined or empty hides the WORKSPACE cell and switches to the two-column style', async () => {
  for (const workspaceName of [null, undefined, '']) {
    const m = await mount(snap([group(2)], { workspaceName } as any));
    assert.deepEqual(m.cells(m.headers[0]), [['PROJECT', 'P'], ['AGENT', 'Orchestrator']], String(workspaceName));
    assert.ok(m.headers[0].className.includes('no-workspace'));
  }
});

test('scope all: one top bar per office with its own project name; no workspace cell when the snapshot has none', async () => {
  const m = await mount(snapAll([{ name: 'alpha', offices: [group(2, 'a'), solo('as')] }, { name: 'beta', offices: [group(4, 'b')] }]));
  assert.deepEqual(m.headers.map(h => m.cells(h).map(c => c[1])), [['alpha', 'Orchestrator'], ['alpha', 'Solo Agent'], ['beta', 'Orchestrator']]);
});

test('nameplates are drawn on the canvas, not as DOM buttons; clicking a plate on the canvas selects its agent', async () => {
  const m = await mountFake(snap([group(3)]));
  try {
    assert.equal(m.plates().length, 0, 'no .office-plate DOM buttons');
    const stations = m.handle.inspect().layout.rooms[0].stations;
    for (const st of stations) m.clickScene(st.plate.x, st.plate.y);
    assert.deepEqual(m.clicks, stations.map((st: any) => st.agent.id));
    m.clickScene(5, 5);
    assert.equal(m.clicks.length, stations.length, 'clicking empty space selects nothing');
  } finally { m.handle.dispose(); m.restore(); }
});

test('providerColor: known providers have their own color, unknown providers fall back to one default', () => {
  const known = ['claude', 'codex', 'gemini', 'antigravity'].map(providerColor);
  assert.equal(new Set(known).size, 3, 'gemini and antigravity share a color');
  for (const odd of ['', 'pi', 'opencode']) assert.equal(providerColor(odd), providerColor('nope'), odd);
});

test('providerColor: prototype keys are not providers', () => {
  for (const odd of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(providerColor(odd), providerColor('nope'), odd);
});
