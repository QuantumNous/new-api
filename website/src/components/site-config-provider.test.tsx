import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigProvider, useSiteConfig } from "./site-config-provider";

function ConfigProbe() {
  const { docsUrl } = useSiteConfig();
  return <span>{docsUrl ?? "hidden"}</span>;
}

describe("SiteConfigProvider", () => {
  test("provides one documentation URL to descendant chrome", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl="https://docs.example.com/start">
        <ConfigProbe />
      </SiteConfigProvider>
    );

    expect(html).toContain("https://docs.example.com/start");
  });

  test("defaults to a hidden documentation entry without a provider", () => {
    expect(renderToStaticMarkup(<ConfigProbe />)).toContain("hidden");
  });
});
