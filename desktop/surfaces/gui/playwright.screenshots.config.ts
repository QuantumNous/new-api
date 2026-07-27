import { defineConfig, devices } from "@playwright/test";

// Marketing screenshot capture for the you-box.com download page. Runs on the same hermetic
// mocks as e2e/ (no Python backend, no real state), so the images are deterministic and can be
// regenerated from a clean checkout whenever the UI changes.
//
//   npm run screenshots
//
// Kept out of playwright.config.ts on purpose: these are not regression tests, they write
// binary assets into the web app, and they run serially at a fixed viewport.
const PORT = 5198;

export default defineConfig({
  testDir: "./screenshots",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
