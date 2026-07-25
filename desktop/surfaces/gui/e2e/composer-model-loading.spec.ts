import { test, expect } from "./fixtures";

// The composer must never advertise models the backend didn't confirm: before the
// /v1/settings list arrives (cold app boot races the sidecar), the picker is a
// disabled "Loading models…" chip — NOT a hardcoded fallback list, which went stale
// and offered phantom ids (caught by owner, 2026-07-21).
test("picker shows a disabled Loading-models chip until the list arrives", async ({ page }) => {
  await page.route("**/v1/settings", (r) =>
    r.fulfill({
      json: { model: "gpt-5.5", models: [], model_labels: {}, has_key: true, model_ready: true, onboarded: true, nav_layout: "flat" },
    }),
  );
  await page.goto("/");
  const chip = page.getByTestId("models-loading");
  await expect(chip).toBeVisible();
  await expect(chip).toBeDisabled();
  await expect(chip).toContainText("Loading models…");
});
