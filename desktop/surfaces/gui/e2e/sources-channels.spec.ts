import { test, expect } from "./fixtures";

// Guards the per-session Slack channels drill-down (§14, hosted in the rail's Access section
// since §32): the "Channels" affordance is gated to two-way connectors, opens an inline child
// view, and add/remove round-trip through the subscribe APIs.
test("Slack channels drill-down: gating, add (auto-prefixed), remove", async ({ page }) => {
  await page.goto("/");

  // Open the pinned cowork session, then expand the rail's Access section.
  await page.getByText("Draft the launch note").first().click();
  await page.getByTestId("access-toggle").click();

  const body = page.getByRole("region", { name: "Session access" });
  await expect(body.getByText("Slack", { exact: true })).toBeVisible();

  // Gating: only the two-way connector (Slack) gets a Channels affordance — not Browser.
  await expect(page.getByRole("button", { name: /Channels ·/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Channels · 0/ })).toBeVisible();

  // Drill in.
  await page.getByRole("button", { name: /Channels · 0/ }).click();
  await expect(page.getByText("Slack channels")).toBeVisible();
  await expect(page.getByText(/Not listening to any Slack channel yet/)).toBeVisible();

  // Add a bare channel id — the panel scopes it to the connector (→ "slack:C0123").
  await page.getByPlaceholder("slack:C0123 or channel link").fill("C0123");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("slack:C0123", { exact: true })).toBeVisible();
  await expect(page.getByText(/Subscribed channels · 1/)).toBeVisible();

  // Remove it → back to the empty state.
  await page.getByTitle("Stop listening").click();
  await expect(page.getByText(/Not listening to any Slack channel yet/)).toBeVisible();

  // Back returns to the Sources list.
  await page.getByRole("button", { name: "Back to sources" }).click();
  await expect(body.getByText("Slack", { exact: true })).toBeVisible();
});

// The recent-channels dropdown is a hand-rolled popover (NOT a <datalist> — WKWebView renders
// none), fed by /v1/channels/recent: focus opens it, typing filters, picking fills the input.
test("recent channels popover: opens on focus, filters, picks", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  await page.getByTestId("access-toggle").click();
  await page.getByRole("button", { name: /Channels · 0/ }).click();

  const input = page.getByPlaceholder("slack:C0123 or channel link");
  await input.click();
  const pop = page.getByTestId("channel-suggestions");
  // Named channels show "#name" with the address as a sub-label; unnamed fall back to the address.
  await expect(pop.getByText("#ocw-test")).toBeVisible();
  await expect(pop.getByText("slack:C0AAA111")).toBeVisible();
  await expect(pop.getByText("bob: deploy failed")).toBeVisible();

  // Typing part of the channel NAME filters too…
  await input.fill("ocw");
  await expect(pop.getByText("#ocw-test")).toBeVisible();
  await expect(pop.getByText("slack:C0BBB222")).toHaveCount(0);
  await input.fill("");

  // Typing filters (matches address or message text)…
  await input.fill("deploy");
  await expect(pop.getByText("slack:C0AAA111")).toHaveCount(0);
  await expect(pop.getByText("slack:C0BBB222")).toBeVisible();

  // …and picking fills the input and closes the popover.
  await pop.getByText("slack:C0BBB222").click();
  await expect(input).toHaveValue("slack:C0BBB222");
  await expect(page.getByTestId("channel-suggestions")).toHaveCount(0);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Subscribed channels · 1/)).toBeVisible();
});

// Address-form fixes: a pasted Copy-link URL resolves to the id; a bare #name is rejected
// with the paste-the-ID hint instead of storing a dead subscription.
test("channel add: link URLs resolve, bare #names are rejected with a hint", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  await page.getByTestId("access-toggle").click();
  await page.getByRole("button", { name: /Channels · 0/ }).click();

  const input = page.getByPlaceholder("slack:C0123 or channel link");
  await input.fill("#general");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("channel-add-error")).toContainText(
    "paste the channel ID",
  );
  await expect(page.getByText(/Subscribed channels · 1/)).toHaveCount(0);

  await input.fill("https://acme.slack.com/archives/C0123ABC");
  // Typing again clears the rejection.
  await expect(page.getByTestId("channel-add-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("slack:C0123ABC")).toBeVisible();
  await expect(page.getByText(/Subscribed channels · 1/)).toBeVisible();
});
