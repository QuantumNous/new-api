import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("perf metrics proxy", () => {
  test("defaults omitted group to the merged all-groups scope", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = ((url: string | URL) => {
      requestedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { groups: [] } }), { status: 200 }));
    }) as typeof fetch;

    try {
      const request = new NextRequest("https://flatkey.ai/api/perf-metrics?model=gpt-4o&hours=24");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(requestedUrl).toContain("group=all");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("forwards only the allowlisted PLG group", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = ((url: string | URL) => {
      requestedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { groups: [] } }), { status: 200 }));
    }) as typeof fetch;

    try {
      const request = new NextRequest("https://flatkey.ai/api/perf-metrics?model=gpt-4o&hours=24&group=plg");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(requestedUrl).toContain("/api/perf-metrics");
      expect(requestedUrl).toContain("model=gpt-4o");
      expect(requestedUrl).toContain("hours=24");
      expect(requestedUrl).toContain("group=plg");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects unsupported group values without proxying", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.resolve(new Response("{}"));
    }) as typeof fetch;

    try {
      const request = new NextRequest("https://flatkey.ai/api/perf-metrics?model=gpt-4o&group=company-employees");
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(called).toBe(false);
      expect(await response.json()).toEqual({ success: false, message: "unsupported performance metrics group" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
