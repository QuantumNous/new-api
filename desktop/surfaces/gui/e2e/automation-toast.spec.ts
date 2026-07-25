// UX-026: the automation-start toast — top-right, 5s, schedule-fired runs only.
// The server pushes automation_run_started over the app-wide /ws/events stream;
// the toast names the automation, offers one View-run action (opens the run's
// session), an ✕, and auto-dismisses via the drain bar.
import { expect } from "@playwright/test";
import { sendAppEvent, test } from "./fixtures";

const RUN_STARTED = {
  type: "automation_run_started",
  data: {
    task_id: "task-1",
    task_title: "Daily AI News",
    session_id: "run-live-1",
    workspace: "/tmp/aw",
    agent: "cowork",
    trigger: "schedule",
  },
};

test("a schedule-fired run pops the toast; View run opens its session", async ({ page }) => {
  await page.goto("/");
  await sendAppEvent(page, RUN_STARTED);
  const toast = page.getByTestId("automation-toast");
  await expect(toast).toContainText("Automation started");
  await expect(toast).toContainText("Daily AI News");

  await toast.getByTestId("toast-view-run").click();
  await expect(page.getByTestId("automation-toast")).toHaveCount(0);
  // the run's session is now the active conversation (composer visible = session surface)
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();
});

test("the toast dismisses on ✕ and by itself after ~5s", async ({ page }) => {
  await page.goto("/");
  await sendAppEvent(page, RUN_STARTED);
  await expect(page.getByTestId("automation-toast")).toBeVisible();
  await page.getByTestId("toast-dismiss").click();
  await expect(page.getByTestId("automation-toast")).toHaveCount(0);

  await sendAppEvent(page, { ...RUN_STARTED, data: { ...RUN_STARTED.data, task_title: "Weekly CRM digest" } });
  await expect(page.getByTestId("automation-toast")).toContainText("Weekly CRM digest");
  // auto-dismiss: gone within the 5s drain (+ slack for CI)
  await expect(page.getByTestId("automation-toast")).toHaveCount(0, { timeout: 7000 });
});
