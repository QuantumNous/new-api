import { test, expect } from "./fixtures";

// Personas is launch-flagged off by default — this suite covers the flagged-on flows.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ocw.flag.personas", "1"));
});

// Regression for the invisible-after-install bug (2026-07-03): enabling a persona in
// Settings ▸ Personas must surface it EVERYWHERE without a reload — the New-Session picker and
// the grouped sidebar — via the PERSONAS_CHANGED event (and backend enable-implies-surface).

test("enabling an installed persona surfaces it in picker + sidebar without reload", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator(".sidebar");

  // Disabled install: absent from the persona picker and the grouped sidebar.
  await page.getByLabel("Choose a persona").click();
  const menu = page.locator(".newsplit-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Acme Notes")).toHaveCount(0);
  await page.locator(".fixed.inset-0.z-20").click(); // close via backdrop
  await expect(sidebar.getByText("Acme Notes")).toHaveCount(0);

  // Enable it on the Personas page.
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Personas", exact: true }).click();
  const row = page.locator(".divide-y > div").filter({ hasText: "Acme Notes" });
  // Controlled checkbox: the DOM state flips only after the POST round-trip, so click + expect
  // (a plain .check() asserts the state synchronously and fails).
  const enabled = row.getByRole("checkbox", { name: "Enabled" });
  await enabled.click();
  await expect(enabled).toBeChecked();

  // No reload: the sidebar group and the picker both pick it up via PERSONAS_CHANGED.
  await expect(sidebar.getByText("Acme Notes")).toBeVisible();
  await page.getByLabel("Choose a persona").click();
  await expect(page.locator(".newsplit-menu").getByText("Acme Notes")).toBeVisible();
});

// Disable-archives (§18): disabling a persona archives its conversations, so the confirm must
// interpose when there's something to archive — and only then. The sidebar section disappears
// with the persona (its sessions are archived, so the never-orphan rule no longer holds it).
test("disabling a persona with conversations asks first, then archives them", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByText("Ops", { exact: true })).toBeVisible();

  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Personas", exact: true }).click();
  const row = page.locator(".divide-y > div").filter({ hasText: "Ops Coworker" });
  const enabled = row.getByRole("checkbox", { name: "Enabled" });

  // Unchecking only ARMS the confirm — the flag must not flip yet.
  await enabled.click();
  const warning = page.getByTestId("persona-disable-warning-ops");
  await expect(warning).toContainText("archives its 1 conversation");
  await expect(enabled).toBeChecked();

  // Backing out leaves everything as it was.
  await page.getByRole("button", { name: "Keep enabled" }).click();
  await expect(warning).toHaveCount(0);
  await expect(enabled).toBeChecked();

  // Arm again and confirm: persona disables, its section leaves the sidebar without a reload.
  await enabled.click();
  await page.getByTestId("persona-disable-confirm-ops").click();
  await expect(enabled).not.toBeChecked();
  await expect(sidebar.getByText("Ops", { exact: true })).toHaveCount(0);
});

test("disabling a persona with no conversations skips the confirm", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Personas", exact: true }).click();
  const row = page.locator(".divide-y > div").filter({ hasText: "Code" });
  const enabled = row.getByRole("checkbox", { name: "Enabled" });
  await enabled.click();
  await expect(page.getByTestId("persona-disable-warning-code")).toHaveCount(0);
  await expect(enabled).not.toBeChecked();
});
