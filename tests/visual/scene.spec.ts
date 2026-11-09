import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { buildVisualHarness } from "./harness/build-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessUrl = `file://${path.join(__dirname, "harness/index.html")}`;

test.beforeAll(() => {
  buildVisualHarness();
});

type State = "working" | "away" | "phone" | "sleeping";
const STATES: State[] = ["working", "away", "phone", "sleeping"];
const agent = (id: string, name: string, state: State, extra: Record<string, unknown> = {}) => ({
  id, name, provider: "claude", state, stateSince: 0, needsAttention: false, ...extra,
});
const solo = (state: State, extra: Record<string, unknown> = {}) => ({
  id: "s", kind: "solo" as const, manager: null, members: [agent("s", "Agent Solo", state, extra)],
});
const group = (members: number, state?: State) => ({
  id: "g", kind: "group" as const, manager: agent("g-lead", "Orchestrator", state ?? "working"),
  members: Array.from({ length: members }, (_, i) => agent(`g${i}`, `Agent ${i}`, state ?? STATES[i % 4])),
});
const snapshot = (offices: unknown[], extra: Record<string, unknown> = {}) => ({
  scope: "project", generatedAt: 0, workspaceName: "Visual QA", projects: [{ projectId: "p", projectName: "Studio", offices }], ...extra,
});
const allProjects = () => ({
  scope: "all", generatedAt: 0, projects: [
    { projectId: "a", projectName: "alpha", offices: [group(3), solo("working")] },
    { projectId: "b", projectName: "beta", offices: [group(6)] },
  ],
});

async function open(page: Page) {
  await page.goto(harnessUrl);
  await page.evaluate(() => (window as any).__harness.spritesReady);
}

/** 주입한 시간만으로 한 프레임을 그린다. steps는 core.step의 dt 목록, epoch는 flame 판정 시각. */
async function render(page: Page, input: { snapshot: unknown; steps?: { dtMs: number; snapshot?: unknown }[]; timeMs?: number; epoch?: number; scale?: number }) {
  return page.evaluate((i) => (window as any).__harness.stepAndRender(i), input as any);
}
const forMs = (ms: number) => Array.from({ length: Math.round(ms / 100) }, () => ({ dtMs: 100 }));
const shot = (page: Page, name: string) => expect(page.locator("canvas")).toHaveScreenshot(`${name}.png`);

test("rendering the same input twice is pixel-identical (time is fully injected)", async ({ page }) => {
  await open(page);
  const input = { snapshot: snapshot([group(5)]), steps: forMs(3000), epoch: 1000 };
  await render(page, input);
  const a = await page.evaluate(() => (window as any).__harness.saveBuffer());
  await render(page, input);
  const b = await page.evaluate(() => (window as any).__harness.saveBuffer());
  expect(await page.evaluate(([x, y]) => (window as any).__harness.diffSavedBuffers(x, y), [a, b])).toBe(0);
});

// 상태별 기준 스크린샷. 솔로 오피스(작은 방)라 에이전트 하나의 자세가 또렷하게 보인다.
const cases: { name: string; office: () => unknown; steps: number; epoch?: number }[] = [
  { name: "working", office: () => solo("working"), steps: 500 },
  { name: "away-on-beanbag", office: () => solo("away"), steps: 30_000 },
  { name: "phone", office: () => solo("phone"), steps: 500 },
  { name: "sleeping", office: () => solo("sleeping"), steps: 500 },
  { name: "attention", office: () => solo("working", { needsAttention: true }), steps: 500 },
  // stateSince=0, epoch=90s → working 60초 초과로 flame_aura
  { name: "flame", office: () => solo("working"), steps: 500, epoch: 90_000 },
];

for (const c of cases) {
  test(`state baseline: ${c.name}`, async ({ page }) => {
    await open(page);
    await render(page, { snapshot: snapshot([c.office()]), steps: forMs(c.steps), epoch: c.epoch ?? 1000, timeMs: 0 });
    await shot(page, `state-${c.name}`);
  });
}

test("flame appears only after 60s of working", async ({ page }) => {
  await open(page);
  const input = { snapshot: snapshot([solo("working", { stateSince: 1000 })]), steps: forMs(500) };
  await render(page, { ...input, epoch: 1000 + 59_000 });
  const before = await page.evaluate(() => (window as any).__harness.saveBuffer());
  await render(page, { ...input, epoch: 1000 + 60_000 });
  const after = await page.evaluate(() => (window as any).__harness.saveBuffer());
  expect(await page.evaluate(([x, y]) => (window as any).__harness.diffSavedBuffers(x, y), [before, after])).toBeGreaterThan(0);
});

test("multi-frame sheets animate with time (skipped until art ships second-stage sheets)", async ({ page }) => {
  await open(page);
  const frames = await page.evaluate(() => {
    const data = (window as any).__harness.core.assetData;
    return { working: data["actor-0-working"].frames, phone: data["actor-0-phone"].frames, sleeping: data["actor-0-sleeping"].frames };
  });
  const animated = (Object.keys(frames) as (keyof typeof frames)[]).filter((k) => frames[k] > 1);
  test.skip(animated.length === 0, `embedded sheets have 1 frame (${JSON.stringify(frames)}); regenerate with npm run sprites after art updates`);
  for (const state of animated) {
    const snap = snapshot([solo(state as State)]);
    await render(page, { snapshot: snap, steps: forMs(500), epoch: 1000 });
    const a = await page.evaluate(() => (window as any).__harness.saveBuffer());
    await render(page, { snapshot: snap, steps: forMs(1000), epoch: 1000 });
    const b = await page.evaluate(() => (window as any).__harness.saveBuffer());
    expect(await page.evaluate(([x, y]) => (window as any).__harness.diffSavedBuffers(x, y), [a, b]), state).toBeGreaterThan(0);
  }
});

