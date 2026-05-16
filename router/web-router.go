package router

import (
	"bytes"
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

const defaultBlockedPageHTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Service Unavailable</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{font-family:"SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fafbfc;min-height:100vh;display:flex}
.left{flex:0 0 45%;background:linear-gradient(145deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.left::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;border:1px solid rgba(255,255,255,0.03);top:50%;left:50%;transform:translate(-50%,-50%);animation:pulse 8s ease-in-out infinite}
.left::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;border:1px solid rgba(255,255,255,0.05);top:50%;left:50%;transform:translate(-50%,-50%);animation:pulse 8s ease-in-out infinite 1s}
@keyframes pulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}50%{transform:translate(-50%,-50%) scale(1.1);opacity:0.5}}
.globe-art{position:relative;z-index:1;width:200px;height:200px}
.globe-art svg{width:100%;height:100%}
.right{flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 64px}
.badge{display:inline-flex;align-items:center;gap:6px;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;margin-bottom:32px;width:fit-content}
.badge::before{content:'';width:6px;height:6px;background:#dc2626;border-radius:50%;animation:blink 2s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
h1{font-size:36px;font-weight:700;color:#111827;margin-bottom:20px;line-height:1.3}
.main-msg{font-size:16px;line-height:1.9;color:#4b5563;margin-bottom:40px;max-width:420px}
.alt-langs{border-top:1px solid #f3f4f6;padding-top:28px;display:flex;flex-direction:column;gap:12px}
.alt-lang{font-size:13px;color:#9ca3af;line-height:1.6;padding-left:16px;border-left:2px solid #e5e7eb;transition:all .2s}
.alt-lang:hover{border-left-color:#6366f1;color:#6b7280}
@media(max-width:768px){body{flex-direction:column}.left{flex:none;height:200px}.right{padding:40px 24px}h1{font-size:28px}}
</style>
</head>
<body>
<div class="left">
  <div class="globe-art">
    <svg viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>
      <ellipse cx="100" cy="100" rx="50" ry="80" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
      <ellipse cx="100" cy="100" rx="25" ry="80" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
      <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
      <line x1="30" y1="60" x2="170" y2="60" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <line x1="30" y1="140" x2="170" y2="140" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
      <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <line x1="40" y1="40" x2="160" y2="160" stroke="#ef4444" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
      <circle cx="100" cy="100" r="4" fill="rgba(99,102,241,0.6)"/>
    </svg>
  </div>
</div>
<div class="right">
  <div class="badge">REGION RESTRICTED</div>
  <h1>服务暂不可用</h1>
  <p class="main-msg">尊敬的阁下！根据您所在国政策，本站暂时无法为您提供服务。如有必要，可将本站交付至您可用地区同事进行操作。感谢理解！带来不便，敬请谅解！</p>
  <div class="alt-langs">
    <div class="alt-lang">Due to regional policies, this service is temporarily unavailable. Please ask colleagues in accessible regions to operate if needed.</div>
    <div class="alt-lang">地域ポリシーにより、当サービスは一時的にご利用いただけません。必要に応じてアクセス可能な地域の同僚にご依頼ください。</div>
    <div class="alt-lang">Ce service est temporairement indisponible dans votre région. Veuillez contacter vos collègues dans une région accessible si nécessaire.</div>
    <div class="alt-lang">Сервис временно недоступен в вашем регионе. При необходимости обратитесь к коллегам в доступном регионе.</div>
    <div class="alt-lang">Do chính sách khu vực, dịch vụ tạm thời không khả dụng. Vui lòng nhờ đồng nghiệp ở khu vực khả dụng nếu cần.</div>
  </div>
</div>
</body>
</html>`

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	// 静态资源（/assets/）不计入速率限制，只对页面请求限速
	router.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Next()
			return
		}
		middleware.GlobalWebRateLimit()(c)
	})
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", common.EmbedFolder(buildFS, "web/dist")))

	// Image Studio: 为子应用的目录入口提供 index.html
	imageStudioIndex, err := buildFS.ReadFile("web/dist/image-studio/index.html")
	if err == nil {
		serveImageStudio := func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", imageStudioIndex)
		}
		router.GET("/image-studio", serveImageStudio)
		router.GET("/image-studio/", serveImageStudio)
	}

	// GeoIP 封锁页面：直接返回后台配置的 HTML 内容
	router.GET("/blocked", func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		c.Header("Cache-Control", "no-cache")
		geoBlock := operation_setting.GetGeoBlockSetting()
		pageContent := geoBlock.PageContent
		if pageContent == "" {
			pageContent = defaultBlockedPageHTML
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(pageContent))
	})

	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")

		// GeoIP 封锁检查：命中则 302 重定向到 /blocked
		country := c.GetHeader("X-GeoIP-Country")
		if operation_setting.IsCountryBlocked(country) {
			c.Redirect(http.StatusFound, "/blocked")
			return
		}

		cdnSettings := operation_setting.GetCDNSetting()
		if cdnSettings.Enabled {
			country := c.GetHeader(cdnSettings.DetectHeader)
			if country != "" {
				cdnUrl := operation_setting.GetCDNUrlForCountry(country)
				if cdnUrl != "" {
					modifiedPage := bytes.ReplaceAll(indexPage, []byte("/assets/"), []byte(cdnUrl+"/assets/"))
					modifiedPage = bytes.Replace(modifiedPage, []byte("<head>"), []byte(`<head><meta name="cdn-url" content="`+cdnUrl+`">`), 1)
					c.Data(http.StatusOK, "text/html; charset=utf-8", modifiedPage)
					return
				}
			}
		}

		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}
