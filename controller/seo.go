package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// GetRobotsTxt serves /robots.txt for search engine crawlers.
func GetRobotsTxt(c *gin.Context) {
	base := seoBaseURL(c)
	sitemapURL := common.AbsoluteURL(base, "/sitemap.xml")
	body := common.BuildRobotsTxt(sitemapURL)
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(body))
}

// GetSitemapXML serves /sitemap.xml listing public indexable URLs.
func GetSitemapXML(c *gin.Context) {
	base := seoBaseURL(c)
	body := common.BuildSitemapXML(base, nil)
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(body))
}

func seoBaseURL(c *gin.Context) string {
	if base := common.SiteBaseURL(system_setting.ServerAddress); base != "" {
		return base
	}
	// Fall back to the incoming request origin so local/dev still produce absolute URLs.
	scheme := "https"
	if c.Request.TLS == nil {
		// Honor reverse-proxy headers when present.
		if proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); proto != "" {
			scheme = strings.ToLower(strings.Split(proto, ",")[0])
		} else {
			scheme = "http"
		}
	}
	host := strings.TrimSpace(c.Request.Host)
	if host == "" {
		return ""
	}
	return scheme + "://" + host
}
