package router

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard and landing frontend assets.
type WebAssets struct {
	BuildFS             fs.FS
	IndexPage           []byte
	LandingBuildFS      fs.FS
	LandingIndexPage    []byte
	LandingNotFoundPage []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, ".")
	landingFS := common.EmbedFolder(assets.LandingBuildFS, ".")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Match([]string{http.MethodGet, http.MethodHead}, "/", func(c *gin.Context) {
		serveLandingIndex(c, assets.LandingIndexPage)
	})
	router.Match([]string{http.MethodGet, http.MethodHead}, "/docs", func(c *gin.Context) {
		serveLandingPage(c, assets.LandingBuildFS, "docs/index.html", assets.LandingNotFoundPage)
	})
	router.Match([]string{http.MethodGet, http.MethodHead}, "/docs/*page", func(c *gin.Context) {
		page := strings.TrimPrefix(c.Param("page"), "/")
		if page == "" {
			serveLandingPage(c, assets.LandingBuildFS, "docs/index.html", assets.LandingNotFoundPage)
			return
		}
		serveLandingPage(c, assets.LandingBuildFS, path.Join("docs", page, "index.html"), assets.LandingNotFoundPage)
	})
	router.Use(static.Serve("/", landingFS))
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		requestPath := c.Request.URL.Path
		if hasPathPrefix(requestPath, "/v1") || hasPathPrefix(requestPath, "/v1beta") || hasPathPrefix(requestPath, "/api") || hasPathPrefix(requestPath, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		if isDashboardRoute(requestPath) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
			return
		}
		c.Data(http.StatusNotFound, "text/html; charset=utf-8", assets.LandingNotFoundPage)
	})
}

func hasPathPrefix(requestPath string, prefix string) bool {
	return requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/")
}

var dashboardExactRoutes = map[string]struct{}{
	"/privacy-policy":             {},
	"/user-agreement":             {},
	"/forgot-password":            {},
	"/oauth":                      {},
	"/otp":                        {},
	"/register":                   {},
	"/reset":                      {},
	"/sign-in":                    {},
	"/sign-up":                    {},
	"/401":                        {},
	"/403":                        {},
	"/404":                        {},
	"/500":                        {},
	"/503":                        {},
	"/chat2link":                  {},
	"/about":                      {},
	"/pricing":                    {},
	"/rankings":                   {},
	"/setup":                      {},
	"/user/reset":                 {},
	"/channels":                   {},
	"/dashboard":                  {},
	"/keys":                       {},
	"/models":                     {},
	"/playground":                 {},
	"/profile":                    {},
	"/redemption-codes":           {},
	"/subscriptions":              {},
	"/system-info":                {},
	"/system-settings":            {},
	"/system-settings/auth":       {},
	"/system-settings/billing":    {},
	"/system-settings/content":    {},
	"/system-settings/models":     {},
	"/system-settings/operations": {},
	"/system-settings/security":   {},
	"/system-settings/site":       {},
	"/usage-logs":                 {},
	"/users":                      {},
	"/wallet":                     {},
	"/login":                      {},
	"/forbidden":                  {},
	"/console":                    {},
}

var dashboardParameterizedRoutePrefixes = []string{
	"/oauth",
	"/pricing",
	"/chat",
	"/dashboard",
	"/errors",
	"/models",
	"/usage-logs",
	"/system-settings/auth",
	"/system-settings/billing",
	"/system-settings/content",
	"/system-settings/models",
	"/system-settings/operations",
	"/system-settings/security",
	"/system-settings/site",
}

func isDashboardRoute(requestPath string) bool {
	cleanPath := strings.TrimSuffix(requestPath, "/")
	if _, ok := dashboardExactRoutes[cleanPath]; ok {
		return true
	}
	if hasPathPrefix(cleanPath, "/console") {
		return true
	}

	for _, prefix := range dashboardParameterizedRoutePrefixes {
		if !hasPathPrefix(cleanPath, prefix) || cleanPath == prefix {
			continue
		}
		remainder := strings.TrimPrefix(cleanPath, prefix+"/")
		if !strings.Contains(remainder, "/") {
			return true
		}
	}

	return false
}

func serveLandingIndex(c *gin.Context, content []byte) {
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", content)
}

func serveLandingPage(c *gin.Context, landingFS fs.FS, page string, fallback []byte) {
	content, err := fs.ReadFile(landingFS, page)
	c.Header("Cache-Control", "no-cache")
	if err != nil {
		c.Data(http.StatusNotFound, "text/html; charset=utf-8", fallback)
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", content)
}
