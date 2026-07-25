// Session-screen cleanup (§22): the contextual top-left cluster ([sidebar][+][search], rendered
// ONLY while the sidebar is collapsed), the centered facts subtitle (persona · model — fixed
// facts replacing the locked-model pill and the topbar About-persona button), and the model
// picker's fresh-session-only placement.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("top-left cluster renders only while the sidebar is collapsed", async ({ page }) => {
  await page.goto("/");

  // Expanded sidebar owns those actions — no duplicate cluster.
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByTestId("topbar-cluster")).toHaveCount(0);

  // Collapse → the cluster appears with all three actions; the floating reveal button does NOT
  // double up on the session surface (the cluster's sidebar button replaces it).
  await page.keyboard.press("Meta+b");
  const cluster = page.getByTestId("topbar-cluster");
  await expect(cluster).toBeVisible();
  await expect(cluster.getByRole("button", { name: "Show sidebar" })).toBeVisible();
  await expect(cluster.getByRole("button", { name: "New session" })).toBeVisible();
  await expect(cluster.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.locator(".nav-reveal-btn")).toHaveCount(0);

  // The cluster's search opens the command-palette overlay.
  await cluster.getByRole("button", { name: "Search" }).click();
  await expect(page.getByPlaceholder("Search chats")).toBeVisible();
  await page.keyboard.press("Escape");

  // The cluster's sidebar button docks the nav back — and the cluster leaves with it.
  await cluster.getByRole("button", { name: "Show sidebar" }).click();
  await expect(page.locator(".app")).not.toHaveClass(/nav-collapsed/);
  await expect(page.getByTestId("topbar-cluster")).toHaveCount(0);
});

test("facts subtitle: absent on a fresh session, model-only after the first turn, inert", async ({
  page,
}) => {
  await page.goto("/");

  // Fresh-ish (boot-resumed, no rendered history): no subtitle, no old About-persona button —
  // and the model is a live PICKER in the composer (fresh sessions choose; nothing is locked yet).
  await expect(page.getByTestId("session-subtitle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "About this persona" })).toHaveCount(0);
  await expect(page.locator(".dd").filter({ hasText: "Claude Opus 4.8" })).toBeVisible();

  // First turn → the facts move up to the subtitle; the picker STAYS in the composer
  // (§17 rev 2026-07-22: mid-session model switching shipped, so it remains actionable).
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Echo: hello/)).toBeVisible();

  // Model only — no persona name (owner ask 2026-07-22: personas are hidden this release),
  // and the subtitle is a plain fact line, not a button to the persona page.
  const sub = page.getByTestId("session-subtitle");
  await expect(sub).toHaveText("Claude Opus 4.8");
  await expect(page.locator(".dd").filter({ hasText: "Claude Opus 4.8" })).toBeVisible();
  await sub.click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

test("composer is three controls (+ attach · Mode · send); folder and branch chips are gone", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();

  await expect(page.getByRole("button", { name: "Attach" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mode", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  // The folder/roots popover trigger and the standalone Inbox control left the composer (§22).
  await expect(page.getByTitle(/director(y|ies) the agent can use/)).toHaveCount(0);
  await expect(page.getByTitle("Inbox routing")).toHaveCount(0);
  await expect(page.locator(".wschip")).toHaveCount(0);
  await expect(page.locator(".wsbranch")).toHaveCount(0);
});
