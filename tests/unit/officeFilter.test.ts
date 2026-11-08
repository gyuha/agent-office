import test from 'node:test';
import assert from 'node:assert/strict';
import { agent, snap, snapAll, type State } from './helpers/scene.ts'; // resolve 훅(확장자 없는 import)을 먼저 등록한다.
import { officeMatches, countOffices, filterSnapshot, type OfficeFilter } from '../../client/scene/core/officeFilter.ts';

const FILTERS: OfficeFilter[] = ['all', 'working', 'awaiting', 'idle'];

type Spec = { state: State; attention?: boolean };
let counter = 0;
/** 에이전트 상태 목록으로 오피스를 만든다. 첫 항목이 manager, `manager: null`이면 모두 구성원(solo는 1명). */
function office(manager: Spec | null, ...members: Spec[]) {
  const id = `o${counter++}`;
  const make = (s: Spec, name: string, i: number) => agent(`${id}-${i}`, name, { state: s.state, needsAttention: s.attention ?? false });
  return { id, kind: manager ? ('group' as const) : ('solo' as const), manager: manager ? make(manager, 'Orchestrator', 0) : null, members: members.map((m, i) => make(m, `Agent ${i + 1}`, i + 1)) };
}
const W: Spec = { state: 'working' };            // 작업중
const Q: Spec = { state: 'working', attention: true }; // 질문 대기(state는 working으로 유지된다)
const A: Spec = { state: 'away' };
const P: Spec = { state: 'phone' };
const S: Spec = { state: 'sleeping' };

const matches = (o: any) => Object.fromEntries(FILTERS.map(f => [f, officeMatches(o, f)])) as Record<OfficeFilter, boolean>;

// ───────── 판정 규칙 ─────────
test('all: every office matches, whatever its agents do', () => {
  for (const o of [office(W, W), office(Q, A), office(S, P, A), office(null, S), office(null, Q)]) assert.equal(officeMatches(o, 'all'), true);
});

test('working: some agent is working and not waiting for an answer', () => {
  assert.deepEqual(matches(office(W, A, S)), { all: true, working: true, awaiting: false, idle: false }, 'the manager works');
  assert.deepEqual(matches(office(A, A, W)), { all: true, working: true, awaiting: false, idle: false }, 'a member works');
  assert.deepEqual(matches(office(W, W, W)), { all: true, working: true, awaiting: false, idle: false }, 'everybody works');
});

test('awaiting: some agent needs attention (a question or a permission), wherever it sits', () => {
  assert.equal(officeMatches(office(Q, A, S), 'awaiting'), true, 'the manager asks');
  assert.equal(officeMatches(office(A, A, Q), 'awaiting'), true, 'a member asks');
  assert.equal(officeMatches(office(Q, Q, Q), 'awaiting'), true, 'everybody asks');
});

test('idle: nobody is working and nobody is waiting (away, phone and sleeping only)', () => {
  assert.deepEqual(matches(office(A, P, S)), { all: true, working: false, awaiting: false, idle: true });
  assert.deepEqual(matches(office(S, S, S)), { all: true, working: false, awaiting: false, idle: true });
  assert.deepEqual(matches(office(P, A)), { all: true, working: false, awaiting: false, idle: true });
  assert.deepEqual(matches(office(A)), { all: true, working: false, awaiting: false, idle: true }, 'a manager alone');
});

test('needsAttention is the awaiting flag whatever the state says; an away agent is never "working"', () => {
  // 계약상 needsAttention은 working을 유지한 채 켜지지만, 판정은 플래그만 본다.
  const odd = office(A, { state: 'away', attention: true });
  assert.equal(officeMatches(odd, 'awaiting'), true);
  assert.equal(officeMatches(odd, 'idle'), false);
  assert.equal(officeMatches(odd, 'working'), false, 'an away agent is not working');
});

test('an office can be both working and awaiting (one agent works while another asks)', () => {
  const o = office(W, Q, A);
  assert.deepEqual(matches(o), { all: true, working: true, awaiting: true, idle: false });
  const split = office(Q, W);
  assert.deepEqual(matches(split), { all: true, working: true, awaiting: true, idle: false }, 'order does not matter');
});

test('an agent that is working AND waiting counts as awaiting only: it is not "working" for the Working filter', () => {
  assert.deepEqual(matches(office(Q)), { all: true, working: false, awaiting: true, idle: false });
  assert.deepEqual(matches(office(Q, Q, Q)), { all: true, working: false, awaiting: true, idle: false });
});

