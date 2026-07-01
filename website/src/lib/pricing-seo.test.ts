import { describe, expect, test } from "bun:test";
import { filterPricingModels, type PricingData } from "./pricing";
import {
  buildModelSlug,
  buildPricingSeoIndex,
  buildVendorSlug,
  findModelSeoEntry,
  findVendorSeoEntry,
} from "./pricing-seo";

const pricing: PricingData = {
  vendors: [
    { id: 1, name: "字节跳动", icon: "bytedance", description: "ByteDance AI models" },
    { id: 2, name: "OpenAI", icon: "openai" },
  ],
  models: [
    {
      model_name: "doubao-seed-1.6",
      vendor_id: 1,
      vendor_name: "字节跳动",
      quota_type: 0,
      model_ratio: 0.5,
      completion_ratio: 2,
      supported_endpoint_types: ["openai"],
    },
    {
      model_name: "gpt-5.1",
      vendor_id: 2,
      vendor_name: "OpenAI",
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 2,
      supported_endpoint_types: ["openai-response"],
    },
  ],
  groupRatio: {},
  usableGroup: {},
  supportedEndpoint: {},
  autoGroups: [],
};

describe("pricing SEO slugs", () => {
  test("uses stable ASCII vendor slugs instead of localized display names", () => {
    expect(buildVendorSlug({ id: 1, name: "字节跳动", icon: "bytedance" })).toBe("bytedance");
    expect(buildVendorSlug({ id: 2, name: "OpenAI" })).toBe("openai");
  });

  test("uses stable ASCII model slugs and preserves readable model names", () => {
    expect(buildModelSlug("GPT-5.1")).toBe("gpt-5-1");
    expect(buildModelSlug("doubao-seed-1.6")).toBe("doubao-seed-1-6");
  });

  test("builds vendor and model index entries from pricing data", () => {
    const index = buildPricingSeoIndex(pricing);

    expect(index.vendors.map((vendor) => vendor.slug)).toEqual(["bytedance", "openai"]);
    expect(index.models.map((model) => model.slug)).toEqual(["doubao-seed-1-6", "gpt-5-1"]);
    expect(index.vendors[0]?.models.map((model) => model.model_name)).toEqual(["doubao-seed-1.6"]);
  });

  test("resolves entries by slug for dynamic SEO routes", () => {
    const index = buildPricingSeoIndex(pricing);

    expect(findVendorSeoEntry(index, "bytedance")?.displayName).toBe("字节跳动");
    expect(findModelSeoEntry(index, "gpt-5-1")?.model.model_name).toBe("gpt-5.1");
  });

  test("pricing filtering accepts vendor slug parameters", () => {
    const index = buildPricingSeoIndex(pricing);
    const models = index.models.map((entry) => entry.model);

    expect(filterPricingModels(models, { vendor: "bytedance" }).map((model) => model.model_name)).toEqual(["doubao-seed-1.6"]);
  });
});
