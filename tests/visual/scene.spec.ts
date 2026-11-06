import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { buildVisualHarness } from "./harness/build-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(__dirname, "harness/index.html");
const harnessUrl = `file://${harnessPath}`;

test.beforeAll(() => {
  buildVisualHarness();
});

async function openHarness(page: Page) {
  await page.goto(harnessUrl);
  await page.evaluate(() => (window as any).__harness.spritesReady);
}

function makeSoloSnapshot(
  state: "working" | "away" | "phone" | "sleeping",
  options: { id?: string; name?: string; provider?: string; needsAttention?: boolean } = {},
) {
  const id = options.id ?? "solo-0";
  return {
    scope: "project" as const,
    generatedAt: 0,
    projects: [
      {
        projectId: "prj-solo",
        projectName: "Studio",
        offices: [
          {
            id,
            kind: "solo" as const,
            manager: null,
            members: [
              {
                id,
                name: options.name ?? "Agent Solo",
                provider: options.provider ?? "claude",
                state,
                stateSince: 0,
                needsAttention: options.needsAttention ?? false,
              },
            ],
          },
        ],
      },
    ],
  };
}

const PREVIEW_STATES = ["working", "away", "phone", "sleeping"] as const;

function makePreviewAgent(id: string, state: (typeof PREVIEW_STATES)[number], rawIndex: number) {
  return {
    id,
    name: rawIndex === 0 ? "Orchestrator" : `Agent ${rawIndex}`,
    provider: ["claude", "codex", "gemini", "unknown"][rawIndex % 4],
    state,
    stateSince: 0,
    needsAttention: rawIndex === 2,
  };
}

function makePreviewOffice(n: number, prefix: string) {
  const list = Array.from({ length: n }, (_, i) =>
    makePreviewAgent(`${prefix}${i}`, PREVIEW_STATES[i % 4], i),
  );
  return {
    id: prefix,
    kind: (n > 1 ? "group" : "solo") as "group" | "solo",
    manager: n > 1 ? list.shift()! : null,
    members: list,
  };
}

function makeScenarioSnapshot(
  mode: "project-1" | "project-3" | "project-7" | "project-15" | "all" | "empty",
) {
  if (mode === "all") {
    return {
      scope: "all" as const,
      generatedAt: 0,
      projects: [0, 1, 2].map((i) => ({
        projectId: `p${i}`,
        projectName: ["Atlas", "Beacon", "Cosmos"][i],
        offices: [makePreviewOffice([7, 3, 1][i], `p${i}`)],
      })),
    };
  }
  const counts = mode === "empty" ? [] : [Number(mode.split("-")[1])];
  return {
    scope: "project" as const,
    generatedAt: 0,
    projects: [
      {
        projectId: "p",
        projectName: "Studio",
        offices: counts.map((n, i) => makePreviewOffice(n, `o${i}`)),
      },
    ],
  };
}

test.describe("1. 결정성 (Determinism)", () => {
  test("같은 입력(스냅샷, 액터, 시각 t)이면 두 번 렌더링해도 픽셀이 100% 일치한다", async ({ page }) => {
    await openHarness(page);
    const snap = makeScenarioSnapshot("project-7");

    const diff = await page.evaluate((snapshot) => {
      const h = (window as any).__harness;
      h.stepAndRender({ snapshot, steps: [{ dtMs: 0 }, { dtMs: 250 }], timeMs: 1200 });
      const idA = h.saveBuffer();
      h.stepAndRender({ snapshot, steps: [{ dtMs: 0 }, { dtMs: 250 }], timeMs: 1200 });
      const idB = h.saveBuffer();
      return h.diffSavedBuffers(idA, idB);
    }, snap);

    expect(diff).toBe(0);
  });
});

