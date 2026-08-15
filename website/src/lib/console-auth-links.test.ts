import { describe, expect, test } from "bun:test";
import {
  consoleGoogleOAuthStartUrl,
  consoleSignInUrl,
} from "./console-auth-links";

describe("console auth links", () => {
  test("builds a plain sign-in URL with the current website locale", () => {
    const url = new URL(consoleSignInUrl("zh"));

    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("lng")).toBe("zh");
    expect(url.searchParams.has("provider")).toBe(false);
  });

  test("builds a server-side Google OAuth start URL", () => {
    const url = new URL(consoleGoogleOAuthStartUrl("ja"));

    expect(url.pathname).toBe("/api/oauth/google/start");
    expect(url.searchParams.get("lng")).toBe("ja");
    expect(url.searchParams.get("source")).toBe("website");
    expect(url.searchParams.has("provider")).toBe(false);
  });

  test("preserves safe caller params except provider on Google OAuth start", () => {
    const url = new URL(
      consoleGoogleOAuthStartUrl(
        "en",
        new URLSearchParams("redirect=%2Fkeys&provider=github"),
      ),
    );

    expect(url.searchParams.get("lng")).toBe("en");
    expect(url.searchParams.get("redirect")).toBe("/keys");
    expect(url.searchParams.get("source")).toBe("website");
    expect(url.searchParams.has("provider")).toBe(false);
  });
});
