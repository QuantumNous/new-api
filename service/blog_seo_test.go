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

func TestBuildBlogSitemapForcesCanonicalPublicHost(t *testing.T) {
	sitemap := BuildBlogSitemap("https://router.flatkey.ai/", nil, []BlogPost{
		{ID: 1, Title: "Gateway Guide", Slug: "gateway-guide", Date: "2026-06-09T10:00:00Z"},
	})

	if strings.Contains(sitemap, "router.flatkey.ai") {
		t.Fatalf("expected sitemap to avoid non-canonical host, got:\n%s", sitemap)
	}
	if !strings.Contains(sitemap, `<loc>https://flatkey.ai/blog/gateway-guide</loc>`) {
		t.Fatalf("expected sitemap to contain canonical post URL, got:\n%s", sitemap)
	}
}

func TestBuildRobotsTxtPointsToSitemapAndLLMs(t *testing.T) {
	robots := BuildRobotsTxt("https://flatkey.ai/")

	for _, expected := range []string{
		"User-agent: *",
		"Allow: /",
		"Disallow: /cdn-cgi/",
		"Disallow: /_next/",
		"Sitemap: https://flatkey.ai/sitemap.xml",
		"LLMs: https://flatkey.ai/llms.txt",
	} {
		if !strings.Contains(robots, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, robots)
		}
	}
}

func TestBuildRobotsTxtForcesCanonicalPublicHost(t *testing.T) {
	robots := BuildRobotsTxt("https://router.flatkey.ai/")

	if strings.Contains(robots, "router.flatkey.ai") {
		t.Fatalf("expected robots.txt to avoid non-canonical host, got:\n%s", robots)
	}
	for _, expected := range []string{
		"Allow: /",
		"Disallow: /cdn-cgi/",
		"Disallow: /_next/",
		"Sitemap: https://flatkey.ai/sitemap.xml",
		"LLMs: https://flatkey.ai/llms.txt",
	} {
		if !strings.Contains(robots, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, robots)
		}
	}
}

func TestBuildNonCanonicalRobotsTxtDisallowsAll(t *testing.T) {
	robots := BuildNonCanonicalRobotsTxt()

	for _, expected := range []string{
		"User-agent: *",
		"Disallow: /",
		"Sitemap: https://flatkey.ai/sitemap.xml",
	} {
		if !strings.Contains(robots, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, robots)
		}
	}
	if strings.Contains(robots, "Allow: /") || strings.Contains(robots, "router.flatkey.ai") {
		t.Fatalf("expected non-canonical robots.txt to disallow only canonical sitemap, got:\n%s", robots)
	}
}

func TestBuildLLMsTxtIncludesBlogResources(t *testing.T) {
	llms := BuildLLMsTxt("https://flatkey.ai/", []BlogCategory{
		{Name: "Gateway Comparisons", Slug: "gateway-comparisons"},
	}, []BlogPost{
		{Title: "Gateway Guide", Slug: "gateway-guide", Summary: "Pick the right gateway."},
	})

	for _, expected := range []string{
		"# flatkey.ai",
		"- Blog: https://flatkey.ai/blog",
		"- Gateway Comparisons: https://flatkey.ai/blog/category/gateway-comparisons",
		"- Gateway Guide: https://flatkey.ai/blog/gateway-guide - Pick the right gateway.",
	} {
		if !strings.Contains(llms, expected) {
			t.Fatalf("expected llms.txt to contain %q, got:\n%s", expected, llms)
		}
	}
}

func TestBuildLLMsTxtForcesCanonicalPublicHost(t *testing.T) {
	llms := BuildLLMsTxt("https://router.flatkey.ai/", nil, []BlogPost{
		{Title: "Gateway Guide", Slug: "gateway-guide", Summary: "Pick the right gateway."},
	})

	if strings.Contains(llms, "router.flatkey.ai") {
		t.Fatalf("expected llms.txt to avoid non-canonical host, got:\n%s", llms)
	}
	if !strings.Contains(llms, "- Gateway Guide: https://flatkey.ai/blog/gateway-guide - Pick the right gateway.") {
		t.Fatalf("expected llms.txt to contain canonical post URL, got:\n%s", llms)
	}
}

func TestIsCanonicalPublicHost(t *testing.T) {
	cases := []struct {
		name string
		host string
		want bool
	}{
		{name: "canonical", host: "flatkey.ai", want: true},
		{name: "canonical with port", host: "flatkey.ai:443", want: true},
		{name: "forwarded host list", host: "flatkey.ai, proxy.internal", want: true},
		{name: "router subdomain", host: "router.flatkey.ai", want: false},
		{name: "www subdomain", host: "www.flatkey.ai", want: false},
		{name: "empty", host: "", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsCanonicalPublicHost(tc.host); got != tc.want {
				t.Fatalf("IsCanonicalPublicHost(%q)=%v, want %v", tc.host, got, tc.want)
			}
		})
	}
}