test.describe("2. 상태별 애니메이션 검증 (working, phone, sleeping, away, needsAttention)", () => {
  test("working: 고정 시각 t=0ms, 100ms, 200ms 캡처 비교 및 프레임 변화(픽셀 차이 > 0) 단언", async ({ page }) => {
    await openHarness(page);
    const snap = makeSoloSnapshot("working", { id: "ag-work", name: "Worker" });
    const canvas = page.locator("#canvas");

    const times = [0, 100, 200];
    const bufIds: number[] = [];
    for (const t of times) {
      const id = await page.evaluate(
        ({ snapshot, timeMs }) => {
          const h = (window as any).__harness;
          h.stepAndRender({
            snapshot,
            steps: [{ dtMs: 0 }, { dtMs: timeMs }],
            timeMs,
          });
          return h.saveBuffer();
        },
        { snapshot: snap, timeMs: t },
      );
      bufIds.push(id);
      await expect(canvas).toHaveScreenshot(`state-working-t${t}.png`);
    }

    const [diff01, diff12] = await page.evaluate(
      ([id0, id1, id2]) => {
        const h = (window as any).__harness;
        return [h.diffSavedBuffers(id0, id1), h.diffSavedBuffers(id1, id2)];
      },
      bufIds,
    );
    expect(diff01).toBeGreaterThan(0);
    expect(diff12).toBeGreaterThan(0);
  });

  test("phone: 고정 시각 t=0ms, 400ms, 800ms 캡처 비교 및 미세 프레임 변화 단언", async ({ page }) => {
    await openHarness(page);
    const snap = makeSoloSnapshot("phone", { id: "ag-phone", name: "Phoner", provider: "codex" });
    const canvas = page.locator("#canvas");

    const times = [0, 400, 800];
    const bufIds: number[] = [];
    for (const t of times) {
      const id = await page.evaluate(
        ({ snapshot, timeMs }) => {
          const h = (window as any).__harness;
          h.stepAndRender({
            snapshot,
            steps: [{ dtMs: 0 }, { dtMs: timeMs }],
            timeMs,
          });
          return h.saveBuffer();
        },
        { snapshot: snap, timeMs: t },
      );
      bufIds.push(id);
      await expect(canvas).toHaveScreenshot(`state-phone-t${t}.png`);
    }

    const [diff01, diff12] = await page.evaluate(
      ([id0, id1, id2]) => {
        const h = (window as any).__harness;
        return [h.diffSavedBuffers(id0, id1), h.diffSavedBuffers(id1, id2)];
      },
      bufIds,
    );
    // phone은 스크롤/끄덕임 같은 작은 주기 움직임이 있다: 프레임은 변하되 장면 전체가 바뀌지는 않는다.
    expect(diff01).toBeGreaterThan(0);
    expect(diff12).toBeGreaterThan(0);
    const totalPixels = await page.evaluate(() => {
      const c = document.getElementById("canvas") as HTMLCanvasElement;
      return c.width * c.height;
    });
    expect(diff01).toBeLessThan(totalPixels * 0.02);
    expect(diff12).toBeLessThan(totalPixels * 0.02);
  });

  test("sleeping: 고정 시각 t=0ms, 400ms, 800ms 캡처 비교 및 프레임 변화(픽셀 차이 > 0) 단언", async ({ page }) => {
    await openHarness(page);
    const snap = makeSoloSnapshot("sleeping", { id: "ag-sleep", name: "Sleeper", provider: "gemini" });
    const canvas = page.locator("#canvas");

    const times = [0, 400, 800];
    const bufIds: number[] = [];
    for (const t of times) {
      const id = await page.evaluate(
        ({ snapshot, timeMs }) => {
          const h = (window as any).__harness;
          h.stepAndRender({
            snapshot,
            steps: [{ dtMs: 0 }, { dtMs: timeMs }],
            timeMs,
          });
          return h.saveBuffer();
        },
        { snapshot: snap, timeMs: t },
      );
      bufIds.push(id);
      await expect(canvas).toHaveScreenshot(`state-sleeping-t${t}.png`);
    }

    const [diff01, diff12] = await page.evaluate(
      ([id0, id1, id2]) => {
        const h = (window as any).__harness;
        return [h.diffSavedBuffers(id0, id1), h.diffSavedBuffers(id1, id2)];
      },
      bufIds,
    );
    expect(diff01).toBeGreaterThan(0);
    expect(diff12).toBeGreaterThan(0);
  });

  test("away(이동 중 & 목적지 도착): 이동 중 t=200ms/350ms, 도착 후 t=2000ms/2400ms 캡처 비교 및 애니메이션 변화 단언", async ({ page }) => {
    await openHarness(page);
    const snapWorking = makeSoloSnapshot("working", { id: "ag-away", name: "Walker" });
    const snapAway = makeSoloSnapshot("away", { id: "ag-away", name: "Walker" });
    const canvas = page.locator("#canvas");

    // 1) 이동 중 (working 좌석에서 시작해 away로 200ms, 350ms 이동)
    const moving1 = await page.evaluate(
      ({ sWork, sAway }) => {
        const h = (window as any).__harness;
        const res = h.stepAndRender({
          snapshot: sAway,
          steps: [
            { snapshot: sWork, dtMs: 0 },
            { snapshot: sAway, dtMs: 200 },
          ],
          timeMs: 200,
        });
        return { actor: res.actors["ag-away"], bufId: h.saveBuffer() };
      },
      { sWork: snapWorking, sAway: snapAway },
    );
    expect(moving1.actor.moving).toBe(true);
    await expect(canvas).toHaveScreenshot("state-away-moving-t200.png");

    const moving2 = await page.evaluate(
      ({ sWork, sAway }) => {
        const h = (window as any).__harness;
        const res = h.stepAndRender({
          snapshot: sAway,
          steps: [
            { snapshot: sWork, dtMs: 0 },
            { snapshot: sAway, dtMs: 350 },
          ],
          timeMs: 350,
        });
        return { actor: res.actors["ag-away"], bufId: h.saveBuffer() };
      },
      { sWork: snapWorking, sAway: snapAway },
    );
    expect(moving2.actor.moving).toBe(true);
    await expect(canvas).toHaveScreenshot("state-away-moving-t350.png");

    const movingDiff = await page.evaluate(
      ([idA, idB]) => (window as any).__harness.diffSavedBuffers(idA, idB),
      [moving1.bufId, moving2.bufId],
    );
    expect(movingDiff).toBeGreaterThan(0);

    // 2) 목적지 도착 후 (idle 애니메이션: fps=3이므로 phase=2000ms와 2400ms에서 프레임이 다름)
    const arrived1 = await page.evaluate(
      ({ sWork, sAway }) => {
        const h = (window as any).__harness;
        const res = h.stepAndRender({
          snapshot: sAway,
          steps: [
            { snapshot: sWork, dtMs: 0 },
            { snapshot: sAway, dtMs: 2000 },
          ],
          timeMs: 2000,
        });
        return { actor: res.actors["ag-away"], bufId: h.saveBuffer() };
      },
      { sWork: snapWorking, sAway: snapAway },
    );
    expect(arrived1.actor.moving).toBe(false);
    await expect(canvas).toHaveScreenshot("state-away-arrived-t2000.png");

    const arrived2 = await page.evaluate(
      ({ sWork, sAway }) => {
        const h = (window as any).__harness;
        const res = h.stepAndRender({
          snapshot: sAway,
          steps: [
            { snapshot: sWork, dtMs: 0 },
            { snapshot: sAway, dtMs: 2400 },
          ],
          timeMs: 2400,
        });
        return { actor: res.actors["ag-away"], bufId: h.saveBuffer() };
      },
      { sWork: snapWorking, sAway: snapAway },
    );
    expect(arrived2.actor.moving).toBe(false);
    await expect(canvas).toHaveScreenshot("state-away-arrived-t2400.png");

    const arrivedDiff = await page.evaluate(
      ([idA, idB]) => (window as any).__harness.diffSavedBuffers(idA, idB),
      [arrived1.bufId, arrived2.bufId],
    );
    expect(arrivedDiff).toBeGreaterThan(0);
  });

  test("needsAttention: 고정 시각 t=0ms, 200ms 캡처 비교, '?' 마크 표시 및 애니메이션 동작 단언", async ({ page }) => {
    await openHarness(page);
    const snapWithout = makeSoloSnapshot("working", {
      id: "ag-attn",
      name: "NeedsPerm",
      needsAttention: false,
    });
    const snapWith = makeSoloSnapshot("working", {
      id: "ag-attn",
      name: "NeedsPerm",
      needsAttention: true,
    });
    const canvas = page.locator("#canvas");

    // t=0에서 needsAttention=false와 true의 픽셀 차이가 있어야 함 ('?' 표시)
    const idWithout = await page.evaluate((snapshot) => {
      const h = (window as any).__harness;
      h.stepAndRender({ snapshot, steps: [{ dtMs: 0 }], timeMs: 0 });
      return h.saveBuffer();
    }, snapWithout);

    const idWith0 = await page.evaluate((snapshot) => {
      const h = (window as any).__harness;
      h.stepAndRender({ snapshot, steps: [{ dtMs: 0 }], timeMs: 0 });
      return h.saveBuffer();
    }, snapWith);
    await expect(canvas).toHaveScreenshot("state-needsAttention-t0.png");

    const diffIndicator = await page.evaluate(
      ([idA, idB]) => (window as any).__harness.diffSavedBuffers(idA, idB),
      [idWithout, idWith0],
    );
    expect(diffIndicator).toBeGreaterThan(0);

    // t=200ms 캡처 및 t=0 대비 프레임 변화 단언
    const idWith200 = await page.evaluate((snapshot) => {
      const h = (window as any).__harness;
      h.stepAndRender({ snapshot, steps: [{ dtMs: 0 }, { dtMs: 200 }], timeMs: 200 });
      return h.saveBuffer();
    }, snapWith);
    await expect(canvas).toHaveScreenshot("state-needsAttention-t200.png");

    const diffAnim = await page.evaluate(
      ([idA, idB]) => (window as any).__harness.diffSavedBuffers(idA, idB),
      [idWith0, idWith200],
    );
    expect(diffAnim).toBeGreaterThan(0);
  });
});

