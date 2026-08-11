import { describe, expect, test } from "bun:test";
import { buildRowsForModels } from "./home-models";
import {
  buildEffectiveGroupRatio,
  formatModelPrice,
  getBestGroupRatio,
  type PricingData,
  type PricingModel,
} from "./pricing";

const VENDORS: PricingData["vendors"] = [{ id: 1, name: "Zhipu" }];

// A domestic model billed cheaper than the flat plg ratio: GroupModelRatio
// gives plg/glm-5 a 0.6 override while the plg group ratio is 0.9.
const GROUP_RATIO = { plg: 0.9 };
const GROUP_MODEL_RATIO = { plg: { "glm-5": 0.6 } };

const GLM: PricingModel = {
  model_name: "glm-5",
  vendor_id: 1,
  quota_type: 0,
  model_ratio: 0.3, // official $0.60 / 1M input
  completion_ratio: 1,
  enable_groups: ["plg"],
};

// No per-model override: falls back to the flat plg group ratio.
const GPT: PricingModel = {
  model_name: "gpt-4.1-mini",
  vendor_id: 1,
  quota_type: 0,
  model_ratio: 0.2, // official $0.40 / 1M input
  completion_ratio: 1,
  enable_groups: ["plg"],
};

function enrich(model: PricingModel): PricingModel {
  return {
    ...model,
    group_ratio: buildEffectiveGroupRatio(model, GROUP_RATIO, GROUP_MODEL_RATIO),
  };
}

describe("per-model group ratio takes precedence over the flat group ratio", () => {
  test("buildEffectiveGroupRatio applies the model override", () => {
    expect(buildEffectiveGroupRatio(GLM, GROUP_RATIO, GROUP_MODEL_RATIO)).toEqual({ plg: 0.6 });
    expect(buildEffectiveGroupRatio(GPT, GROUP_RATIO, GROUP_MODEL_RATIO)).toEqual({ plg: 0.9 });
  });

  test("getBestGroupRatio prefers the model override", () => {
    expect(getBestGroupRatio(enrich(GLM), GROUP_RATIO)).toBe(0.6);
    expect(getBestGroupRatio(enrich(GPT), GROUP_RATIO)).toBe(0.9);
  });

  test("formatModelPrice quotes the overridden ratio, not the group ratio", () => {
    // 0.3 x 2 x 0.6 = 0.36. Using the flat 0.9 would over-quote at $0.54.
    expect(formatModelPrice(enrich(GLM), "input")).toBe("$0.36");
    expect(formatModelPrice(enrich(GPT), "input")).toBe("$0.36");
  });

  test("directory rows quote the overridden ratio", () => {
    const rows = buildRowsForModels([enrich(GLM), enrich(GPT)], VENDORS, GROUP_RATIO);

    expect(rows[0].official).toBe("$0.6");
    expect(rows[0].discounted).toBe("$0.36"); // 0.6 x 0.6, not 0.6 x 0.9
    expect(rows[1].official).toBe("$0.4");
    expect(rows[1].discounted).toBe("$0.36"); // 0.4 x 0.9
  });

  test("an unenriched model still falls back to the flat group ratio", () => {
    expect(getBestGroupRatio(GLM, GROUP_RATIO)).toBe(0.9);
  });
});
