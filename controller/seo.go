package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func seoSiteBase(c *gin.Context) string {
	// Prefer configured absolute site URL only. Do not trust Request.Host —
	// without SEOSiteURL/ServerAddress, omit absolute links rather than
	// emitting attacker-controlled Host into robots/sitemap.
	site := strings.TrimRight(strings.TrimSpace(common.SEOSiteURL), "/")
	if site == "" {
		site = strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	}
	return site
}

// RobotsTxt serves GET /robots.txt for crawlers (no SPA).
func RobotsTxt(c *gin.Context) {
	var b strings.Builder
	b.WriteString("User-agent: *\n")
	if common.SEORobotsIndex {
		b.WriteString("Allow: /\n")
		b.WriteString("Disallow: /console\n")
		b.WriteString("Disallow: /dashboard\n")
		b.WriteString("Disallow: /api/\n")
		if site := seoSiteBase(c); site != "" {
			b.WriteString("Sitemap: ")
			b.WriteString(site)
			b.WriteString("/sitemap.xml\n")
		}
	} else {
		b.WriteString("Disallow: /\n")
	}
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(b.String()))
}

// SitemapXML serves GET /sitemap.xml with core public URLs.
func SitemapXML(c *gin.Context) {
	site := seoSiteBase(c)
	if site == "" {
		// No configured public base URL: emit relative-path locs only when needed,
		// but sitemap requires absolute URLs — return empty set rather than fake host.
		c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(
			`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
		))
		return
	}
	paths := []string{"/", "/pricing", "/about", "/rankings"}
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	for _, p := range paths {
		b.WriteString("<url><loc>")
		b.WriteString(site)
		b.WriteString(p)
		b.WriteString("</loc></url>")
	}
	b.WriteString(`</urlset>`)
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
}
