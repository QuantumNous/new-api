import { describe, expect, test } from "bun:test";
import { buildConsoleUrl } from "./origins";

describe("buildConsoleUrl", () => {
  test("builds a console URL from an origin with trailing slash", () => {
    expect(buildConsoleUrl("/dashboard", "https://console.flatkey.ai/")).toBe("https://console.flatkey.ai/dashboard");
  });

  test("normalizes paths without a leading slash", () => {
    expect(buildConsoleUrl("dashboard", "https://console.flatkey.ai")).toBe("https://console.flatkey.ai/dashboard");
  });
});
