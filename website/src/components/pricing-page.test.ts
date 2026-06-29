import { describe, expect, test } from "bun:test";
import { LOCALIZED_TOP_UP_PRICES, getPricingPageCopy, getPricingPlans, getPricingPageFaqs } from "./pricing-page";

describe("pricing page conversion copy", () => {
  test("uses API gateway conversion messaging in the hero and plan section", () => {
    const copy = getPricingPageCopy("en");

    expect(copy.modelPricing).toBe("One API key for every top AI model");
    expect(copy.description).toContain("Top up $10");
    expect(copy.quickStartSteps).toEqual([
      "Top up $10",
      "Create an API key",
      "Call GPT, Claude, Gemini, DeepSeek, and video models",
    ]);
    expect(copy.costExamplesTitle).toBe("3X the official Plus plan usage");
    expect(copy.officialPlusProof.medal).toBe("Official token burn verified");
    expect(copy.officialPlusProof.proof).toContain("$20 reaches 3X official Plus-style usable workload");
    expect(copy.costExamples.map((item) => item.label)).toEqual([
      "Built for real API workloads",
      "One balance across top models",
      "40% lower effective cost",
    ]);
    expect(copy.trustSignals).toContain("Prepaid balance, no surprise bill");
  });

  test("uses the published top-up pricing tiers", () => {
    const plans = getPricingPlans("en");

    expect(plans.map((plan) => plan.price)).toEqual(["$10", "$20", "$200", "Custom"]);
    expect(plans.slice(0, 3).map((plan) => plan.action)).toEqual(["checkout", "checkout", "checkout"]);
    expect(plans.map((plan) => plan.caption)).toEqual([
      "Lowest entry to get started",
      "3X more usage than the official plan",
      "40X more usage than the official plan",
      "Custom usage, routing, and invoicing",
    ]);
    expect(plans[1]?.badge).toBe("Most Popular");
    expect(plans[1]?.discount).toBe("40% OFF");
    expect(plans[2]?.discount).toBe("50% OFF");
    expect(plans[3]?.name).toBe("Enterprise");
    expect(plans[3]?.cta).toBe("Contact Us");
  });

  test("adds stable checkout metadata to self-serve plans", () => {
    const plans = getPricingPlans("pt").slice(0, 3);

    expect(plans.map((plan) => plan.currency)).toEqual(["BRL", "BRL", "BRL"]);
    expect(plans.map((plan) => plan.amountMinor)).toEqual([4990, 9990, 99000]);
    expect(plans.map((plan) => plan.stripeLookupKey)).toEqual([
      "topup-brl-4990",
      "topup-brl-9990",
      "topup-brl-99000",
    ]);
    expect(plans[0]?.checkoutUrl).toContain("redirect=%2Fwallet%3Famount%3D49.9%26currency%3DBRL");
    expect(plans[0]?.checkoutUrl).toContain("stripe_lookup_key%3Dtopup-brl-4990");
  });

  test("localizes top-up plan prices for supported currency locales", () => {
    const ptPlans = getPricingPlans("pt").slice(0, 3);
    const jaPlans = getPricingPlans("ja").slice(0, 3);

    expect(ptPlans.map((plan) => plan.name)).toEqual(["Top up R$49.90", "Top up R$99.90", "Top up R$990"]);
    expect(ptPlans.map((plan) => plan.price)).toEqual(["R$49.90", "R$99.90", "R$990"]);
    expect(jaPlans.map((plan) => plan.name)).toEqual(["Top up ¥1,500", "Top up ¥3,000", "Top up ¥30,000"]);
    expect(jaPlans.map((plan) => plan.price)).toEqual(["¥1,500", "¥3,000", "¥30,000"]);
  });

  test("documents all configured localized top-up amounts", () => {
    expect(LOCALIZED_TOP_UP_PRICES.USD).toEqual([10, 20, 200]);
    expect(LOCALIZED_TOP_UP_PRICES.BRL).toEqual([49.9, 99.9, 990]);
    expect(LOCALIZED_TOP_UP_PRICES.JPY).toEqual([1500, 3000, 30000]);
  });

  test("answers how the $20 plan reaches 3X usage", () => {
    const faqs = getPricingPageFaqs("en");

    expect(faqs[0]?.question).toContain("$20");
    expect(faqs[0]?.question).toContain("3X");
    expect(faqs[0]?.answer).toContain("metered API balance");
    expect(faqs[0]?.answer).toContain("seat overhead");
  });
});
