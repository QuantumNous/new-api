import { describe, expect, test } from "bun:test";
import { ROUTER_ORIGIN, buildConsoleUrl } from "./origins";

describe("buildConsoleUrl", () => {
  test("builds a console URL from an origin with trailing slash", () => {
    expect(buildConsoleUrl("/dashboard", "https://console.flatkey.ai/")).toBe("https://console.flatkey.ai/dashboard");
  });

  test("normalizes paths without a leading slash", () => {
    expect(buildConsoleUrl("dashboard", "https://console.flatkey.ai")).toBe("https://console.flatkey.ai/dashboard");
  });

  test("preserves search params when provided", () => {
    expect(buildConsoleUrl("/sign-up", "https://console.flatkey.ai", "?next=%2Fdashboard&utm_source=home")).toBe(
      "https://console.flatkey.ai/sign-up?next=%2Fdashboard&utm_source=home"
    );
  });
});

describe("ROUTER_ORIGIN", () => {
  test("defaults model invocation examples to the router host", () => {
    expect(ROUTER_ORIGIN).toBe("https://router.flatkey.ai");
  });
});