test.describe("3. 레이아웃 검증 (시각 캡처 비교 & 비시각 기하 불변성)", () => {
  const scenarios = ["project-1", "project-3", "project-7", "project-15", "all", "empty"] as const;

  for (const mode of scenarios) {
    test(`레이아웃 시각 캡처: ${mode}`, async ({ page }) => {
      await openHarness(page);
      const snap = makeScenarioSnapshot(mode);
      const canvas = page.locator("#canvas");

      await page.evaluate((snapshot) => {
        (window as any).__harness.stepAndRender({
          snapshot,
          steps: [{ dtMs: 0 }, { dtMs: 500 }],
          timeMs: 1000,
          width: 800,
          scale: 2,
        });
      }, snap);

      await expect(canvas).toHaveScreenshot(`layout-${mode}.png`);
    });
  }
});

test.describe("4. 전이 검증 (working ↔ away 이동 상한, 좌석 복귀, 스냅샷 재입력 위치 보존)", () => {
  test("working → away → working 전이 및 동일 id 스냅샷 재투입 시 위치가 리셋/순간이동하지 않는다", async ({ page }) => {
    await openHarness(page);
    const canvas = page.locator("#canvas");

    const transitionResult = await page.evaluate(() => {
      const h = (window as any).__harness;
      const makeTransitionSnap = (member0State: "working" | "away", generatedAt = 0) => {
        const list = [
          {
            id: "o00",
            name: "Orchestrator",
            provider: "claude",
            state: "working",
            stateSince: 0,
            needsAttention: false,
          },
          {
            id: "o01",
            name: "Agent 1",
            provider: "codex",
            state: member0State,
            stateSince: 0,
            needsAttention: false,
          },
          {
            id: "o02",
            name: "Agent 2",
            provider: "gemini",
            state: "phone",
            stateSince: 0,
            needsAttention: true,
          },
        ];
        return {
          scope: "project",
          generatedAt,
          projects: [
            {
              projectId: "p",
              projectName: "Studio",
              offices: [
                {
                  id: "o0",
                  kind: "group",
                  manager: list[0],
                  members: [list[1], list[2]],
                },
              ],
            },
          ],
        };
      };

      const snapStart = makeTransitionSnap("working", 100);
      const snapAway = makeTransitionSnap("away", 200);
      const layout = h.core.layoutOffices(snapStart, 800);
      const memberStation = layout.rooms[0].stations.find((s: any) => s.agent.id === "o01");
      const seat = memberStation.seat;
      const away = memberStation.away;

      // 처음에는 working으로 좌석에서 시작
      let actors = h.core.step({}, snapStart, 0, layout);
      const startPos = { x: actors["o01"].x, y: actors["o01"].y };

      // working -> away 전이: 100ms 단위 80스텝 동안 매 프레임 이동 거리가 상한(dtMs * 0.065 = 6.5px) 이하인지 검증
      let maxStepDistance = 0;
      let midWayPos = { x: 0, y: 0 };
      const dtMs = 100;
      const maxAllowedPerStep = dtMs * 0.065 + 0.001;

      for (let i = 1; i <= 80; i++) {
        // 매번 새로 생성된 스냅샷 객체(같은 id)를 넣어도 위치가 리셋되지 않아야 함
        const freshAwaySnap = makeTransitionSnap("away", i * dtMs);
        const prevPos = { x: actors["o01"].x, y: actors["o01"].y };
        actors = h.core.step(actors, freshAwaySnap, dtMs);
        const curPos = { x: actors["o01"].x, y: actors["o01"].y };
        const dist = Math.hypot(curPos.x - prevPos.x, curPos.y - prevPos.y);
        if (dist > maxStepDistance) maxStepDistance = dist;
        if (i === 5) midWayPos = curPos;
      }

      const arrivedAwayPos = { x: actors["o01"].x, y: actors["o01"].y };
      const arrivedAwayMoving = actors["o01"].moving;

      // away -> working 복귀: 중간 스텝에서 새 스냅샷을 다시 넣어도 리셋되지 않고 최종적으로 seat에 돌아오는지 확인
      let returnMaxStepDistance = 0;
      let midReturnBeforeFresh = { x: 0, y: 0 };
      let midReturnAfterFresh = { x: 0, y: 0 };

      for (let i = 1; i <= 80; i++) {
        const freshWorkSnap = makeTransitionSnap("working", 5000 + i * dtMs);
        if (i === 4) {
          midReturnBeforeFresh = { x: actors["o01"].x, y: actors["o01"].y };
          // dtMs=0으로 새 스냅샷만 투입했을 때 위치가 그대로 보존되는지 확인
          actors = h.core.step(actors, freshWorkSnap, 0);
          midReturnAfterFresh = { x: actors["o01"].x, y: actors["o01"].y };
        }
        const prevPos = { x: actors["o01"].x, y: actors["o01"].y };
        actors = h.core.step(actors, freshWorkSnap, dtMs);
        const curPos = { x: actors["o01"].x, y: actors["o01"].y };
        const dist = Math.hypot(curPos.x - prevPos.x, curPos.y - prevPos.y);
        if (dist > returnMaxStepDistance) returnMaxStepDistance = dist;
      }

      const returnedSeatPos = { x: actors["o01"].x, y: actors["o01"].y };
      const returnedMoving = actors["o01"].moving;

      // 전이 중간 장면 렌더링 (시각 캡처용)
      let renderActors = h.core.step({}, snapStart, 0, layout);
      renderActors = h.core.step(renderActors, snapAway, 500);
      h.renderFrame({ snapshot: snapAway, actors: renderActors, timeMs: 500, width: 800, scale: 2 });

      return {
        seat,
        away,
        startPos,
        midWayPos,
        arrivedAwayPos,
        arrivedAwayMoving,
        maxStepDistance,
        maxAllowedPerStep,
        returnMaxStepDistance,
        midReturnBeforeFresh,
        midReturnAfterFresh,
        returnedSeatPos,
        returnedMoving,
      };
    });

    // 1) 시작 위치는 좌석(seat)이고, 이동 중(5스텝 후)에는 좌석과 away 사이의 중간 지점에 위치함
    expect(transitionResult.startPos).toEqual(transitionResult.seat);
    expect(transitionResult.midWayPos).not.toEqual(transitionResult.seat);
    expect(transitionResult.midWayPos).not.toEqual(transitionResult.away);

    // 2) 프레임 간 이동 거리가 속도 상한(0.065 px/ms * 100ms = 6.5px)을 넘지 않는다(순간이동 없음)
    expect(transitionResult.maxStepDistance).toBeGreaterThan(0);
    expect(transitionResult.maxStepDistance).toBeLessThanOrEqual(transitionResult.maxAllowedPerStep);
    expect(transitionResult.returnMaxStepDistance).toBeLessThanOrEqual(transitionResult.maxAllowedPerStep);

    // 3) away 목적지에 정확히 도착하고, 이후 working 전환 시 좌석(seat)으로 정확히 돌아온다
    expect(transitionResult.arrivedAwayPos).toEqual(transitionResult.away);
    expect(transitionResult.arrivedAwayMoving).toBe(false);
    expect(transitionResult.returnedSeatPos).toEqual(transitionResult.seat);
    expect(transitionResult.returnedMoving).toBe(false);

    // 4) 이동 도중 새 스냅샷(같은 id)을 다시 넣어도 위치가 리셋되지 않는다
    expect(transitionResult.midReturnAfterFresh).toEqual(transitionResult.midReturnBeforeFresh);
    expect(transitionResult.midReturnAfterFresh).not.toEqual(transitionResult.seat);

    await expect(canvas).toHaveScreenshot("transition-midway.png");
  });
});

