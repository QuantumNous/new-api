import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newestFile, scratchBaseIfReady, selectMode, sendTask } from "./helpers";

// LIVE capstone — install a persona from a local-directory bundle, enable + surface it, start a
// session as it, and have it do real work. Exercises the whole persona pipeline: manifest parse +
// snapshot on install, lifecycle (enable/surface), session creation, and execution. Excluded from
// CI — run with `npm run e2e:live`. Idempotent: re-installing overwrites the snapshot.

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(here, "fixtures", "persona"); // holds e2e-tester.md

test("live: install a persona from a directory, enable it, and run a task as it", async ({ page }) => {
  const scratchBase = await scratchBaseIfReady();
  test.skip(!scratchBase, "live backend not ready — start openworker-server and configure a model");

  const token = `PERSONA-${Date.now()}`;
  const name = `persona-${Date.now()}.txt`;

  await page.goto("/");

  // Open persona management (Settings ▸ Personas) via the New-session menu.
  await page.getByRole("button", { name: "Choose a persona" }).click();
  await page.getByText(/Manage personas/).click();
  await expect(page.getByText("Add personas")).toBeVisible();

  // Install from the local directory bundle.
  await page.getByRole("combobox").selectOption("dir");
  await page.getByPlaceholder("/path/to/personas").fill(FIXTURE_DIR);
  await page.getByRole("button", { name: "Install" }).click();
  await expect(page.getByText(/Installed \d+ persona/)).toBeVisible({ timeout: 30_000 });

  // Enable + surface it in the picker. Idempotent across re-runs (skip if already on), and click +
  // await rather than check() — these are controlled React checkboxes (async updatePersona re-render).
  const row = page.locator("div.flex.items-center.gap-4").filter({ hasText: "E2E Tester" });
  const ensureChecked = async (i: number) => {
    const box = row.getByRole("checkbox").nth(i);
    if (!(await box.isChecked())) {
      await box.click();
      await expect(box).toBeChecked();
    }
  };
  await ensureChecked(0); // Enabled
  await ensureChecked(1); // In picker (enabled only once Enabled is on)

  // Leave Settings (so the settings rows unmount), then start a fresh session AS the new persona.
  // Select by the unique tagline — it appears only on the dropdown item, whereas the name "E2E
  // Tester" also shows in the top bar/sidebar once a session is on it.
  await page.getByRole("button", { name: "New session" }).click();
  await page.getByRole("button", { name: "Choose a persona" }).click();
  await page.getByText(/Throwaway persona/).click();
  await expect(page.getByText("E2E Tester").first()).toBeVisible(); // the session is this persona

  // New sessions start in "Ask for approval" regardless of the persona's declared mode (a safety
  // default for freshly-installed personas), so set Full access to let the write run to completion.
  await selectMode(page, "Full access");
  await sendTask(page, `Write a file named ${name} containing exactly: ${token}`);

  // The installed persona should do the work. Non-Cowork personas don't render the Artifacts rail,
  // so wait on the file itself (ground truth) rather than a UI signal.
  await expect
    .poll(
      () => {
        const f = newestFile(scratchBase!, name);
        return f ? readFileSync(f, "utf8") : "";
      },
      { timeout: 150_000, message: `${name} with the token never appeared under ${scratchBase}` },
    )
    .toContain(token);
});
