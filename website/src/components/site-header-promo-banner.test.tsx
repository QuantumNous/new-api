import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigProvider } from "./site-config-provider";
import { SiteHeader } from "./site-header";

describe("SiteHeader promo banner", () => {
  test("renders the Seedance promo banner at the top of the site", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl={null}>
        <SiteHeader locale="en" pathname="/" />
      </SiteConfigProvider>,
    );

    expect(html).toContain("Seedance is 15% off for a limited time.");
    expect(html).toContain("Join our Discord to get $5 in free credit.");
    expect(html).toContain(">Learn more →<");
    expect(html).toContain('aria-label="Dismiss Seedance promotion"');
    expect(html).toContain('href="/blog/deepseek-v4-pro-vs-flash"');
    expect(html.indexOf("Seedance is 15% off for a limited time.")).toBeLessThan(
      html.indexOf('aria-label="Dismiss Seedance promotion"'),
    );
  });

  test("renders the localized Seedance promo banner for zh visitors", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl={null}>
        <SiteHeader locale="zh" pathname="/zh" />
      </SiteConfigProvider>,
    );

    expect(html).toContain(
      "Seedance 限时 85 折。加入我们的 Discord，可领取 5 美元免费额度。",
    );
    expect(html).toContain(">了解更多 →<");
    expect(html).toContain('aria-label="关闭 Seedance 优惠横幅"');
    expect(html).toContain('href="/zh/blog/deepseek-v4-pro-vs-flash"');
  });

  test("links the promo banner to the matching Portuguese article", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl={null}>
        <SiteHeader locale="pt" pathname="/pt" />
      </SiteConfigProvider>,
    );

    expect(html).toContain('href="/pt/blog/deepseek-v4-pro-vs-flash"');
  });
});
