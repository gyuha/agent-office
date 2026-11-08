import test from 'node:test';
import assert from 'node:assert/strict';
import { group, layoutOffices, snap, snapAll, solo, trace, withState } from './helpers/scene.ts';
import { mountFake } from './helpers/dom.ts';

const GAP = 20, PADDING = 16, MIN = 410, MAX = 480;

// 구현과 독립적으로 다시 계산한 masonry 규칙: 카드 최대 480, 최소 410, 간격 20. 배정 단위는 프로젝트 블록이고, 블록은 그 시점 가장 짧은 열에 순서대로 붙는다.
// VQA-039: 폭이 410px 이상이면 바깥 여백은 min(16, (폭 - 410) / 2)라서 1열 카드가 410px 아래로 내려가지 않는다.
const paddingFor = (width: number) => (width >= MIN ? Math.min(PADDING, (width - MIN) / 2) : PADDING);
const columnsFor = (width: number, count: number) => Math.max(1, Math.min(count || 1, Math.floor((width - paddingFor(width) * 2 + GAP) / (MIN + GAP))));
const cardWidthFor = (width: number, columns: number) => Math.min(MAX, (width - paddingFor(width) * 2 - GAP * (columns - 1)) / columns);

type Office = ReturnType<typeof group> | ReturnType<typeof solo>;
const projectsOf = (specs: { name: string; offices: Office[] }[]) => snapAll(specs);
/** 방 하나짜리 카드 스냅샷: 구현이 카드마다 쓰는 것과 같은 모양. */
const cardSnapshot = (snapshot: any, project: any, office: any) => ({ ...snapshot, projects: [{ ...project, offices: [office] }] });

function expectedPlacement(snapshot: any, width: number) {
  const projects = [...snapshot.projects].sort((a: any, b: any) => a.projectName.localeCompare(b.projectName));
  const cards = projects.flatMap((p: any) => p.offices.filter((o: any) => o.manager || o.members.length).map((o: any) => ({ key: `${p.projectId}/${o.id}`, project: p.projectId, snap: cardSnapshot(snapshot, p, o) })));
  const columns = columnsFor(width, cards.length), cardWidth = cardWidthFor(width, columns);
  const heights = cards.map(c => layoutOffices(c.snap, cardWidth).height * cardWidth / 1536);
  const padding = paddingFor(width);
  const bottoms: number[] = Array(columns).fill(padding), left = (width - (columns * cardWidth + (columns - 1) * GAP)) / 2;
  const placed: { key: string; project: string; col: number; left: number; top: number; width: number; height: number }[] = [];
  // 같은 프로젝트의 연속된 카드를 한 블록으로 묶고, 블록 전체를 가장 짧은 열에 둔다.
  const blocks: number[][] = [];
  cards.forEach((c, i) => { if (!blocks.length || cards[blocks.at(-1)![0]].project !== c.project) blocks.push([]); blocks.at(-1)!.push(i); });
  for (const block of blocks) {
    const col = bottoms.indexOf(Math.min(...bottoms));
    for (const i of block) { placed[i] = { key: cards[i].key, project: cards[i].project, col, left: left + col * (cardWidth + GAP), top: bottoms[col], width: cardWidth, height: heights[i] }; bottoms[col] += heights[i] + GAP; }
  }
  return { columns, cardWidth, placed, blocks, totalHeight: Math.max(...bottoms) - (cards.length ? GAP : 0) + padding };
}

