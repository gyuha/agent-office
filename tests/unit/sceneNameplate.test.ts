import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, manifest, fakeSprites, group, providerColor, snap, solo, step, trace, layoutOffices } from './helpers/scene.ts';

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

test('providerIcons mapping comes from the manifest: every value is an embedded sheet and a shared default exists', () => {
  const icons = (manifest as any).providerIcons;
  assert.equal(icons.default, 'provider-icon-default');
  for (const [provider, key] of Object.entries<string>(icons)) assert.ok((assetData as any)[key]?.uri, `${provider} -> ${key}`);
  assert.equal(icons.gemini, 'provider-icon-default');
  assert.equal(icons.orchestrator, 'provider-icon-default');
  for (const p of ICON_PROVIDERS) assert.equal(icons[p], `provider-icon-${p}`);
});

test('unknown providers (and gemini/orchestrator) use the shared default icon, never a color dot; prototype keys count as unknown', () => {
  for (const provider of ['pi', 'omp', '', 'Claude', 'gemini', 'orchestrator', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const { images, arcs } = trace(snap([solo('s', { provider })]));
    assert.deepEqual(images.filter(i => i.key.startsWith('provider-icon-')).map(i => i.key), ['provider-icon-default'], JSON.stringify(provider));
    assert.equal(arcs.length, 0, JSON.stringify(provider));
  }
  assert.equal(providerColor('gemini'), providerColor('antigravity'));
});

test('only when the mapped icon sheet itself is missing does the plate fall back to the color circle', () => {
  const { images, arcs } = trace(snap([solo('s', { provider: 'claude' })]), { sprites: fakeSprites({}, ['provider-icon-claude']) });
  assert.equal(images.filter(i => i.key.startsWith('provider-icon-')).length, 0);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].fill, providerColor('claude'));
  const unknown = trace(snap([solo('s', { provider: 'pi' })]), { sprites: fakeSprites({}, ['provider-icon-default']) });
  assert.equal(unknown.arcs.length, 1);
});

test('every agent in a mixed office gets exactly one plate with its own name and provider mark', () => {
  const o = group(4);
  const providers = ['codex', 'pi', 'copilot', 'muse'];
  o.members.forEach((m, i) => { (m as { provider: string }).provider = providers[i]; });
  const { images, arcs, texts } = trace(snap([o]));
  const names = ['Agent 0', 'Agent 1', 'Agent 2', 'Agent 3', 'Orchestrator'];
  assert.equal(texts.length, 5);
  for (const name of names) assert.ok(texts.some(t => t.text === name || (t.text.endsWith('…') && name.startsWith(t.text.slice(0, -1)))), `plate for ${name}`);
  assert.deepEqual(images.filter(i => i.key.startsWith('provider-icon-')).map(i => i.key).sort(),
    ['provider-icon-claude', 'provider-icon-codex', 'provider-icon-copilot', 'provider-icon-default', 'provider-icon-muse']);
  assert.equal(arcs.length, 0);
});

test('long names are cut with an ellipsis so the label always fits inside the plate', () => {
  const o = solo('s'); (o.members[0] as { name: string }).name = 'An extremely long agent name that cannot fit on a brass plate';
  const { texts, layout } = trace(snap([o]));
  assert.equal(texts.length, 1);
  assert.ok(texts[0].text.endsWith('…') && texts[0].text.length < 60);
  const st = layout.rooms[0].stations[0];
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(texts[0].font)![1]);
  assert.ok(texts[0].text.length * 0.6 * px <= st.plateWidth, 'label measured with the 0.6em/char font fits');
});

test('plate text size tracks the scene scale: 18 scene px at full size, never below 6.5 CSS px on screen', () => {
  for (const [width, want] of [[1536, 18], [900, 18], [410, 6.5 / (410 / 1536)], [200, 6.5 / (200 / 1536)]] as const) {
    const { texts, layout } = trace(snap([solo('s')]), { width });
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(texts[0].font)![1]);
    assert.ok(Math.abs(px - Math.max(18, want)) < 1e-9, `${width}px -> ${px}`);
    assert.ok(px * layout.viewportScale! >= 6.5 - 1e-9);
  }
});

// 깊이 정렬: 책상 앞/옆을 지나는 보행자는 가구에 가려지지 않는다(VQA-016). 자기 책상 안에서만 앞쪽 소품 뒤에 있다.
function walkerOrder(walkerY: (depth: number) => number) {
  const s = snap([group(2)]);
  const layout = layoutOffices(s);
  const [, owner, walker] = layout.rooms[0].stations;
  const base: any = step({}, s, 0, layout);
  const actors = { ...base, [walker.agent.id]: { ...base[walker.agent.id], moving: true, direction: 'right', x: owner.plate.x, y: walkerY(owner.y + owner.height) } };
  const { images, texts } = trace(s, { actors });
  const plate = texts.find(t => t.text === owner.agent.name)!;
  const walk = images.filter(i => i.key === `actor-${walker.variant}-walk_right`);
  assert.equal(walk.length, 1);
  return { plate, walk: walk[0], images };
}

test('a walker in front of a desk is drawn after (over) its nameplate', () => {
  const { plate, walk } = walkerOrder(depth => depth + 30);
  assert.ok(walk.order > plate.order);
});

test('VQA-016: a walker passing behind a desk is still drawn above every desk layer and nameplate (never hidden by furniture)', () => {
  const { plate, walk, images } = walkerOrder(depth => depth - 30);
  assert.ok(walk.order > plate.order);
  assert.ok(images.filter(i => /^pod-\d-(back|front)$/.test(i.key)).every(i => i.order < walk.order));
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

// ───────── VQA-023: 리드 명판 이름이 410/480px에서 잘리지 않음 ─────────
for (const width of [1536, 900, 480, 410]) {
  test(`VQA-023 (${width}px): the lead nameplate shows the full name for N=1..16, never fewer characters than member plates, and stays at least 5 CSS px tall text`, () => {
    for (let n = 2; n <= 16; n++) {
      const o = group(n, 'g');
      o.members.forEach((m, i) => { (m as { name: string }).name = ['plugin#FDF9', 'search#64CA', 'scene#3C71', 'art#94A2'][i % 4]; });
      const s = snap([o]);
      const t = trace(s, { width });
      const lead = t.texts.find(x => x.text.startsWith('Orch'))!;
      assert.equal(lead.text, 'Orchestrator', `${width}px N=${n}: lead label "${lead.text}"`);
      const vs = t.layout.viewportScale!;
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(lead.font)![1]);
      assert.ok(px * vs >= 5 - 1e-6, `${width}px N=${n}: lead font ${(px * vs).toFixed(2)} CSS px`);
      const members = t.texts.filter(x => x !== lead);
      const longestShown = Math.max(...members.map(x => Array.from(x.text.replace('…', '')).length));
      assert.ok(Array.from(lead.text).length >= longestShown, `${width}px N=${n}: lead shows ${lead.text.length} chars vs members ${longestShown}`);
    }
  });
}

test('VQA-023: only when even the minimum font cannot fit the name does the lead label fall back to an ellipsis', () => {
  const o = group(3, 'g');
  (o.manager as { name: string }).name = 'An-extremely-long-orchestrator-name-that-cannot-fit';
  const t = trace(snap([o]), { width: 410 });
  const lead = t.texts.find(x => x.text.startsWith('An-'))!;
  assert.ok(lead.text.endsWith('…') && lead.text.length < 'An-extremely-long-orchestrator-name-that-cannot-fit'.length);
});
