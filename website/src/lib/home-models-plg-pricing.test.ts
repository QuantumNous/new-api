import { describe, expect, test } from "bun:test";
import { buildRowsForModels } from "./home-models";
import type { PricingData, PricingModel } from "./pricing";
import { discountedPriceUsd } from "./pricing";

const VENDORS: PricingData["vendors"] = [{ id: 7, name: "OpenAI" }];

// gpt-4.1-mini as served by /api/website/pricing?group=plg: model_ratio 0.2
// (official $0.40 / 1M input), plg-only enable_groups, plg ratio 0.9.
const PLG_MODEL: PricingModel = {
  model_name: "gpt-4.1-mini",
  vendor_id: 7,
  quota_type: 0,
  model_ratio: 0.2,
  completion_ratio: 4,
  enable_groups: ["plg"],
};

const PLG_GROUP_RATIO = { plg: 0.9 };

describe("discountedPriceUsd", () => {
  test("applies the group ratio only, with no top-up bonus layer", () => {
    // The $200+$100 top-up bonus is retired: list price passes through as-is.
    expect(discountedPriceUsd(0.4)).toBe(0.4);
    expect(discountedPriceUsd(1)).toBe(1);
    expect(discountedPriceUsd(0)).toBe(0);
  });
});

describe("buildRowsForModels on the plg payload", () => {
  test("prices gpt-4.1-mini at the plg group ratio, not the retired bonus", () => {
    const [row] = buildRowsForModels([PLG_MODEL], VENDORS, PLG_GROUP_RATIO);

    expect(row.official).toBe("$0.4");
    // 0.2 x 2 x 0.9 = 0.36. The old bonus path produced $0.24.
    expect(row.discounted).toBe("$0.36");
    expect(row.discounted).not.toBe("$0.24");
  });

  test("falls back to the official price when no group ratio resolves", () => {
    const [row] = buildRowsForModels([{ ...PLG_MODEL, enable_groups: [] }], VENDORS, {});

    expect(row.official).toBe("$0.4");
    expect(row.discounted).toBe("$0.4");
  });

  test("keeps request-billed prices pure for row-specific unit rendering", () => {
    const requestModel: PricingModel = {
      model_name: "some-video-model",
      vendor_id: 7,
      quota_type: 1,
      model_ratio: 0,
      completion_ratio: 0,
      model_price: 1,
      enable_groups: ["plg"],
    };

    const [row] = buildRowsForModels([requestModel], VENDORS, PLG_GROUP_RATIO);

    expect(row.official).toBe("$1");
    expect(row.discounted).toBe("$0.9");
  });

  test("describes token rows with per-1M token unit metadata", () => {
    const [row] = buildRowsForModels([PLG_MODEL], VENDORS, PLG_GROUP_RATIO);

    expect(row.priceUnit).toBe("per 1M tokens");
    expect(row.pricePrefix).toBeUndefined();
  });

  test("describes request rows with per-request unit metadata", () => {
    const requestModel: PricingModel = {
      model_name: "some-video-model",
      vendor_id: 7,
      quota_type: 1,
      model_ratio: 0,
      completion_ratio: 0,
      model_price: 1,
      enable_groups: ["plg"],
    };

    const [row] = buildRowsForModels([requestModel], VENDORS, PLG_GROUP_RATIO);

    expect(row.priceUnit).toBe("per request");
    expect(row.pricePrefix).toBeUndefined();
  });

  test("describes display-priced per-second rows as from pricing", () => {
    const secondModel: PricingModel = {
      model_name: "some-video-model",
      vendor_id: 7,
      quota_type: 1,
      model_ratio: 0,
      completion_ratio: 0,
      model_price: 0.08,
      enable_groups: ["plg"],
      display_pricing: {
        billing_kind: "per_second",
        prices: {
          second: { configured: 0.08, plg: 0.072, from: true },
        },
      },
    };

    const [row] = buildRowsForModels([secondModel], VENDORS, PLG_GROUP_RATIO);

    expect(row.official).toBe("$0.08");
    expect(row.discounted).toBe("$0.072");
    expect(row.priceUnit).toBe("per second");
    expect(row.pricePrefix).toBe("from");
  });

  test("keeps display-priced video models even when legacy model_price is zero", () => {
    const secondModel: PricingModel = {
      model_name: "display-only-video-model",
      vendor_id: 7,
      quota_type: 1,
      model_ratio: 0,
      completion_ratio: 0,
      model_price: 0,
      enable_groups: ["plg"],
      display_pricing: {
        billing_kind: "per_second",
        prices: {
          second: { configured: 0.08, plg: 0.072 },
        },
      },
    };

    const rows = buildRowsForModels([secondModel], VENDORS, PLG_GROUP_RATIO);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.discounted).toBe("$0.072");
  });
});
