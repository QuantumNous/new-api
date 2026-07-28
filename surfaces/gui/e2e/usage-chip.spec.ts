// Token-usage chip (OPE-42): after a turn reports usage, a quiet meter+count chip appears
// in the composer's bottom row; clicking it opens the per-model breakdown popover with the
// context-window fill. The fake agent attaches fixed usage to every echo turn
// (input 1k / output 200 / cache_read 8k / cache_write 800 — 10k per turn), and the
// settings fixture maps the default model to a 200k context window.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("usage chip appears after a turn and opens the breakdown popover", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();

  // Fresh session: no usage yet — the chip is hidden entirely.
  await expect(page.getByTestId("usage-chip")).toHaveCount(0);

  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("hello");
  await box.press("Enter");
  await expect(page.getByText("Echo: hello", { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });

  // Chip shows the session total (1k + 200 + 8k + 800 = 10k).
  const chip = page.getByTestId("usage-chip");
  await expect(chip).toContainText("10k");

  // Popover: context fill (9.8k prompt-side of 200k = 5%) + per-model breakdown.
  await chip.click();
  const pop = page.getByTestId("usage-popover");
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("Context window");
  await expect(pop).toContainText("9.8k of 200k · 5%");
  await expect(pop).toContainText("Session totals");
  await expect(pop).toContainText("Claude Opus 4.8 · Anthropic");
  // Cache split present → the input rows read as components of Total input.
  await expect(pop).toContainText("Uncached input");
  await expect(pop).toContainText("Cache reads");
  await expect(pop).toContainText("Cache writes");
  // Total input = fresh 1k + cache_read 8k + cache_write 800 (cumulative billed input).
  await expect(pop).toContainText("Total input");
  await expect(pop).toContainText("9.8k");
  await expect(pop).toContainText("10k tokens");

  // Second turn accumulates (totals double), and the scrim click closes the popover.
  await page.mouse.click(10, 10);
  await expect(pop).toHaveCount(0);
  await box.fill("again");
  await box.press("Enter");
  await expect(page.getByText("Echo: again", { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(chip).toContainText("20k");
});

test("usage resets on a new session", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("hello");
  await box.press("Enter");
  await expect(page.getByTestId("usage-chip")).toContainText("10k", { timeout: 10_000 });

  // "＋ New session" wipes the transcript — and the usage accumulation with it.
  await page.getByRole("button", { name: /New session/ }).first().click();
  await expect(page.getByTestId("usage-chip")).toHaveCount(0);
});
