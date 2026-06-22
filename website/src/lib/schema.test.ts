import { describe, expect, test } from "bun:test";
import {
  buildBlogArticleSchema,
  buildBlogCategorySchema,
  buildBlogIndexSchema,
  stringifyJsonLd,
} from "./schema";

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
