package common

import (
	"fmt"
	"html"
	"net/url"
	"strings"
)

// Public SEO page metadata used for HTML injection and sitemap generation.
type SEOPage struct {
	Path        string
	Title       string
	Description string
	Priority    string
	Changefreq  string
	// Heading is the H1 used in crawler-visible prerender HTML.
	Heading string
	// Body is short plain-text content for crawler-visible prerender HTML.
	Body string
}

// DefaultBrandName is the preferred product name for SEO when SystemName is empty.
const DefaultBrandName = "BoxAI"

// DefaultSEODescription is used when a page has no more specific copy.
// Keep BoxAI and the public hostname co-mentioned for brand+domain queries.
const DefaultSEODescription = "BoxAI (you-box.com) is a unified AI API gateway aggregating OpenAI, Claude, Gemini and 40+ providers. One endpoint for models, billing, rate limits, and admin."

// HomeSEOTitleTemplate builds the homepage document title.
// Example: "BoxAI · Unified AI API Gateway | you-box.com"
const HomeSEOTitleLead = "Unified AI API Gateway"

// PublicSEOPages returns indexable marketing/docs routes (no auth-only paths).
func PublicSEOPages() []SEOPage {
	return []SEOPage{
		{
			Path:        "/",
			Title:       "",
			Description: DefaultSEODescription,
			Priority:    "1.0",
			Changefreq:  "daily",
			Heading:     "BoxAI — Unified AI API Gateway",
			Body:        "BoxAI (you-box.com) is a unified AI API gateway for OpenAI, Claude, Gemini and more. Manage keys, usage, billing, and model access through one endpoint at https://you-box.com.",
		},
		{
			Path:        "/pricing",
			Title:       "Model Pricing",
			Description: "BoxAI model pricing on you-box.com — compare token prices, capabilities, and billing modes across providers on the unified AI API gateway.",
			Priority:    "0.9",
			Changefreq:  "daily",
			Heading:     "BoxAI Model Pricing",
			Body:        "Browse BoxAI (you-box.com) model prices, group rates, and capabilities before you integrate with the unified API gateway.",
		},
		{
			Path:        "/docs/what-is-boxai",
			Title:       "What is BoxAI",
			Description: "What is BoxAI? BoxAI (you-box.com) is a unified AI API gateway for multi-provider models, billing, and developer access.",
			Priority:    "0.85",
			Changefreq:  "monthly",
			Heading:     "What is BoxAI?",
			Body:        "BoxAI (https://you-box.com) is the official unified AI API gateway. One API for OpenAI-compatible, Claude, Gemini and other providers, with keys, usage, and billing in one place.",
		},
		{
			Path:        "/docs/getting-started",
			Title:       "Getting Started",
			Description: "Get started with BoxAI on you-box.com — create an API key, pick a model, and send your first OpenAI-compatible request.",
			Priority:    "0.8",
			Changefreq:  "weekly",
			Heading:     "Getting Started with BoxAI",
			Body:        "On BoxAI (https://you-box.com), create an API key, choose an available model ID, and call the OpenAI-compatible chat completions endpoint.",
		},
		{
			Path:        "/docs/streaming",
			Title:       "Streaming",
			Description: "Stream BoxAI model responses with server-sent events and cancel interrupted generations safely.",
			Priority:    "0.7",
			Changefreq:  "weekly",
			Heading:     "Streaming",
			Body:        "Enable streaming in your BoxAI request payload and consume SSE frames until the stream completes or is aborted.",
		},
		{
			Path:        "/docs/errors",
			Title:       "Errors, Retries, and Rate Limits",
			Description: "Classify BoxAI gateway errors, retry transient failures safely, and respect rate limits on you-box.com.",
			Priority:    "0.7",
			Changefreq:  "weekly",
			Heading:     "Errors, Retries, and Rate Limits",
			Body:        "Fix validation and auth errors, back off on 429 responses, and retry only safe transient failures on the BoxAI gateway.",
		},
		{
			Path:        "/rankings",
			Title:       "Rankings",
			Description: "BoxAI public model and usage rankings on you-box.com.",
			Priority:    "0.6",
			Changefreq:  "daily",
			Heading:     "BoxAI Rankings",
			Body:        "View public model and usage rankings for the BoxAI unified AI API gateway at you-box.com.",
		},
		{
			Path:        "/about",
			Title:       "About BoxAI",
			Description: "About BoxAI (you-box.com) — the unified AI API gateway for multi-model access, billing, and admin.",
			Priority:    "0.5",
			Changefreq:  "monthly",
			Heading:     "About BoxAI",
			Body:        "BoxAI at https://you-box.com is a unified gateway for multi-provider AI APIs with billing, access control, and an admin dashboard.",
		},
		{
			Path:        "/privacy-policy",
			Title:       "Privacy Policy",
			Description: "Privacy policy for BoxAI (you-box.com) — how we collect, use, and protect personal data.",
			Priority:    "0.3",
			Changefreq:  "yearly",
			Heading:     "Privacy Policy",
			Body:        "This page describes privacy practices for the BoxAI AI API gateway service at you-box.com.",
		},
		{
			Path:        "/user-agreement",
			Title:       "User Agreement",
			Description: "User agreement for BoxAI (you-box.com), including acceptable use and account responsibilities.",
			Priority:    "0.3",
			Changefreq:  "yearly",
			Heading:     "User Agreement",
			Body:        "This page describes the terms that govern use of the BoxAI AI API gateway at you-box.com.",
		},
	}
}

