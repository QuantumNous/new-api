// The Automations quickstart (UX-DECISIONS §29): ONE template system — the former onboarding
// recipe (role templates, connect rows, lazy cloud sign-in, §25 consent) merged into the page's
// "Start from a template" grid. Cards carry §27's connector-dot vocabulary; picking one expands
// the configure card. The `ob-*` testids moved here with the machinery.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openAutomations(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Automations", exact: true }).click();
  await expect(page.getByText("Recurring tasks OpenWorker runs on a schedule.")).toBeVisible();
}

// The fixtures seed one task, so the quickstart isn't on the bare list — surface it via the
// "+ New automation" toggle (empty state shows it without the toggle; covered indirectly by
// the delete test in automations-manage.spec.ts).
async function openQuickstart(page) {
  await openAutomations(page);
  await page.getByRole("button", { name: "+ New automation" }).click();
  await expect(page.getByText("Start from a template")).toBeVisible();
}

test("role recipe: connect rows, lazy single sign-in, channel by name, consent mints the grant", async ({
  page,
}) => {
  await openQuickstart(page);

  // Pipeline digest: Slack is connected in fixtures, HubSpot isn't. No recipe form yet.
  await page.getByTestId("qs-template-pipeline").click();
  const cfg = page.getByTestId("qs-configure");
  // §30: the card names its template — "SET UP · Pipeline digest" — instead of starting
  // abruptly after the grid.
  await expect(cfg).toContainText("Set up");
  await expect(cfg).toContainText("Pipeline digest");
  await expect(cfg.getByText("✓ Connected").first()).toBeVisible();
  await expect(page.getByTestId("ob-recipe")).toHaveCount(0);
  await expect(page.getByTestId("ob-create")).toBeDisabled();
  await expect(page.getByTestId("ob-create-hint")).toContainText("Connect HubSpot");

  // Connect HubSpot while signed out → the ONE cloud pane appears; signing in finishes the
  // pending connect without another click.
  await page.getByTestId("ob-connect-hubspot").click();
  await expect(page.getByTestId("ob-cloudpane")).toBeVisible();
  await page.getByTestId("ob-cloud-signin").click();
  await expect(page.getByTestId("ob-recipe")).toBeVisible({ timeout: 15_000 });

  // Connected but no channel → the gate names the missing piece (tester catch 2026-07-12).
  await expect(page.getByTestId("ob-create-hint")).toContainText("Pick a channel");

  // Channel picked BY NAME; §25 consent pre-checked; create lands on the task's detail with
  // the standing grant listed.
  const chan = page.locator('[data-testid="ob-channel"] input');
  await chan.click();
  await page.getByTestId("channel-suggestions").getByText("#ocw-test").click();
  await expect(chan).toHaveValue("#ocw-test");
  await expect(page.getByTestId("ob-consent")).toBeChecked();
  await page.getByTestId("ob-create").click();

  await expect(page.getByRole("button", { name: /Run now/ })).toBeVisible();
  await expect(page.getByText("Pipeline digest").first()).toBeVisible();
  await expect(page.getByTestId("task-grants")).toContainText("send_message");
});

test("connect narrates itself: Opening browser → waiting strip → Cancel restores the button", async ({
  page,
}) => {
  await openQuickstart(page);
  // Sign in out-of-band so Connect goes straight to the broker flow (no cloud pane).
  await page.evaluate(() => fetch("/v1/cloud/login", { method: "POST" }));

  // Hold the connect POST open (§30's 4–5 s of dead air) and never flip the fixture's
  // connected state — the waiting strip owns the gap until the user acts.
  let release: (() => void) | undefined;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/v1\/connectors\/hubspot\/connect-managed$/, async (route) => {
    await held;
    await route.fulfill({ json: { ok: true } });
  });

  await page.getByTestId("qs-template-pipeline").click();
  // The mount refresh must land the signed-in status before Connect is clicked, or the
  // click would open the sign-in pane instead of the broker flow.
  await page.waitForResponse(/\/v1\/cloud\/status/);
  await page.getByTestId("ob-connect-hubspot").click();
  await expect(page.getByText("Opening browser…")).toBeVisible();

  release!();
  await expect(page.getByText("Waiting for HubSpot…")).toBeVisible();
  await expect(page.getByTestId("ob-connect-wait")).toContainText(
    "Finish connecting HubSpot in your browser",
  );

  // Cancel clears only the LOCAL waiting state — the Connect button returns.
  await page.getByTestId("ob-connect-cancel").click();
  await expect(page.getByTestId("ob-connect-wait")).toHaveCount(0);
  await expect(page.getByTestId("ob-connect-hubspot")).toBeVisible();
});

test("read-only recipe (Morning brief) carries disclosure, not a grant", async ({ page }) => {
  await openQuickstart(page);
  await page.getByTestId("qs-template-brief").click();

  // Calendar + Gmail rows; no consent checkbox anywhere — reads never gate.
  await expect(page.getByText("Today's meetings and gaps")).toBeVisible();
  await expect(page.getByText("What arrived overnight")).toBeVisible();
  await expect(page.getByTestId("ob-consent")).toHaveCount(0);
});

test("no-connection template: When is editable and create opens the detail", async ({ page }) => {
  await openQuickstart(page);
  // The card says so on its face.
  await expect(page.getByTestId("qs-template-news")).toContainText("No connections needed");
  await page.getByTestId("qs-template-news").click();

  // No connect rows, no consent — just When (day × time) and an enabled Create.
  await expect(page.getByTestId("ob-consent")).toHaveCount(0);
  await expect(
    page.getByTestId("ob-recipe").getByRole("button", { name: "Day" }),
  ).toContainText("Every day");
  await expect(page.getByTestId("ob-create")).toBeEnabled();
  await page.getByTestId("ob-create").click();

  await expect(page.getByRole("button", { name: /Run now/ })).toBeVisible();
  await expect(page.getByText("Morning news briefing").first()).toBeVisible();
});
