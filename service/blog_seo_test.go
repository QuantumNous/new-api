package service

import (
	"strings"
	"testing"
)

func TestBuildBlogSitemapIncludesStaticCategoriesAndPosts(t *testing.T) {
	sitemap := BuildBlogSitemap("https://flatkey.ai/", []BlogCategory{
		{ID: 364, Name: "Gateway Comparisons", Slug: "gateway-comparisons"},
	}, []BlogPost{
		{ID: 1, Title: "Gateway <Guide>", Slug: "gateway-guide", Date: "2026-06-09T10:00:00Z"},
	})

	for _, expected := range []string{
		`<loc>https://flatkey.ai/</loc>`,
		`<loc>https://flatkey.ai/blog</loc>`,
		`<loc>https://flatkey.ai/blog/category/gateway-comparisons</loc>`,
		`<loc>https://flatkey.ai/blog/gateway-guide</loc>`,
		`<lastmod>2026-06-09</lastmod>`,
		`xmlns:xhtml="http://www.w3.org/1999/xhtml"`,
		`<xhtml:link rel="alternate" hreflang="en" href="https://flatkey.ai/blog/gateway-guide"></xhtml:link>`,
		`<xhtml:link rel="alternate" hreflang="zh" href="https://flatkey.ai/zh/blog/gateway-guide"></xhtml:link>`,
		`<xhtml:link rel="alternate" hreflang="x-default" href="https://flatkey.ai/blog/gateway-guide"></xhtml:link>`,
	} {
		if !strings.Contains(sitemap, expected) {
			t.Fatalf("expected sitemap to contain %q, got:\n%s", expected, sitemap)
		}
	}
}

func TestBuildRobotsTxtPointsToSitemapAndLLMs(t *testing.T) {
	robots := BuildRobotsTxt("https://flatkey.ai/")

	for _, expected := range []string{
		"User-agent: *",
		"Allow: /",
		"Sitemap: https://flatkey.ai/sitemap.xml",
		"LLMs: https://flatkey.ai/llms.txt",
	} {
		if !strings.Contains(robots, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, robots)
		}
	}
}

func TestBuildLLMsTxtIncludesBlogResources(t *testing.T) {
	llms := BuildLLMsTxt("https://flatkey.ai/", []BlogCategory{
		{Name: "Gateway Comparisons", Slug: "gateway-comparisons"},
	}, []BlogPost{
		{Title: "Gateway Guide", Slug: "gateway-guide", Summary: "Pick the right gateway."},
	})

	for _, expected := range []string{
		"# Flatkey AI",
		"- Blog: https://flatkey.ai/blog",
		"- Gateway Comparisons: https://flatkey.ai/blog/category/gateway-comparisons",
		"- Gateway Guide: https://flatkey.ai/blog/gateway-guide - Pick the right gateway.",
	} {
		if !strings.Contains(llms, expected) {
			t.Fatalf("expected llms.txt to contain %q, got:\n%s", expected, llms)
		}
	}
}
