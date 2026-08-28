package router

import (
	"bytes"
	"embed"
	"net"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS                          embed.FS
	IndexPage                        []byte
	CloudflareWebAnalyticsToken      string
	CloudflareWebAnalyticsHostTokens map[string]string
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	// Pre-render the index page for every token that can be served so the SPA
	// fallback only does a host lookup per request instead of rebuilding and
	// copying the whole page each time. The empty-token entry is the no-beacon
	// page served when a host is unconfigured or analytics is disabled.
	indexPage := assets.IndexPage
	defaultToken := assets.CloudflareWebAnalyticsToken
	hostTokens := assets.CloudflareWebAnalyticsHostTokens
	injectedPages := map[string][]byte{"": injectCloudflareWebAnalytics(indexPage, "")}
	if defaultToken != "" {
		injectedPages[defaultToken] = injectCloudflareWebAnalytics(indexPage, defaultToken)
	}
	for _, token := range hostTokens {
		if _, ok := injectedPages[token]; !ok {
			injectedPages[token] = injectCloudflareWebAnalytics(indexPage, token)
		}
	}

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		token := cloudflareWebAnalyticsTokenForHost(c.Request.Host, defaultToken, hostTokens)
		page, ok := injectedPages[token]
		if !ok {
			page = injectCloudflareWebAnalytics(indexPage, token)
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", page)
	})
}

// ParseCloudflareWebAnalyticsHostTokens parses a "host=token,host=token,..."
// config string into a normalized host->token map. Malformed entries and those
// with an empty host or token are skipped.
func ParseCloudflareWebAnalyticsHostTokens(config string) map[string]string {
	hostTokens := make(map[string]string)
	for entry := range strings.SplitSeq(config, ",") {
		host, token, ok := strings.Cut(entry, "=")
		host = normalizeCloudflareWebAnalyticsHost(host)
		token = strings.TrimSpace(token)
		if !ok || host == "" || token == "" {
			continue
		}
		hostTokens[host] = token
	}
	return hostTokens
}

// normalizeCloudflareWebAnalyticsHost lowercases a host and trims surrounding
// whitespace and a trailing root dot so configured hosts and request hosts
// compare consistently. Both the config parser and the request matcher rely on
// this single rule.
func normalizeCloudflareWebAnalyticsHost(host string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
}

func cloudflareWebAnalyticsTokenForHost(requestHost string, defaultToken string, hostTokens map[string]string) string {
	if len(hostTokens) == 0 {
		return defaultToken
	}

	host := requestHost
	if parsedHost, _, err := net.SplitHostPort(requestHost); err == nil {
		host = parsedHost
	}
	host = normalizeCloudflareWebAnalyticsHost(host)

	matchedHostLength := -1
	matchedToken := ""
	for configuredHost, token := range hostTokens {
		if host != configuredHost && !strings.HasSuffix(host, "."+configuredHost) {
			continue
		}
		if len(configuredHost) > matchedHostLength {
			matchedHostLength = len(configuredHost)
			matchedToken = token
		}
	}
	return matchedToken
}

func injectCloudflareWebAnalytics(indexPage []byte, token string) []byte {
	analyticsInjectBuilder := &strings.Builder{}
	if token != "" {
		analyticsInjectBuilder.WriteString("<!-- Cloudflare Web Analytics -->\n")
		analyticsInjectBuilder.WriteString("<script type=\"module\" src=\"https://static.cloudflareinsights.com/beacon.min.js\" data-cf-beacon='{\"token\":\"")
		analyticsInjectBuilder.WriteString(token)
		analyticsInjectBuilder.WriteString("\"}'></script>\n")
		analyticsInjectBuilder.WriteString("<!-- End Cloudflare Web Analytics -->\n")
	}
	analyticsInjectBuilder.WriteString("<!--Cloudflare Web Analytics QuantumNous-->\n")
	return bytes.ReplaceAll(
		indexPage,
		[]byte("<!--Cloudflare Web Analytics-->\n"),
		[]byte(analyticsInjectBuilder.String()),
	)
}
