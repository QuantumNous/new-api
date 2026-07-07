import { describe, expect, test } from "bun:test";
import {
  LANGUAGE_PREFERENCE_COOKIE,
  buildLanguagePreferenceCookie,
  buildLanguagePreferenceCookieWrites,
  getLanguageRedirectPath,
  isBotUserAgent,
  resolvePreferredLocale,
} from "./language-routing";

describe("language routing", () => {
  test("resolves supported languages from Accept-Language", () => {
    expect(resolvePreferredLocale(undefined, "ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(resolvePreferredLocale(undefined, "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(resolvePreferredLocale(undefined, "pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt");
    expect(resolvePreferredLocale(undefined, "de-DE,de;q=0.9,en;q=0.8")).toBe("de");
  });

  test("uses valid cookie locale before Accept-Language", () => {
    expect(resolvePreferredLocale("fr", "ja-JP,ja;q=0.9")).toBe("fr");
    expect(resolvePreferredLocale("en", "ja-JP,ja;q=0.9")).toBe("en");
    expect(resolvePreferredLocale("xx", "ja-JP,ja;q=0.9")).toBe("ja");
  });

  test("falls back to English for unsupported or malformed languages", () => {
    expect(resolvePreferredLocale(undefined, "ko-KR,ko;q=0.9")).toBe("en");
    expect(resolvePreferredLocale(undefined, ";;;")).toBe("en");
    expect(resolvePreferredLocale(undefined, undefined)).toBe("en");
  });

  test("redirects ordinary users on non-locale public pages", () => {
    expect(getLanguageRedirectPath({ pathname: "/", method: "GET", acceptLanguage: "ja" })).toBe("/ja");
    expect(getLanguageRedirectPath({ pathname: "/pricing", method: "GET", acceptLanguage: "ja" })).toBe("/ja/pricing");
    expect(getLanguageRedirectPath({ pathname: "/pricing", method: "GET", acceptLanguage: "de-DE,de;q=0.9" })).toBe("/de/pricing");
    expect(getLanguageRedirectPath({ pathname: "/lp/personal-ai", method: "GET", acceptLanguage: "zh-CN,zh;q=0.9" })).toBe("/zh/lp/personal-ai");
    expect(getLanguageRedirectPath({ pathname: "/pricing", method: "GET", cookieLocale: "fr", acceptLanguage: "ja" })).toBe("/fr/pricing");
  });

  test("does not redirect English preferences or explicit locale paths", () => {
    expect(getLanguageRedirectPath({ pathname: "/pricing", method: "GET", acceptLanguage: "en-US,en;q=0.9" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/ja/pricing", method: "GET", acceptLanguage: "fr" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/de", method: "GET", acceptLanguage: "ja" })).toBeNull();
  });

  test("does not redirect ignored methods and paths", () => {
    expect(getLanguageRedirectPath({ pathname: "/pricing", method: "POST", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/_next/static/app.js", method: "GET", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/api/perf-metrics", method: "GET", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/cdn-cgi/trace", method: "GET", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/favicon.ico", method: "GET", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/sign-in", method: "GET", acceptLanguage: "ja" })).toBeNull();
    expect(getLanguageRedirectPath({ pathname: "/install.sh", method: "GET", acceptLanguage: "ja" })).toBeNull();
  });

  test("detects search and AI crawlers", () => {
    const bots = [
      "Googlebot/2.1",
      "bingbot/2.0",
      "OAI-SearchBot/1.0",
      "GPTBot/1.0",
      "ChatGPT-User/1.0",
      "ClaudeBot/1.0",
      "Claude-SearchBot/1.0",
      "Claude-User/1.0",
      "claude-code/1.0",
      "PerplexityBot/1.0",
      "Perplexity-User/1.0",
    ];

    for (const bot of bots) {
      expect(isBotUserAgent(bot)).toBe(true);
      expect(getLanguageRedirectPath({ pathname: "/pricing", method: "GET", userAgent: bot, acceptLanguage: "ja" })).toBeNull();
    }
  });

  test("exports the cookie name used by the client switcher", () => {
    expect(LANGUAGE_PREFERENCE_COOKIE).toBe("fk_locale");
  });

  test("builds a one-year language preference cookie", () => {
    expect(buildLanguagePreferenceCookie("ja")).toBe("fk_locale=ja; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  test("builds a shared-domain language preference cookie when configured", () => {
    expect(buildLanguagePreferenceCookie("ja", ".flatkey.ai")).toBe(
      "fk_locale=ja; Path=/; Domain=.flatkey.ai; Max-Age=31536000; SameSite=Lax"
    );
  });

  test("expires the host-scoped language cookie before setting a shared-domain cookie", () => {
    expect(buildLanguagePreferenceCookieWrites("ja", ".flatkey.ai")).toEqual([
      "fk_locale=; Path=/; Max-Age=0; SameSite=Lax",
      "fk_locale=ja; Path=/; Domain=.flatkey.ai; Max-Age=31536000; SameSite=Lax",
    ]);
  });

  test("writes only the normal language cookie when no shared domain is configured", () => {
    expect(buildLanguagePreferenceCookieWrites("ja", " ")).toEqual([
      "fk_locale=ja; Path=/; Max-Age=31536000; SameSite=Lax",
    ]);
  });
});
