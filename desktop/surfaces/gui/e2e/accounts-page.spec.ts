// The generic multi-account detail page (AccountsDetail) + the modal's generic
// one-click pane, exercised via Notion — the pattern all batch-2 connectors
// share (accounts.py layer: AccountRow shape, Default badge, per-account ×).
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

async function signInAndConnectFirstWorkspace(page) {
  await openConnectors(page);
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  // Available row → modal with One click | Manual pills → generic one-click
  await page
    .getByTestId("connector-notion")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expect(page.getByTestId("modal-pane-manual")).toBeVisible();
  await page.getByTestId("modal-generic-one-click").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("connector-notion")).toContainText("Rohit's Workspace", {
    timeout: 10_000,
  });
}

test("one-click connect, add a second workspace from the page; first stays default", async ({
  page,
}) => {
  await signInAndConnectFirstWorkspace(page);
  await page.getByTestId("connector-notion").click();
  await expect(page.getByTestId("accounts-detail")).toBeVisible();

  await page.getByTestId("add-account-btn").click();
  const first = page.getByTestId("account-ws-1");
  const second = page.getByTestId("account-ws-2");
  await expect(second).toBeVisible({ timeout: 10_000 });
  await expect(first).toContainText("Rohit's Workspace");
  await expect(first).toContainText("Default");
  await expect(second).not.toContainText("Default");
  // list row summarizes the multi-account state
  await page.getByTestId("connectors-breadcrumb").click();
  await expect(page.getByTestId("connector-notion")).toContainText("2 accounts");
});

test("Make default moves the badge; disconnecting the default repoints it", async ({
  page,
}) => {
  await signInAndConnectFirstWorkspace(page);
  await page.getByTestId("connector-notion").click();
  await page.getByTestId("add-account-btn").click();
  await expect(page.getByTestId("account-ws-2")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("account-make-default-ws-2").click();
  await expect(page.getByTestId("account-ws-2")).toContainText("Default");
  await expect(page.getByTestId("account-ws-1")).not.toContainText("Default");

  await page.getByTestId("account-disconnect-ws-2").click();
  await expect(page.getByTestId("account-ws-2")).toHaveCount(0);
  await expect(page.getByTestId("account-ws-1")).toContainText("Default");
});

test("signed out: the modal's one-click pane offers inline cloud sign-in; manual pane has the token form", async ({
  page,
}) => {
  await openConnectors(page);
  await page
    .getByTestId("connector-notion")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expect(page.getByTestId("inline-cloud-sign-in")).toBeVisible();
  await page.getByTestId("modal-pane-manual").click();
  await expect(page.getByPlaceholder("ntn_…")).toBeVisible();
});
