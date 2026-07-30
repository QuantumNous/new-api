package common

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizePublicPath(t *testing.T) {
	assert.Equal(t, "/", NormalizePublicPath(""))
	assert.Equal(t, "/", NormalizePublicPath("/"))
	assert.Equal(t, "/pricing", NormalizePublicPath("/pricing/"))
	assert.Equal(t, "/pricing", NormalizePublicPath("/pricing?x=1"))
	assert.Equal(t, "/docs/getting-started", NormalizePublicPath("/docs/getting-started/#top"))
	assert.Equal(t, "/a/b", NormalizePublicPath("/a//b/"))
}

func TestLookupSEOPage(t *testing.T) {
	page, ok := LookupSEOPage("/pricing/")
	require.True(t, ok)
	assert.Equal(t, "/pricing", page.Path)

	page, ok = LookupSEOPage("/pricing/gpt-4o")
	require.True(t, ok)
	assert.Contains(t, page.Title, "gpt-4o")

	page, ok = LookupSEOPage("/docs/custom-slug")
	require.True(t, ok)
	assert.Equal(t, "/docs/custom-slug", page.Path)

	_, ok = LookupSEOPage("/console/log")
	assert.False(t, ok)
}

func TestIsPrivateSEOPath(t *testing.T) {
	assert.True(t, IsPrivateSEOPath("/console"))
	assert.True(t, IsPrivateSEOPath("/console/token"))
	assert.True(t, IsPrivateSEOPath("/sign-in"))
	assert.True(t, IsPrivateSEOPath("/api/status"))
	assert.False(t, IsPrivateSEOPath("/"))
	assert.False(t, IsPrivateSEOPath("/pricing"))
	assert.False(t, IsPrivateSEOPath("/docs/getting-started"))
}

func TestBuildRobotsTxt(t *testing.T) {
	body := BuildRobotsTxt("https://you-box.com/sitemap.xml")
	assert.Contains(t, body, "User-agent: *")
	assert.Contains(t, body, "Disallow: /console")
	assert.Contains(t, body, "Sitemap: https://you-box.com/sitemap.xml")
	assert.NotContains(t, body, "Disallow: /\n")
}

func TestBuildSitemapXML(t *testing.T) {
	xml := BuildSitemapXML("https://you-box.com", nil)
	assert.Contains(t, xml, `<?xml version="1.0" encoding="UTF-8"?>`)
	assert.Contains(t, xml, "<loc>https://you-box.com/</loc>")
	assert.Contains(t, xml, "<loc>https://you-box.com/pricing</loc>")
	assert.Contains(t, xml, "<loc>https://you-box.com/docs/getting-started</loc>")
	assert.Contains(t, xml, "<loc>https://you-box.com/docs/what-is-boxai</loc>")
	assert.Contains(t, xml, "<loc>https://you-box.com/rankings</loc>")
	assert.NotContains(t, xml, "/console")
}

func TestInjectSEOIntoHTML(t *testing.T) {
	index := []byte(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>New API</title>
    <meta name="title" content="New API" />
    <meta
      name="description"
      content="Unified AI API gateway and admin dashboard."
    />
    <meta name="theme-color" content="#fff" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`)

	page, ok := LookupSEOPage("/")
	require.True(t, ok)
	out := string(InjectSEOIntoHTML(index, page, "BoxAI", "https://you-box.com", "/logo.png", false))

	assert.Contains(t, out, `lang="zh-CN"`)
	assert.Contains(t, out, "BoxAI · Unified AI API Gateway | you-box.com")
	assert.Contains(t, out, "BoxAI")
	assert.Contains(t, out, "you-box.com")
	assert.Contains(t, out, "alternateName")
	assert.Contains(t, out, `name="robots" content="index,follow"`)
	assert.Contains(t, out, `rel="canonical" href="https://you-box.com/"`)
	assert.Contains(t, out, `property="og:title" content="BoxAI · Unified AI API Gateway | you-box.com"`)
	assert.Contains(t, out, `id="app-jsonld"`)
	assert.Contains(t, out, `id="seo-prerender"`)
	assert.Contains(t, out, "<h1>")
	assert.True(t, strings.Index(out, `id="seo-prerender"`) < strings.Index(out, `id="root"`))

	// Private path forces noindex even if flag is false
	private := SEOPage{Path: "/console", Title: "Console", Description: "x"}
	out2 := string(InjectSEOIntoHTML(index, private, "BoxAI", "https://you-box.com", "", false))
	assert.Contains(t, out2, `name="robots" content="noindex,nofollow"`)
	assert.NotContains(t, out2, `id="seo-prerender"`)
}

func TestFormatSEOTitle(t *testing.T) {
	assert.Equal(t, "BoxAI", FormatSEOTitle("", "BoxAI"))
	assert.Equal(t, "Pricing | BoxAI", FormatSEOTitle("Pricing", "BoxAI"))
	assert.Equal(t, "BoxAI", FormatSEOTitle("", ""))
	assert.Equal(t,
		"BoxAI · Unified AI API Gateway | you-box.com",
		FormatSEODocumentTitle("/", "", "BoxAI", "https://you-box.com"),
	)
}

func TestSiteBaseURL(t *testing.T) {
	assert.Equal(t, "https://you-box.com", SiteBaseURL("https://you-box.com/"))
	assert.Equal(t, "https://you-box.com", SiteBaseURL("you-box.com"))
	assert.Equal(t, "", SiteBaseURL(""))
}

func TestInjectAgainstRepoIndexHTML(t *testing.T) {
	raw, err := os.ReadFile("../web/default/index.html")
	if err != nil {
		// when tests run from module root cwd may differ
		raw, err = os.ReadFile("web/default/index.html")
	}
	if err != nil {
		t.Skip(err)
	}
	page, ok := LookupSEOPage("/pricing")
	require.True(t, ok)
	out := string(InjectSEOIntoHTML(raw, page, "BoxAI", "https://you-box.com", "/logo.png", false))
	assert.Contains(t, out, "Model Pricing | BoxAI")
	assert.Contains(t, out, `name="robots" content="index,follow"`)
	assert.Contains(t, out, `rel="canonical" href="https://you-box.com/pricing"`)
	assert.Contains(t, out, `property="og:title"`)
	assert.Contains(t, out, `id="seo-prerender"`)
	assert.Contains(t, out, `id="app-jsonld"`)
	// description should no longer be the generic New API dashboard line only
	assert.True(t, strings.Contains(out, "Browse model prices") || strings.Contains(out, page.Description))
}
