import { readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Page } from "@playwright/test";

// Shared helpers for the LIVE smoke specs (real backend + real model). Kept out of the hermetic
// suite (separate dir/config); see e2e/README.md.

export const BACKEND = "http://127.0.0.1:8765";

/** The expanded scratch base if the backend is up and a model is ready — else null (→ skip). */
export async function scratchBaseIfReady(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND}/v1/settings`);
    const s = await res.json();
    if (res.ok && s.model_ready) {
      return String(s.scratch_base || "~/OpenWorker").replace(/^~(?=\/|$)/, homedir());
    }
  } catch {
    /* backend unreachable */
  }
  return null;
}

/** Newest `name` file across the per-session scratch dirs (each live session gets its own). */
export function newestFile(scratchBase: string, name: string): string | null {
  let best: { path: string; mtime: number } | null = null;
  let dirs: string[];
  try {
    dirs = readdirSync(scratchBase);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const f = join(scratchBase, d, name);
    try {
      const st = statSync(f);
      if (!best || st.mtimeMs > best.mtime) best = { path: f, mtime: st.mtimeMs };
    } catch {
      /* not in this session dir */
    }
  }
  return best?.path ?? null;
}

/** Open a fresh Cowork session via the split button's persona menu. */
export async function startCoworkSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose a persona" }).click();
  await page.getByText(/Produce a deliverable/).click();
}

/** Switch the composer's permission mode from the default "Ask for approval". */
export async function selectMode(page: Page, label: "Full access" | "Plan" | "Discuss") {
  await page.getByText("Ask for approval").click();
  await page.getByText(label, { exact: true }).click();
}

/** Type a task and send it. */
export async function sendTask(page: Page, text: string) {
  await page.getByPlaceholder(/Ask the coworker/).fill(text);
  // exact — "Send" is a substring of the Inbox control's "Sending approvals…" title when unattended.
  await page.getByRole("button", { name: "Send", exact: true }).click();
}