const num = (css: string, prop: string) => { const m = new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)px`).exec(css); return m ? Number(m[1]) : NaN; };
const geometry = (holder: any) => { const css = String(holder.style.cssText); return { left: num(css, 'left'), top: num(css, 'top'), width: num(css, 'width'), css }; };

/** 서로 높이가 다른 방 12개(작은 방, 중간 방, 큰 방 섞음). 이름 순서와 생성 순서를 일부러 다르게 둔다. */
function mixedAll(count = 12) {
  const sizes = [3, 6, 12, 1, 8, 4, 16, 2, 5, 10, 7, 9];
  const names = ['zeta', 'alpha', 'mu', 'beta', 'omega', 'delta', 'kappa', 'gamma', 'sigma', 'epsilon', 'theta', 'eta'];
  return projectsOf(Array.from({ length: count }, (_, i) => ({ name: names[i % names.length], offices: [sizes[i % sizes.length] === 1 ? solo(`s${i}`, { state: 'working' }) : group(sizes[i % sizes.length], `g${i}`, { state: 'working' })] as Office[] })));
}

async function withAll<T>(getter: any, width: number, fn: (m: Awaited<ReturnType<typeof mountFake>>) => T | Promise<T>) {
  const m = await mountFake(getter, { clientWidth: width });
  try { m.run(300); return await fn(m); } finally { m.handle.dispose(); m.restore(); }
}

test('masonry: column count follows floor((width - 32 + 20) / (410 + 20)), at most one column per card: 1200 → 2, 1600 → 3, 2000 → 4', async () => {
  const s = mixedAll();
  for (const [width, want] of [[360, 1], [700, 1], [871, 1], [872, 2], [1200, 2], [1600, 3], [2000, 4], [3000, 6]] as const) {
    assert.equal(columnsFor(width, 12), Math.min(want, 12), `formula at ${width}`);
    await withAll(s, width, m => {
      const lefts = new Set(m.holders().map((h: any) => geometry(h).left.toFixed(3)));
      assert.equal(lefts.size, Math.min(want, 12), `${width}px: ${lefts.size} columns`);
    });
  }
  const two = projectsOf([{ name: 'a', offices: [solo('a', {})] }, { name: 'b', offices: [group(3, 'b')] }]);
  await withAll(two, 2000, m => assert.equal(new Set(m.holders().map((h: any) => geometry(h).left)).size, 2, 'never more columns than cards'));
});

test('masonry: card width is at most 480 and at least 410 once the panel can hold a column (1200 → 480, 1600 → 480, 2000 → 477) and shrinks only on very narrow panels', async () => {
  const s = mixedAll();
  for (const [width, want] of [[1200, 480], [1600, 480], [2000, 477]] as const) await withAll(s, width, m => {
    for (const h of m.holders()) { const w = geometry(h).width; assert.ok(Math.abs(w - want) < 1e-6 && w >= MIN && w <= MAX, `${width}px: card ${w}`); }
  });
  await withAll(s, 700, m => { for (const h of m.holders()) assert.equal(geometry(h).width, 480); });
  await withAll(snapAll([{ name: 'a', offices: [group(3, 'a')] }]), 2000, m => assert.equal(geometry(m.holders()[0]).width, 480, 'a lone card is capped at 480'));
  await withAll(s, 400, m => { for (const h of m.holders()) assert.equal(geometry(h).width, 368); });
});


test('masonry: cards are placed in order (sorted by project name) onto the currently shortest column; positions match an independent simulation', async () => {
  const s = mixedAll();
  for (const width of [780, 1200, 1600, 2000]) await withAll(s, width, m => {
    const want = expectedPlacement(s, width);
    const holders = m.holders();
    assert.equal(holders.length, want.placed.length);
    want.placed.forEach((p, i) => {
      const g = geometry(holders[i]);
      assert.ok(g.css.includes('position:absolute'), `${width}px card ${i}: absolutely placed`);
      assert.ok(Math.abs(g.left - p.left) < 1e-6 && Math.abs(g.top - p.top) < 1e-6 && Math.abs(g.width - p.width) < 1e-6, `${width}px card ${i}: (${g.left},${g.top}) vs (${p.left},${p.top})`);
    });
    // 순서: DOM 순서가 이름순이다.
    const names = holders.map((h: any) => h.children[0].children[2].children[0].children[0].children[1].textContent);
    assert.deepEqual(names, [...names].sort((a: string, b: string) => a.localeCompare(b)), 'cards follow project name order');
    // 각 카드는 그 시점에 가장 짧은 열에 붙는다(독립 검증).
    const bottoms: number[] = Array(want.columns).fill(PADDING);
    want.placed.forEach(p => { assert.equal(p.col, bottoms.indexOf(Math.min(...bottoms))); bottoms[p.col] += p.height + GAP; });
    assert.ok(Math.abs(num(String(m.collection.style.cssText), 'height') - want.totalHeight) < 1e-6 || Math.abs(parseFloat(m.collection.style.height) - want.totalHeight) < 1e-6, `${width}px: collection height ${m.collection.style.height ?? m.collection.style.cssText}`);
    // 같은 열의 카드는 겹치지 않는다.
    for (let c = 0; c < want.columns; c++) { const col = want.placed.filter(p => p.col === c); for (let i = 1; i < col.length; i++) assert.ok(col[i].top >= col[i - 1].top + col[i - 1].height + GAP - 1e-6); }
  });
});

test('masonry: equal-height single-office projects fill the columns left to right, then wrap to the shortest', async () => {
  const s = projectsOf(Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, offices: [group(3, `g${i}`)] as Office[] })));
  await withAll(s, 1600, m => {
    const g = m.holders().map((h: any) => geometry(h)), columns = columnsFor(1600, 7);
    assert.equal(columns, 3);
    assert.equal(new Set(g.slice(0, columns).map(x => x.left)).size, columns);
    for (let i = 0; i < columns; i++) assert.equal(g[i].top, PADDING, `card ${i} starts the first row`);
    for (let i = columns; i < 7; i++) { assert.equal(g[i].left, g[i - columns].left, `card ${i} goes under card ${i - columns}`); assert.ok(g[i].top > PADDING); }
  });
});

/** 방이 여러 개인 프로젝트가 섞인 scope all. */
function projectBlocks() {
  const mk = (n: number, id: string) => (n === 1 ? solo(id, { state: 'working' }) : group(n, id, { state: 'working' })) as Office;
  return projectsOf([
    { name: 'alpha', offices: [mk(3, 'a0'), mk(6, 'a1'), mk(1, 'a2')] },
    { name: 'beta', offices: [mk(12, 'b0')] },
    { name: 'delta', offices: [mk(3, 'd0')] },
    { name: 'epsilon', offices: [mk(8, 'e0'), mk(2, 'e1')] },
    { name: 'gamma', offices: [mk(4, 'g0'), mk(16, 'g1')] },
    { name: 'zeta', offices: [mk(5, 'z0')] },
  ]);
}

test('VQA-034: all offices of one project stay together in one column, contiguous and in order (the project block is the masonry unit)', async () => {
  const s = projectBlocks();
  for (const width of [900, 1200, 1600, 2000]) await withAll(s, width, m => {
    const want = expectedPlacement(s, width);
    const holders = m.holders();
    assert.equal(holders.length, 10);
    // 같은 프로젝트: 같은 열(left 동일), 위에서 아래로 빈틈 없이 이어진다(간격 20).
    for (const block of want.blocks) {
      const g = block.map(i => geometry(holders[i]));
      assert.equal(new Set(g.map(x => x.left.toFixed(3))).size, 1, `${width}px: project ${want.placed[block[0]].project} spans columns ${g.map(x => x.left)}`);
      assert.ok(block.every(i => holders[i].dataset.project === want.placed[block[0]].project), 'project id is exposed on every card');
      for (let k = 1; k < block.length; k++) assert.ok(Math.abs(g[k].top - (g[k - 1].top + want.placed[block[k - 1]].height + GAP)) < 1e-6, `${width}px: block cards are contiguous`);
    }
    // 블록 단위로 가장 짧은 열에 배정된다(독립 시뮬레이션과 모든 위치가 같다).
    want.placed.forEach((p, i) => { const g = geometry(holders[i]); assert.ok(Math.abs(g.left - p.left) < 1e-6 && Math.abs(g.top - p.top) < 1e-6, `${width}px card ${i}: (${g.left},${g.top}) vs (${p.left},${p.top})`); });
    // 한 프로젝트의 카드가 다른 프로젝트 카드 사이에 끼지 않는다(열 안에서 같은 프로젝트끼리 연속).
    for (let c = 0; c < want.columns; c++) {
      const col = want.placed.filter(p => p.col === c).map(p => p.project);
      const seen = new Set<string>(); let last = '';
      for (const project of col) { if (project !== last) { assert.ok(!seen.has(project), `${width}px column ${c}: project ${project} is split by another project`); seen.add(project); last = project; } }
    }
  });
});

test('VQA-034: a project block goes to the column that is shortest when the block starts; the next project follows the new shortest column', async () => {
  const s = projectBlocks();
  await withAll(s, 1600, m => {
    const want = expectedPlacement(s, 1600);
    const bottoms: number[] = Array(want.columns).fill(PADDING);
    for (const block of want.blocks) {
      assert.equal(want.placed[block[0]].col, bottoms.indexOf(Math.min(...bottoms)), `block of ${want.placed[block[0]].project}`);
      for (const i of block) bottoms[want.placed[i].col] += want.placed[i].height + GAP;
    }
    assert.equal(new Set(want.placed.map(p => p.col)).size, want.columns, 'every column is used');
  });
});

test('VQA-034: a poll that changes the height of one office re-places the blocks, still keeping each project together', async () => {
  let current = projectBlocks();
  const m = await mountFake(() => current, { clientWidth: 1600 });
  try {
    m.run(300);
    const placements = m.handle.inspect().placements;
    current = withState(JSON.parse(JSON.stringify(current)), 'phone');
    m.run(2000);
    assert.equal(m.handle.inspect().placements, placements, 'same heights: nothing moves');
    const grown = JSON.parse(JSON.stringify(current));
    grown.projects.find((p: any) => p.projectName === 'alpha').offices[0].members.push(...group(3, 'x').members); // 3 → 6 명
    current = grown;
    m.run(300);
    assert.equal(m.handle.inspect().placements, placements + 1);
    const want = expectedPlacement(grown, 1600);
    want.placed.forEach((p, i) => assert.ok(Math.abs(geometry(m.holders()[i]).left - p.left) < 1e-6 && Math.abs(geometry(m.holders()[i]).top - p.top) < 1e-6, `card ${i}`));
    for (const block of want.blocks) assert.equal(new Set(block.map(i => geometry(m.holders()[i]).left.toFixed(3))).size, 1);
  } finally { m.handle.dispose(); m.restore(); }
});

// VQA-035: 410px 카드(masonry 최소 폭)에서도 일반 이름은 말줄임 없이 전부 보인다.
for (const width of [410, 430, 480]) {
  test(`VQA-035 (${width}px card): ordinary agent names are never ellipsized on member or lead plates`, () => {
    const names = ['plugin#FDF9', 'search#64CA', 'scene#3C71', 'art#94A2', 'review#A1C2', 'infra#55E3', 'qa#0499', 'mobile#E27D'];
    for (let n = 1; n <= 16; n++) {
      const o: any = n === 1 ? solo('s', {}) : group(n, 'g');
      o.members.forEach((m: any, i: number) => { m.name = names[i % names.length]; });
      const t = trace(snap([o]), { width });
      for (const text of t.texts) assert.ok(!text.text.includes('…'), `${width}px N=${n}: "${text.text}" is ellipsized`);
      const shown = new Set(t.texts.map(x => x.text));
      for (const m of o.members) assert.ok(shown.has(m.name), `${width}px N=${n}: ${m.name} fully shown`);
      if (o.manager) assert.ok(shown.has('Orchestrator'));
    }
  });
}


test('masonry: a 2s poll with the same card heights keeps every card where it is (no re-placement); only a height change re-places', async () => {
  let current = mixedAll();
  const m = await mountFake(() => current, { clientWidth: 1600 });
  try {
    m.run(300);
    const before = m.holders().map((h: any) => geometry(h).css);
    const placements = m.handle.inspect().placements;
    for (let poll = 0; poll < 5; poll++) {
      current = withState(JSON.parse(JSON.stringify(current)), poll % 2 ? 'working' : 'phone'); // 새 객체, 같은 높이, 다른 상태
      m.run(2000);
      assert.equal(m.handle.inspect().placements, placements, `poll ${poll}: no re-placement`);
      assert.deepEqual(m.holders().map((h: any) => geometry(h).css), before, `poll ${poll}: holder styles untouched`);
    }
    // 높이가 바뀌면(N=3 → N=6 인원 증가) 그때만 다시 배치한다.
    const grown = JSON.parse(JSON.stringify(current));
    const target = grown.projects.find((p: any) => p.offices[0].members.length === 3);
    target.offices[0].members.push(...group(3, 'extra').members);
    current = grown;
    m.run(300);
    assert.equal(m.handle.inspect().placements, placements + 1, 'exactly one re-placement after a height change');
    const want = expectedPlacement(grown, 1600);
    want.placed.forEach((p, i) => assert.ok(Math.abs(geometry(m.holders()[i]).top - p.top) < 1e-6 && Math.abs(geometry(m.holders()[i]).left - p.left) < 1e-6, `card ${i} re-placed by the rule`));
    // 같은 높이의 갱신이 다시 와도 다시 배치하지 않는다.
    current = withState(JSON.parse(JSON.stringify(current)), 'away');
    m.run(2000);
    assert.equal(m.handle.inspect().placements, placements + 1);
  } finally { m.handle.dispose(); m.restore(); }
});

test('masonry: a width change re-places the cards (and only then, for the same snapshot)', async () => {
  const s = mixedAll();
  const m = await mountFake(s, { clientWidth: 1200 });
  try {
    m.run(300);
    const placements = m.handle.inspect().placements;
    m.run(3000);
    assert.equal(m.handle.inspect().placements, placements, 'nothing changes without a change');
    m.parent.clientWidth = 1600; m.run(300);
    assert.equal(m.handle.inspect().placements, placements + 1);
    expectedPlacement(s, 1600).placed.forEach((p, i) => assert.ok(Math.abs(geometry(m.holders()[i]).left - p.left) < 1e-6));
  } finally { m.handle.dispose(); m.restore(); }
});

test('one canvas per room, one shared 12fps timer: N cards → N canvases and N+1 scheduler subscribers but a single timer', async () => {
  const s = mixedAll();
  await withAll(s, 1600, m => {
    assert.equal(m.holders().length, 12);
    assert.equal(m.sceneRoots().filter((r: any) => r.children[1].tag === 'canvas').length, 12, 'one canvas per card');
    const sched = m.handle.inspect().scheduler;
    assert.equal(sched.subscribers, 13, 'rooms + the collection layout task');
    assert.equal(sched.timers, 1, 'a single timer for everything');
    assert.ok(m.pendingTimers() <= 2, `pending timers+frames: ${m.pendingTimers()}`);
    const before = (m.handle.inspect().cards as any[]).map(c => c.metrics.drawCount);
    m.run(1000);
    const after = (m.handle.inspect().cards as any[]).map(c => c.metrics.drawCount);
    after.forEach((n, i) => assert.ok(n - before[i] >= 10 && n - before[i] <= 13, `card ${i}: ${n - before[i]} frames in 1s (about 12fps)`));
  });
});

test('off-screen cards: beyond the prepaint band zero draw calls (canvas kept); beyond the retention band the canvas memory is released; on-screen cards keep drawing', async () => {
  const s = mixedAll();
  await withAll(s, 1600, m => {
    const cardsNow = () => m.handle.inspect().cards as any[];
    const roots = m.sceneRoots();
    const far = [1, 4, 7], near = [2, 5]; // far: 2400px 밖(메모리 해제), near: 1200px 밖~2400px 안(그리기만 멈춤)
    const prepaint = (i: number) => m.io.callbacks[2 * i], retention = (i: number) => m.io.callbacks[2 * i + 1]; // 카드마다 [미리 그리기, 유지] 쌍
    for (const i of [...far, ...near]) prepaint(i)([{ isIntersecting: false }]);
    for (const i of far) retention(i)([{ isIntersecting: false }]);
    const keptWidth = Object.fromEntries(near.map(i => [i, roots[i].children[1].width]));
    const before = cardsNow().map(c => c.metrics.drawCount);
    m.run(5000);
    const after = cardsNow().map(c => c.metrics.drawCount);
    after.forEach((n, i) => {
      if (far.includes(i) || near.includes(i)) assert.equal(n, before[i], `card ${i}: draw calls while off-screen`);
      else assert.ok(n - before[i] >= 50, `card ${i}: keeps drawing (${n - before[i]})`);
      if (far.includes(i)) assert.deepEqual([roots[i].children[1].width, roots[i].children[1].height], [0, 0], `card ${i}: backing store released beyond 2400px`);
      if (near.includes(i)) assert.equal(roots[i].children[1].width, keptWidth[i], `card ${i}: canvas kept inside 2400px`);
    });
    for (const i of [...far, ...near]) prepaint(i)([{ isIntersecting: true }]);
    for (const i of far) retention(i)([{ isIntersecting: true }]);
    const resumed = cardsNow().map(c => c.metrics.drawCount);
    m.run(1000);
    cardsNow().forEach((c, i) => { if (far.includes(i) || near.includes(i)) { assert.ok(c.metrics.drawCount - resumed[i] >= 10, `card ${i}: resumes`); assert.ok(roots[i].children[1].width > 0, `card ${i}: canvas rebuilt`); } });
  });
});


test('document.hidden stops the shared timer for every card at once; becoming visible restarts it', async () => {
  const s = mixedAll(6);
  await withAll(s, 1600, m => {
    m.doc.hidden = true; m.fire('visibilitychange');
    assert.equal(m.pendingTimers(), 0);
    const before = (m.handle.inspect().cards as any[]).reduce((n, c) => n + c.metrics.drawCount, 0);
    m.run(5000);
    assert.equal((m.handle.inspect().cards as any[]).reduce((n, c) => n + c.metrics.drawCount, 0), before);
    m.doc.hidden = false; m.fire('visibilitychange'); m.run(1000);
    assert.ok((m.handle.inspect().cards as any[]).reduce((n, c) => n + c.metrics.drawCount, 0) - before >= 6 * 10);
  });
});

test('cards that disappear are disposed (canvas freed, DOM removed, subscription dropped) and new ones appear in order', async () => {
  let current = mixedAll(6);
  const m = await mountFake(() => current, { clientWidth: 1600 });
  try {
    m.run(300);
    const roots = m.sceneRoots();
    const sub = m.handle.inspect().scheduler.subscribers;
    current = { ...current, projects: current.projects.slice(0, 4) };
    m.run(300);
    assert.equal(m.holders().length, 4);
    assert.equal(m.handle.inspect().scheduler.subscribers, sub - 2);
    const gone = roots.filter((r: any) => r.removed);
    assert.equal(gone.length, 2);
    for (const r of gone) assert.deepEqual([r.children[1].width, r.children[1].height], [0, 0]);
    current = mixedAll(6);
    m.run(300);
    assert.equal(m.holders().length, 6);
    expectedPlacement(current, 1600).placed.forEach((p, i) => assert.ok(Math.abs(geometry(m.holders()[i]).top - p.top) < 1e-6));
  } finally { m.handle.dispose(); m.restore(); }
});

test('project scope stays a single column: one card, capped at 480px, no absolute masonry placement', async () => {
  await withAll(snap([group(6)], { workspaceName: 'ws' } as any), 1600, m => {
    assert.equal(m.holders().length, 1);
    const css = String(m.holders()[0].style.cssText);
    assert.ok(!css.includes('position:absolute') && css.includes('max-width:480px'), css);
    assert.ok(Math.abs(m.holders()[0].clientWidth - 480) < 1e-6);
    assert.equal(m.handle.inspect().placements, undefined, 'no masonry bookkeeping outside scope all');
  });
});

test('scope all with a single room (or empty rooms skipped): one card, columns never exceed the number of cards', async () => {
  const s = projectsOf([{ name: 'only', offices: [solo('s', {}), { id: 'empty', kind: 'group', manager: null, members: [] } as any] }]);
  await withAll(s, 2000, m => { assert.equal(m.holders().length, 1); assert.equal(expectedPlacement(s, 2000).columns, 1); });
});

// ───────── VQA-039: 410~430px 화면에서도 카드가 410px 이상, 명판 말줄임 0 ─────────
const fullNames = ['plugin#FDF9', 'search#64CA', 'scene#3C71', 'art#94A2', 'review#A1C2', 'infra#55E3', 'qa#0499', 'mobile#E27D'];
function n16All() {
  const o: any = group(16, 'big');
  o.members.forEach((m: any, i: number) => { m.name = fullNames[i % fullNames.length]; });
  return snapAll([{ name: 'delta', offices: [o] }]);
}

test('VQA-039: the outer margin is min(16, (width - 410) / 2) from 410px up, so a one-column card never drops below 410px', () => {
  assert.equal(paddingFor(410), 0);
  assert.equal(paddingFor(420), 5);
  assert.equal(paddingFor(426), 8);
  assert.equal(paddingFor(442), 16);
  assert.equal(paddingFor(1200), 16);
  for (let w = 410; w <= 440; w++) assert.ok(cardWidthFor(w, 1) >= 410 - 1e-9, `${w}px: card ${cardWidthFor(w, 1)}`);
  assert.equal(cardWidthFor(400, 1), 368, 'below 410 the old margin still applies');
});

for (const width of [410, 415, 420, 425, 430, 442, 480]) {
  test(`VQA-039 (${width}px screen): scope all one-column card is at least 410px wide, centered inside the margin, and no plate name is ellipsized (N16)`, async () => {
    const s = n16All();
    await withAll(s, width, m => {
      const holders = m.holders();
      assert.equal(holders.length, 1);
      const g = geometry(holders[0]);
      const padding = paddingFor(width);
      assert.ok(g.width >= 410 - 1e-6, `${width}px: card ${g.width}px`);
      assert.ok(Math.abs(g.width - Math.min(MAX, width - 2 * padding)) < 1e-6, `${width}px: card = width - 2 * margin`);
      assert.ok(g.left >= padding - 1e-6 && g.left + g.width <= width - padding + 1e-6, `${width}px: card stays inside the margins (${g.left}..${g.left + g.width})`);
      assert.ok(g.left >= -1e-6 && g.left + g.width <= width + 1e-6, 'never wider than the screen');
      // 같은 카드 폭으로 그린 N16 명판은 일반 이름을 말줄임 없이 전부 보여 준다.
      const o = s.projects[0].offices[0];
      const t = trace(snap([o]), { width: g.width });
      for (const text of t.texts) assert.ok(!text.text.includes('…'), `${width}px (card ${g.width}px): "${text.text}" is ellipsized`);
      for (const name of [...fullNames, 'Orchestrator']) assert.ok(t.texts.some(x => x.text === name), `${width}px: ${name} shown in full`);
    });
  });
}

test('VQA-039: the margin shrinks smoothly (it is not a step): 410 → 0, 426 → 8, 442 → 16', async () => {
  const lefts: number[] = [];
  for (const width of [410, 426, 442]) await withAll(n16All(), width, m => lefts.push(geometry(m.holders()[0]).left));
  assert.deepEqual(lefts.map(v => Math.round(v * 1000) / 1000), [0, 8, 16]);
});

// ───────── VQA-038: 필터 결과에 새로 들어온 카드는 첫 표시 프레임부터 그려져 있다 ─────────
const barButton = (m: any, f: string) => m.parent.children.find((c: any) => c.className === 'office-filter-bar').children.find((b: any) => b.dataset.filter === f);

/** 화면 안(미리 그리기 구간 안)에 있는 카드의 canvas가 폭 0이면 빈 카드 프레임이다. */
const blankCards = (m: any) => m.sceneRoots().filter((r: any) => r.children[1].width === 0 || r.children[1].height === 0).length;

function filterScenario() {
  const mk = (id: string, ...states: [string, boolean?][]) => { const o: any = group(Math.max(states.length - 1, 1), id); [o.manager, ...o.members].forEach((a: any, i: number) => { a.state = states[i]?.[0] ?? 'away'; a.needsAttention = !!states[i]?.[1]; }); return o; };
  const make = (overrides: Record<string, string> = {}) => snapAll([
    { name: 'alpha', offices: [mk('a0', [overrides.a0 ?? 'working'], ['away']), mk('a1', [overrides.a1 ?? 'away'], ['away'])] },
    { name: 'beta', offices: [mk('b0', [overrides.b0 ?? 'away'], ['phone']), mk('b1', [overrides.b1 ?? 'working'], ['away'])] },
  ]);
  return make;
}

test('VQA-038: cards that enter the filter result are painted before their first visible frame (zero blank-canvas frames)', async () => {
  const make = filterScenario();
  let current = make();
  const m = await mountFake(() => current, { clientWidth: 1200 });
  try {
    await m.runPaint(300);
    barButton(m, 'working').onclick();               // Working: a0, b1
    await m.runPaint(300);
    assert.equal(m.holders().length, 2);
    let blankFrames = 0, frames = 0;
    m.onPaint(() => { frames++; blankFrames += blankCards(m) > 0 ? 1 : 0; });
    // 1) 스냅샷이 바뀌어 a1, b0이 Working에 들어온다(rAF 안에서 카드가 생긴다).
    current = make({ a1: 'working', b0: 'working' });
    await m.runPaint(1000);
    assert.equal(m.holders().length, 4, 'two cards entered');
    // 2) 필터 버튼 클릭으로 카드가 한꺼번에 들어온다. 클릭 핸들러가 끝난 직후(마이크로태스크 처리 뒤, 화면을 칠하기 전)에 이미 그려져 있다.
    for (const f of ['all', 'idle', 'working']) {
      barButton(m, f).onclick();
      await m.flush();
      assert.equal(blankCards(m), 0, `${f}: no blank card at the first paint after the click`);
    }
    await m.runPaint(1000);
    assert.ok(frames >= 10, `observed ${frames} frames`);
    assert.equal(blankFrames, 0, 'no frame showed a blank card');
  } finally { m.handle.dispose(); m.restore(); }
});

test('VQA-038: every newly mounted card is drawn at once, including the case where several cards enter in the same refresh', async () => {
  const make = filterScenario();
  let current = make({ a0: 'away', b1: 'away' });   // Working 결과가 비어 있다
  const m = await mountFake(() => current, { clientWidth: 1600 });
  try {
    await m.runPaint(300);
    barButton(m, 'working').onclick();
    await m.runPaint(300);
    assert.equal(m.holders().length, 0, 'empty result: nothing mounted');
    let blankFrames = 0;
    m.onPaint(() => { blankFrames += blankCards(m) > 0 ? 1 : 0; });
    current = make({ a0: 'working', a1: 'working', b0: 'working', b1: 'working' });
    await m.runPaint(100);
    assert.equal(m.holders().length, 4, 'all four entered in one refresh');
    for (const r of m.sceneRoots()) assert.ok(r.children[1].width > 0 && r.children[1].height > 0, 'canvas has a backing store');
    await m.runPaint(1000);
    assert.equal(blankFrames, 0);
  } finally { m.handle.dispose(); m.restore(); }
});

test('VQA-038: a new card whose canvas stays at 0x0 would be caught: the blank-card detector sees a card that is mounted but not yet drawn', async () => {
  const m = await mountFake(snapAll([{ name: 'a', offices: [group(3, 'a0')] }]), { clientWidth: 1200 });
  try {
    m.run(300);
    const root = m.sceneRoots()[0];
    const saved = [root.children[1].width, root.children[1].height];
    root.children[1].width = 0; root.children[1].height = 0;
    assert.equal(blankCards(m), 1, 'detector flags a 0x0 canvas');
    [root.children[1].width, root.children[1].height] = saved;
    assert.equal(blankCards(m), 0);
  } finally { m.handle.dispose(); m.restore(); }
});