// NormalizePublicPath strips query/hash, collapses duplicate slashes, and trims a
// trailing slash (except for "/").
func NormalizePublicPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "/"
	}
	if i := strings.IndexAny(raw, "?#"); i >= 0 {
		raw = raw[:i]
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	parts := strings.Split(raw, "/")
	clean := make([]string, 0, len(parts))
	for _, p := range parts {
		if p == "" || p == "." {
			continue
		}
		if p == ".." {
			if len(clean) > 0 {
				clean = clean[:len(clean)-1]
			}
			continue
		}
		clean = append(clean, p)
	}
	if len(clean) == 0 {
		return "/"
	}
	return "/" + strings.Join(clean, "/")
}

// LookupSEOPage returns metadata for a known public path.
func LookupSEOPage(path string) (SEOPage, bool) {
	path = NormalizePublicPath(path)
	for _, page := range PublicSEOPages() {
		if page.Path == path {
			return page, true
		}
	}
	// Docs detail pages beyond the static list stay indexable with generic copy.
	if strings.HasPrefix(path, "/docs/") && path != "/docs" {
		slug := strings.TrimPrefix(path, "/docs/")
		if slug != "" && !strings.Contains(slug, "/") {
			title := humanizeSlug(slug)
			return SEOPage{
				Path:        path,
				Title:       title,
				Description: title + " — API documentation for the unified AI gateway.",
				Priority:    "0.6",
				Changefreq:  "weekly",
				Heading:     title,
				Body:        "API documentation for integrating with the unified AI gateway.",
			}, true
		}
	}
	// Public model detail pages: /pricing/{modelId}
	if strings.HasPrefix(path, "/pricing/") {
		modelID := strings.TrimPrefix(path, "/pricing/")
		if modelID != "" && !strings.Contains(modelID, "/") {
			title := modelID + " Pricing"
			return SEOPage{
				Path:        path,
				Title:       title,
				Description: "Pricing and capabilities for model " + modelID + " on the unified AI API gateway.",
				Priority:    "0.6",
				Changefreq:  "daily",
				Heading:     title,
				Body:        "View token pricing, billing mode, and integration details for " + modelID + ".",
			}, true
		}
	}
	return SEOPage{}, false
}