test('idle never overlaps working or awaiting', () => {
  const samples = [office(W), office(Q), office(A), office(S, P), office(W, Q, A, S, P), office(null, W), office(null, Q), office(null, S), office(A, A, A, Q), office(P, W)];
  for (const o of samples) {
    const m = matches(o);
    if (m.idle) assert.ok(!m.working && !m.awaiting, JSON.stringify(m));
    assert.ok(m.working || m.awaiting || m.idle, 'every office falls into at least one of the three states');
  }
});

test('an office whose only active agent waits for an answer (the rest rest) is awaiting only: not working, not idle', () => {
  for (const o of [office(A, Q, S, P), office(Q, A, A), office(S, S, Q), office(null, Q)]) {
    assert.deepEqual(matches(o), { all: true, working: false, awaiting: true, idle: false }, JSON.stringify(o.members.map(m => [m.state, m.needsAttention])));
  }
});

test('solo offices (manager null) follow the same rules', () => {
  assert.deepEqual(matches(office(null, W)), { all: true, working: true, awaiting: false, idle: false });
  assert.deepEqual(matches(office(null, Q)), { all: true, working: false, awaiting: true, idle: false });
  for (const spec of [A, P, S]) assert.deepEqual(matches(office(null, spec)), { all: true, working: false, awaiting: false, idle: true }, spec.state);
});

test('the manager counts as an agent of the office, with or without members', () => {
  assert.equal(officeMatches(office(W), 'working'), true, 'working manager alone');
  assert.equal(officeMatches(office(Q), 'awaiting'), true, 'asking manager alone');
  assert.equal(officeMatches(office(S, W), 'idle'), false, 'a working member keeps the office out of Idle');
  assert.equal(officeMatches(office(W, S, S), 'idle'), false, 'a working manager keeps the office out of Idle');
});

test('officeMatches does not modify the office', () => {
  const o = office(W, Q, A);
  const before = JSON.stringify(o);
  for (const f of FILTERS) officeMatches(o, f);
  assert.equal(JSON.stringify(o), before);
});

// ───────── 개수 ─────────
/** scope all, 프로젝트 3개, 오피스 8개. */
function mixed() {
  return snapAll([
    { name: 'alpha', offices: [office(W, A), office(Q, W), office(null, S)] },       // working, working+awaiting, idle
    { name: 'beta', offices: [office(A, P, S), office(null, W)] },                     // idle, working
    { name: 'gamma', offices: [office(null, Q), office(S, S), office(Q, A, A)] },      // awaiting, idle, awaiting
  ]);
}

test('countOffices: each filter count equals the number of matching offices (scope all, several projects)', () => {
  const s = mixed();
  assert.deepEqual(countOffices(s), { all: 8, working: 3, awaiting: 3, idle: 3 });
  const offices = s.projects.flatMap(p => p.offices);
  for (const f of FILTERS) assert.equal(countOffices(s)[f], offices.filter(o => officeMatches(o, f)).length, f);
});

test('countOffices: the counts of a working+awaiting office land in both buckets, so Working + Awaiting + Idle can exceed All', () => {
  const s = snap([office(W, Q, A)]);
  assert.deepEqual(countOffices(s), { all: 1, working: 1, awaiting: 1, idle: 0 });
  const t = snapAll([{ name: 'p', offices: [office(W, Q), office(A), office(W)] }]);
  const c = countOffices(t);
  assert.deepEqual(c, { all: 3, working: 2, awaiting: 1, idle: 1 });
  assert.ok(c.working + c.awaiting + c.idle > c.all);
});

test('countOffices: project scope (one project), solo offices, and an empty snapshot', () => {
  assert.deepEqual(countOffices(snap([office(null, W), office(null, Q), office(null, A)])), { all: 3, working: 1, awaiting: 1, idle: 1 });
  assert.deepEqual(countOffices(snap([])), { all: 0, working: 0, awaiting: 0, idle: 0 });
  assert.deepEqual(countOffices(snapAll([])), { all: 0, working: 0, awaiting: 0, idle: 0 });
});

test('countOffices counts offices, not agents', () => {
  const s = snap([office(W, W, W, W, W)]);
  assert.deepEqual(countOffices(s), { all: 1, working: 1, awaiting: 0, idle: 0 });
});

test('countOffices returns exactly the four filter keys and does not modify the snapshot', () => {
  const s = mixed(), before = JSON.stringify(s);
  assert.deepEqual(Object.keys(countOffices(s)).sort(), [...FILTERS].sort());
  assert.equal(JSON.stringify(s), before);
});

// ───────── 스냅샷 거르기 ─────────
const ids = (s: any) => s.projects.map((p: any) => [p.projectName, p.offices.map((o: any) => o.id)]);

test('filterSnapshot("all") returns the same content', () => {
  const s = mixed();
  assert.deepEqual(filterSnapshot(s, 'all'), s);
});

