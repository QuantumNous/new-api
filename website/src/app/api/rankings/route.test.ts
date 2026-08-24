import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("rankings proxy", () => {
  test("always requests the public visibility-filtered rankings view", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = ((input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
        }),
      );
    }) as typeof fetch;

    try {
      const response = await GET(
        new NextRequest("https://flatkey.ai/api/rankings?period=month"),
      );

      expect(response.status).toBe(200);
      expect(requestedUrl).toBe(
        "https://console.flatkey.ai/api/rankings?period=month&view=public",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
