import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("current user API", () => {
  test("proxies session cookies to the console identity endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let requestedCookie = "";
    globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
      requestedUrl = String(url);
      requestedCookie = new Headers(init?.headers).get("cookie") ?? "";
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { id: 123 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as typeof fetch;

    try {
      const request = new NextRequest("https://flatkey.ai/api/current-user", {
        headers: { cookie: "session=abc" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(requestedUrl).toContain("/api/user/analytics-self");
      expect(requestedCookie).toBe("session=abc");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
