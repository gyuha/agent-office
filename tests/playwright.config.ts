import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

function resolveBrowserUse() {
  const cacheDir = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (fs.existsSync(cacheDir)) {
    const entries = fs
      .readdirSync(cacheDir)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse();
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
