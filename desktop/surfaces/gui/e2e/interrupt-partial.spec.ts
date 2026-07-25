// Owner-hit 2026-07-22: Stop mid-stream kept the partial visible — until the NEXT message's
// turn_start wiped it, because the partial only ever lived in the ephemeral streaming buffer
// (assistant_message is what promotes text into the transcript, and an interrupted turn never
// emits one). The fix flushes the buffer into a durable assistant item on interrupted/error.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("interrupted partial stream survives the next turn", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("stream the epic");
  await box.press("Enter");

  // Let a few deltas land, then stop the turn.
  await expect(page.getByText("The epic scrolls ever onward").first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /Stop/ }).click();
  await expect(page.getByText("Interrupted.").first()).toBeVisible({ timeout: 5_000 });

  // The partial is still on screen after the stop…
  await expect(page.getByText("The epic scrolls ever onward").first()).toBeVisible();

  // …and — the regression — still there after the next turn starts and completes.
  await box.fill("continue please");
  await box.press("Enter");
  await expect(page.getByText("Echo: continue please", { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("The epic scrolls ever onward").first()).toBeVisible();
});
