import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../i18n";
import { SkillsTab } from "./SkillsTab";

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

const SKILLS = {
  skills: [
    { name: "docx-report", description: "Word reports", source: "builtin", path: null, enabled: true, overrides: null },
    { name: "release-notes", description: "Release notes", source: "global", path: "/tmp/release-notes", enabled: false, overrides: "builtin" },
  ],
};

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

describe("SkillsTab", () => {
  it("shows tier tags, the shadowing marker, and removes only installed skills", async () => {
    stubFetch([{ match: "/v1/skills", method: "GET", json: SKILLS }]);
    render(<SkillsTab />);

    await screen.findByTestId("skill-row-docx-report");
    expect(screen.getByTestId("skill-row-docx-report").textContent).toContain("Built-in");
    expect(screen.getByTestId("skill-row-release-notes").textContent).toContain(
      "overrides builtin",
    );
    expect(screen.queryByTestId("skill-remove-docx-report")).toBeNull();
    expect(screen.getByTestId("skill-remove-release-notes")).toBeTruthy();
  });

  it("PATCHes the enable state of the toggled skill", async () => {
    const calls = stubFetch([{ match: "/v1/skills", method: "GET", json: SKILLS }]);
    render(<SkillsTab />);

    await screen.findByTestId("skill-row-release-notes");
    fireEvent.click(
      screen.getByTestId("skill-row-release-notes").querySelector("button[role=switch]")!,
    );
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "PATCH" && c.url.includes("release-notes") && c.body.enabled === true),
      ).toBe(true),
    );
  });

  it("renders translated copy after a language switch", async () => {
    stubFetch([{ match: "/v1/skills", method: "GET", json: SKILLS }]);
    await i18n.changeLanguage("zh");
    render(<SkillsTab />);

    await screen.findByTestId("skill-row-docx-report");
    expect(screen.getByTestId("skill-row-docx-report").textContent).toContain("内置");
    expect(screen.getByText("浏览技能市场…")).toBeTruthy();
  });
});
