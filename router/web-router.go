package router

import (
	"bytes"
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service"
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

const googleTagManagerID = "GTM-NKH9LPX9"

var (
	googleTagManagerHeadSnippet = []byte(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','` + googleTagManagerID + `');</script>
<!-- End Google Tag Manager -->
`)
	googleTagManagerBodySnippet = []byte(`<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=` + googleTagManagerID + `"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`)
)

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(publicWWWRedirectPolicy())
	router.Use(publicSearchIndexPolicy())
	router.GET("/robots.txt", controller.GetRobotsTxt)
	router.GET("/llms.txt", controller.GetLLMsTxt)
	router.GET("/sitemap.xml", controller.GetSitemapXML)
	router.Use(static.Serve("/", themeFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		indexPage := assets.DefaultIndexPage
		if common.GetTheme() == "classic" {
			indexPage = assets.ClassicIndexPage
		}
		if shouldInjectGoogleTagManager(c.Request.URL.Path) {
			indexPage = injectGoogleTagManager(indexPage)
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}

func publicWWWRedirectPolicy() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.EqualFold(publicRequestHost(c), "www.flatkey.ai") {
			target := "https://flatkey.ai" + c.Request.URL.RequestURI()
			c.Redirect(http.StatusPermanentRedirect, target)
			c.Abort()
			return
		}
		c.Next()
	}
}

func publicSearchIndexPolicy() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !service.IsCanonicalPublicHost(publicRequestHost(c)) {
			c.Header("X-Robots-Tag", "noindex, nofollow")
		}
		c.Next()
	}
}

func publicRequestHost(c *gin.Context) string {
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	return host
}

func shouldInjectGoogleTagManager(path string) bool {
	if path == "" {
		path = "/"
	}
	adminPrefixes := []string{
		"/channels",
		"/redemption-codes",
		"/subscriptions",
		"/system-settings",
		"/users",
		"/console/channel",
		"/console/deployment",
		"/console/models",
		"/console/redemption",
		"/console/setting",
		"/console/subscription",
		"/console/user",
	}
	for _, prefix := range adminPrefixes {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return false
		}
	}
	return true
}

func injectGoogleTagManager(indexPage []byte) []byte {
	if bytes.Contains(indexPage, []byte(googleTagManagerID)) {
		return indexPage
	}
	indexPage = bytes.Replace(indexPage, []byte("<head>"), append([]byte("<head>\n    "), googleTagManagerHeadSnippet...), 1)
	indexPage = bytes.Replace(indexPage, []byte("<body>"), append([]byte("<body>\n    "), googleTagManagerBodySnippet...), 1)
	return indexPage
}
