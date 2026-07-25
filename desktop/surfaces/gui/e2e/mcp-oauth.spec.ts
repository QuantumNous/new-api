// MCP OAuth quick-add (first server: Granola): the MCP tab offers a curated Connect
// card; connecting adds the server, kicks off the browser sign-in ("signing in…"),
// and the tab's poll flips the row to connected. Sign out returns it to needs_auth.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openMcpTab(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await page.getByRole("button", { name: "MCP servers", exact: true }).click();
}

test("granola: quick-add card → sign-in flow → connected → sign out", async ({ page }) => {
  await openMcpTab(page);

  // Curated card renders while granola isn't configured.
  const preset = page.getByTestId("mcp-preset-granola");
  await expect(preset).toContainText("Granola");
  await expect(preset).toContainText("Meeting notes");

  // Connect: adds the server with OAuth pending and starts the browser flow.
  await preset.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByTestId("mcp-preset-granola")).toHaveCount(0);
  const row = page.locator(".space-y-2 > div").filter({ hasText: "granola" }).first();
  await expect(row).toContainText("signing in…");

  // The 2s status poll flips the mock to connected with its 6 tools.
  await expect(row).toContainText("connected", { timeout: 10_000 });
  await expect(row).toContainText("6 tools");
  await expect(row).toContainText("oauth");

  // Sign out forgets tokens; the row needs auth again and offers Sign in.
  await row.getByTestId("mcp-signout-granola").click();
  await expect(row).toContainText("needs auth");
  await expect(row.getByTestId("mcp-signin-granola")).toBeVisible();
});