test('filterSnapshot drops offices that do not match and keeps the order of the rest', () => {
  const s = mixed();
  const all = s.projects.flatMap(p => p.offices);
  for (const f of ['working', 'awaiting', 'idle'] as const) {
    const out = filterSnapshot(s, f);
    const want = all.filter(o => officeMatches(o, f)).map(o => o.id);
    assert.deepEqual(out.projects.flatMap(p => p.offices.map(o => o.id)), want, f);
    assert.equal(out.projects.flatMap(p => p.offices).length, countOffices(s)[f], `${f}: kept offices = the count`);
  }
});

test('filterSnapshot removes projects that end up with no offices, and keeps the project order', () => {
  const s = mixed();
  const working = filterSnapshot(s, 'working');
  assert.deepEqual(working.projects.map(p => p.projectName), ['alpha', 'beta'], 'gamma has no working office');
  const awaiting = filterSnapshot(s, 'awaiting');
  assert.deepEqual(awaiting.projects.map(p => p.projectName), ['alpha', 'gamma'], 'beta has no awaiting office');
  const idle = filterSnapshot(s, 'idle');
  assert.deepEqual(idle.projects.map(p => p.projectName), ['alpha', 'beta', 'gamma']);
  assert.ok(working.projects.every(p => p.offices.length > 0));
  const none = filterSnapshot(snapAll([{ name: 'p', offices: [office(A), office(S)] }]), 'working');
  assert.deepEqual(none.projects, [], 'no match at all: no project is left');
});

test('filterSnapshot keeps every other field and every kept project/office as it was', () => {
  const s: any = { ...mixed(), workspaceName: 'ws', generatedAt: 12345 };
  const out: any = filterSnapshot(s, 'awaiting');
  assert.equal(out.scope, 'all');
  assert.equal(out.workspaceName, 'ws');
  assert.equal(out.generatedAt, 12345);
  for (const p of out.projects) {
    const src = s.projects.find((x: any) => x.projectId === p.projectId);
    assert.equal(p.projectName, src.projectName);
    for (const o of p.offices) assert.deepEqual(o, src.offices.find((x: any) => x.id === o.id), 'offices pass through unchanged');
  }
  const project = filterSnapshot({ ...snap([office(W), office(A)]), workspaceName: 'only' } as any, 'idle');
  assert.equal(project.scope, 'project');
  assert.equal((project as any).workspaceName, 'only');
});

test('filterSnapshot does not modify its input', () => {
  const s = mixed(), before = JSON.stringify(s);
  for (const f of FILTERS) filterSnapshot(s, f);
  assert.equal(JSON.stringify(s), before);
});

test('filterSnapshot on project scope and on an empty snapshot', () => {
  const s = snap([office(W), office(A), office(null, Q), office(null, S)]);
  assert.deepEqual(filterSnapshot(s, 'working').projects[0].offices.map(o => o.id), [s.projects[0].offices[0].id]);
  assert.deepEqual(filterSnapshot(s, 'idle').projects[0].offices.map(o => o.id), [s.projects[0].offices[1].id, s.projects[0].offices[3].id]);
  assert.deepEqual(filterSnapshot(snap([]), 'working').projects, []);
  assert.deepEqual(filterSnapshot(snapAll([]), 'idle').projects, []);
});

test('filtering follows the snapshot: an office that changes state moves between filters on the next snapshot (no grace period)', () => {
  const resting = snapAll([{ name: 'p', offices: [office(A, A)] }]);
  assert.deepEqual(ids(filterSnapshot(resting, 'idle')).length, 1);
  assert.deepEqual(filterSnapshot(resting, 'working').projects, []);
  const woke = JSON.parse(JSON.stringify(resting));
  woke.projects[0].offices[0].members[0].state = 'working';
  assert.deepEqual(filterSnapshot(woke, 'idle').projects, [], 'leaves Idle at once');
  assert.equal(filterSnapshot(woke, 'working').projects[0].offices.length, 1, 'enters Working at once');
  const asks = JSON.parse(JSON.stringify(woke));
  asks.projects[0].offices[0].members[0].needsAttention = true;
  assert.deepEqual(filterSnapshot(asks, 'working').projects, [], 'a waiting agent no longer counts as working');
  assert.equal(filterSnapshot(asks, 'awaiting').projects[0].offices.length, 1);
});

test('the filtered counts always agree with the filtered snapshot, for every filter and several snapshot shapes', () => {
  const shapes = [mixed(), snap([office(W), office(Q, A), office(null, S)]), snapAll([]), snapAll([{ name: 'solo', offices: [office(null, W)] }])];
  for (const s of shapes) {
    const counts = countOffices(s);
    for (const f of FILTERS) assert.equal(filterSnapshot(s, f).projects.reduce((n, p) => n + p.offices.length, 0), counts[f], f);
  }
});
