import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingPlansGrid } from "./pricing-plans-grid";
import { getPricingPlans } from "./pricing-page";

describe("PricingPlansGrid", () => {
  test("does not mount the enterprise form iframe before the modal is opened", () => {
    const html = renderToStaticMarkup(<PricingPlansGrid plans={getPricingPlans("en")} locale="en" />);

    expect(html).not.toContain("Enterprise sales inquiry form");
    expect(html).not.toContain("data-tally-src=");
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).toContain("redirect=%2Fwallet%3Famount%3D10%26currency%3DUSD");
    expect(html).not.toContain("mailto:support@flatkey.ai");
    expect(html).not.toContain("support@flatkey.ai");
  });
});
