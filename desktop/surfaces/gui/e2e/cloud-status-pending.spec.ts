// FB-013: a signed-in user opened the rail's connect pane and was told to sign in —
// the rail's single cloud-status fetch rendered PENDING (and any failure) as signed-out,
// with nothing that could ever flip it back. Contract now: unknown status shows a neutral
// "checking" line, never the sign-in ask; the pane polls while open; and completing
// sign-in from the inline prompt flips the pane itself (no other section's poll needed).
import { expect } from "@playwright/test";
import { test } from "./fixtures";

const openGmailPane = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  await page.getByTestId("access-toggle").click();
  await page.getByTestId("access-add-source").click();
  await page.getByTestId("access-add-gmail").click();
};

test("pending status shows 'checking', never the sign-in ask; resolves to one-click", async ({
  page,
}) => {
  // Hold every /v1/cloud/status response (test routes outrank the fixture's) — the user
  // IS signed in, the app just doesn't know yet.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/v1/cloud/status", async (route) => {
    await gate;
    await route.fulfill({
      json: { signed_in: true, account: "her@example.com", user_id: "u1", telemetry_enabled: true },
    });
  });

  await openGmailPane(page);
  await expect(page.getByTestId("cloud-status-pending")).toBeVisible();
  await expect(page.getByTestId("inline-cloud-sign-in")).toHaveCount(0);

  release();
  await expect(page.getByRole("button", { name: "Connect Gmail with one click" })).toBeVisible();
  await expect(page.getByTestId("cloud-status-pending")).toHaveCount(0);
});

test("signing in from the rail prompt flips the pane to one-click", async ({ page }) => {
  // Fixture default: signed out — the resolved signed-out state legitimately asks.
  await openGmailPane(page);
  const ask = page.getByTestId("inline-cloud-sign-in");
  await expect(ask).toBeVisible();
  await expect(page.getByTestId("cloud-status-pending")).toHaveCount(0);

  // The mock login flips CLOUD_STATE instantly; the inline button's own post-login poll
  // plus the CLOUD_CHANGED broadcast must flip THIS pane without any other page open.
  await ask.click();
  await expect(page.getByRole("button", { name: "Connect Gmail with one click" })).toBeVisible({
    timeout: 5_000,
  });
});
