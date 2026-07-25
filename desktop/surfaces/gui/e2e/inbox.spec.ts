import { test, expect } from "./fixtures";

// The Inbox (owner testing pass, 2026-07-03; §28 two-tab split 2026-07-12): Pending holds the
// kind chips (All/Approvals/Questions), persona filter chips (only with >1 persona holding
// items), and resolve-removes-card. Routing moved to the Configure tab (the former Connectors ▸
// Messaging routing page) — Pending's status line is read-only and links there; the old inline
// editor (the mirror setting's SECOND editor) is gone.

async function openInbox(page: import("@playwright/test").Page) {
  await page.goto("/");
  // §26: the fixtures seed pending items, so the account row's inbox chip is unlocked and
  // pending — clicking it goes STRAIGHT to Inbox (the menu is the row's target, not the chip's).
  await page.getByTestId("inbox-chip").click();
  await expect(page.getByText("Approve: run_shell")).toBeVisible();
}

test("kind + persona filters narrow the pending list", async ({ page }) => {
  await openInbox(page);
  const question = "Which environment should I restart?";
  await expect(page.getByText(question)).toBeVisible();

  const filters = page.getByTestId("inbox-filters");
  await filters.getByRole("button", { name: "Approvals" }).click();
  await expect(page.getByText(question)).not.toBeVisible();
  await expect(page.getByText("Approve: run_shell")).toBeVisible();

  await filters.getByRole("button", { name: "Questions" }).click();
  await expect(page.getByText("Approve: run_shell")).not.toBeVisible();
  await expect(page.getByText(question)).toBeVisible();

  // Persona chips render because two personas hold items; filtering to Ops hides the cowork item.
  await filters.getByRole("button", { name: "All", exact: true }).click();
  await filters.getByRole("button", { name: "Ops", exact: true }).click();
  await expect(page.getByText("Approve: run_shell")).not.toBeVisible();
  await expect(page.getByText(question)).toBeVisible();
});

test("resolving an approval removes its card; question options resolve on click", async ({ page }) => {
  await openInbox(page);

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approve: run_shell")).not.toBeVisible();

  // Single-select question: clicking an option resolves immediately.
  await page.getByRole("button", { name: "staging", exact: true }).click();
  await expect(page.getByText("Which environment should I restart?")).not.toBeVisible();
  await expect(page.getByText("Nothing pending.")).toBeVisible();
});

test("routing: Configure tab binds the mirror channel; Pending's status line follows", async ({
  page,
}) => {
  await openInbox(page);
  const line = page.getByTestId("inbox-routing");
  await expect(line).toContainText("Delivered here only");

  // The status line is read-only — its Configure › link lands on the Configure tab, which
  // holds the ONE editor (the old inline editor was a duplicate of this card).
  await page.getByTestId("inbox-route-configure").click();
  const mirror = page.getByTestId("inbox-mirror-card");
  await expect(mirror).toContainText("in-app Inbox only");
  await mirror.getByPlaceholder("slack:C0123 or channel link").fill("C0777");
  await mirror.getByRole("button", { name: "Set", exact: true }).click();
  await expect(mirror).toContainText("slack:C0777");

  // Back on Pending, the line reflects the new target immediately.
  await page.getByTestId("inbox-tab-pending").click();
  await expect(line).toContainText("slack:C0777");
  await expect(line).toContainText("replies there resolve items here");

  // Clearing (also on Configure) returns Pending to local-only delivery.
  await page.getByTestId("inbox-tab-configure").click();
  await mirror.getByRole("button", { name: "clear" }).click();
  await expect(mirror).toContainText("in-app Inbox only");
  await page.getByTestId("inbox-tab-pending").click();
  await expect(line).toContainText("Delivered here only");
});
