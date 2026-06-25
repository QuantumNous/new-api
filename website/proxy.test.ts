import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./src/proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://flatkey.ai${path}`, { headers });
}

describe("website proxy language redirects", () => {
  test("redirects ordinary users and preserves query strings", () => {
    const response = proxy(request("/pricing?vendor=OpenAI", { "accept-language": "ja-JP,ja;q=0.9" }));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://flatkey.ai/ja/pricing?vendor=OpenAI");
  });

  test("does not redirect declared AI crawlers", () => {
    const response = proxy(
      request("/pricing", {
        "accept-language": "ja-JP,ja;q=0.9",
        "user-agent": "OAI-SearchBot/1.0",
      })
    );

    expect(response?.headers.get("location")).toBeNull();
  });
});
