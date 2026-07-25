import { test, expect } from "./fixtures";

test("app loads with the persona nav and composer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("OpenWorker").first()).toBeVisible();
  // New session + Search are the fixed top nav.
  await expect(page.getByRole("button", { name: /New session/i })).toBeVisible();
  // The persona groups render from /v1/personas.
  await expect(page.getByText("Ops", { exact: true })).toBeVisible();
});
