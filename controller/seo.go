package controller

import (
	"fmt"
	"html"
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
	common.OptionMapRWMutex.RLock()
	siteURL := common.SEOSiteURL
	serverAddr := system_setting.ServerAddress
	common.OptionMapRWMutex.RUnlock()

	site := strings.TrimRight(strings.TrimSpace(siteURL), "/")
	if site == "" {
		site = strings.TrimRight(strings.TrimSpace(serverAddr), "/")
	}
	return site
}

// RobotsTxt serves GET /robots.txt for crawlers (no SPA).
func RobotsTxt(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	robotsIndex := common.SEORobotsIndex
	common.OptionMapRWMutex.RUnlock()

	var b strings.Builder
	b.WriteString("User-agent: *\n")
	if robotsIndex {
		b.WriteString("Allow: /\n")
		b.WriteString("Disallow: /console\n")
		b.WriteString("Disallow: /dashboard\n")
		b.WriteString("Disallow: /api/\n")
		b.WriteString("Disallow: /token\n")
		b.WriteString("Disallow: /topup\n")
		b.WriteString("Disallow: /log\n")
		b.WriteString("Disallow: /setting\n")
		b.WriteString("Disallow: /channel\n")
		b.WriteString("Disallow: /user\n")
		b.WriteString("\n")
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

type sitemapEntry struct {
	path       string
	changefreq string
	priority   string
}

// SitemapXML serves GET /sitemap.xml with core public URLs.
func SitemapXML(c *gin.Context) {
	site := seoSiteBase(c)
	if site == "" {
		c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(
			`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
		))
		return
	}

	entries := []sitemapEntry{
		{"/", "daily", "1.0"},
		{"/pricing", "weekly", "0.8"},
		{"/about", "monthly", "0.6"},
		{"/rankings", "daily", "0.7"},
		{"/login", "monthly", "0.3"},
		{"/register", "monthly", "0.3"},
	}

	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	escapedSite := html.EscapeString(site)
	for _, e := range entries {
		b.WriteString("<url>")
		b.WriteString(fmt.Sprintf("<loc>%s%s</loc>", escapedSite, e.path))
		b.WriteString(fmt.Sprintf("<changefreq>%s</changefreq>", e.changefreq))
		b.WriteString(fmt.Sprintf("<priority>%s</priority>", e.priority))
		b.WriteString("</url>")
	}
	b.WriteString(`</urlset>`)
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
}
