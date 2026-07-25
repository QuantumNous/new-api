// Slack connection health (M3.6 Step 2, UX-DECISIONS §21): the list chip and the
// detail status line surface three honest layers — cloud sign-in, the desktop↔relay
// socket, per-workspace bot tokens — and never a synthetic "Slack is down" claim.
// The fixture's /v1/connectors/slack/status reads live+signed-out by default; each
// state here is forced with a later page.route override (later routes match first).
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

function statusPayload(overrides: any = {}) {
  return {
    ok: true,
    mode: "relay",
    relay: { state: "live", reconnects: 0, last_event_at: 1751970000, last_error: "" },
    signed_in: true,
    teams: { T1DL: { token_ok: true }, T2AC: { token_ok: true } },
    ...overrides,
  };
}

function forceStatus(page, overrides: any) {
  return page.route("**/v1/connectors/slack/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(statusPayload(overrides)),
    }),
  );
}

test("signed out: chip and status line say Sign-in needed", async ({ page }) => {
  await openConnectors(page);
  await expect(page.getByTestId("connector-slack")).toContainText("Sign-in needed");
  await page.getByTestId("connector-slack").click();
  await expect(page.getByTestId("slack-mode-badge")).toContainText(
    "Sign-in needed — relaying is paused",
  );
});

test("signed in + live socket: Live everywhere", async ({ page }) => {
  await forceStatus(page, {});
  await openConnectors(page);
  await expect(page.getByTestId("connector-slack")).toContainText("Live");
  await page.getByTestId("connector-slack").click();
  await expect(page.getByTestId("slack-mode-badge")).toContainText("Live · managed relay");
});

test("relay socket reconnecting: warn chip + status line", async ({ page }) => {
  await forceStatus(page, {
    relay: { state: "reconnecting", reconnects: 3, last_event_at: null, last_error: "boom" },
  });
  await openConnectors(page);
  await expect(page.getByTestId("connector-slack")).toContainText("Reconnecting");
  await page.getByTestId("connector-slack").click();
  await expect(page.getByTestId("slack-mode-badge")).toContainText("Reconnecting to the relay");
});

test("relay unreachable: Offline, not a Slack-outage claim", async ({ page }) => {
  await forceStatus(page, {
    relay: { state: "offline", reconnects: 0, last_event_at: null, last_error: "unreachable" },
  });
  await openConnectors(page);
  await expect(page.getByTestId("connector-slack")).toContainText("Offline");
  await page.getByTestId("connector-slack").click();
  await expect(page.getByTestId("slack-mode-badge")).toContainText("can't reach the relay");
});

test("one dead bot token: ⚠ chip + a warning on THAT workspace only", async ({ page }) => {
  await forceStatus(page, {
    teams: { T1DL: { token_ok: true }, T2AC: { token_ok: false } },
  });
  await openConnectors(page);
  await expect(page.getByTestId("connector-slack")).toContainText("Token");
  await page.getByTestId("connector-slack").click();
  await expect(page.getByTestId("token-warn-T2AC")).toContainText("Token revoked");
  await expect(page.getByTestId("token-warn-T1DL")).toHaveCount(0);
});
