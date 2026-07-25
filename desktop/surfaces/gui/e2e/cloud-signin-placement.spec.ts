// Regression guard (shipped once, 2026-07-09; reshaped by §26): cloud sign-in must be
// reachable by a FRESH user. The sidebar account row is the permanent sign-in home —
// always visible, never below any fold — and every signed-out one-click pane carries a
// real Sign-in button, not a hint pointing at another page.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Connectors", exact: true }).click();
}

test("the account row is always visible and signs in from its menu", async ({ page }) => {
  await page.goto("/");
  const row = page.getByTestId("account-row");
  await expect(row).toBeVisible();
  await expect(row).toContainText("Not signed in");

  await row.click();
  await page.getByTestId("account-sign-in").click();
  await expect(row).toContainText("Rohit", { timeout: 10_000 });

  // Sign out is right there in the same menu once signed in.
  await row.click();
  await expect(
    page.getByTestId("account-menu").getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
});

test("signed-out one-click pane signs in inline, then connects", async ({ page }) => {
  await openConnectors(page);
  // Fresh user path: Available → Connect → the pane must offer sign-in itself.
  await page
    .getByTestId("connector-gmail")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await page.getByTestId("inline-cloud-sign-in").click();
  // The mock signs in instantly; the section's poll re-renders the pane armed.
  await expect(
    page.getByRole("button", { name: /Connect Gmail with one click/i }),
  ).toBeVisible({ timeout: 10_000 });
});
