import { describe, expect, test } from "bun:test";
import { consoleSignInUrl } from "./console-auth-links";

describe("console auth links", () => {
  test("builds a Google sign-in URL with the current website locale", () => {
    const url = new URL(consoleSignInUrl("zh"));

    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("lng")).toBe("zh");
    expect(url.searchParams.get("provider")).toBe("google");
  });
});