// IsPrivateSEOPath reports paths that must not be indexed.
func IsPrivateSEOPath(path string) bool {
	path = NormalizePublicPath(path)
	prefixes := []string{
		"/console",
		"/api",
		"/v1",
		"/oauth",
		"/setup",
		"/sign-in",
		"/sign-up",
		"/register",
		"/forgot-password",
		"/otp",
		"/share",
		"/playground",
		"/inspiration",
		"/agents",
		"/connect",
		"/_authenticated",
		"/dashboard",
		"/mj",
		"/pg",
		"/static",
		"/assets",
	}
	for _, p := range prefixes {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	// Auth layout error helpers
	switch path {
	case "/401", "/404", "/500", "/503":
		return true
	}
	return false
}

// SiteBaseURL returns a normalized absolute origin from ServerAddress-like input.
// Falls back to empty string when unset/invalid (callers should use request host).
func SiteBaseURL(serverAddress string) string {
	addr := strings.TrimSpace(serverAddress)
	if addr == "" {
		return ""
	}
	if !strings.Contains(addr, "://") {
		addr = "https://" + addr
	}
	u, err := url.Parse(addr)
	if err != nil || u.Host == "" {
		return ""
	}
	u.Path = ""
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/")
}

// AbsoluteURL joins base + path.
func AbsoluteURL(base, path string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	path = NormalizePublicPath(path)
	if base == "" {
		return path
	}
	if path == "/" {
		return base + "/"
	}
	return base + path
}

// FormatSEOTitle builds "Page | Site" or just Site when page title is empty/equal.
func FormatSEOTitle(pageTitle, siteName string) string {
	siteName = strings.TrimSpace(siteName)
	pageTitle = strings.TrimSpace(pageTitle)
	if siteName == "" {
		siteName = DefaultBrandName
	}
	if pageTitle == "" || strings.EqualFold(pageTitle, siteName) {
		return siteName
	}
	return pageTitle + " | " + siteName
}

// FormatSEODocumentTitle chooses homepage vs inner-page title rules.
// Homepage: "BoxAI · Unified AI API Gateway | you-box.com" when baseURL is set.
func FormatSEODocumentTitle(path, pageTitle, siteName, baseURL string) string {
	siteName = strings.TrimSpace(siteName)
	if siteName == "" {
		siteName = DefaultBrandName
	}
	path = NormalizePublicPath(path)
	pageTitle = strings.TrimSpace(pageTitle)
	if path == "/" && (pageTitle == "" || strings.EqualFold(pageTitle, siteName)) {
		host := hostFromBaseURL(baseURL)
		title := siteName + " · " + HomeSEOTitleLead
		if host != "" {
			return title + " | " + host
		}
		return title
	}
	return FormatSEOTitle(pageTitle, siteName)
}

func hostFromBaseURL(baseURL string) string {
	base := SiteBaseURL(baseURL)
	if base == "" {
		return ""
	}
	u, err := url.Parse(base)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(u.Host)
}

// BuildRobotsTxt returns robots.txt body for the public site.
func BuildRobotsTxt(sitemapURL string) string {
	var b strings.Builder
	b.WriteString("# https://www.robotstxt.org/robotstxt.html\n")
	b.WriteString("User-agent: *\n")
	b.WriteString("Allow: /\n")
	b.WriteString("\n")
	disallow := []string{
		"/console",
		"/api/",
		"/v1/",
		"/oauth/",
		"/setup",
		"/sign-in",
		"/sign-up",
		"/register",
		"/forgot-password",
		"/otp",
		"/share/",
		"/playground",
		"/inspiration",
		"/agents",
		"/connect",
		"/dashboard",
		"/mj/",
		"/pg/",
	}
	for _, d := range disallow {
		b.WriteString("Disallow: ")
		b.WriteString(d)
		b.WriteString("\n")
	}
	if sitemapURL != "" {
		b.WriteString("\nSitemap: ")
		b.WriteString(sitemapURL)
		b.WriteString("\n")
	}
	return b.String()
}

// BuildSitemapXML builds a urlset sitemap for public pages.
func BuildSitemapXML(base string, extra []SEOPage) string {
	pages := PublicSEOPages()
	if len(extra) > 0 {
		seen := make(map[string]struct{}, len(pages)+len(extra))
		for _, p := range pages {
			seen[p.Path] = struct{}{}
		}
		for _, p := range extra {
			p.Path = NormalizePublicPath(p.Path)
			if p.Path == "" || p.Path == "/" {
				continue
			}
			if _, ok := seen[p.Path]; ok {
				continue
			}
			if IsPrivateSEOPath(p.Path) {
				continue
			}
			seen[p.Path] = struct{}{}
			if p.Priority == "" {
				p.Priority = "0.5"
			}
			if p.Changefreq == "" {
				p.Changefreq = "weekly"
			}
			pages = append(pages, p)
		}
	}

	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteByte('\n')
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	b.WriteByte('\n')
	for _, page := range pages {
		loc := AbsoluteURL(base, page.Path)
		b.WriteString("  <url>\n")
		b.WriteString("    <loc>")
		b.WriteString(xmlEscape(loc))
		b.WriteString("</loc>\n")
		if page.Changefreq != "" {
			b.WriteString("    <changefreq>")
			b.WriteString(xmlEscape(page.Changefreq))
			b.WriteString("</changefreq>\n")
		}
		if page.Priority != "" {
			b.WriteString("    <priority>")
			b.WriteString(xmlEscape(page.Priority))
			b.WriteString("</priority>\n")
		}
		b.WriteString("  </url>\n")
	}
	b.WriteString("</urlset>\n")
	return b.String()
}

// InjectSEOIntoHTML rewrites the SPA index HTML with page-specific meta tags and
// crawler-visible prerender content. Safe to call with empty/partial HTML.
func InjectSEOIntoHTML(indexHTML []byte, page SEOPage, siteName, baseURL, imageURL string, noindex bool) []byte {
	if len(indexHTML) == 0 {
		return indexHTML
	}
	htmlStr := string(indexHTML)
	title := FormatSEODocumentTitle(page.Path, page.Title, siteName, baseURL)
	desc := strings.TrimSpace(page.Description)
	if desc == "" {
		desc = DefaultSEODescription
	}
	canonical := AbsoluteURL(baseURL, page.Path)
	if canonical == "" {
		canonical = page.Path
		if canonical == "" {
			canonical = "/"
		}
	}
	if imageURL == "" {
		imageURL = AbsoluteURL(baseURL, "/logo.png")
	} else if strings.HasPrefix(imageURL, "/") {
		imageURL = AbsoluteURL(baseURL, imageURL)
	}

	robots := "index,follow"
	if noindex || IsPrivateSEOPath(page.Path) {
		robots = "noindex,nofollow"
	}

	// lang: keep existing if present; prefer zh-CN when site is commonly Chinese deployments
	htmlStr = replaceOnce(htmlStr, `<html lang="en">`, `<html lang="zh-CN">`)

	htmlStr = replaceMetaContent(htmlStr, "name", "title", title)
	htmlStr = replaceMetaContent(htmlStr, "name", "description", desc)
	htmlStr = upsertMeta(htmlStr, "name", "robots", robots)
	htmlStr = replaceTitleTag(htmlStr, title)
	htmlStr = upsertLink(htmlStr, "canonical", canonical)

	htmlStr = upsertMeta(htmlStr, "property", "og:type", "website")
	htmlStr = upsertMeta(htmlStr, "property", "og:site_name", siteNameOrDefault(siteName))
	htmlStr = upsertMeta(htmlStr, "property", "og:url", canonical)
	htmlStr = upsertMeta(htmlStr, "property", "og:title", title)
	htmlStr = upsertMeta(htmlStr, "property", "og:description", desc)
	if imageURL != "" {
		htmlStr = upsertMeta(htmlStr, "property", "og:image", imageURL)
	}
	htmlStr = upsertMeta(htmlStr, "property", "og:locale", "zh_CN")

	htmlStr = upsertMeta(htmlStr, "name", "twitter:card", "summary_large_image")
	htmlStr = upsertMeta(htmlStr, "name", "twitter:title", title)
	htmlStr = upsertMeta(htmlStr, "name", "twitter:description", desc)
	if imageURL != "" {
		htmlStr = upsertMeta(htmlStr, "name", "twitter:image", imageURL)
	}

	jsonLD := buildWebSiteJSONLD(siteNameOrDefault(siteName), baseURL, imageURL, desc)
	htmlStr = upsertJSONLD(htmlStr, jsonLD)

	if !noindex && !IsPrivateSEOPath(page.Path) {
		prerender := buildPrerenderHTML(page, title, desc, baseURL)
		htmlStr = injectBeforeRoot(htmlStr, prerender)
	}

	return []byte(htmlStr)
}

func siteNameOrDefault(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return DefaultBrandName
	}
	return name
}

