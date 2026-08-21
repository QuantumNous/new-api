import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));

function hrefBeforeText(html: string, text: string): string {
  const textIndex = html.indexOf(`>${text}<`);
  expect(textIndex).toBeGreaterThanOrEqual(0);
  const matches = [...html.slice(0, textIndex).matchAll(/href="([^"]+)"/g)];
  expect(matches.length).toBeGreaterThan(0);
  return matches[matches.length - 1][1].replaceAll("&amp;", "&");
}

describe("OnlineHomePage", () => {
  const signupHref = "https://console.flatkey.ai/sign-up?lng=en";
  const overviewHref =
    "https://console.flatkey.ai/sign-up?redirect=%2Fdashboard%2Foverview&lng=en";

  test("routes home auth CTAs to console signup when no session hint exists", async () => {
    const { OnlineHomePage } = await import("./online-home-page");
    const html = renderToStaticMarkup(
      await OnlineHomePage({ locale: "en" }),
    );

    expect(hrefBeforeText(html, "Get up to 40 USD free credits")).toBe(
      overviewHref,
    );
    expect(hrefBeforeText(html, "Get started")).toBe(signupHref);
  });

  test("does not treat a console session hint as verified auth for home CTAs", async () => {
    const { OnlineHomePage } = await import("./online-home-page");
    const html = renderToStaticMarkup(
      await OnlineHomePage({ locale: "en", hasConsoleSessionHint: true }),
    );

    expect(hrefBeforeText(html, "Get up to 40 USD free credits")).toBe(
      overviewHref,
    );
    expect(hrefBeforeText(html, "Get started")).toBe(signupHref);
  });

  test("keeps the free-credits CTA pointed at the console overview in a non-English locale", async () => {
    const { OnlineHomePage } = await import("./online-home-page");
    const html = renderToStaticMarkup(
      await OnlineHomePage({ locale: "zh" }),
    );

    expect(hrefBeforeText(html, "最高领取 40 美元免费额度")).toBe(
      "https://console.flatkey.ai/sign-up?redirect=%2Fdashboard%2Foverview&lng=zh",
    );
  });
});
