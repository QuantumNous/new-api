import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./src/proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://flatkey.ai${path}`, { headers });
}

describe("website proxy language redirects", () => {
  const originalCookieSessionDomain = process.env.COOKIE_SESSION_DOMAIN;

  function withCookieSessionDomain<T>(domain: string | undefined, callback: () => T): T {
    if (domain === undefined) {
      delete process.env.COOKIE_SESSION_DOMAIN;
    } else {
      process.env.COOKIE_SESSION_DOMAIN = domain;
    }

    try {
      return callback();
    } finally {
      if (originalCookieSessionDomain === undefined) {
        delete process.env.COOKIE_SESSION_DOMAIN;
      } else {
        process.env.COOKIE_SESSION_DOMAIN = originalCookieSessionDomain;
      }
    }
  }

  function setCookieHeaders(response: Response | undefined): string[] {
    return response?.headers.getSetCookie?.() ?? response?.headers.get("set-cookie")?.split(/,\s*(?=fk_locale=)/) ?? [];
  }

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

  test("migrates an existing language cookie to the shared cookie domain", () => {
    const response = withCookieSessionDomain(".flatkey.ai", () =>
      proxy(request("/pricing", { cookie: "fk_locale=ja" }))
    );

    expect(setCookieHeaders(response)).toContain("fk_locale=; Path=/; Max-Age=0; SameSite=Lax");
    expect(setCookieHeaders(response)).toContain("fk_locale=ja; Path=/; Domain=.flatkey.ai; Max-Age=31536000; SameSite=Lax");
  });

  test("does not migrate the language cookie when no shared cookie domain is configured", () => {
    const response = withCookieSessionDomain(undefined, () =>
      proxy(request("/pricing", { cookie: "fk_locale=ja" }))
    );

    expect(response?.headers.get("set-cookie")).toBeNull();
  });
});
