import { afterEach, describe, expect, test } from "bun:test";
import { ROUTER_ORIGIN } from "@/lib/origins";
import { GET } from "./route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("llms.txt", () => {
  test("documents Gemini native and OpenAI-compatible image model access", async () => {
    globalThis.fetch = ((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/status")) {
        return Promise.resolve(
          Response.json({ success: true, data: { docs_link: "https://docs.flatkey.ai/zh/introduction" } })
        );
      }
      return Promise.resolve(new Response(null, { status: 503 }));
    }) as typeof fetch;

    const response = await GET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toContain(
      `Gemini native generateContent: POST ${ROUTER_ORIGIN}/v1beta/models/{model}:generateContent`
    );
    expect(body).toContain(
      "nano-banana-pro-preview supports both Gemini native generateContent and OpenAI-compatible Chat Completions."
    );
    expect(body).toContain("currently do not use /v1/images/generations");
    expect(body).toContain(`Create a video task with POST ${ROUTER_ORIGIN}/v1/videos.`);
    expect(body).toContain(`Poll task status with GET ${ROUTER_ORIGIN}/v1/videos/{task_id}.`);
    expect(body).toContain(
      "Chinese documentation: https://docs.flatkey.ai/zh/api-reference/seedance-video-generation"
    );
  });
});
