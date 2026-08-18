import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LOCALES } from "@/lib/locales";
import { BLOG_DISCORD_INVITE_URL, BlogCTA, BlogLimitedOffer } from "./blog-pages";

describe("BlogLimitedOffer", () => {
  test("links the English offer to Discord with the promised credit", () => {
    const html = renderToStaticMarkup(<BlogLimitedOffer locale="en" />);

    expect(html).toContain("Limited offer");
    expect(html).toContain("Join Discord. Get $5 in credits.");
    expect(html).toContain("Message an admin with your registered Flatkey email to claim.");
    expect(html).not.toContain("Meet other AI builders");
    expect(html).toContain(">Claim offer<");
    expect(html).not.toContain("Join Discord &amp; claim $5");
    expect(html).toContain(`href="${BLOG_DISCORD_INVITE_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  test("renders localized offer copy for Chinese visitors", () => {
    const html = renderToStaticMarkup(<BlogLimitedOffer locale="zh" />);

    expect(html).toContain("限时优惠");
    expect(html).toContain("加入 Discord，领取 5 美元额度。");
    expect(html).toContain("进群后联系管理员，并提供 Flatkey 注册邮箱领取。");
  });

  test("renders the offer for every supported locale", () => {
    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(<BlogLimitedOffer locale={locale} />);
      expect(html).toContain(BLOG_DISCORD_INVITE_URL);
      expect(html).toMatch(/5|５/);
    }
  });
});

describe("BlogCTA", () => {
  test("uses a dedicated high-contrast button on the dark panel", () => {
    const html = renderToStaticMarkup(<BlogCTA locale="en" />);

    expect(html).toContain("Build faster with one AI gateway.");
    expect(html).toContain("blog-cta-button");
    expect(html).toContain(">Get started<");
  });
});
