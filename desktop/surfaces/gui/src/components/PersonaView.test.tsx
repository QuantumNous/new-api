import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PersonaView } from "./PersonaView";

// A hermetic fetch stub routing by URL substring + method. Records calls so tests can assert POSTs.
type Call = { url: string; method: string; body: any };

function stubFetch(routes: { match: string; method?: string; json: any }[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method || "GET").toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    for (const r of routes) {
      if (url.includes(r.match) && (!r.method || r.method === method)) {
        return { ok: true, json: async () => r.json } as Response;
      }
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const DETAIL = {
  id: "ops",
  name: "Ops Coworker",
  icon: "🛠️",
  tagline: "Operate and investigate",
  description: "A careful, methodical operations engineer.",
  enabled: true,
  tools: ["files", "search", "shell"],
  recommended_models: ["claude-opus-4-8", "gpt-5.5"],
  default_permission_mode: "interactive",
  workspace: "deliverable",
  recommends: [
    { kind: "connector", ref: "github", reason: "confirm deploys", tier: "core", connected: true },
    { kind: "connector", ref: "datadog", reason: "pull alerts", tier: "core", connected: false },
    { kind: "mcp", ref: "filesystem", reason: "read runbooks", tier: "optional", connected: false },
  ],
  default_connections: [
    { connector: "slack", enabled: true, connected: true },
    { connector: "datadog", enabled: false, connected: false },
  ],
};

const CONNECTORS = {
  connectors: [
    { name: "github", title: "GitHub", logo: "github", brand_color: "#1f2328" },
    { name: "slack", title: "Slack", logo: "slack", brand_color: "#611f69" },
    { name: "datadog", title: "Datadog", logo: "datadog", brand_color: "#632ca6" },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PersonaView", () => {
  it("renders the persona detail (identity, tools, recommends + connect state) from the endpoint", async () => {
    stubFetch([
      { match: "/v1/personas/ops", method: "GET", json: DETAIL },
      { match: "/v1/connectors", method: "GET", json: CONNECTORS },
    ]);
    render(<PersonaView personaId="ops" />);

    expect(await screen.findByText("Ops Coworker")).toBeTruthy();
    expect(screen.getByText("Operate and investigate")).toBeTruthy();
    expect(screen.getByText("A careful, methodical operations engineer.")).toBeTruthy();
    // tools rendered as chips
    expect(screen.getByText("shell")).toBeTruthy();
    // a connected recommend shows "connected"; an unconnected one offers Connect/Add
    expect(screen.getByText("connected")).toBeTruthy();
    expect(screen.getByText("Connect")).toBeTruthy(); // datadog (core, not connected)
    expect(screen.getByText("Add")).toBeTruthy(); // filesystem (mcp, not connected)
    // defaults footer
    expect(screen.getByText("claude-opus-4-8")).toBeTruthy();
  });

  it("toggling a default connection POSTs /connections and applies the returned defaults", async () => {
    const calls = stubFetch([
      { match: "/v1/personas/ops", method: "GET", json: DETAIL },
      { match: "/v1/connectors", method: "GET", json: CONNECTORS },
      {
        match: "/v1/personas/ops/connections",
        method: "POST",
        json: {
          ok: true,
          default_connections: [
            { connector: "slack", enabled: false, connected: true },
            { connector: "datadog", enabled: false, connected: false },
          ],
        },
      },
    ]);
    render(<PersonaView personaId="ops" />);
    await screen.findByText("Ops Coworker");

    // Switches in DOM order: [0] persona Enable, then the default-connection toggles. Slack is the
    // checked+enabled default; datadog is disabled (not connected). Target the last checked+enabled
    // switch — the Slack default — and flip it off.
    const switches = screen.getAllByRole("switch");
    const candidates = switches.filter(
      (s) => s.getAttribute("aria-checked") === "true" && !(s as HTMLButtonElement).disabled,
    );
    fireEvent.click(candidates[candidates.length - 1]);

    await waitFor(() => {
      const post = calls.find(
        (c) => c.method === "POST" && c.url.includes("/v1/personas/ops/connections"),
      );
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ connector: "slack", enabled: false });
    });
  });

  it("toggling Enable POSTs /enable", async () => {
    const calls = stubFetch([
      { match: "/v1/personas/ops", method: "GET", json: DETAIL },
      { match: "/v1/connectors", method: "GET", json: CONNECTORS },
      { match: "/v1/personas/ops/enable", method: "POST", json: { ok: true } },
    ]);
    render(<PersonaView personaId="ops" />);
    await screen.findByText("Ops Coworker");

    // The enable switch is the first one in DOM order (identity header).
    const enableToggle = screen.getAllByRole("switch")[0];
    fireEvent.click(enableToggle);

    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.url.includes("/v1/personas/ops/enable"));
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ enabled: false });
    });
  });
});