func humanizeSlug(slug string) string {
	slug = strings.ReplaceAll(slug, "-", " ")
	slug = strings.ReplaceAll(slug, "_", " ")
	parts := strings.Fields(slug)
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}

func xmlEscape(s string) string {
	return html.EscapeString(s)
}

func replaceOnce(s, old, new string) string {
	return strings.Replace(s, old, new, 1)
}

func replaceTitleTag(s, title string) string {
	escaped := html.EscapeString(title)
	if start := strings.Index(s, "<title>"); start >= 0 {
		end := strings.Index(s[start:], "</title>")
		if end >= 0 {
			end = start + end
			return s[:start] + "<title>" + escaped + "</title>" + s[end+len("</title>"):]
		}
	}
	// insert before </head>
	return upsertBeforeHeadClose(s, "<title>"+escaped+"</title>\n")
}

func replaceMetaContent(s, attrKey, attrVal, content string) string {
	// Try existing tag first
	needle := fmt.Sprintf(`%s="%s"`, attrKey, attrVal)
	idx := strings.Index(s, needle)
	if idx < 0 {
		needle = fmt.Sprintf(`%s='%s'`, attrKey, attrVal)
		idx = strings.Index(s, needle)
	}
	if idx < 0 {
		return upsertMeta(s, attrKey, attrVal, content)
	}
	// Find the opening <meta ...> containing this attribute
	start := strings.LastIndex(s[:idx], "<meta")
	if start < 0 {
		return upsertMeta(s, attrKey, attrVal, content)
	}
	end := strings.Index(s[start:], ">")
	if end < 0 {
		return upsertMeta(s, attrKey, attrVal, content)
	}
	end = start + end
	tag := s[start : end+1]
	// multiline meta with separate content attr is common in our index.html
	// Prefer rewriting content="..." inside the same tag; if missing, expand search
	if strings.Contains(tag, "content=") {
		newTag := replaceContentAttr(tag, content)
		return s[:start] + newTag + s[end+1:]
	}
	// Multi-line: <meta \n name="description" \n content="..." \n />
	// Extend to next ">" after content if needed — already have full tag to >
	// description block may be:
	// <meta\n      name="description"\n      content="..."\n    />
	close := end
	// look ahead a bit for content= if tag was self-opening without content
	windowEnd := close + 1
	if windowEnd < len(s) {
		// already closed
	}
	_ = windowEnd
	newTag := strings.TrimSuffix(strings.TrimSpace(tag), "/>")
	newTag = strings.TrimSuffix(newTag, ">")
	newTag = strings.TrimSpace(newTag) + ` content="` + html.EscapeString(content) + `" />`
	return s[:start] + newTag + s[end+1:]
}

