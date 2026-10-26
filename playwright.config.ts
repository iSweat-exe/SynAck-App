import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

// The interface is tested in a real browser, served by Vite, with the Rust side replaced by a
// fake backend (see `e2e/fakeTauri.ts`). The Rust side has its own tests (`cargo test`).
//
// Locally the Edge that Windows ships is used, so nothing has to be downloaded; on a CI runner,
// `npx playwright install chromium` provides the browser.
const channel = process.env.E2E_BROWSER ?? (process.env.CI === undefined ? "msedge" : undefined);

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-results",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["github"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: "http://localhost:1420",
    // Wide enough for the whole navbar, and no animation to wait for.
    viewport: { width: 1600, height: 900 },
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 }, channel },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