test.describe("5. Known Visual Issues 기록 (테스트 실패 없이 검증/문서화)", () => {
  test("[Known Issue 2] 움직이는 에이전트끼리 경로 계획(route) 시 동적 충돌 회피가 없다", async ({ page }) => {
    await openHarness(page);

    const collisionInfo = await page.evaluate(() => {
      const h = (window as any).__harness;
      const snapWork = {
        scope: "project",
        generatedAt: 0,
        projects: [
          {
            projectId: "p",
            projectName: "Studio",
            offices: [
              {
                id: "g",
                kind: "group",
                manager: {
                  id: "m",
                  name: "Boss",
                  provider: "claude",
                  state: "working",
                  stateSince: 0,
                  needsAttention: false,
                },
                members: [
                  {
                    id: "a1",
                    name: "Agent 1",
                    provider: "claude",
                    state: "working",
                    stateSince: 0,
                    needsAttention: false,
                  },
                  {
                    id: "a2",
                    name: "Agent 2",
                    provider: "codex",
                    state: "working",
                    stateSince: 0,
                    needsAttention: false,
                  },
                ],
              },
            ],
          },
        ],
      };
      const layout = h.core.layoutOffices(snapWork, 800);
      let actors = h.core.step({}, snapWork, 0, layout);
      actors["a2"].x = actors["a1"].x;
      actors["a2"].y = actors["a1"].y;
      const snapAway = JSON.parse(JSON.stringify(snapWork));
      snapAway.projects[0].offices[0].members[0].state = "away";
      snapAway.projects[0].offices[0].members[1].state = "away";
      actors = h.core.step(actors, snapAway, 100);
      const distanceBetweenMovingActors = Math.hypot(
        actors["a1"].x - actors["a2"].x,
        actors["a1"].y - actors["a2"].y,
      );
      return { distanceBetweenMovingActors };
    });

    test.info().annotations.push({
      type: "known-issue",
      description: "actors.ts의 route()/step()에 에이전트 간 동적 충돌 회피가 없어 같은 경로에서 좌표가 겹칠 수 있음",
    });
    // 두 액터는 서로 다른 away 슬롯으로 가지만 출발 직후에는 몸이 겹친 채 같은 속도로 움직인다(밀어내기 없음).
    expect(collisionInfo.distanceBetweenMovingActors).toBeLessThanOrEqual(2 * 100 * 0.065);
  });
});
