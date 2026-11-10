import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agent, snap, snapAll, solo, group } from './helpers/scene.ts'; // resolve 훅(확장자 없는 import)을 먼저 등록한다.

// attention.ts는 확장자 없는 './ids'를 가져오므로 resolve 훅이 등록된 뒤 동적으로 불러온다.
const { attentionCount, sidebarTarget } = await import('../../client/attention.ts');
const { ALL_OFFICES_SCREEN_ID } = await import('../../client/ids.ts');
const { parseOfficeFilter } = await import('../../client/scene/core/officeFilter.ts');

const ask = { needsAttention: true };

test('attentionCount: sums across projects and offices', () => {
  const s = snapAll([
    { name: 'a', offices: [{ ...group(2, 'g1'), members: [agent('m1', 'M1', ask), agent('m2', 'M2')] }, solo('s1', ask)] },
    { name: 'b', offices: [{ ...group(1, 'g2'), members: [agent('m3', 'M3', ask)] }] },
  ]);
  assert.equal(attentionCount(s), 3);
});

test('attentionCount: counts a manager that needs attention', () => {
  const o = { ...group(1, 'g'), manager: agent('lead', 'Lead', ask), members: [agent('m', 'M')] };
  assert.equal(attentionCount(snap([o])), 1);
});

test('attentionCount: solo office (manager null)', () => {
  assert.equal(attentionCount(snap([solo('s', ask)])), 1);
  assert.equal(attentionCount(snap([solo('s')])), 0);
});

test('attentionCount: 0 when nobody waits, no offices, or no snapshot', () => {
  assert.equal(attentionCount(snap([group(2, 'g')])), 0);
  assert.equal(attentionCount(snap([])), 0);
  assert.equal(attentionCount(null), 0);
});

test('sidebarTarget: count > 0 opens All Offices with the awaiting filter', () => {
  for (const n of [1, 5]) {
    const t = sidebarTarget(n);
    assert.equal(t.screenId, ALL_OFFICES_SCREEN_ID);
    assert.equal(t.params?.filter, 'awaiting');
  }
});

test('sidebarTarget: count 0 opens All Offices without a params key', () => {
  const t = sidebarTarget(0);
  assert.equal(t.screenId, ALL_OFFICES_SCREEN_ID);
  assert.equal('params' in t, false);
});

test('parseOfficeFilter: valid values pass through, anything else becomes all', () => {
  for (const f of ['all', 'working', 'awaiting', 'idle']) assert.equal(parseOfficeFilter(f), f);
  for (const v of ['bogus', undefined, '', 0, 1, null, {}]) assert.equal(parseOfficeFilter(v), 'all', String(v));
});

test('OfficeSidebarItem uses the shared attention helpers instead of its own', () => {
  const src = readFileSync(new URL('../../client/OfficeSidebarItem.tsx', import.meta.url), 'utf8');
  assert.match(src, /import\s*\{[^}]*\battentionCount\b[^}]*\}\s*from\s*["']\.\/attention["']/);
  assert.match(src, /import\s*\{[^}]*\bsidebarTarget\b[^}]*\}\s*from\s*["']\.\/attention["']/);
  assert.match(src, /openScreen\(sidebarTarget\(/);
  assert.doesNotMatch(src, /function\s+attentionCount\b/);
  assert.doesNotMatch(src, /(const|let)\s+attentionCount\b/);
});