func replaceContentAttr(tag, content string) string {
	escaped := html.EscapeString(content)
	for _, q := range []string{`"`, `'`} {
		prefix := "content=" + q
		i := strings.Index(tag, prefix)
		if i < 0 {
			continue
		}
		j := i + len(prefix)
		k := strings.Index(tag[j:], q)
		if k < 0 {
			continue
		}
		return tag[:i] + prefix + escaped + q + tag[j+k+1:]
	}
	// append content
	trim := strings.TrimSpace(tag)
	if strings.HasSuffix(trim, "/>") {
		return strings.TrimSuffix(trim, "/>") + ` content="` + escaped + `" />`
	}
	if strings.HasSuffix(trim, ">") {
		return strings.TrimSuffix(trim, ">") + ` content="` + escaped + `">`
	}
	return trim + ` content="` + escaped + `"`
}

func upsertMeta(s, attrKey, attrVal, content string) string {
	escaped := html.EscapeString(content)
	tag := fmt.Sprintf(`<meta %s="%s" content="%s" />`, attrKey, attrVal, escaped)

	// Replace existing meta with same key/value
	for _, q := range []string{`"`, `'`} {
		needle := fmt.Sprintf(`%s=%s%s%s`, attrKey, q, attrVal, q)
		idx := strings.Index(s, needle)
		if idx < 0 {
			continue
		}
		start := strings.LastIndex(s[:idx], "<meta")
		if start < 0 {
			continue
		}
		endRel := strings.Index(s[start:], ">")
		if endRel < 0 {
			continue
		}
		end := start + endRel
		return s[:start] + tag + s[end+1:]
	}
	return upsertBeforeHeadClose(s, tag+"\n")
}

