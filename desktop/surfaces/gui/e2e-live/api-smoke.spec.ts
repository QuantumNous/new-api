// LIVE smoke — API shape only (no model tokens). Hits the REAL sidecar's /v1/health and
// /v1/providers to catch integration drift between the GUI's expectations and the backend's
// responses. Skips cleanly when the backend is down, so it's safe to run anytime. No creds needed.
import { expect, test } from "@playwright/test";
import { BACKEND } from "./helpers";

async function backendUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

test("health reports ok with the fields the GUI reads", async () => {
  test.skip(!(await backendUp()), "backend not running on :8765");
  const s = await (await fetch(`${BACKEND}/v1/health`)).json();
  expect(s.status).toBe("ok");
  // The GUI's boot reads these three off /v1/health.
  expect(s).toHaveProperty("model");
  expect(s).toHaveProperty("default_workspace");
});

test("providers list has the shape the Settings pane expects", async () => {
  test.skip(!(await backendUp()), "backend not running on :8765");
  const providers = await (await fetch(`${BACKEND}/v1/providers`)).json();
  expect(Array.isArray(providers)).toBe(true);
  expect(providers.length).toBeGreaterThan(0);
  // Each descriptor carries what ManageTabs renders: name/title/needs_key/fields/configured.
  for (const p of providers) {
    expect(p).toMatchObject({
      name: expect.any(String),
      title: expect.any(String),
      needs_key: expect.any(Boolean),
      configured: expect.any(Boolean),
    });
    expect(Array.isArray(p.fields)).toBe(true);
  }
  // The core providers Rohit tested should be present.
  const names = providers.map((p: any) => p.name);
  expect(names).toEqual(expect.arrayContaining(["openai", "anthropic"]));
});