test("a repeated 2s poll of the same state does not change a single pixel's animation phase relative to continuous stepping", async ({ page }) => {
  await open(page);
  const snap = snapshot([group(4, "phone")]);
  await render(page, { snapshot: snap, steps: forMs(4000), epoch: 1000 });
  const continuous = await page.evaluate(() => (window as any).__harness.saveBuffer());
  const polls = [{ dtMs: 2000, snapshot: JSON.parse(JSON.stringify(snap)) }, { dtMs: 2000, snapshot: JSON.parse(JSON.stringify(snap)) }];
  await render(page, { snapshot: snap, steps: polls, epoch: 1000 });
  const polled = await page.evaluate(() => (window as any).__harness.saveBuffer());
  expect(await page.evaluate(([x, y]) => (window as any).__harness.diffSavedBuffers(x, y), [continuous, polled])).toBe(0);
});

const layouts: { name: string; snap: () => unknown }[] = [
  { name: "solo", snap: () => snapshot([solo("working")]) },
  { name: "n3", snap: () => snapshot([group(3)]) },
  { name: "n6", snap: () => snapshot([group(6)]) },
  { name: "n10", snap: () => snapshot([group(10)]) },
  { name: "n16", snap: () => snapshot([group(16)]) },
  { name: "all", snap: () => allProjects() },
  { name: "empty", snap: () => snapshot([]) },
];

for (const l of layouts) {
  test(`layout baseline: ${l.name}`, async ({ page }) => {
    await open(page);
    await render(page, { snapshot: l.snap(), steps: forMs(300), epoch: 1000 });
    await shot(page, `layout-${l.name}`);
  });
}

test("away agents walk to their beanbags and back (position-only check, no baseline)", async ({ page }) => {
  await open(page);
  const r = await render(page, { snapshot: snapshot([group(3, "away")]), steps: forMs(30_000), epoch: 1000 });
  const resting = Object.values<any>(r.actors).filter((a) => a.destination === "beanbag");
  expect(resting).toHaveLength(4); // 관리자 전용 빈백 + 구성원 3
  expect(resting.every((a) => !a.moving)).toBe(true);
  const back = await render(page, { snapshot: snapshot([group(3, "working")]), steps: forMs(30_000), initialActors: r.actors, epoch: 1000 });
  expect(Object.values<any>(back.actors).every((a) => a.destination !== "beanbag" && !a.moving)).toBe(true);
});

// ───────── 실제 마운트 경로(mountOfficeScene): canvas + DOM 상단바 + 명판, setTime으로 시간 고정 ─────────
const mountUrl = `file://${path.join(__dirname, "harness/mount.html")}`;
type Mount = { open(i: unknown): Promise<boolean>; setTime(ms: number, epoch: number): Promise<void>; selected(): string[]; headers(): { noWorkspace: boolean; cells: string[][] }[]; plates(): string[] };

async function openMount(page: Page, snap: unknown, width = 1200, ms = 3500, epoch = 1000) {
  await page.goto(mountUrl);
  await page.evaluate(([snapshot, w]) => (window as any).mount.open({ snapshot, width: w }), [snap, width] as const);
  await page.evaluate(([t, e]) => (window as any).mount.setTime(t, e), [ms, epoch] as const);
}
const mountShot = (page: Page, name: string) => expect(page.locator(".office-scene")).toHaveScreenshot(`mount-${name}.png`);
void (null as unknown as Mount);

const mountedStates: { name: string; snap: () => unknown; ms: number; epoch: number }[] = [
  { name: "working", snap: () => snapshot([solo("working")]), ms: 3500, epoch: 1000 },
  { name: "away", snap: () => snapshot([solo("away")]), ms: 20_000, epoch: 1000 },
  { name: "phone", snap: () => snapshot([solo("phone")]), ms: 3500, epoch: 1000 },
  { name: "sleeping", snap: () => snapshot([solo("sleeping")]), ms: 3500, epoch: 1000 },
  { name: "attention", snap: () => snapshot([solo("working", { needsAttention: true })]), ms: 3500, epoch: 1000 },
  { name: "flame", snap: () => snapshot([solo("working")]), ms: 3500, epoch: 90_000 },
];
for (const c of mountedStates) {
  test(`mounted state baseline: ${c.name}`, async ({ page }) => {
    await openMount(page, c.snap(), 1200, c.ms, c.epoch);
    await mountShot(page, `state-${c.name}`);
  });
}

test("mounted layouts: group with workspace, group without workspace, scope all, narrow width", async ({ page }) => {
  await openMount(page, snapshot([group(6)]));
  await mountShot(page, "group-n6-workspace");
  await openMount(page, snapshot([group(6)], { workspaceName: null }));
  await mountShot(page, "group-n6-no-workspace");
  await openMount(page, allProjects());
  await expect(page.locator(".office-collection")).toHaveScreenshot("mount-all.png"); // scope all은 카드 여러 장(masonry)이라 컬렉션 전체를 찍는다
  await openMount(page, snapshot([group(3)]), 360);
  await mountShot(page, "n3-narrow");
});

