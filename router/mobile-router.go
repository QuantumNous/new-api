package router

import (
	"io/fs"
	"net/http"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// 手机 UA 特征。iPad 归桌面（屏幕足够跑完整控制台）。
var mobileUARegex = regexp.MustCompile(`(?i)iphone|android.+mobile|windows phone`)

// SetMobileRouter 挂载移动端 H5 静态应用 /m/*。
//
// 与画布一致，必须在 FRONTEND_BASE_URL 判断之前调用：即使部署了外置前端，
// 移动端 H5 也永远由 Go 单二进制内置伺服。
// 静态资源公开访问（登录在应用内完成），未知深链回落到 index.html（SPA 语义）。
func SetMobileRouter(router *gin.Engine, assets ThemeAssets) {
	// 手机 UA 访问站点根路径时跳转移动端。仅拦截 GET / ——
	// 深链（/console 等）不拦截，手机上仍可显式使用桌面版。
	// 注：作为全局中间件注册，先于 SetWebRouter 的 static.Serve 生效。
	router.Use(func(c *gin.Context) {
		if c.Request.Method == http.MethodGet &&
			c.Request.URL.Path == "/" &&
			mobileUARegex.MatchString(c.Request.UserAgent()) {
			c.Redirect(http.StatusFound, "/m/")
			c.Abort()
			return
		}
		c.Next()
	})

	mobileFS, err := fs.Sub(assets.MobileBuildFS, "web/mobile/dist")
	if err != nil {
		panic(err)
	}
	httpFS := http.FS(mobileFS)
	fileServer := http.StripPrefix("/m", http.FileServer(httpFS))

	handler := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		p := strings.TrimPrefix(c.Request.URL.Path, "/m")
		if p == "/manifest.webmanifest" {
			manifest, err := MobileWebManifest()
			if err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "application/manifest+json; charset=utf-8", manifest)
			return
		}
		// index 与 SPA fallback 都走内存字节并做品牌替换，
		// 避免首屏闪现构建期的默认标题/图标
		if p == "/" || p == "/index.html" || !canvasFileExists(httpFS, p) {
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", BrandIndexHTML(assets.MobileIndexPage))
			return
		}
		if strings.HasPrefix(p, "/assets/") {
			// Vite 产物文件名带内容 hash，可长缓存
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	}

	// 无斜杠的 /m 显式重定向，避免落入 SPA NoRoute fallback
	redirectRoot := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		c.Redirect(http.StatusMovedPermanently, "/m/")
	}
	router.GET("/m", redirectRoot)
	router.HEAD("/m", redirectRoot)

	mobileGroup := router.Group("/m")
	mobileGroup.GET("/*filepath", handler)
	mobileGroup.HEAD("/*filepath", handler)

	// 体验区预置音色与示例素材只打包在 classic 前端里（/audio-presets、
	// /playground-samples 为根绝对路径引用）。显式路由从 classic 产物伺服，
	// 保证移动端及 theme=default 下均可用。
	classicFS, err := fs.Sub(assets.ClassicBuildFS, "web/classic/dist")
	if err != nil {
		panic(err)
	}
	classicFileServer := http.FileServer(http.FS(classicFS))
	serveClassicAsset := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		classicFileServer.ServeHTTP(c.Writer, c.Request)
	}
	router.GET("/audio-presets/*filepath", serveClassicAsset)
	router.HEAD("/audio-presets/*filepath", serveClassicAsset)
	router.GET("/playground-samples/*filepath", serveClassicAsset)
	router.HEAD("/playground-samples/*filepath", serveClassicAsset)
}
