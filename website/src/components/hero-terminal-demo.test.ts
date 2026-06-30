import { describe, expect, test } from "bun:test";
import { API_DEMOS, STATIC_HERO_DEMO_INDEX } from "./hero-terminal-demo";

describe("homepage API demos", () => {
  test("send JSON content type in every curl example", () => {
    for (const demo of API_DEMOS) {
      expect(demo.headers).toContain('"Content-Type: application/json"');
    }
  });

  test("uses a stable static first paint before client rotation starts", () => {
    expect(STATIC_HERO_DEMO_INDEX).toBe(0);
    expect(API_DEMOS[STATIC_HERO_DEMO_INDEX]?.id).toBe("gpt-chat");
  });

  test("show router endpoints for model invocation examples", () => {
    for (const demo of API_DEMOS) {
      expect(demo.endpoint).toStartWith("https://router.flatkey.ai/");
    }
  });
});
