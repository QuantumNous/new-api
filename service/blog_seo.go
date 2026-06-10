package service

import (
	"encoding/xml"
	"net/url"
	"strings"
)

type sitemapURL struct {
	Loc        string `xml:"loc"`
	Lastmod    string `xml:"lastmod,omitempty"`
	Changefreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func BuildBlogSitemap(baseURL string, categories []BlogCategory, posts []BlogPost) string {
	baseURL = normalizePublicBaseURL(baseURL)
	urls := []sitemapURL{
		{Loc: joinPublicURL(baseURL, "/"), Changefreq: "daily", Priority: "1.0"},
		{Loc: joinPublicURL(baseURL, "/pricing"), Changefreq: "daily", Priority: "0.8"},
		{Loc: joinPublicURL(baseURL, "/rankings"), Changefreq: "daily", Priority: "0.7"},
		{Loc: joinPublicURL(baseURL, "/about"), Changefreq: "monthly", Priority: "0.5"},
		{Loc: joinPublicURL(baseURL, "/blog"), Changefreq: "daily", Priority: "0.9"},
	}

	for _, category := range categories {
		if strings.TrimSpace(category.Slug) == "" {
			continue
		}
		urls = append(urls, sitemapURL{
			Loc:        joinPublicURL(baseURL, "/blog/category/"+category.Slug),
			Changefreq: "weekly",
			Priority:   "0.7",
		})
	}

	for _, post := range posts {
		if strings.TrimSpace(post.Slug) == "" {
			continue
		}
		urls = append(urls, sitemapURL{
			Loc:        joinPublicURL(baseURL, "/blog/"+post.Slug),
			Lastmod:    sitemapDate(post.Date),
			Changefreq: "monthly",
			Priority:   "0.8",
		})
	}

	payload, err := xml.MarshalIndent(sitemapURLSet{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}, "", "  ")
	if err != nil {
		return ""
	}
	return xml.Header + string(payload) + "\n"
}

func BuildRobotsTxt(baseURL string) string {
	baseURL = normalizePublicBaseURL(baseURL)
	return strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"",
		"Sitemap: " + joinPublicURL(baseURL, "/sitemap.xml"),
		"LLMs: " + joinPublicURL(baseURL, "/llms.txt"),
		"",
	}, "\n")
}

func BuildLLMsTxt(baseURL string, categories []BlogCategory, posts []BlogPost) string {
	baseURL = normalizePublicBaseURL(baseURL)
	var builder strings.Builder
	builder.WriteString("# Flatkey AI\n\n")
	builder.WriteString("Flatkey AI is a unified AI API gateway, model routing, billing, and operations platform.\n\n")
	builder.WriteString("## Core Pages\n\n")
	builder.WriteString("- Home: " + joinPublicURL(baseURL, "/") + "\n")
	builder.WriteString("- Model pricing: " + joinPublicURL(baseURL, "/pricing") + "\n")
	builder.WriteString("- Rankings: " + joinPublicURL(baseURL, "/rankings") + "\n")
	builder.WriteString("- Blog: " + joinPublicURL(baseURL, "/blog") + "\n")
	builder.WriteString("- Sitemap: " + joinPublicURL(baseURL, "/sitemap.xml") + "\n")

	if len(categories) > 0 {
		builder.WriteString("\n## Blog Categories\n\n")
		for _, category := range categories {
			if strings.TrimSpace(category.Slug) == "" || strings.TrimSpace(category.Name) == "" {
				continue
			}
			builder.WriteString("- " + category.Name + ": " + joinPublicURL(baseURL, "/blog/category/"+category.Slug) + "\n")
		}
	}

	if len(posts) > 0 {
		builder.WriteString("\n## Blog Articles\n\n")
		for _, post := range posts {
			if strings.TrimSpace(post.Slug) == "" || strings.TrimSpace(post.Title) == "" {
				continue
			}
			builder.WriteString("- " + post.Title + ": " + joinPublicURL(baseURL, "/blog/"+post.Slug))
			if summary := strings.TrimSpace(post.Summary); summary != "" {
				builder.WriteString(" - " + summary)
			}
			builder.WriteString("\n")
		}
	}

	return builder.String()
}

func normalizePublicBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return "https://flatkey.ai"
	}
	return strings.TrimRight(baseURL, "/")
}

func joinPublicURL(baseURL string, path string) string {
	parsed, err := url.Parse(normalizePublicBaseURL(baseURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return normalizePublicBaseURL(baseURL) + path
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func sitemapDate(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= len("2006-01-02") {
		return value[:len("2006-01-02")]
	}
	return ""
}
