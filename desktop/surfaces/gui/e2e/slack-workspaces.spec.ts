// The Slack detail page (M3.6, UX-DECISIONS §21): one group per workspace with
// People / Waiting / Listening rows, add-workspace via the header-button MODAL
// (One click | Manual), per-workspace disconnect (stop-relaying-only), and the
// manual Socket-Mode card so neither connect path regresses.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openSlackPage(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await page.getByTestId("connector-slack").click();
}

test("lists every connected workspace as its own group", async ({ page }) => {
  await openSlackPage(page);
  await expect(page.getByTestId("slack-workspace-T1DL")).toContainText("deeplearning.ai");
  await expect(page.getByTestId("slack-workspace-T2AC")).toContainText("acme-partners");
  // The workspace domain is the visible differentiator (ids demote to hover).
  await expect(page.getByTestId("slack-workspace-T1DL")).toContainText("· dlaiteam");
  await expect(page.getByTestId("slack-workspace-T2AC")).toContainText("· acmehq");
  // the workspace with people/parked shows the People row; the quiet one shows the hint
  await expect(page.getByTestId("slack-workspace-T1DL")).toContainText("People");
  await expect(page.getByTestId("slack-workspace-T2AC")).toContainText("No one allowed yet");
});

test("Add workspace opens the modal; signed out shows the sign-in hint, signed in installs", async ({
  page,
}) => {
  await openSlackPage(page);
  await page.getByTestId("add-workspace-btn").click();
  const modal = page.getByTestId("add-connection-modal");
  await expect(modal).toContainText("Sign in to OpenWorker Cloud"); // signed out
  // Manual pane is right there too — both modes, one entry point
  await modal.getByTestId("modal-pane-manual").click();
  await expect(modal.getByPlaceholder("Bot token · xoxb-…")).toBeVisible();
  await page.keyboard.press("Escape");

  // sign in from the list's cloud strip, then install one-click
  await page.getByTestId("connectors-breadcrumb").click();
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  await page.getByTestId("connector-slack").click();
  await page.getByTestId("add-workspace-btn").click();
  await page.getByTestId("modal-add-to-slack").click();
  // the mock completes the browser install instantly; the page's poll shows it
  await expect(page.getByTestId("slack-workspace-T3NEW")).toContainText("new-workspace", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("slack-workspace-T1DL")).toBeVisible(); // existing ones stay
});

test("disconnect removes one workspace and keeps the rest relaying", async ({ page }) => {
  await openSlackPage(page);
  await page.getByTestId("disconnect-workspace-T2AC").click();
  await expect(page.getByTestId("slack-workspace-T2AC")).toHaveCount(0);
  await expect(page.getByTestId("slack-workspace-T1DL")).toBeVisible();
});

test("manual Socket Mode: one card with the flat allow-list (no regression)", async ({
  page,
}) => {
  // Override the connectors payload AFTER mockApi so this test sees a manual-mode Slack
  // (routes registered later match first).
  await page.route("**/v1/connectors", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connectors: [
          {
            name: "slack", title: "Slack", icon: "#", blurb: "Two-way Slack messaging.",
            auth: "bot_token", two_way: true, available: true, brand_color: "#611f69",
            logo: "slack", fields: [], instructions: [], connected: true, account: "acme",
            enabled: true, allowed_users: ["U0OK"], allowed_user_names: { U0OK: "Rohit" },
            tools: [], managed: true, managed_profile: false, mode: "", workspaces: [],
            unauthorized: [],
          },
        ],
      }),
    }),
  );
  await openSlackPage(page);
  await expect(page.getByTestId("slack-mode-badge")).toContainText("Socket Mode");
  const card = page.getByTestId("slack-manual-card");
  await expect(card).toContainText("acme");
  await expect(card).toContainText("Rohit"); // flat allow-list chip, named
});
