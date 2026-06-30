import { describe, expect, test } from "bun:test";
import { publicPricingUrl } from "./pricing";

describe("publicPricingUrl", () => {
  test("points website pricing at the cached public API", () => {
    expect(publicPricingUrl("https://router.flatkey.ai")).toBe("https://router.flatkey.ai/api/website/pricing");
  });

  test("defaults public pricing data fetches to the console origin", () => {
    expect(publicPricingUrl()).toBe("https://console.flatkey.ai/api/website/pricing");
  });
});
