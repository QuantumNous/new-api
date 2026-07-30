package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// ThemeAssets holds the embedded frontend assets for both themes.
type ThemeAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", themeFS))
	router.NoRoute(webFallbackHandler(assets))
}

func webFallbackHandler(assets ThemeAssets) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		requestPath := c.Request.URL.Path
		if strings.HasPrefix(requestPath, "/v1") || strings.HasPrefix(requestPath, "/api") || strings.HasPrefix(requestPath, "/assets") || requestPath == "/static" || strings.HasPrefix(requestPath, "/static/") {
			c.Header("Cache-Control", "no-store")
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		indexHTML := assets.DefaultIndexPage
		if common.GetTheme() == "classic" {
			indexHTML = assets.ClassicIndexPage
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", injectIndexSEO(c, requestPath, indexHTML))
	}
}

// injectIndexSEO rewrites the SPA shell with path-specific meta tags and a
// crawler-visible prerender block for public pages. Private routes get noindex.
func injectIndexSEO(c *gin.Context, requestPath string, indexHTML []byte) []byte {
	path := common.NormalizePublicPath(requestPath)
	siteName := strings.TrimSpace(common.SystemName)
	if siteName == "" {
		siteName = "New API"
	}
	base := common.SiteBaseURL(system_setting.ServerAddress)
	if base == "" && c != nil && c.Request != nil {
		scheme := "https"
		if c.Request.TLS == nil {
			if proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); proto != "" {
				scheme = strings.ToLower(strings.Split(proto, ",")[0])
			} else {
				scheme = "http"
			}
		}
		if host := strings.TrimSpace(c.Request.Host); host != "" {
			base = scheme + "://" + host
		}
	}
	imageURL := strings.TrimSpace(common.Logo)
	if imageURL == "" {
		imageURL = "/logo.png"
	}

	if page, ok := common.LookupSEOPage(path); ok {
		return common.InjectSEOIntoHTML(indexHTML, page, siteName, base, imageURL, false)
	}
	// Unknown client routes still get a sensible default shell; mark private paths noindex.
	page := common.SEOPage{
		Path:        path,
		Title:       siteName,
		Description: common.DefaultSEODescription,
	}
	noindex := common.IsPrivateSEOPath(path)
	return common.InjectSEOIntoHTML(indexHTML, page, siteName, base, imageURL, noindex)
}
