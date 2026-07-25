// Unattended mode (item 8) — the "Send approvals to Inbox" toggle and its effect on approvals.
// Since §22 the toggle lives at the BOTTOM of the composer's Mode menu (who approves, and when —
// one mental model; the standalone InboxControl left the row). When a session is unattended, an
// approval PARKS to the Inbox instead of surfacing an inline card (the app suppresses the live
// card; the Inbox list itself is covered by inbox.spec.ts). The mocked /v1/sessions/:id/unattended
// is stateful so the toggle persists across a reload.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

// The toggle sits inside the composer's Mode menu (§22).
async function openModeMenu(page) {
  await page.getByRole("button", { name: "Mode", exact: true }).click();
  await expect(page.getByTestId("mode-menu")).toBeVisible();
}

test("attended (default): a tool request surfaces the inline approval card", async ({ page }) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please run a tool");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("The coworker wants to run a command.").first()).toBeVisible();
});

test("Send-to-Inbox toggle (in the Mode menu) flips and persists across a reload", async ({
  page,
}) => {
  await page.goto("/");
  await openModeMenu(page);
  const sw = page.getByRole("switch", { name: "Send approvals to the Inbox" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");

  // Reload: the stateful endpoint returns the saved flag, so the toggle reads back on.
  await page.reload();
  await openModeMenu(page);
  await expect(page.getByRole("switch", { name: "Send approvals to the Inbox" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("unattended: a tool request parks (no inline approval card)", async ({ page }) => {
  await page.goto("/");
  await openModeMenu(page);
  await page.getByRole("switch", { name: "Send approvals to the Inbox" }).click();
  // The menu's full-screen overlay closes it on any outside click.
  await page.mouse.click(5, 5);

  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please run a tool");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // The turn still starts, but the live approval card is suppressed — the prompt is parked to the
  // Inbox instead. Give the (suppressed) card a beat to NOT appear.
  await expect(page.getByText("Echo:").first()).toBeVisible().catch(() => {});
  await expect(page.getByText("The coworker wants to run a command.")).toHaveCount(0);
});

test("answering the live approval never re-flashes its parked Inbox mirror", async ({ page }) => {
  // Every live approval is ALSO parked as a per-session Inbox item (reconnect/remote resolution).
  // Tester catch 2026-07-12: after "Allow once", the polled sessionInbox copy was still pending
  // for up to a poll cycle, so the docked answer-in-context card flashed the SAME request again.
  // Simulate the mirror: any per-session inbox fetch for the live session returns one pending
  // approval until the decision lands (the fixtures' fixed items belong to other sessions).
  // The real server resolves the mirror synchronously with the decision — only the CLIENT's
  // polled copy is stale, which is exactly what this test pins.
  let mirrorResolved = false;
  await page.route(/\/v1\/inbox\?/, async (route) => {
    const q = new URL(route.request().url()).searchParams;
    const sid = q.get("session_id");
    if (!sid || sid === "wp-3" || sid === "ops-1") return route.fallback();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: mirrorResolved
          ? []
          : [
              {
                id: "mirror-1",
                session_id: sid,
                kind: "approval",
                title: "Run `run_shell`?",
                body: "requires approval",
                state: "pending",
                resolution: null,
                inbox: "default",
                created_at: "2026-07-12 10:00:00",
                resolved_at: null,
              },
            ],
      }),
    });
  });

  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please run a tool");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("The coworker wants to run a command.").first()).toBeVisible();

  mirrorResolved = true; // server side resolves with the decision; the stale client copy is the bug
  await page.getByRole("button", { name: "Allow once" }).last().click();
  // "Never appears" semantics: pre-fix the stale mirror rendered within a frame of the click and
  // self-cleared a poll later — so a plain toHaveCount(0) would blink green. Watch the window.
  const flashed = await page
    .getByText("Run `run_shell`?")
    .waitFor({ state: "visible", timeout: 700 })
    .then(() => true)
    .catch(() => false);
  expect(flashed).toBe(false);
  await expect(page.getByText("The command ran; 1 file found.")).toBeVisible();
});
