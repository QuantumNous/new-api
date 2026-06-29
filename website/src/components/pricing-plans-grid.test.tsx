import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingPlansGrid } from "./pricing-plans-grid";
import { getPricingPageCopy, getPricingPlans } from "./pricing-page";

describe("PricingPlansGrid", () => {
  test("does not mount the enterprise form iframe before the modal is opened", () => {
    const copy = getPricingPageCopy("en");
    const html = renderToStaticMarkup(
      <PricingPlansGrid
        plans={getPricingPlans("en")}
        locale="en"
        contactCopy={{
          closeLabel: copy.enterpriseContactCloseLabel,
          eyebrow: copy.enterpriseContactEyebrow,
          title: copy.enterpriseContactTitle,
          description: copy.enterpriseContactDescription,
        }}
      />
    );

    expect(html).not.toContain("Enterprise sales inquiry form");
    expect(html).not.toContain("data-tally-src=");
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).toContain("redirect=%2Fwallet%3Famount%3D10%26currency%3DUSD");
    expect(html).not.toContain("mailto:support@flatkey.ai");
    expect(html).not.toContain("support@flatkey.ai");
  });

  test("styles the localized enterprise price from the plan action", () => {
    const copy = getPricingPageCopy("pt");
    const plans = getPricingPlans("pt");
    const contactPlan = plans.find((plan) => plan.action === "contact");
    const html = renderToStaticMarkup(
      <PricingPlansGrid
        plans={plans}
        locale="pt"
        contactCopy={{
          closeLabel: copy.enterpriseContactCloseLabel,
          eyebrow: copy.enterpriseContactEyebrow,
          title: copy.enterpriseContactTitle,
          description: copy.enterpriseContactDescription,
        }}
      />
    );

    expect(contactPlan?.price).not.toBe("Custom");
    expect(html).toContain(
      `<span class="text-4xl font-black tracking-tight text-slate-950 dark:text-white">${contactPlan?.price}</span>`
    );
  });
});
