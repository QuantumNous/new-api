import { describe, expect, test } from "bun:test";
import { API_DEMOS } from "./hero-terminal-demo";

describe("homepage API demos", () => {
  test("send JSON content type in every curl example", () => {
    for (const demo of API_DEMOS) {
      expect(demo.headers).toContain('"Content-Type: application/json"');
    }
  });

  test("show router endpoints for model invocation examples", () => {
    for (const demo of API_DEMOS) {
      expect(demo.endpoint).toStartWith("https://router.flatkey.ai/");
    }
  });
});
