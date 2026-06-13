package service

import (
	"encoding/xml"
	"net"
	"net/url"
	"strings"
)

const canonicalPublicBaseURL = "https://flatkey.ai"

type sitemapURL struct {
	Loc        string             `xml:"loc"`
	Lastmod    string             `xml:"lastmod,omitempty"`
	Changefreq string             `xml:"changefreq,omitempty"`
	Priority   string             `xml:"priority,omitempty"`
	Alternates []sitemapAlternate `xml:"xhtml:link,omitempty"`
}

type sitemapAlternate struct {
	Rel      string `xml:"rel,attr"`
	Hreflang string `xml:"hreflang,attr"`
	Href     string `xml:"href,attr"`
}

type sitemapURLSet struct {
	XMLName    xml.Name     `xml:"urlset"`
	Xmlns      string       `xml:"xmlns,attr"`
	XmlnsXHTML string       `xml:"xmlns:xhtml,attr"`
	URLs       []sitemapURL `xml:"url"`
}

func BuildBlogSitemap(baseURL string, categories []BlogCategory, posts []BlogPost) string {
	baseURL = normalizePublicBaseURL(baseURL)
	urls := make([]sitemapURL, 0)
	urls = appendPublicSitemapURLs(urls, baseURL, "/", "", "daily", "1.0")
	urls = appendPublicSitemapURLs(urls, baseURL, "/pricing", "", "daily", "0.8")
	urls = appendPublicSitemapURLs(urls, baseURL, "/rankings", "", "daily", "0.7")
	urls = appendPublicSitemapURLs(urls, baseURL, "/about", "", "monthly", "0.5")
	urls = appendPublicSitemapURLs(urls, baseURL, "/blog", "", "daily", "0.9")

	for _, category := range categories {
		if strings.TrimSpace(category.Slug) == "" {
			continue
		}
		urls = appendPublicSitemapURLs(urls, baseURL, "/blog/category/"+category.Slug, "", "weekly", "0.7")
	}

	for _, post := range posts {
		if strings.TrimSpace(post.Slug) == "" {
			continue
		}
		urls = appendPublicSitemapURLs(urls, baseURL, "/blog/"+post.Slug, sitemapDate(post.Date), "monthly", "0.8")
	}

	payload, err := xml.MarshalIndent(sitemapURLSet{
		Xmlns:      "http://www.sitemaps.org/schemas/sitemap/0.9",
		XmlnsXHTML: "http://www.w3.org/1999/xhtml",
		URLs:       urls,
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
		"Disallow: /cdn-cgi/",
		"Disallow: /_next/",
		"",
		"Sitemap: " + joinPublicURL(baseURL, "/sitemap.xml"),
		"LLMs: " + joinPublicURL(baseURL, "/llms.txt"),
		"",
	}, "\n")
}

func BuildNonCanonicalRobotsTxt() string {
	return strings.Join([]string{
		"User-agent: *",
		"Disallow: /",
		"",
		"Sitemap: " + joinPublicURL(canonicalPublicBaseURL, "/sitemap.xml"),
		"",
	}, "\n")
}

func BuildLLMsTxt(baseURL string, categories []BlogCategory, posts []BlogPost) string {
	baseURL = normalizePublicBaseURL(baseURL)
	var builder strings.Builder
	builder.WriteString("# flatkey.ai\n\n")
	builder.WriteString("flatkey.ai is a unified AI API gateway, model routing, billing, and operations platform.\n\n")
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

var publicSitemapLocales = []string{"en", "zh", "es", "fr", "pt", "ru", "ja", "vi"}

func appendPublicSitemapURLs(urls []sitemapURL, baseURL string, path string, lastmod string, changefreq string, priority string) []sitemapURL {
	alternates := buildSitemapAlternates(baseURL, path)
	for _, locale := range publicSitemapLocales {
		urls = append(urls, sitemapURL{
			Loc:        joinPublicURL(baseURL, localizePublicSitemapPath(path, locale)),
			Lastmod:    lastmod,
			Changefreq: changefreq,
			Priority:   priority,
			Alternates: alternates,
		})
	}
	return urls
}

func buildSitemapAlternates(baseURL string, path string) []sitemapAlternate {
	alternates := make([]sitemapAlternate, 0, len(publicSitemapLocales)+1)
	for _, locale := range publicSitemapLocales {
		alternates = append(alternates, sitemapAlternate{
			Rel:      "alternate",
			Hreflang: locale,
			Href:     joinPublicURL(baseURL, localizePublicSitemapPath(path, locale)),
		})
	}
	alternates = append(alternates, sitemapAlternate{
		Rel:      "alternate",
		Hreflang: "x-default",
		Href:     joinPublicURL(baseURL, localizePublicSitemapPath(path, "en")),
	})
	return alternates
}

func localizePublicSitemapPath(path string, locale string) string {
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if locale == "en" {
		return path
	}
	if path == "/" {
		return "/" + locale
	}
	return "/" + locale + path
}

func CanonicalPublicBaseURL() string {
	return canonicalPublicBaseURL
}

func IsCanonicalPublicHost(host string) bool {
	host = strings.TrimSpace(host)
	if host == "" {
		return false
	}
	if strings.Contains(host, ",") {
		host = strings.TrimSpace(strings.Split(host, ",")[0])
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	return strings.EqualFold(host, "flatkey.ai")
}

func normalizePublicBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL != "" {
		if parsed, err := url.Parse(baseURL); err == nil && IsCanonicalPublicHost(parsed.Host) {
			return strings.TrimRight(baseURL, "/")
		}
	}
	return canonicalPublicBaseURL
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
