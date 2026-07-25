// Cloud sign-in (§26: the sidebar account row is the sign-in home) + managed one-click
// connectors. Product invariant under test: manual token setup is always present; managed
// one-click is an ADDITION that appears only when signed in.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Connectors", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connectors" })).toBeVisible();
}

async function signIn(page) {
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
}

test("signed out: the account row is the sign-in home; managed connector still connects manually", async ({
  page,
}) => {
  await page.goto("/");
  const row = page.getByTestId("account-row");
  await expect(row).toContainText("Not signed in");

  // The menu leads with the sign-in CTA and always lists Inbox + Connectors.
  await row.click();
  const menu = page.getByTestId("account-menu");
  await expect(menu).toContainText("one-click connections need OpenWorker Cloud");
  await expect(menu.getByTestId("account-sign-in")).toBeVisible();
  await expect(menu.getByRole("button", { name: "Inbox" })).toBeVisible();
  await menu.getByRole("button", { name: "Connectors", exact: true }).click();

  // The managed-capable connector's add-modal shows the hint + manual fields, no
  // one-click button while signed out.
  await page.getByTestId("connector-gmail").getByRole("button", { name: "Connect" }).click();
  const modal = page.getByTestId("add-connection-modal");
  await expect(modal.getByTestId("managed-connect")).toContainText("Sign in to OpenWorker Cloud");
  await expect(modal.locator("input[type=password]")).toBeVisible(); // manual field rendered
  await expect(modal.getByRole("button", { name: /one click/i })).toHaveCount(0);
});

test("signed in: account row shows the name; one-click appears; sign out from the menu", async ({
  page,
}) => {
  await openConnectors(page);
  await signIn(page);

  await page.getByTestId("connector-gmail").getByRole("button", { name: "Connect", exact: true }).click();
  const modal = page.getByTestId("add-connection-modal");
  await expect(modal.getByRole("button", { name: /Connect Gmail with one click/i })).toBeVisible();
  // the manual path must still be offered alongside
  await expect(modal.getByTestId("managed-connect")).toContainText("or connect manually");
  await page.keyboard.press("Escape");

  // The menu header carries the email; Sign out flips the row back.
  await page.getByTestId("account-row").click();
  const menu = page.getByTestId("account-menu");
  await expect(menu).toContainText("rohit@openworker.com");
  await menu.getByRole("button", { name: "Sign out" }).click();
  await page.getByTestId("account-row").click(); // reopen → status refetch
  await expect(page.getByTestId("account-row")).toContainText("Not signed in");
});

test("telemetry/Privacy card is gone from Settings (owner ask 2026-07-22), signed in or out", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByTestId("telemetry-toggle")).toHaveCount(0);
  await expect(page.getByText("Privacy", { exact: true })).toHaveCount(0);

  await signIn(page);
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("telemetry-toggle")).toHaveCount(0);
  await expect(page.getByText("Privacy", { exact: true })).toHaveCount(0);
});
