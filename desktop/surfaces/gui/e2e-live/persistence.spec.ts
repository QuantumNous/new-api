import { test, expect } from "@playwright/test";
import { scratchBaseIfReady, selectMode, sendTask, startCoworkSession } from "./helpers";

// LIVE #6 — persistence & resume. After a completed turn, reloading the page must not lose the work:
// the session persists in the sidebar and reopens with its full transcript and its artifact. We
// reopen it explicitly (rather than relying on which session auto-restores — several sessions can
// share the same updated_at second). Excluded from CI — run with `npm run e2e:live`.

test("live: a session's transcript and artifact survive a page reload", async ({ page }) => {
  const scratchBase = await scratchBaseIfReady();
  test.skip(!scratchBase, "live backend not ready — start openworker-server and configure a model");

  const token = `PERSIST-${Date.now()}`;
  // Unique filename — appears early in the session title (so it survives title truncation and is a
  // reliable click target in the sidebar), and is the artifact name.
  const name = `note-${Date.now()}.txt`;

  await startCoworkSession(page);
  await selectMode(page, "Full access");
  await sendTask(page, `Write a file named ${name} containing exactly: ${token}`);

  // Turn finishes (artifact lands) and the token is in the transcript.
  await expect(page.getByText(/Artifacts \(\d+\)/)).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(token).first()).toBeVisible();

  // Reload, then reopen this session from the sidebar (it must have persisted there).
  await page.reload();
  await page.getByText(name).first().click({ timeout: 60_000 });

  // Reopened with its transcript restored (the token) and its artifact back on the rail.
  await expect(page.getByText(token).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Artifacts \(\d+\)/)).toBeVisible({ timeout: 30_000 });
});
