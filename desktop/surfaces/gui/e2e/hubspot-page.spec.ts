// The HubSpot detail page (M3.6 Step 4, UX-DECISIONS §21): multi-portal with
// Default/Sandbox/access tags, the add-modal with One click (read | write
// consent radios) | Manual private-app pills, and the hidden-fields denylist.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

async function signIn(page) {
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
}

test("connect via modal: access radios pick the consent tier; tags reflect it", async ({
  page,
}) => {
  await openConnectors(page);
  await signIn(page);

  // Available row → Connect → the two-pill modal with the access radios
  await page.getByTestId("connector-hubspot").getByRole("button", { name: "Connect" }).click();
  const modal = page.getByTestId("add-connection-modal");
  await expect(modal.getByTestId("hubspot-access-read")).toBeChecked(); // read-only default
  await expect(modal).toContainText("never delete");
  await modal.getByTestId("hubspot-access-write").check();
  await modal.getByTestId("modal-connect-hubspot").click();
  await page.keyboard.press("Escape");

  // the mock connects instantly; the row moves to Connected and navigates
  await expect(page.getByTestId("connector-hubspot")).toContainText("Acme Inc", {
    timeout: 10_000,
  });
  await page.getByTestId("connector-hubspot").click();
  const row = page.getByTestId("hubspot-portal-111");
  await expect(row).toContainText("Default");
  await expect(page.getByTestId("hubspot-access-tag-111")).toContainText("read & write");
});

test("manual pane offers the private-app token (no duplicated one-click)", async ({
  page,
}) => {
  await openConnectors(page);
  await page.getByTestId("connector-hubspot").getByRole("button", { name: "Connect" }).click();
  const modal = page.getByTestId("add-connection-modal");
  await modal.getByTestId("modal-pane-manual").click();
  await expect(modal.getByPlaceholder("pat-…")).toBeVisible();
  await expect(modal.getByTestId("managed-connect")).toHaveCount(0); // one-click lives on the other pill
});

test("second portal: sandbox tag, make-default, disconnect repoints", async ({ page }) => {
  await openConnectors(page);
  await signIn(page);
  await page.getByTestId("connector-hubspot").getByRole("button", { name: "Connect" }).click();
  await page.getByTestId("modal-connect-hubspot").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("connector-hubspot")).toContainText("Acme Inc", { timeout: 10_000 });
  await page.getByTestId("connector-hubspot").click();

  // add the sandbox portal from the page's header button
  await page.getByTestId("add-portal-btn").click();
  await page.getByTestId("modal-connect-hubspot").click();
  await page.keyboard.press("Escape");
  const sandbox = page.getByTestId("hubspot-portal-222");
  await expect(sandbox).toContainText("Sandbox", { timeout: 10_000 });

  await page.getByTestId("hubspot-make-default-222").click();
  await expect(sandbox).toContainText("Default");
  await page.getByTestId("hubspot-disconnect-222").click();
  await expect(page.getByTestId("hubspot-portal-222")).toHaveCount(0);
  await expect(page.getByTestId("hubspot-portal-111")).toContainText("Default");
});

test("hidden fields round-trip and read back normalized", async ({ page }) => {
  await openConnectors(page);
  await signIn(page);
  await page.getByTestId("connector-hubspot").getByRole("button", { name: "Connect" }).click();
  await page.getByTestId("modal-connect-hubspot").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("connector-hubspot")).toContainText("Acme Inc", { timeout: 10_000 });
  await page.getByTestId("connector-hubspot").click();

  const row = page.getByTestId("hubspot-hidden-fields");
  await row.getByRole("textbox").fill("Salary");
  await row.getByRole("textbox").press("Enter");
  await expect(row).toContainText("salary"); // normalized lowercase from the PATCH echo
  await row.getByTitle("remove").click();
  await expect(row).not.toContainText("salary");
});
