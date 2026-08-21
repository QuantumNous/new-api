import { describe, expect, test } from "bun:test";
import { buildRowsForModels } from "./home-models";
import { getPricingData } from "./pricing";

// The directory quotes a price against the official rate, so the two figures
// have to be the ones a visitor is actually charged. The trap is
// `group_model_ratio`: per-model overrides beat the flat group ratio during
// billing, and a row built from the group ratio alone advertises a model higher
// than it is billed (deepseek-v4-flash quoted $0.396 while charging $0.374).
//
// These tests pin that behaviour against the live payload rather than a fixture,
// because the drift they guard against comes from operational pricing changes.

const PRICING_GROUP = "plg";

describe("directory pricing", () => {
  test("per-model ratio overrides win over the flat group ratio", async () => {
    const pricing = await getPricingData(PRICING_GROUP);
    if (pricing.models.length === 0) {
      console.warn("pricing API unreachable — skipping price derivation check");
      return;
    }

    const overridden = Object.entries(pricing.groupModelRatio[PRICING_GROUP] ?? {});
    if (overridden.length === 0) {
      console.warn("no per-model ratio overrides configured — nothing to compare");
      return;
    }

    const rows = buildRowsForModels(pricing.models, pricing.vendors, pricing.groupRatio, pricing.groupModelRatio);
    const groupRatio = pricing.groupRatio[PRICING_GROUP];
    let checked = 0;

    for (const [modelName, modelRatio] of overridden) {
      const row = rows.find((candidate) => candidate.name === modelName);
      const model = pricing.models.find((candidate) => candidate.model_name === modelName);
      if (!row || !model || row.officialUsd <= 0) continue;
      // The override must be what the quote uses, not the group-wide ratio.
      expect(row.discountedUsd, `${modelName} should bill at its own ratio`).toBeCloseTo(row.officialUsd * modelRatio, 4);
      if (groupRatio != null && Math.abs(groupRatio - modelRatio) > 1e-9) {
        expect(row.discountedUsd, `${modelName} must not quote the group ratio`).not.toBeCloseTo(
          row.officialUsd * groupRatio,
          4
        );
      }
      checked++;
    }

    expect(checked, "expected at least one overridden model in the catalogue").toBeGreaterThan(0);
  }, 30_000);

  test("our price never exceeds the official price", async () => {
    const pricing = await getPricingData(PRICING_GROUP);
    if (pricing.models.length === 0) return;

    const rows = buildRowsForModels(pricing.models, pricing.vendors, pricing.groupRatio, pricing.groupModelRatio);
    const overcharged = rows
      .filter((row) => row.officialUsd > 0 && row.discountedUsd > row.officialUsd)
      .map((row) => `${row.name}: ${row.discounted} > ${row.official}`);

    expect(overcharged, `rows quoting above the official rate:\n  ${overcharged.join("\n  ")}`).toEqual([]);
  }, 30_000);
});