test("mounted top bar shows project / workspace / agent and hides workspace when null", async ({ page }) => {
  await openMount(page, snapshot([group(3)]));
  expect(await page.evaluate(() => (window as any).mount.headers())).toEqual([
    { noWorkspace: false, cells: [["PROJECT", "Studio"], ["WORKSPACE", "Visual QA"], ["AGENT", "Orchestrator"]] },
  ]);
  await openMount(page, snapshot([solo("working")], { workspaceName: null }));
  expect(await page.evaluate(() => (window as any).mount.headers())).toEqual([
    { noWorkspace: true, cells: [["PROJECT", "Studio"], ["AGENT", "Agent Solo"]] },
  ]);
});

test("mounted nameplates are canvas-drawn: no DOM buttons, and clicking a plate on the canvas selects that agent", async ({ page }) => {
  await openMount(page, snapshot([group(3)]));
  expect(await page.evaluate(() => (window as any).mount.domPlates())).toBe(0);
  for (const id of ["g-lead", "g0", "g1", "g2"]) {
    const p = await page.evaluate((i) => (window as any).mount.plateCenter(i), id);
    await page.mouse.click(p.x, p.y);
  }
  expect(await page.evaluate(() => (window as any).mount.selected())).toEqual(["g-lead", "g0", "g1", "g2"]);
});

test("mounted 410px panel: plates stay inside the scene and clickable, WORKSPACE wraps to two lines", async ({ page }) => {
  await openMount(page, snapshot([group(3)], { workspaceName: "Greeting with no task specified" }), 410);
  expect(await page.evaluate(() => (window as any).mount.workspaceLines())).toBe(2);
  const p = await page.evaluate(() => (window as any).mount.plateCenter("g1"));
  await page.mouse.click(p.x, p.y);
  expect(await page.evaluate(() => (window as any).mount.selected())).toEqual(["g1"]);
  await mountShot(page, "n3-410");
  await openMount(page, snapshot([group(10)], { workspaceName: "Greeting with no task specified" }), 410);
  await mountShot(page, "n10-410");
});

test("setTime is a pure seek: the same time renders the same pixels, also after seeking backwards", async ({ page }) => {
  await openMount(page, snapshot([group(4)]), 1200, 5000, 90_000);
  const first = await page.locator(".office-scene").screenshot();
  await page.evaluate(() => (window as any).mount.setTime(500, 90_000));
  await page.evaluate(() => (window as any).mount.setTime(5000, 90_000));
  const again = await page.locator(".office-scene").screenshot();
  expect(again.equals(first)).toBe(true);
  await page.evaluate(() => (window as any).mount.setTime(5600, 90_000));
  expect((await page.locator(".office-scene").screenshot()).equals(first)).toBe(false);
});

test("mounted scene is capped at 480px and centered in a wider panel; backing store = CSS size x DPR (max 2)", async ({ page, browser }) => {
  await openMount(page, snapshot([group(3)]), 1200);
  const m = await page.evaluate(() => (window as any).mount.metrics());
  expect(m.cssWidth).toBe(480);
  expect(m.rootWidth).toBe(480);
  expect(m.rootLeft).toBe(360);
  expect(m.backing[0]).toBe(480);
  await openMount(page, snapshot([group(3)]), 400);
  expect((await page.evaluate(() => (window as any).mount.metrics())).cssWidth).toBe(400);
  for (const [dpr, want] of [[2, 960], [3, 960]] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    await openMount(p, snapshot([group(3)]), 1200);
    expect((await p.evaluate(() => (window as any).mount.metrics())).backing[0], `dpr ${dpr}`).toBe(want);
    await ctx.close();
  }
});

// ───────── 전환 순간 고정 캡처 (setTransition): VQA-003/016/017/018 ─────────
const away = (n: number) => snapshot([group(n, "away")]);
const working = (n: number) => snapshot([group(n, "working")]);
for (const [name, n, ms] of [["manager-behind-desk", 3, 400], ["walkers-lanes", 3, 1000], ["walkers-n6-mid", 6, 2500]] as const) {
  test(`mounted transition baseline: working→away ${name} (N=${n}, +${ms}ms)`, async ({ page }) => {
    await page.goto(mountUrl);
    await page.evaluate(([snap]) => (window as any).mount.open({ snapshot: snap, width: 480 }), [away(n)] as any);
    await page.evaluate(([from, t]) => (window as any).mount.setTransition(from, t, 1000, 3000), [working(n), ms] as any);
    await mountShot(page, `transition-${name}`);
  });
}

