import { test, expect } from "./fixtures";

// Standing scoped approvals (UX-DECISIONS §25): the creation consent card renders the agent's
// proposed permission set (reads = disclosure, writes = grants); a recurring run's approval card
// offers the task-persistent "Allow every time" (in-app, run context only); and the automation's
// detail page lists granted rules with per-rule Revoke.

async function openTaskDetail(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Automations", exact: true }).click();
  await page.getByText("Daily AI News").first().click();
  await expect(page.getByRole("button", { name: /Run now/ })).toBeVisible();
}

test("creation consent card renders writes as grants and reads as disclosure", async ({ page }) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await expect(box).toBeVisible();

  await box.fill("please create an automation for the weekly digest");
  await page.getByRole("button", { name: "Send" }).click();

  // The approve-at-creation card carries the proposal instead of dumping raw JSON args.
  const grants = page.getByTestId("approval-grants");
  await expect(grants).toBeVisible();
  await expect(grants).toContainText("slack:T1/C1");
  await expect(grants).toContainText("always allowed once you approve");
  await expect(grants).toContainText("rohit/agent-platform");
  await expect(grants).toContainText("read-only");
  // Creation is minting surface #1 — there is no "Allow every time" here.
  await expect(page.getByRole("button", { name: "Allow every time" })).toHaveCount(0);

  await page.getByRole("button", { name: "Allow once" }).last().click();
  await expect(page.getByText("Done via create_scheduled_task [decision=once]")).toBeVisible();
});

test("a run session's approval card offers Allow every time and sends always_task", async ({
  page,
}) => {
  await openTaskDetail(page);
  await page.getByRole("button", { name: /Run now/ }).click();
  await expect(page.getByTestId("run-banner")).toBeVisible();
  // The manual run auto-sends the task prompt; wait for that turn to finish (the composer
  // re-arms) before driving the approval flow.
  await expect(page.getByText(/Echo: .*Fetch the latest AI news/)).toBeVisible();

  // An eligible gated write inside the run (the event carries the pinnable target).
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("post the digest");
  await page.getByRole("button", { name: "Send" }).click();

  const allowEvery = page.getByRole("button", { name: "Allow every time" });
  await expect(allowEvery).toBeVisible();
  // The task-persistent grant replaces the session-scoped Always-allow in run context.
  await expect(page.getByRole("button", { name: "Always allow", exact: true })).toHaveCount(0);

  await allowEvery.click();
  // The decision that rode the socket is the task-persistent one.
  await expect(page.getByText("Done via send_message [decision=always_task]")).toBeVisible();
});

test("a plain session never offers Allow every time, even for an eligible call", async ({
  page,
}) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await expect(box).toBeVisible();

  await box.fill("post the digest");
  await page.getByRole("button", { name: "Send" }).click();

  // Same tool, same target — but without a run context the standing grant isn't offered;
  // the session-scoped Always-allow remains.
  await expect(page.getByRole("button", { name: "Allow once" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow every time" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Always allow", exact: true }).last()).toBeVisible();
});

test("task detail lists standing rules under 'Allowed without asking'; Revoke removes one", async ({
  page,
}) => {
  await openTaskDetail(page);

  const grants = page.getByTestId("task-grants");
  await expect(page.getByText("Allowed without asking")).toBeVisible();
  await expect(grants).toContainText("send_message");
  await expect(grants).toContainText("slack:T1/C1");

  await grants.getByRole("button", { name: "Revoke" }).click();
  // The last rule is gone → the whole section disappears (nothing is allowed anymore).
  await expect(page.getByTestId("task-grants")).toHaveCount(0);
  await expect(page.getByText("Allowed without asking")).toHaveCount(0);
});
