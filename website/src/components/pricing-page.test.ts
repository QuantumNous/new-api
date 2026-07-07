import { describe, expect, test } from "bun:test";
import { LOCALIZED_TOP_UP_PRICES, TOP_UP_PACKAGE_AMOUNTS, getPricingPageCopy, getPricingPlans, getPricingPageFaqs } from "./pricing-page";

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
    expect(copy.packageBullets).toContain("Bonus credit on every top-up");
    expect(copy.trustSignals).toContain("Prepaid balance, no surprise bill");
  });

  test("uses the published top-up pricing tiers", () => {
    const plans = getPricingPlans("en");

    expect(plans.map((plan) => plan.price)).toEqual(["$10", "$20", "$200", "Custom"]);
    expect(plans.slice(0, 3).map((plan) => plan.action)).toEqual(["checkout", "checkout", "checkout"]);
    expect(plans.map((plan) => plan.caption)).toEqual([
      "Pay $10, get $13 in credit",
      "Pay $20, get $28 in credit",
      "Pay $200, get $300 in credit",
      "Custom usage, routing, and invoicing",
    ]);
    expect(plans.slice(0, 3).map((plan) => plan.cta)).toEqual([
      "Top up $10",
      "Top up $20",
      "Top up $200",
    ]);
    expect(plans[0]?.badge).toBe("Most Popular");
    expect(plans[0]?.discount).toBe("+3 free bonus");
    expect(plans[1]?.badge).toBeUndefined();
    expect(plans[1]?.discount).toBe("+8 free bonus");
    expect(plans[2]?.discount).toBe("+100 free bonus");
    expect(plans[3]?.name).toBe("Enterprise");
    expect(plans[3]?.cta).toBe("Contact Us");
  });

  test("localizes newly added pricing plan and model page copy", () => {
    const copy = getPricingPageCopy("pt");
    const plans = getPricingPlans("pt");

    expect(copy.pricingHeroTitle).not.toBe("Simple pricing for one AI API gateway");
    expect(copy.pricingHeroDescription).not.toBe(
      "Start with prepaid balance, route across top models, and scale usage without buying fixed monthly bundles."
    );
    expect(copy.modelsEyebrow).not.toBe("Models");
    expect(copy.modelsDescription).not.toBe(
      "Discover live model availability, pricing, endpoint support, and model detail pages."
    );
    expect(plans[0]?.badge).not.toBe("Most Popular");
    expect(plans[0]?.discount).toBe("+3 de bônus grátis");
    expect(plans[1]?.discount).toBe("+8 de bônus grátis");
    expect(plans[2]?.discount).toBe("+100 de bônus grátis");
    expect(plans[3]?.cta).not.toBe("Contact Us");
    expect(plans[3]?.name).toBe(copy.enterprisePlanName);
  });

  test("adds stable checkout metadata to self-serve plans", () => {
    const plans = getPricingPlans("pt").slice(0, 3);

    expect(plans.map((plan) => plan.currency)).toEqual(["BRL", "BRL", "BRL"]);
    expect(plans.map((plan) => plan.amount)).toEqual([10, 20, 200]);
    expect(plans.map((plan) => plan.amountMinor)).toEqual([4990, 9990, 99000]);
    expect(plans.map((plan) => plan.stripeLookupKey)).toEqual([
      "topup-brl-4990",
      "topup-brl-9990",
      "topup-brl-99000",
    ]);
    expect(plans[0]?.checkoutUrl).toContain("redirect=%2Fwallet%3Famount%3D10%26currency%3DBRL");
    expect(plans[0]?.checkoutUrl).toContain("stripe_lookup_key%3Dtopup-brl-4990");
  });

  test("localizes top-up plan prices for supported currency locales", () => {
    const ptPlans = getPricingPlans("pt").slice(0, 3);
    const jaPlans = getPricingPlans("ja").slice(0, 3);

    expect(ptPlans.map((plan) => plan.name)).toEqual(["Recarregar R$49.90", "Recarregar R$99.90", "Recarregar R$990"]);
    expect(ptPlans.map((plan) => plan.price)).toEqual(["R$49.90", "R$99.90", "R$990"]);
    expect(jaPlans.map((plan) => plan.name)).toEqual(["¥1,500 をチャージ", "¥3,000 をチャージ", "¥30,000 をチャージ"]);
    expect(jaPlans.map((plan) => plan.price)).toEqual(["¥1,500", "¥3,000", "¥30,000"]);
  });

  test("documents all configured localized top-up amounts", () => {
    expect(TOP_UP_PACKAGE_AMOUNTS).toEqual([10, 20, 200]);
    expect(LOCALIZED_TOP_UP_PRICES.USD).toEqual([10, 20, 200]);
    expect(LOCALIZED_TOP_UP_PRICES.BRL).toEqual([49.9, 99.9, 990]);
    expect(LOCALIZED_TOP_UP_PRICES.JPY).toEqual([1500, 3000, 30000]);
  });

  test("answers how the top-up bonus works", () => {
    const faqs = getPricingPageFaqs("en");

    expect(faqs[0]?.question).toContain("top-up bonus");
    expect(faqs[0]?.answer).toContain("+$3 on $10");
    expect(faqs[0]?.answer).toContain("+$8 on $20");
    expect(faqs[0]?.answer).toContain("+$100 on $200");
  });
});