// ───────── scope all: masonry (1600px 패널 → 3열, 프로젝트 블록 단위) ─────────
test("mounted scope all at 1600px: 3 columns, project blocks stay in one column, cards 410..480px", async ({ page }) => {
  const specs: [string, number[]][] = [["alpha", [3, 6, 1]], ["beta", [12]], ["delta", [3]], ["epsilon", [8, 2]], ["gamma", [4, 16]], ["zeta", [5]]];
  const snap = {
    scope: "all", generatedAt: 0,
    projects: specs.map(([name, sizes]) => ({
      projectId: name, projectName: name,
      offices: sizes.map((n, k) => {
        const o: any = n === 1 ? solo("working") : group(n);
        const id = `${name}-${k}`;
        return { ...o, id, manager: o.manager && { ...o.manager, id: `${id}-lead` }, members: o.members.map((m: any, j: number) => ({ ...m, id: `${id}-${j}` })) };
      }),
    })),
  };
  await page.goto(mountUrl);
  await page.evaluate(([snapshot, w]) => (window as any).mount.open({ snapshot, width: w }), [snap, 1600] as any);
  await page.evaluate(([t, e]) => (window as any).mount.setTime(t, e), [3500, 1000] as const);
  const cols = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".office-collection > div")] as HTMLElement[];
    const rect = (c: HTMLElement) => c.getBoundingClientRect();
    const byProject: Record<string, number[]> = {};
    for (const c of cards) (byProject[c.dataset.project!] ??= []).push(Math.round(rect(c).left));
    return { count: cards.length, lefts: new Set(cards.map((c) => Math.round(rect(c).left))).size, widths: cards.map((c) => Math.round(rect(c).width)), canvases: document.querySelectorAll(".office-collection canvas").length, byProject };
  });
  expect(cols.count).toBe(10);
  expect(cols.lefts).toBe(3);
  expect(cols.canvases).toBe(10);
  expect(Math.max(...cols.widths)).toBeLessThanOrEqual(480);
  expect(Math.min(...cols.widths)).toBeGreaterThanOrEqual(410);
  for (const [project, lefts] of Object.entries(cols.byProject)) expect(new Set(lefts).size, `project ${project} stays in one column`).toBe(1);
  await expect(page.locator(".office-collection")).toHaveScreenshot("mount-all-masonry-1600.png");
});

// ───────── office filter (All · Working · Awaiting · Idle) ─────────
type FilterName = "all" | "working" | "awaiting" | "idle";
type FSpec = [State, boolean?]; // [상태, 질문 대기]
/** 오피스: 첫 항목이 manager, solo면 구성원 1명. 에이전트 이름을 오피스 id로 두어 헤더(AGENT)로 오피스를 알아본다. */
function filterOffice(id: string, ...specs: FSpec[]) {
  const make = (s: FSpec, name: string, i: number) => agent(`${id}-${i}`, name, s[0], { needsAttention: !!s[1] });
  if (specs.length === 1 && id.startsWith("solo-")) return { id, kind: "solo" as const, manager: null, members: [make(specs[0], id, 0)] };
  const [lead, ...rest] = specs;
  return { id, kind: "group" as const, manager: make(lead, id, 0), members: rest.map((s, i) => make(s, `${id}-m${i + 1}`, i + 1)) };
}
const PROJECTS: { name: string; offices: (() => ReturnType<typeof filterOffice>)[] }[] = [
  { name: "alpha", offices: [() => filterOffice("a0", ["working"], ["away"]), () => filterOffice("a1", ["working", true], ["away"])] },
  { name: "beta", offices: [() => filterOffice("b0", ["away"], ["phone"]), () => filterOffice("b1", ["working"], ["working", true])] },
  { name: "gamma", offices: [() => filterOffice("solo-g0", ["sleeping"]), () => filterOffice("solo-g1", ["working"])] },
];
// working: a0, b1, solo-g1 / awaiting: a1, b1 / idle: b0, solo-g0
const EXPECTED: Record<FilterName, string[]> = { all: ["a0", "a1", "b0", "b1", "solo-g0", "solo-g1"], working: ["a0", "b1", "solo-g1"], awaiting: ["a1", "b1"], idle: ["b0", "solo-g0"] };
const COUNTS: Record<FilterName, number> = { all: 6, working: 3, awaiting: 2, idle: 2 };
const LABEL: Record<FilterName, string> = { all: "All", working: "Working", awaiting: "Awaiting", idle: "Idle" };
const FILTER_NAMES: FilterName[] = ["all", "working", "awaiting", "idle"];

const filterAll = (mods: Partial<Record<string, (o: any) => any>> = {}) => ({
  scope: "all", generatedAt: 0,
  projects: PROJECTS.map((p) => ({ projectId: p.name, projectName: p.name, offices: p.offices.map((f) => { const o = f(); return mods[o.id] ? mods[o.id]!(o) : o; }) })),
});
/** scope project(워크스페이스 패널): 같은 오피스 6개를 한 프로젝트에 둔다. */
const filterPanel = () => ({
  scope: "project", generatedAt: 0, workspaceName: "Filters",
  projects: [{ projectId: "panel", projectName: "Panel", offices: PROJECTS.flatMap((p) => p.offices.map((f) => f())) }],
});

async function openFilter(page: Page, snap: unknown, width = 1200) {
  await page.goto(mountUrl);
  await page.evaluate(([snapshot, w]) => (window as any).mount.open({ snapshot, width: w }), [snap, width] as any);
  await page.waitForFunction(() => (window as any).mount.headers().length > 0);
}
const bar = (page: Page) => page.evaluate(() => (window as any).mount.filterBar());
/** 화면에 있는 오피스(방) 제목 순서: 헤더의 AGENT 값. */
const shownOffices = (page: Page) => page.evaluate(() => (window as any).mount.headers().map((h: any) => h.cells.find((c: string[]) => c[0] === "AGENT")[1]));
const press = (page: Page, f: FilterName) => page.locator(`.office-filter-bar button[data-filter="${f}"]`).click();
const SCOPES = [["scope all", filterAll], ["scope project (panel)", filterPanel]] as const;

