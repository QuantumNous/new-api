import { describe, expect, test } from "bun:test";
import {
  buildBasePageSchema,
  buildBlogArticleSchema,
  buildBlogCategorySchema,
  buildBlogIndexSchema,
  buildHomepageSchema,
  buildModelSchema,
  stringifyJsonLd,
} from "./schema";

describe("sitewide structured data", () => {
  test("builds a reusable WebPage schema with localized URL and breadcrumbs", () => {
    const graph = buildBasePageSchema({
      locale: "zh",
      pathname: "/models",
    });

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "WebPage",
        url: "https://flatkey.ai/zh/models",
        inLanguage: "zh-CN",
        isPartOf: expect.objectContaining({ "@type": "WebSite" }),
        publisher: expect.objectContaining({ "@type": "Organization" }),
      })
    );
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://flatkey.ai/zh" },
          { "@type": "ListItem", position: 2, name: "Models", item: "https://flatkey.ai/zh/models" },
        ],
      })
    );
  });

  test("keeps English breadcrumb home at the site root", () => {
    const graph = buildBasePageSchema({
      locale: "en",
      pathname: "/pricing",
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://flatkey.ai/" },
          { "@type": "ListItem", position: 2, name: "Pricing", item: "https://flatkey.ai/pricing" },
        ],
      })
    );
  });
});
describe("homepage structured data", () => {
  test("builds product and navigation schema for rich homepage search results", () => {
    const graph = buildHomepageSchema({
      locale: "en",
      title: "flatkey.ai - AI API Gateway",
      description: "One API for leading AI models.",
    });

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "WebSite",
        name: "flatkey.ai",
        url: "https://flatkey.ai",
      })
    );
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "SoftwareApplication",
        name: "flatkey.ai",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: "https://flatkey.ai",
      })
    );
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "ItemList",
        itemListElement: [
          { "@type": "SiteNavigationElement", position: 1, name: "Sign up", url: "https://flatkey.ai/sign-up" },
          { "@type": "SiteNavigationElement", position: 2, name: "Pricing", url: "https://flatkey.ai/pricing" },
          { "@type": "SiteNavigationElement", position: 3, name: "Use cases", url: "https://flatkey.ai/use-case/codex" },
          { "@type": "SiteNavigationElement", position: 4, name: "Blog", url: "https://flatkey.ai/blog" },
        ],
      })
    );
  });

  test("localizes homepage navigation schema URLs", () => {
    const graph = buildHomepageSchema({
      locale: "ja",
      title: "flatkey.ai",
      description: "AI API gateway.",
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "ItemList",
        itemListElement: expect.arrayContaining([
          expect.objectContaining({ name: "Sign up", url: "https://flatkey.ai/ja/sign-up" }),
          expect.objectContaining({ name: "Pricing", url: "https://flatkey.ai/ja/pricing" }),
          expect.objectContaining({ name: "Use cases", url: "https://flatkey.ai/ja/use-case/codex" }),
          expect.objectContaining({ name: "Blog", url: "https://flatkey.ai/ja/blog" }),
        ]),
      })
    );
  });
});

describe("blog structured data", () => {
  test("builds BlogPosting schema with canonical URL, image, author, and breadcrumb", () => {
    const graph = buildBlogArticleSchema({
      locale: "ja",
      post: {
        id: 1,
        title: "API 料金ガイド",
        slug: "api-pricing-guide",
        summary: "How to plan AI API spend.",
        date: "2026-06-20T10:00:00Z",
        author: "Flatkey Team",
        cover: "https://flatkey.ai/blog-cover.png",
        categoryName: "Guides",
        categorySlug: "guides",
      },
    });

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "BlogPosting",
        headline: "API 料金ガイド",
        description: "How to plan AI API spend.",
        url: "https://flatkey.ai/ja/blog/api-pricing-guide",
        mainEntityOfPage: "https://flatkey.ai/ja/blog/api-pricing-guide",
        datePublished: "2026-06-20T10:00:00Z",
        dateModified: "2026-06-20T10:00:00Z",
        image: ["https://flatkey.ai/blog-cover.png"],
        author: { "@type": "Person", name: "Flatkey Team" },
      })
    );
    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: "https://flatkey.ai/ja/blog" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://flatkey.ai/ja/blog/category/guides" },
          { "@type": "ListItem", position: 3, name: "API 料金ガイド", item: "https://flatkey.ai/ja/blog/api-pricing-guide" },
        ],
      })
    );
  });

  test("builds Blog schema for the blog index", () => {
    const graph = buildBlogIndexSchema({
      locale: "en",
      title: "flatkey.ai Blog",
      description: "Product updates and API guides.",
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "Blog",
        name: "flatkey.ai Blog",
        description: "Product updates and API guides.",
        url: "https://flatkey.ai/blog",
      })
    );
    expect(graph["@graph"]).toContainEqual(expect.objectContaining({ "@type": "WebSite", url: "https://flatkey.ai" }));
  });

  test("uses the Brazilian Portuguese BCP47 tag in JSON-LD language fields", () => {
    const graph = buildBlogIndexSchema({
      locale: "pt",
      title: "Blog da flatkey.ai",
      description: "Guias de API e produto.",
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "Blog",
        inLanguage: "pt-BR",
      })
    );
  });

  test("builds CollectionPage schema for a blog category", () => {
    const graph = buildBlogCategorySchema({
      locale: "en",
      slug: "guides",
      name: "Guides",
      description: "Practical guides.",
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "CollectionPage",
        name: "Guides",
        description: "Practical guides.",
        url: "https://flatkey.ai/blog/category/guides",
      })
    );
  });

  test("stringifies JSON-LD without raw closing script text", () => {
    expect(stringifyJsonLd({ value: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("model structured data", () => {
  test("builds merchant listing fields required for model product pages", () => {
    const graph = buildModelSchema({
      locale: "en",
      modelName: "gpt-4o-mini",
      vendorName: "OpenAI",
      description: "GPT-4o mini through flatkey.ai.",
      inputPriceUsd: 0.15,
      pagePath: "/models/gpt-4o-mini",
      faq: [{ q: "How is it billed?", a: "Usage is billed by token." }],
    });

    expect(graph["@graph"]).toContainEqual(
      expect.objectContaining({
        "@type": "Product",
        image: "https://flatkey.ai/flatkey-mark.svg",
        offers: expect.objectContaining({
          "@type": "Offer",
          hasMerchantReturnPolicy: expect.objectContaining({
            "@type": "MerchantReturnPolicy",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
          }),
          shippingDetails: expect.objectContaining({
            "@type": "OfferShippingDetails",
            shippingRate: expect.objectContaining({
              "@type": "MonetaryAmount",
              value: 0,
              currency: "USD",
            }),
          }),
        }),
      })
    );
  });
});
