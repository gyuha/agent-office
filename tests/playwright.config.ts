import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// 기준 이미지는 이 Chromium 개정에서 찍었다. 캐시에 더 새 개정이 생겨도(다른 도구가 설치) DOM 글꼴 렌더링이 달라져
// 헤더·필터 바 기준 이미지가 깨지므로 "가장 새 것"이 아니라 이 개정을 쓴다. 기준 이미지를 새 개정으로 다시 찍을 때만 바꾼다.
const BASELINE_CHROMIUM_REVISION = process.env.AO_CHROMIUM_REVISION ?? "1248";

function resolveBrowserUse() {
  const cacheDir = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (fs.existsSync(cacheDir)) {
    const all = fs
      .readdirSync(cacheDir)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse();
    const pinned = all.filter((name) => name === `chromium-${BASELINE_CHROMIUM_REVISION}`);
    if (!pinned.length) console.warn(`[playwright.config] chromium-${BASELINE_CHROMIUM_REVISION} not installed; falling back to the newest cached Chromium (baseline text rendering may differ)`);
    const entries = pinned.length ? pinned : all;
    for (const dir of entries) {
      const macArm = path.join(
        cacheDir,
        dir,
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      );
      if (fs.existsSync(macArm)) {
        return { launchOptions: { executablePath: macArm } };
      }
      const macX64 = path.join(
        cacheDir,
        dir,
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      );
      if (fs.existsSync(macX64)) {
        return { launchOptions: { executablePath: macX64 } };
      }
    }
  }
  return { channel: "chrome" };
}

export default defineConfig({
  globalSetup: "./visual/harness/global-setup.mjs",
  testDir: "./visual",
  testMatch: "**/*.spec.ts",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: "allow",
    },
  },
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    ...resolveBrowserUse(),
  },
});