for (const [scopeName, build] of SCOPES) {
  test(`office filter: ${scopeName}: the bar shows All/Working/Awaiting/Idle with the office counts and starts on All`, async ({ page }) => {
    await openFilter(page, build());
    const b = await bar(page);
    expect(b.buttons.map((x: any) => x.filter)).toEqual(FILTER_NAMES);
    expect(b.buttons.map((x: any) => x.text)).toEqual(FILTER_NAMES.map((f) => `${LABEL[f]} ${COUNTS[f]}`));
    expect(b.buttons.map((x: any) => x.pressed)).toEqual([true, false, false, false]);
    expect(b.position).toBe("sticky");
    expect(await shownOffices(page)).toEqual(EXPECTED.all);
  });

  test(`office filter: ${scopeName}: each button keeps only the matching offices and the visible offices equal the button count`, async ({ page }) => {
    await openFilter(page, build());
    for (const f of [...FILTER_NAMES, "all"] as FilterName[]) {
      await press(page, f);
      // 패널(scope project)은 방이 한 카드 안에 있어 다음 12fps 갱신에서 반영된다.
      await expect.poll(() => shownOffices(page), { message: f, timeout: 3000 }).toEqual(EXPECTED[f]);
      const shown = await shownOffices(page);
      expect(shown.length, `${f}: offices on screen = button count`).toBe(COUNTS[f]);
      const b = await bar(page);
      expect(b.buttons.find((x: any) => x.pressed).filter).toBe(f);
      expect(b.buttons.filter((x: any) => x.pressed)).toHaveLength(1);
      expect(b.buttons.map((x: any) => x.text), "counts do not change with the filter").toEqual(FILTER_NAMES.map((n) => `${LABEL[n]} ${COUNTS[n]}`));
      expect(b.emptyVisible).toBe(false);
    }
  });

  test(`office filter: ${scopeName}: when nothing matches, "No offices match" is shown and no card is mounted`, async ({ page }) => {
    const idleOnly = build();
    for (const p of idleOnly.projects) for (const o of p.offices as any[]) for (const a of [o.manager, ...o.members].filter(Boolean)) Object.assign(a, { state: "away", needsAttention: false });
    await openFilter(page, idleOnly);
    expect((await bar(page)).buttons.map((x: any) => x.text)).toEqual(["All 6", "Working 0", "Awaiting 0", "Idle 6"]);
    await press(page, "working");
    const b = await bar(page);
    expect(b.emptyVisible).toBe(true);
    expect(b.emptyText).toBe("No offices match");
    expect(b.cards).toBe(0);
    expect(b.canvases).toBe(0);
    expect(await shownOffices(page)).toEqual([]);
    await press(page, "awaiting");
    expect((await bar(page)).emptyVisible).toBe(true);
    await press(page, "idle");
    const idle = await bar(page);
    expect(idle.emptyVisible).toBe(false);
    expect((await shownOffices(page)).length).toBe(6);
  });
}

test("office filter: scope all: a new snapshot adds and removes cards on the next refresh and keeps the order of the rest", async ({ page }) => {
  await openFilter(page, filterAll());
  await press(page, "working");
  expect(await shownOffices(page)).toEqual(["a0", "b1", "solo-g1"]);
  // a0이 쉬고, b0과 solo-g0이 일을 시작한다(스냅샷은 새 객체).
  const rest = (o: any) => ({ ...o, manager: { ...o.manager, state: "away" }, members: o.members.map((m: any) => ({ ...m, state: "away" })) });
  const work = (o: any) => ({ ...o, manager: o.manager && { ...o.manager, state: "working" }, members: o.members.map((m: any, i: number) => ({ ...m, state: i === 0 ? "working" : m.state })) });
  await page.evaluate((next) => (window as any).mount.setSnapshot(next), filterAll({ a0: rest, b0: work, "solo-g0": work }) as any);
  await page.waitForFunction(() => (window as any).mount.headers().length === 4, null, { timeout: 5000 });
  expect(await shownOffices(page)).toEqual(["b0", "b1", "solo-g0", "solo-g1"]);
  expect((await bar(page)).buttons.map((x: any) => x.text)).toEqual(["All 6", "Working 4", "Awaiting 2", "Idle 1"]);
  // 질문이 생기면 Working에서 빠지고, 그 오피스는 순서를 유지한 채 Awaiting 쪽으로 간다.
  const ask = (o: any) => ({ ...o, manager: { ...o.manager, state: "working", needsAttention: true } });
  await page.evaluate((next) => (window as any).mount.setSnapshot(next), filterAll({ a0: rest, b0: work, "solo-g0": work, b1: ask }) as any);
  await page.waitForFunction(() => (window as any).mount.headers().length === 3, null, { timeout: 5000 });
  expect(await shownOffices(page)).toEqual(["b0", "solo-g0", "solo-g1"]);
  await press(page, "awaiting");
  expect(await shownOffices(page)).toEqual(["a1", "b1"]);
  // 같은 상태의 2초 갱신은 카드를 건드리지 않는다.
  const before = await page.evaluate(() => [...document.querySelectorAll(".office-collection > div")].map((c: any) => c.style.cssText));
  await page.evaluate((next) => (window as any).mount.setSnapshot(next), JSON.parse(JSON.stringify(filterAll({ a0: rest, b0: work, "solo-g0": work, b1: ask }))));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => [...document.querySelectorAll(".office-collection > div")].map((c: any) => c.style.cssText))).toEqual(before);
});

