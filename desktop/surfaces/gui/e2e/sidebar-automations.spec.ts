// UX-023: automations get sidebar presence — an "Automations" nav row under Search
// (aggregate unseen badge) and a "Scheduled" band with ONE entry per automation
// (name + cadence + unseen-runs badge). Opening an automation's detail marks it
// seen: the badge clears immediately via the AUTOMATIONS_CHANGED broadcast, and
// runs newer than the pre-open mark wear a "new" pill inside the detail.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("nav row + Scheduled band render with unseen badges; runs stay out of Recent", async ({
  page,
}) => {
  await page.goto("/");

  // Nav row sits right under Search — no badge of its own (owner call: the
  // Scheduled entry alone carries the count).
  const nav = page.getByTestId("nav-automations");
  await expect(nav).toBeVisible();
  await expect(nav).toContainText("Automations");
  await expect(nav).not.toContainText("2");

  // Scheduled band: one entry PER AUTOMATION — never per run. The noisy task wears
  // its badge; the quiet one shows none.
  const band = page.getByTestId("scheduled-band");
  await expect(band.getByTestId("scheduled-task-1")).toContainText("Daily AI News");
  await expect(band.getByTestId("scheduled-task-1")).toContainText("2");
  await expect(band.getByTestId("scheduled-task-2")).toContainText("Weekly CRM digest");
  await expect(band.getByTestId("scheduled-task-2")).not.toContainText("2");

  // Runs never appear as session rows (their sessions are __run__-prefixed and the
  // server hides them) — the band's entries are the only automation presence.
  await expect(page.getByTitle("__run__r1")).toHaveCount(0);
});

test("opening a Scheduled entry lands on the detail, marks seen, clears the badge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("scheduled-task-1").click();

  // The Automations surface opens ON that automation's detail…
  await expect(page.getByRole("heading", { name: "Daily AI News" })).toBeVisible();
  // …runs newer than the pre-open seen mark wear the "new" pill…
  await expect(page.getByTestId("run-new").first()).toBeVisible();
  // …and the entry's badge clears without waiting for any poll (mark-seen broadcast).
  await expect(page.getByTestId("scheduled-task-1")).not.toContainText("2");
});

test("the nav row opens the Automations overview", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-automations").click();
  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
});

test("deleting an automation clears the band at once; nav re-entry lands on the list", async ({
  page,
}) => {
  await page.goto("/");
  // Open the automation from the band, delete it from the detail.
  await page.getByTestId("scheduled-task-2").click();
  await expect(page.getByRole("heading", { name: "Weekly CRM digest" })).toBeVisible();
  await page.getByRole("button", { name: /Delete/ }).click();

  // The Scheduled band drops the entry immediately (broadcast, not the 15s poll)…
  await expect(page.getByTestId("scheduled-task-2")).toHaveCount(0);

  // …and after visiting a session, the nav row must land on the OVERVIEW — the
  // remembered detail target for a deleted automation once left "Loading…" forever.
  await page.getByTitle("Weekly plan 1").click();
  await page.getByTestId("nav-automations").click();
  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  await expect(page.getByText("Loading…")).toHaveCount(0);
});
