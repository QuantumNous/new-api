import { test, expect } from "./fixtures";

// §16 workspace collapse: the persona FAMILY alone decides the workspace behavior.
//   code      → an explicit project folder, enforced by the FolderGate (no chat-behind-it escape)
//   knowledge → starts orphan on a transparent scratch dir — never gated
// (The mock's Ops persona is knowledge-family with zero sessions, so picking it exercises the
// brand-new-session path, not a resume.)

const personaMenu = (page: import("@playwright/test").Page) => page.locator(".newsplit-menu");

async function startAs(page: import("@playwright/test").Page, persona: RegExp) {
  await page.getByLabel("Choose a persona").click();
  await personaMenu(page).getByRole("button", { name: persona }).click();
}

test("knowledge persona: new session starts instantly, no folder gate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();

  await startAs(page, /Ops/);
  await expect(page.locator(".gate-overlay")).toHaveCount(0);
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();
});

test("code persona: the folder gate blocks until a project is chosen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();

  await startAs(page, /Code/);

  const gate = page.locator(".gate-overlay");
  await expect(gate).toBeVisible();
  await expect(gate.getByText("Choose a project folder")).toBeVisible();
  // No escape hatch: the gate offers pick-a-folder only (no "switch to Chat" — owner call, §16).
  await expect(gate.getByText(/chat/i)).toHaveCount(0);

  await gate.getByPlaceholder("/path/to/your/project").fill("/tmp/e2e-project");
  await gate.getByRole("button", { name: "Open", exact: true }).click();

  // Gate clears, the session is rooted in the chosen folder, and the code composer is live.
  await expect(page.locator(".gate-overlay")).toHaveCount(0);
  await expect(page.getByPlaceholder(/Ask the coder/)).toBeVisible();
});
