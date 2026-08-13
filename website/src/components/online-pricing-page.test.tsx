import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));

describe("OnlinePricingPage", () => {
  test("renders subscribe and contact sales actions below the plan prices", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const html = renderToStaticMarkup(<OnlinePricingPage locale="en" />);

    const goPrice = html.indexOf("<b>$10</b>");
    const enterpriseCustom = html.indexOf(">Custom<");
    const goCta = html.indexOf("Subscribe", goPrice);
    const enterpriseCta = html.indexOf("Contact sales", enterpriseCustom);

    expect(goCta).toBeGreaterThanOrEqual(0);
    expect(goPrice).toBeGreaterThanOrEqual(0);
    expect(goCta).toBeGreaterThan(goPrice);
    expect(enterpriseCta).toBeGreaterThanOrEqual(0);
    expect(enterpriseCustom).toBeGreaterThanOrEqual(0);
    expect(enterpriseCta).toBeGreaterThan(enterpriseCustom);
  });
});
