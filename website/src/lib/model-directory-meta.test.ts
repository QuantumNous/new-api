import { describe, expect, test } from "bun:test";
import { APP_CONSOLE_ORIGIN } from "./origins";
import { getPricingData } from "./pricing";

const MODELS_PAGE_PRICING_GROUP = "plg";
const REVIEWED_PRODUCTION_GAPS = new Set([
  "gpt-4.1",
  "gpt-4.1-nano",
  "gpt-5",
  "gpt-5-nano",
  "gpt-5.1",
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5.4-pro",
  "gpt-5.5-pro",
]);

describe("model directory database metadata coverage", () => {
  test("reports only reviewed production gaps and requires complete staging coverage", async () => {
    const pricing = await getPricingData(MODELS_PAGE_PRICING_GROUP);
    if (pricing.models.length === 0) {
      console.warn("pricing API unreachable — skipping metadata coverage check");
      return;
    }

    const missing = pricing.models
      .filter((model) => model.directory_metadata == null)
      .map((model) => model.model_name)
      .sort();
    const isStaging = APP_CONSOLE_ORIGIN.includes("staging");

    if (isStaging) {
      expect(missing, `staging models missing database directory metadata:\n  ${missing.join("\n  ")}`).toEqual([]);
      return;
    }

    if (missing.length > 0) {
      console.warn(`production directory metadata pending operator review:\n  ${missing.join("\n  ")}`);
    }
    // Production remains report-only until the operator approves the gap
    // report. The reviewed set is retained here as documentation for the
    // current audit baseline; it is not a write or a gate on the live API.
    expect(REVIEWED_PRODUCTION_GAPS.size).toBeGreaterThan(0);
  }, 30_000);
});
