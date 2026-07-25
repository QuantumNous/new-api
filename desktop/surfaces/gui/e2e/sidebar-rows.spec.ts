import { test, expect } from "./fixtures";

// Session rows are SINGLE-LINE (UX-DECISIONS §7, 2026-07-21): title only — the
// persona/workspace subtitle is gone (personas are launch-flagged off; when they return
// the persona surfaces on hover, not as a second line).
test("recent session rows render the title only — no persona subtitle", async ({ page }) => {
  await page.goto("/");
  const row = page
    .locator(".sidebar .group")
    .filter({ hasText: "Draft the launch note" })
    .first();
  await expect(row).toBeVisible();
  const text = (await row.innerText()).trim();
  expect(text).toBe("Draft the launch note");
});
