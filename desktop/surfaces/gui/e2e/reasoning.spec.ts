// Model-layer roadmap item 4 (2026-07-22): reasoning traces. Live turn shows a quiet
// pulsing "Thinking…" disclosure that streams the trace; once the message finalizes the
// trace folds into a collapsed "Thought process" disclosure on the answer bubble.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("thinking streams live, then persists as a collapsed disclosure on the answer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("think hard about this");
  await box.press("Enter");

  // Live phase: the Thinking… block is up while deltas tick in; expanding shows the trace.
  await expect(page.getByText("Thinking…").first()).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("thinking-toggle").click();
  await expect(page.getByTestId("thinking-body")).toContainText("Weighing options.");

  // Finalized: the answer bubble carries a collapsed "Thought process" disclosure.
  await expect(page.getByText("Decision made.").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Thinking…")).toHaveCount(0);
  const toggle = page.getByTestId("thinking-toggle");
  await expect(toggle).toHaveText(/Thought process/);
  await expect(page.getByTestId("thinking-body")).toHaveCount(0); // collapsed by default
  await toggle.click();
  await expect(page.getByTestId("thinking-body")).toContainText(
    "Weighing options. Comparing tradeoffs. Settling it.",
  );
});
