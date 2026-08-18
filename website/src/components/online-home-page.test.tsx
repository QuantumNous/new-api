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
  test("routes home auth CTAs to console signup when no session hint exists", async () => {
    const { OnlineHomePage } = await import("./online-home-page");
    const html = renderToStaticMarkup(
      await OnlineHomePage({ locale: "en" }),
    );

    const signupHref = "https://console.flatkey.ai/sign-up?lng=en";
    expect(hrefBeforeText(html, "Get up to 40 USD free credits")).toBe(
      signupHref,
    );
    expect(hrefBeforeText(html, "Get started")).toBe(signupHref);
  });

  test("does not treat a console session hint as verified auth for home CTAs", async () => {
    const { OnlineHomePage } = await import("./online-home-page");
    const html = renderToStaticMarkup(
      await OnlineHomePage({ locale: "en", hasConsoleSessionHint: true }),
    );

    const signupHref = "https://console.flatkey.ai/sign-up?lng=en";
    expect(hrefBeforeText(html, "Get up to 40 USD free credits")).toBe(
      signupHref,
    );
    expect(hrefBeforeText(html, "Get started")).toBe(signupHref);
  });
});
