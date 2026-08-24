import { describe, expect, test } from "bun:test";
import { fetchRankingsData } from "./rankings-live";

describe("fetchRankingsData", () => {
  test("requests the public visibility-filtered rankings view", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              models: [
                { rank: 1, model_name: "visible-model", total_tokens: 10 },
              ],
              models_history: {
                models: [{ name: "visible-model", total: 10 }],
              },
            },
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;

    try {
      const data = await fetchRankingsData();

      expect(requestedUrl).toBe(
        "https://console.flatkey.ai/api/rankings?period=month&view=public",
      );
      expect(requestedInit?.cache).toBe("no-store");
      expect(data?.models.map((model) => model.model_name)).toEqual([
        "visible-model",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
