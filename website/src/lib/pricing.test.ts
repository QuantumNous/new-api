import { describe, expect, test } from "bun:test";
import { publicPricingUrl } from "./pricing";

describe("publicPricingUrl", () => {
  test("points website pricing at the cached public API", () => {
    expect(publicPricingUrl("https://router.flatkey.ai")).toBe("https://router.flatkey.ai/api/website/pricing");
  });
});
