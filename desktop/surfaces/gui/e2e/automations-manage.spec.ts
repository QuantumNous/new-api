// Automations management — the parts of Rohit's manual pass that automations.spec.ts (run-banner +
// Back) doesn't cover: the task list, triggering a manual run (POST .../run appends a run and opens
// its live session), pausing via the enable toggle, and deleting. Seeded with one task.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openAutomations(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Automations", exact: true }).click();
  await expect(page.getByText("Recurring tasks OpenWorker runs on a schedule.")).toBeVisible();
}

test("lists a scheduled task with its schedule and run count", async ({ page }) => {
  await openAutomations(page);
  const card = page.locator(".sched-card", { hasText: "Daily AI News" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Every day at ~5:40 PM");
  await expect(card).toContainText("last running");
});

test("Run now triggers a manual run and opens its live session", async ({ page }) => {
  await openAutomations(page);
  await page.locator(".sched-card", { hasText: "Daily AI News" }).click();
  await page.getByRole("button", { name: /Run now/ }).click();
  // The manual run opens as a session with the automation-context banner.
  const banner = page.getByTestId("run-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Daily AI News");
});

test("enable toggle pauses the task", async ({ page }) => {
  await openAutomations(page);
  await page.locator(".sched-card", { hasText: "Daily AI News" }).click();
  await expect(page.getByText(/Active · next/)).toBeVisible();
  // The checkbox is visually hidden behind a styled slider — click the label wrapper.
  await page.locator("label.switch").click();
  await expect(page.getByText("Paused", { exact: false })).toBeVisible();
});

test("delete removes the task; deleting the last one shows the empty state", async ({ page }) => {
  await openAutomations(page);
  await page.locator(".sched-card", { hasText: "Daily AI News" }).click();
  await page.getByRole("button", { name: /Delete/ }).click();
  // Back on the list, the deleted task is gone; the other seeded task remains.
  await expect(page.locator(".sched-card", { hasText: "Daily AI News" })).toHaveCount(0);
  await expect(page.locator(".sched-card", { hasText: "Weekly CRM digest" })).toHaveCount(1);

  await page.locator(".sched-card", { hasText: "Weekly CRM digest" }).click();
  await page.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByText(/No scheduled tasks yet/)).toBeVisible();
});
