import { describe, expect, test } from "bun:test";
import { API_DEMOS } from "./hero-terminal-demo";

describe("homepage API demos", () => {
  test("send JSON content type in every curl example", () => {
    for (const demo of API_DEMOS) {
      expect(demo.headers).toContain('"Content-Type: application/json"');
    }
  });
});
