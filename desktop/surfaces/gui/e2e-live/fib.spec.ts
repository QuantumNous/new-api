import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { newestFile, scratchBaseIfReady, selectMode, sendTask, startCoworkSession } from "./helpers";

// LIVE end-to-end smoke: drive the real app against the real backend + a real model, ask it to
// produce a file in Full-access mode, and verify the artifact lands on disk with correct contents.
// This is the vertical the hermetic suite mocks (model, tool execution, file I/O, WS streaming).
// Excluded from CI (separate config/dir) — run with `npm run e2e:live`.

const PROMPT =
  "Compute the first 20 Fibonacci numbers and write them to fib.md with a one-line explanation at the top.";
// Distinctive Fibonacci values unlikely to appear in prose — a format-tolerant correctness check.
const EXPECTED = ["144", "377", "987", "4181"];

test("live: agent writes fib.md to its scratch workspace, verified on disk", async ({ page }) => {
  const scratchBase = await scratchBaseIfReady();
  test.skip(!scratchBase, "live backend not ready — start openworker-server and configure a model");

  await startCoworkSession(page);
  await selectMode(page, "Full access"); // run the write without an approval gate
  await sendTask(page, PROMPT);

  // The artifact rail gains a file once the write tool has run (model + tool time).
  await expect(page.getByText(/Artifacts \(\d+\)/)).toBeVisible({ timeout: 150_000 });

  // Verify on disk — the strongest signal that the whole stack worked.
  const file = newestFile(scratchBase!, "fib.md");
  expect(file, `no fib.md found under ${scratchBase}`).toBeTruthy();
  const text = readFileSync(file!, "utf8");
  for (const n of EXPECTED) {
    expect(text, `fib.md should contain Fibonacci value ${n}`).toContain(n);
  }
});