test("office filter: scope project: a new snapshot updates the rooms of the panel on the next refresh in the same order", async ({ page }) => {
  await openFilter(page, filterPanel());
  await press(page, "idle");
  await expect.poll(() => shownOffices(page), { timeout: 3000 }).toEqual(["b0", "solo-g0"]);
  const next: any = filterPanel();
  for (const o of next.projects[0].offices) if (o.id === "a0") for (const a of [o.manager, ...o.members]) a.state = "away"; // a0: working → idle
  for (const o of next.projects[0].offices) if (o.id === "b0") o.manager.state = "working";                                      // b0: idle → working
  await page.evaluate((s) => (window as any).mount.setSnapshot(s), next);
  await expect.poll(() => shownOffices(page), { timeout: 5000 }).toEqual(["a0", "solo-g0"]);
  expect((await bar(page)).buttons.map((x: any) => x.text)).toEqual(["All 6", "Working 3", "Awaiting 2", "Idle 2"]);
});

for (const [scopeName, build] of SCOPES) {
  test(`office filter: ${scopeName}: at 410px the bar is not clipped (all four buttons fully visible, text not cut)`, async ({ page }) => {
    await openFilter(page, build(), 410);
    const b = await bar(page);
    expect(b.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(b.clientWidth);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(410 + 0.5);
    for (const btn of b.buttons) {
      expect(btn.left, `${btn.filter} left`).toBeGreaterThanOrEqual(b.left - 0.5);
      expect(btn.right, `${btn.filter} right`).toBeLessThanOrEqual(b.right + 0.5);
      expect(btn.scrollWidth, `${btn.filter} text fits`).toBeLessThanOrEqual(btn.clientWidth + 1);
      expect(btn.text).toMatch(/^(All|Working|Awaiting|Idle) \d+$/);
    }
    // 두 줄로 접혀도 서로 겹치지 않는다.
    for (let i = 0; i < b.buttons.length; i++) for (let j = i + 1; j < b.buttons.length; j++) {
      const a = b.buttons[i], c = b.buttons[j];
      expect(a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5, `${a.filter}/${c.filter} overlap`).toBe(false);
    }
    // 가장 큰 개수(두 자리)에서도 안 잘린다.
    const many: any = build();
    const extra = many.projects[0].offices;
    while (extra.length < 12) extra.push({ ...extra[0], id: `x${extra.length}`, manager: { ...extra[0].manager, id: `x${extra.length}-l`, name: `x${extra.length}` }, members: [] });
    await page.evaluate((s) => (window as any).mount.setSnapshot(s), many);
    await page.waitForFunction(() => /All 1[0-9]/.test((window as any).mount.filterBar().buttons[0].text), null, { timeout: 5000 });
    const wide = await bar(page);
    expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth);
    for (const btn of wide.buttons) expect(btn.scrollWidth).toBeLessThanOrEqual(btn.clientWidth + 1);
  });
}

test("office filter: baselines for every filter (scope all 1200px, scope project 480px) and the empty state", async ({ page }) => {
  for (const f of FILTER_NAMES) {
    await openFilter(page, filterAll(), 1200);
    if (f !== "all") await press(page, f);
    await expect.poll(() => shownOffices(page)).toEqual(EXPECTED[f]);
    await page.evaluate(() => (window as any).mount.setTime(3500, 1000));
    await expect(page.locator("#mount")).toHaveScreenshot(`office-filter-all-${f}.png`);
  }
  for (const f of FILTER_NAMES) {
    await openFilter(page, filterPanel(), 480);
    if (f !== "all") await press(page, f);
    await expect.poll(() => shownOffices(page)).toEqual(EXPECTED[f]);
    await page.evaluate(() => (window as any).mount.setTime(3500, 1000));
    await expect(page.locator("#mount")).toHaveScreenshot(`office-filter-panel-${f}.png`);
  }
  const idleOnly: any = filterAll();
  for (const p of idleOnly.projects) for (const o of p.offices) for (const a of [o.manager, ...o.members].filter(Boolean)) Object.assign(a, { state: "away", needsAttention: false });
  await openFilter(page, idleOnly, 480);
  await press(page, "working");
  await expect(page.locator("#mount")).toHaveScreenshot("office-filter-empty.png");
  await openFilter(page, filterAll(), 410);
  await expect(page.locator(".office-filter-bar")).toHaveScreenshot("office-filter-bar-410.png");
});

