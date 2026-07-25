import { test, expect } from "./fixtures";

// The macOS overlay layout (traffic-light insets) must never apply on Windows —
// Windows keeps its native title bar (alignment bug, 2026-07-21). The shell injects
// __OCW_PLATFORM__; this simulates each platform and checks the overlay class.
test("windows platform gets no tauri-overlay layout", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__TAURI__ = {}; // simulate the desktop shell
    (window as any).__OCW_PLATFORM__ = "windows";
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-platform", "windows");
  await expect(page.locator(".app.tauri-overlay")).toHaveCount(0);
});

test("macos platform keeps the overlay layout", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__TAURI__ = {};
    (window as any).__OCW_PLATFORM__ = "macos";
  });
  await page.goto("/");
  await expect(page.locator(".app.tauri-overlay").first()).toBeVisible();
});
