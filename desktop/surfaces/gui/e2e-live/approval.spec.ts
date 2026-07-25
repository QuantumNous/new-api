import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { newestFile, scratchBaseIfReady, sendTask, startCoworkSession } from "./helpers";

// LIVE #1 — the approval gate. In the default "Ask for approval" mode a tool call must block on an
// in-transcript approval card; approving it lets execution proceed. (fib.md skips this via Full
// access.) Excluded from CI — run with `npm run e2e:live`.

test("live: a write blocks on an approval card, then completes once approved", async ({ page }) => {
  const scratchBase = await scratchBaseIfReady();
  test.skip(!scratchBase, "live backend not ready — start openworker-server and configure a model");

  // Unique filename per run so the "doesn't exist before approval" check can't see a prior run's file.
  const name = `hello-${Date.now()}.txt`;

  await startCoworkSession(page);
  // Leave the default "Ask for approval" mode — the write should gate.
  await sendTask(page, `Create a file named ${name} containing exactly the text: hello world`);

  // The tool call blocks on an approval card, and the file does not exist yet.
  await expect(page.getByText("Permission required")).toBeVisible({ timeout: 120_000 });
  expect(newestFile(scratchBase!, name), "file must not exist before approval").toBeNull();

  // Approve it.
  await page.getByRole("button", { name: "Allow once" }).click();

  // Now it runs to completion and the artifact lands on disk.
  await expect(page.getByText(/Artifacts \(\d+\)/)).toBeVisible({ timeout: 120_000 });
  const file = newestFile(scratchBase!, name);
  expect(file, `no ${name} found under ${scratchBase}`).toBeTruthy();
  expect(readFileSync(file!, "utf8").toLowerCase()).toContain("hello world");
});