// ───────── VQA-038 / VQA-039 (실제 브라우저) ─────────
test("office filter: cards entering the filter result are never a blank frame (rAF-measured, real 12fps loop)", async ({ page }) => {
  await openFilter(page, filterAll(), 1600);
  await press(page, "working");
  await expect.poll(() => shownOffices(page)).toEqual(EXPECTED.working);
  // 매 프레임: 화면에 보이는 카드 중 캔버스 폭이 0인 것의 수를 센다.
  await page.evaluate(() => {
    const w = window as any; w.__blank = 0; w.__frames = 0; w.__stop = false;
    const loop = () => {
      w.__frames++;
      for (const c of document.querySelectorAll(".office-collection > div") as any) {
        const r = c.getBoundingClientRect(), canvas = c.querySelector("canvas");
        if (r.bottom > 0 && r.top < innerHeight && canvas && canvas.width === 0) w.__blank++;
      }
      if (!w.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const rest = (o: any) => ({ ...o, manager: { ...o.manager, state: "away" }, members: o.members.map((m: any) => ({ ...m, state: "away" })) });
  const work = (o: any) => ({ ...o, manager: { ...o.manager, state: "working" } });
  // 1) 스냅샷 변경으로 b0과 solo-g0이 Working에 들어온다.
  await page.evaluate((s) => (window as any).mount.setSnapshot(s), filterAll({ a0: rest, b0: work, "solo-g0": (o: any) => ({ ...o, members: [{ ...o.members[0], state: "working" }] }) }) as any);
  await expect.poll(() => shownOffices(page), { timeout: 5000 }).toEqual(["b0", "b1", "solo-g0", "solo-g1"]);
  // 2) 버튼 클릭으로 카드가 한꺼번에 들어온다.
  for (const f of ["all", "idle", "awaiting", "working"] as FilterName[]) { await press(page, f); await page.waitForTimeout(250); }
  const r = await page.evaluate(() => { const w = window as any; w.__stop = true; return { blank: w.__blank, frames: w.__frames }; });
  expect(r.frames).toBeGreaterThan(20);
  expect(r.blank, `${r.blank} frames showed a card with a 0-width canvas`).toBe(0);
});

for (const width of [410, 420, 430]) {
  test(`office filter: ${width}px screen: scope all one-column cards are at least 410px wide and plate names are not ellipsized`, async ({ page }) => {
    const big: any = filterAll();
    const o = big.projects[0].offices[0];
    big.projects = [{ projectId: "delta", projectName: "delta", offices: [{ ...o, id: "n16", manager: { ...o.manager, id: "n16-lead", name: "Orchestrator" }, members: Array.from({ length: 16 }, (_, i) => agent(`n16-${i}`, ["plugin#FDF9", "search#64CA", "review#A1C2", "qa#0499"][i % 4], STATES[i % 4])) }] }];
    await openFilter(page, big, width);
    const m = await page.evaluate(() => {
      const card = document.querySelector(".office-collection > div") as HTMLElement, r = card.getBoundingClientRect();
      return { width: r.width, left: r.left, right: r.right, canvas: !!card.querySelector("canvas") };
    });
    expect(m.width).toBeGreaterThanOrEqual(410);
    expect(m.left).toBeGreaterThanOrEqual(-0.5);
    expect(m.right).toBeLessThanOrEqual(width + 0.5);
    expect(m.canvas).toBe(true);
    await page.evaluate(() => (window as any).mount.setTime(3500, 1000));
    await expect(page.locator(".office-collection")).toHaveScreenshot(`office-filter-n16-${width}.png`);
  });
}

// ───────── awaiting pose: 질문 대기 중 손 든 자세와 '?' 말풍선 (실제 마운트 경로, 프레임 고정) ─────────
// 시트는 3프레임 @ 4fps: 시각 3000/3250/3500ms는 프레임 0/1/2다(액터 시계 = 경과 시간).
const waitingSolo = () => snapshot([solo("working", { needsAttention: true })]);
for (const [width, times] of [[480, [3000, 3250, 3500]], [410, [3500]]] as const) {
  for (const ms of times) {
    test(`awaiting pose: solo agent with a raised hand and a question bubble, ${width}px, t=${ms}ms`, async ({ page }) => {
      await openMount(page, waitingSolo(), width, ms, 1000);
      await mountShot(page, `awaiting-pose-solo-${width}-${ms}`);
    });
  }
}

test("awaiting pose: the typing pose and the hand overlay are gone while waiting; an unflagged office next to it is unchanged", async ({ page }) => {
  const asking = group(5, "working"); // 모두 working이어야 대기 자세가 된다(group(n)만 쓰면 상태가 섞인다)
  asking.manager.needsAttention = true;
  (asking.members[1] as any).needsAttention = true;
  await openMount(page, snapshot([asking]), 480, 3500, 1000);
  await mountShot(page, "awaiting-pose-group-480");
  const calm = group(5, "working");
  await openMount(page, snapshot([calm]), 480, 3500, 1000);
  await mountShot(page, "awaiting-pose-group-480-calm");
});

test("awaiting pose: every look (six members and the manager) raises a hand with a question bubble at 410px", async ({ page }) => {
  const all = group(6, "working");
  all.manager.needsAttention = true;
  for (const m of all.members) (m as any).needsAttention = true;
  await openMount(page, snapshot([all]), 410, 3250, 1000);
  await mountShot(page, "awaiting-pose-all-looks-410");
});

test("awaiting pose: a walking waiting agent keeps the '!' fallback and, when the wait ends, typing returns", async ({ page }) => {
  // 걷는 중(돌아오는 길) 대기: 같은 마운트에서 스냅샷을 대기 상태로 두고 전환 시점을 고정한다.
  await openMount(page, snapshot([solo("working", { needsAttention: true })]), 480, 0, 1000);
  await page.evaluate(([from, t]) => (window as any).mount.setTransition(from, t, 1000, 30000), [snapshot([solo("away")]), 1200] as any);
  await mountShot(page, "awaiting-pose-walking-fallback-480");
  await openMount(page, snapshot([solo("working", { needsAttention: false })]), 480, 3500, 1000);
  await mountShot(page, "awaiting-pose-resolved-typing-480");
});

// ───────── awaiting pose: 의자에 앉은 느낌(렌더 기준) ─────────
// 사용자 피드백("엉덩이가 의자에 앉아 있는 느낌이 안 든다")으로 대기 자세는 일부러 working보다 높게 앉는다.
// 기대: 머리 꼭대기가 의자 등받이 꼭대기 위로 충분히 올라오고, 어깨~상판 뒤 모서리 사이가 충분히 떨어져 있으며, 머리 크기는 같다.
// 값은 manifest 오프셋을 계산식으로 다시 쓰지 않고, 실제 마운트 경로가 canvas에 그린 drawImage 호출(dy)에서 읽는다.
async function renderedTorso(page: Page, snap: unknown, width: number, names: string[]) {
  await page.goto(mountUrl);
  await page.evaluate(([snapshot, w]) => (window as any).mount.open({ snapshot, width: w }), [snap, width] as any);
  await page.waitForFunction(() => (window as any).mount.headers().length > 0);
  await page.evaluate(() => (window as any).mount.record(true));
  await page.evaluate(() => (window as any).mount.setTime(3500, 1000));
  const draws: any[] = await page.evaluate(() => (window as any).mount.recorded());
  await page.evaluate(() => (window as any).mount.record(false));
  const uris: Record<string, string> = await page.evaluate((n) => (window as any).mount.sheetUris(n), names);
  return { draws, uris };
}

test("awaiting pose: seated like on a chair (rendered): head top clears the chair back by 30% of the head height, shoulders sit 50% of the head height above the table rear edge, head size unchanged", async ({ page }) => {
  const WIDTH = 480;
  const asking = group(6, "working");
  asking.manager.needsAttention = true;
  for (const m of asking.members) (m as any).needsAttention = true;
  await openMount(page, snapshot([group(6, "working")]), WIDTH, 3500, 1000);
  const stations: any[] = await page.evaluate(() => (window as any).mount.stations());
  expect(stations).toHaveLength(7);
  const looks = stations.map((st) => (st.manager ? "orchestrator" : `actor-${st.variant}`));
  expect(new Set(looks).size).toBe(7);
  const sheets = looks.flatMap((id) => [`${id}-working`, `${id}-awaiting`]);
  const metrics: Record<string, any> = await page.evaluate((n) => (window as any).mount.sheetMetrics(n), sheets);
  const waiting = await renderedTorso(page, snapshot([asking]), WIDTH, sheets);
  const typing = await renderedTorso(page, snapshot([group(6, "working")]), WIDTH, sheets);
  const lastDraw = (r: { draws: any[]; uris: Record<string, string> }, name: string, st: any) => {
    const same = r.draws.filter((d) => d.src === r.uris[name]);
    expect(same.length, `${name} was drawn`).toBeGreaterThan(0);
    // 같은 시트를 쓰는 다른 자리(큰 방의 6종 반복)와 섞이지 않게 이 자리에 가장 가까운 마지막 그림을 쓴다.
    const nearest = Math.min(...same.map((d) => Math.abs(d.dx + d.dw / 2 - st.seat.x)));
    return same.filter((d) => Math.abs(d.dx + d.dw / 2 - st.seat.x) === nearest).at(-1);
  };
  const report: string[] = [];
  for (const [i, st] of stations.entries()) {
    const id = looks[i], w = metrics[`${id}-working`], a = metrics[`${id}-awaiting`];
    const A = lastDraw(waiting, `${id}-awaiting`, st), W = lastDraw(typing, `${id}-working`, st);
    const f = A.dh / 216, headH = 62 * f; // 머리 박스(논리 프레임 y 18..80)의 높이
    const headTop = A.dy + a.headTop * f, shoulder = A.dy + a.shoulder * f;
    const rear = st.y + st.desk.tableRearY * st.moduleScale;
    const chairModule: number | null = await page.evaluate(([name, cx]) => (window as any).mount.columnTop(name, cx, 35), [st.desk.back, st.desk.seat[0]] as any);
    expect(chairModule, `${id}: chair back found in ${st.desk.back}`).not.toBeNull();
    const chairTop = st.y + chairModule! * st.moduleScale;
    const aboveChair = (chairTop - headTop) / headH, chest = (rear - shoulder) / headH, headSize = a.headWidth / w.headWidth, drawnSize = A.dh / W.dh;
    const typingAbove = (chairTop - (W.dy + w.headTop * (W.dh / 216))) / headH;
    report.push(`${id}: (typing ${typingAbove.toFixed(2)}H) head above chair ${aboveChair.toFixed(2)}H, shoulder→rear ${chest.toFixed(2)}H, head width ratio ${headSize.toFixed(2)}`);
    expect(aboveChair, `${id}: ${report.at(-1)}`).toBeGreaterThanOrEqual(0.3);
    expect(aboveChair, `${id}: sits higher than while typing (${report.at(-1)})`).toBeGreaterThan(typingAbove + 0.2);
    expect(chest, `${id}: ${report.at(-1)}`).toBeGreaterThanOrEqual(0.5);
    expect(Math.abs(headSize - 1), `${id}: head width differs from typing (${report.at(-1)})`).toBeLessThanOrEqual(0.1);
    expect(Math.abs(drawnSize - 1), `${id}: the awaiting cell is drawn at the typing scale`).toBeLessThan(1e-6);
    // 대기 자세는 working보다 위에 그려진다(앉은 높이를 일부러 올렸다).
    expect(A.dy, `${id}: raised relative to the typing pose`).toBeLessThan(W.dy);
  }
  test.info().annotations.push({ type: "metrics", description: report.join(" | ") });
});