func upsertLink(s, rel, href string) string {
	escaped := html.EscapeString(href)
	tag := fmt.Sprintf(`<link rel="%s" href="%s" />`, rel, escaped)
	needle := fmt.Sprintf(`rel="%s"`, rel)
	idx := strings.Index(s, needle)
	if idx < 0 {
		needle = fmt.Sprintf(`rel='%s'`, rel)
		idx = strings.Index(s, needle)
	}
	if idx >= 0 {
		start := strings.LastIndex(s[:idx], "<link")
		if start >= 0 {
			endRel := strings.Index(s[start:], ">")
			if endRel >= 0 {
				end := start + endRel
				return s[:start] + tag + s[end+1:]
			}
		}
	}
	return upsertBeforeHeadClose(s, tag+"\n")
}

func upsertJSONLD(s, jsonLD string) string {
	const markerStart = `<script type="application/ld+json" id="app-jsonld">`
	const markerEnd = `</script>`
	block := markerStart + jsonLD + markerEnd
	if i := strings.Index(s, `id="app-jsonld"`); i >= 0 {
		start := strings.LastIndex(s[:i], "<script")
		if start >= 0 {
			end := strings.Index(s[i:], markerEnd)
			if end >= 0 {
				end = i + end + len(markerEnd)
				return s[:start] + block + s[end:]
			}
		}
	}
	return upsertBeforeHeadClose(s, block+"\n")
}

func upsertBeforeHeadClose(s, snippet string) string {
	const headClose = "</head>"
	i := strings.Index(strings.ToLower(s), headClose)
	if i < 0 {
		return s + snippet
	}
	// preserve original casing of </head>
	real := s[i : i+len(headClose)]
	// find actual with original case
	realIdx := strings.Index(s, "</head>")
	if realIdx < 0 {
		realIdx = strings.Index(s, "</HEAD>")
	}
	if realIdx < 0 {
		realIdx = i
		real = s[i : i+7]
	} else {
		real = s[realIdx : realIdx+7]
	}
	return s[:realIdx] + snippet + real + s[realIdx+len(real):]
}


func mapEsc(values []string, esc func(string) string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		out = append(out, esc(v))
	}
	return out
}

