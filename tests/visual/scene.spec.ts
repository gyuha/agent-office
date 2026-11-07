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
