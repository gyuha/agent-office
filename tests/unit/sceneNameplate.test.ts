import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, fakeSprites, group, providerColor, snap, solo, step, trace, layoutOffices } from './helpers/scene.ts';

const ICON_PROVIDERS = ['claude', 'codex', 'antigravity', 'copilot', 'muse', 'opencode'];

test('the manifest ships an icon sheet for every known provider', () => {
  for (const p of ICON_PROVIDERS) assert.ok((assetData as any)[`provider-icon-${p}`]?.uri, p);
});

test('known providers draw their icon sheet on the plate and no fallback circle', () => {
  for (const provider of ICON_PROVIDERS) {
    const { images, arcs } = trace(snap([solo('s', { provider })]));
    assert.equal(images.filter(i => i.key === `provider-icon-${provider}`).length, 1, provider);
    assert.equal(images.filter(i => i.key.startsWith('provider-icon-') && i.key !== `provider-icon-${provider}`).length, 0, provider);
    assert.equal(arcs.length, 0, provider);
  }
});

test('unknown providers fall back to a filled circle in the provider color, with no icon', () => {
  for (const provider of ['pi', 'omp', '', 'Claude', 'constructor', '__proto__', 'gemini']) {
    const { images, arcs } = trace(snap([solo('s', { provider })]));
    assert.equal(images.filter(i => i.key.startsWith('provider-icon-')).length, 0, JSON.stringify(provider));
    assert.equal(arcs.length, 1, JSON.stringify(provider));
    assert.equal(arcs[0].fill, providerColor(provider));
  }
  assert.equal(providerColor('gemini'), providerColor('antigravity'));
});

test('a provider whose icon failed to load (missing sprite) uses the circle fallback', () => {
  const { images, arcs } = trace(snap([solo('s', { provider: 'claude' })]), { sprites: fakeSprites({}, ['provider-icon-claude']) });
  assert.equal(images.filter(i => i.key.startsWith('provider-icon-')).length, 0);
  assert.equal(arcs.length, 1);
});

test('every agent in a mixed office gets exactly one plate with its own name and provider mark', () => {
  const o = group(4);
  const providers = ['codex', 'pi', 'copilot', 'muse'];
  o.members.forEach((m, i) => { (m as { provider: string }).provider = providers[i]; });
  const { images, arcs, texts } = trace(snap([o]));
  assert.deepEqual(texts.map(t => t.text).sort(), ['Agent 0', 'Agent 1', 'Agent 2', 'Agent 3', 'Orchestrator']);
  assert.deepEqual(images.filter(i => i.key.startsWith('provider-icon-')).map(i => i.key).sort(),
    ['provider-icon-claude', 'provider-icon-codex', 'provider-icon-copilot', 'provider-icon-muse']);
  assert.equal(arcs.length, 1);
});

test('long names are cut with an ellipsis so the label always fits inside the plate', () => {
  const o = solo('s'); (o.members[0] as { name: string }).name = 'An extremely long agent name that cannot fit on a brass plate';
  const { texts, layout } = trace(snap([o]));
  assert.equal(texts.length, 1);
  assert.ok(texts[0].text.endsWith('…') && texts[0].text.length < 60);
  const st = layout.rooms[0].stations[0];
  assert.ok(texts[0].text.length * 10 <= st.plateWidth, 'label measured with the fake 10px/char font fits');
});

test('plate text size tracks the scene scale: 18 scene px at full size, never below 6.5 CSS px on screen', () => {
  for (const [width, want] of [[1536, 18], [900, 18], [410, 6.5 / (410 / 1536)], [200, 6.5 / (200 / 1536)]] as const) {
    const { texts, layout } = trace(snap([solo('s')]), { width });
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(texts[0].font)![1]);
    assert.ok(Math.abs(px - Math.max(18, want)) < 1e-9, `${width}px -> ${px}`);
    assert.ok(px * layout.viewportScale! >= 6.5 - 1e-9);
  }
});

// 깊이 정렬: 명판은 책상과 같은 y 깊이에서 그려진다. 걷는 캐릭터는 자기 y로 정렬된다.
function walkerOrder(walkerY: number) {
  const s = snap([group(2)]);
  const layout = layoutOffices(s);
  const [, owner, walker] = layout.rooms[0].stations;
  const base: any = step({}, s, 0, layout);
  const actors = { ...base, [walker.agent.id]: { ...base[walker.agent.id], moving: true, direction: 'right', x: owner.plate.x, y: walkerY(owner.y + owner.height) } };
  const { images, texts } = trace(s, { actors });
  const plate = texts.find(t => t.text === owner.agent.name)!;
  const walk = images.filter(i => i.key === `actor-${walker.variant}-walk_right`);
  assert.equal(walk.length, 1);
  return { plate, walk: walk[0] };
}

test('a walker in front of a desk is drawn after (over) its nameplate', () => {
  const { plate, walk } = walkerOrder(depth => depth + 30);
  assert.ok(walk.order > plate.order);
});

test('a walker behind a desk is drawn before (under) its desk and nameplate', () => {
  const { plate, walk } = walkerOrder(depth => depth - 30);
  assert.ok(walk.order < plate.order);
});

test('the plate is drawn after the seated occupant and the desk front, never before them', () => {
  const s = snap([group(2)]);
  const { images, texts, layout } = trace(s);
  const owner = layout.rooms[0].stations[1];
  const plate = texts.find(t => t.text === owner.agent.name)!;
  const front = images.find(i => i.key === `pod-${owner.pod}-front` && Math.abs(i.dx - owner.x) < 1)!;
  const figures = images.filter(i => i.key === `actor-${owner.variant}-working`);
  assert.ok(front.order < plate.order);
  assert.ok(figures.every(f => f.order < plate.order));
});