func buildWebSiteJSONLD(siteName, baseURL, imageURL, description string) string {
	home := AbsoluteURL(baseURL, "/")
	if home == "" {
		home = "/"
	}
	// Compact but valid JSON-LD; values HTML-escaped not needed inside script if we escape manually for </
	esc := func(v string) string {
		v = strings.ReplaceAll(v, `\`, `\\`)
		v = strings.ReplaceAll(v, `"`, `\"`)
		v = strings.ReplaceAll(v, "<", `\u003c`)
		return v
	}
	logo := imageURL
	if logo == "" {
		logo = AbsoluteURL(baseURL, "/logo.png")
	}
	host := hostFromBaseURL(baseURL)
	alts := []string{"Box AI", "boxai", "you-box"}
	if host != "" && host != "you-box.com" {
		alts = append(alts, host)
	}
	altJSON := `["` + strings.Join(mapEsc(alts, esc), `","`) + `"]`
	return fmt.Sprintf(
		`{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"%s","alternateName":%s,"url":"%s","logo":"%s"},{"@type":"WebSite","name":"%s","alternateName":%s,"url":"%s","description":"%s","potentialAction":{"@type":"SearchAction","target":"%s/pricing?search={query}","query-input":"required name=query"}},{"@type":"SoftwareApplication","name":"%s","applicationCategory":"DeveloperApplication","operatingSystem":"Web","url":"%s","description":"%s"}]}`,
		esc(siteName), altJSON, esc(home), esc(logo),
		esc(siteName), altJSON, esc(home), esc(description),
		esc(strings.TrimRight(baseURL, "/")),
		esc(siteName), esc(home), esc(description),
	)
}

func buildPrerenderHTML(page SEOPage, title, desc, baseURL string) string {
	heading := strings.TrimSpace(page.Heading)
	if heading == "" {
		heading = title
	}
	body := strings.TrimSpace(page.Body)
	if body == "" {
		body = desc
	}
	// Ensure crawlers always see brand + public host together.
	host := hostFromBaseURL(baseURL)
	if host == "" {
		host = "you-box.com"
	}
	brandLine := DefaultBrandName + " (" + host + ")"
	low := strings.ToLower(body)
	if !strings.Contains(low, "boxai") || !strings.Contains(low, strings.ToLower(host)) {
		body = brandLine + " — " + body
	}
	var links strings.Builder
	for _, p := range PublicSEOPages() {
		if p.Path == page.Path {
			continue
		}
		label := p.Title
		if label == "" {
			label = "Home"
		}
		href := p.Path
		if baseURL != "" {
			// keep relative links so multi-domain deploys stay portable
			href = p.Path
		}
		links.WriteString(fmt.Sprintf(`<li><a href="%s">%s</a></li>`, html.EscapeString(href), html.EscapeString(label)))
	}
	return fmt.Sprintf(
		`<div id="seo-prerender" data-seo="1">`+
			`<main>`+
			`<h1>%s</h1>`+
			`<p>%s</p>`+
			`<nav aria-label="Site"><ul>%s</ul></nav>`+
			`</main>`+
			`</div>`,
		html.EscapeString(heading),
		html.EscapeString(body),
		links.String(),
	)
}

func injectBeforeRoot(s, snippet string) string {
	if start := strings.Index(s, `id="seo-prerender"`); start >= 0 {
		divStart := strings.LastIndex(s[:start], "<div")
		if divStart >= 0 {
			if end, ok := findMatchingDivEnd(s, divStart); ok {
				return s[:divStart] + snippet + s[end:]
			}
		}
	}
	const root = `<div id="root"`
	i := strings.Index(s, root)
	if i < 0 {
		bi := strings.LastIndex(s, "</body>")
		if bi < 0 {
			bi = strings.LastIndex(s, "</BODY>")
		}
		if bi < 0 {
			return s + snippet
		}
		return s[:bi] + snippet + s[bi:]
	}
	return s[:i] + snippet + s[i:]
}

// findMatchingDivEnd returns the index just past the closing </div> for the div
// that starts at start (start must point at '<').
func findMatchingDivEnd(s string, start int) (int, bool) {
	if start < 0 || start >= len(s) || !strings.HasPrefix(s[start:], "<div") {
		return 0, false
	}
	depth := 0
	i := start
	for i < len(s) {
		nextOpen := strings.Index(s[i:], "<div")
		nextClose := strings.Index(s[i:], "</div>")
		if nextClose < 0 {
			return 0, false
		}
		if nextOpen >= 0 && nextOpen < nextClose {
			depth++
			i += nextOpen + 4
			continue
		}
		depth--
		i += nextClose + len("</div>")
		if depth == 0 {
			return i, true
		}
	}
	return 0, false
}
