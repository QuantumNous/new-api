// The rail's Access section (§32 — absorbs the §23 Session-settings drawer; the topbar
// row/glance machinery is retired). Contract: the header carries a PERMANENT summary of what
// the session can touch; expanding edits inline at rail width (no overlay, no dialog).
// Fixture state: browser + slack + github connected/enabled (github is two_way WITHOUT
// channels — relay mentions, no subscriptions), gmail recommended-not-connected, one
// primary root → summary "Browser, Slack +1 · 1 folder".
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("no topbar opener; the Access header IS the ambient glance; expanding edits inline", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();

  // §32: the settings row/icon is gone from the topbar — the panel toggle is the one entry.
  await expect(page.getByRole("button", { name: "Open session settings" })).toHaveCount(0);
  await expect(page.getByTestId("session-settings-row")).toHaveCount(0);

  // The trust surface is ambient: the collapsed header always shows the summary — and no
  // nudge text ever renders at rest (§23's rule carried over).
  const section = page.getByTestId("access-section");
  await expect(section.getByTestId("access-summary")).toHaveText("Browser, Slack +1 · 1 folder");
  await expect(section.getByText(/recommended/i)).toHaveCount(0);

  // Expand → Sources (per-session toggles), Recommended (with its reason), Folders — all
  // inline in the rail; no dialog appears anywhere.
  await section.getByTestId("access-toggle").click();
  const body = page.getByRole("region", { name: "Session access" });
  await expect(body.getByText("Sources")).toBeVisible();
  await expect(body.getByText("Slack", { exact: true })).toBeVisible();
  await expect(body.getByText("email context for morning summaries")).toBeVisible();
  await expect(body.getByTestId("drawer-directories").getByText("Temporary space")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Channels is a chat capability, not a two_way one: Slack gets the drill-down, GitHub
  // (two_way via the relay, no channel semantics) must NOT (owner report 2026-07-13).
  await expect(body.getByRole("button", { name: /Channels ·/ })).toHaveCount(1);
  await expect(body.getByText("GitHub", { exact: true })).toBeVisible();
});

test("+ Add a source: full catalog on focus, filter as you type → connect-in-context; connected sources never match", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  await page.getByTestId("access-toggle").click();

  // Focusing the empty input shows the FULL catalog (FB-012) — every available connector
  // minus the already-connected three, before any typing.
  await page.getByTestId("access-add-source").click();
  const search = page.getByTestId("access-add-search");
  await expect(search).toBeFocused();
  const rows = page.locator('[data-testid^="access-add-"]:not([data-testid="access-add-search"])');
  await expect(rows).toHaveCount(9); // 12 in the catalog − browser/slack/github (connected)
  await expect(page.getByTestId("access-add-notion")).toBeVisible();

  // Already-connected sources don't match (Slack and GitHub are connected in fixtures)…
  await search.fill("slack");
  await expect(page.getByText("No match — see all on the Connectors page below.")).toBeVisible();
  await search.fill("github");
  await expect(page.getByText("No match — see all on the Connectors page below.")).toBeVisible();

  // …and clearing the query restores the full list ("filter as you type", not search-only).
  await search.fill("");
  await expect(rows).toHaveCount(9);

  // Capability aliases match too: "calendar" surfaces Outlook (title alone never would).
  await search.fill("calendar");
  await expect(page.getByTestId("access-add-outlook")).toBeVisible();

  // …the long tail does: Notion is in the catalog but neither connected nor recommended.
  await search.fill("notion");
  await page.getByTestId("access-add-notion").click();

  // Lands in the SAME connect-in-context child view the Recommended flow uses, with the
  // scope-semantics line; back returns to the Sources list.
  const body = page.getByRole("region", { name: "Session access" });
  await expect(body.getByText("Connecting makes Notion available to all your coworkers", { exact: false })).toBeVisible();
  await expect(body.getByPlaceholder("ntn_…")).toBeVisible();
  await body.getByRole("button", { name: "Back to sources" }).click();
  await expect(body.getByText("Slack", { exact: true })).toBeVisible();
});

test("per-session mute round-trips; the summary follows", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();

  const section = page.getByTestId("access-section");
  await section.getByTestId("access-toggle").click();
  const body = page.getByRole("region", { name: "Session access" });
  // Muting Slack for this session drops it from the live summary (the fixture flips
  // enabled on POST and the section reloads).
  await body.getByTitle("Enabled for this session — tap to mute here").nth(1).click();
  await expect(section.getByTestId("access-summary")).toHaveText("Browser, GitHub · 1 folder");
});
