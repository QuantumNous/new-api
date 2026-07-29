package router

import (
	"bytes"
	"html"

	"github.com/QuantumNous/new-api/common"
)

var (
	brandTitlePlaceholder      = []byte("<title>New API</title>")
	brandAppleTitlePlaceholder = []byte(
		`<meta name="apple-mobile-web-app-title" content="New API" />`,
	)
	// 各前端构建产物里的默认 favicon 引用（default/classic 用 /logo.png，移动端用 /m/favicon.ico）
	brandFaviconPlaceholders = [][]byte{
		[]byte(`href="/logo.png"`),
		[]byte(`href="/m/favicon.ico"`),
		[]byte(`href="/m/icon-192.png"`),
	}
)

type mobileManifestIcon struct {
	Src     string `json:"src"`
	Sizes   string `json:"sizes"`
	Type    string `json:"type,omitempty"`
	Purpose string `json:"purpose,omitempty"`
}

type mobileManifest struct {
	ID              string               `json:"id"`
	Name            string               `json:"name"`
	ShortName       string               `json:"short_name"`
	StartURL        string               `json:"start_url"`
	Scope           string               `json:"scope"`
	Display         string               `json:"display"`
	BackgroundColor string               `json:"background_color"`
	ThemeColor      string               `json:"theme_color"`
	Lang            string               `json:"lang"`
	Icons           []mobileManifestIcon `json:"icons"`
}

func currentBrand() (string, string) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	name := common.SystemName
	if name == "" {
		name = "New API"
	}
	return name, common.Logo
}

// BrandIndexHTML 在服务端渲染 index.html 时把构建期写死的默认标题/图标
// 替换为运营配置的站点名称与 logo，消除首屏闪现默认品牌的问题
// （前端 JS 要等 /api/status 返回才能改 document.title，首访必闪）。
// 未配置时保持构建产物原样。每次请求替换一次，index 仅数 KB，开销可忽略，
// 且天然跟随运行时的配置变更。
func BrandIndexHTML(page []byte) []byte {
	name, logo := currentBrand()
	if name != "New API" {
		escapedName := html.EscapeString(name)
		page = bytes.ReplaceAll(page, brandTitlePlaceholder,
			[]byte("<title>"+escapedName+"</title>"))
		page = bytes.ReplaceAll(page, brandAppleTitlePlaceholder,
			[]byte(`<meta name="apple-mobile-web-app-title" content="`+escapedName+`" />`))
	}
	if logo != "" {
		replacement := []byte(`href="` + html.EscapeString(logo) + `"`)
		for _, placeholder := range brandFaviconPlaceholders {
			page = bytes.ReplaceAll(page, placeholder, replacement)
		}
	}
	return page
}

// MobileWebManifest 返回跟随运营个性化设置的移动端 PWA 清单。
// Chromium 使用 manifest 的名称与图标；iOS 对应的兜底标签由 BrandIndexHTML 注入。
func MobileWebManifest() ([]byte, error) {
	name, logo := currentBrand()
	icons := []mobileManifestIcon{
		{
			Src:   "/m/icon-192.png",
			Sizes: "192x192",
			Type:  "image/png",
		},
		{
			Src:   "/m/icon-512.png",
			Sizes: "512x512",
			Type:  "image/png",
		},
	}
	if logo != "" {
		// Logo 地址的实际格式由运营配置决定，因此不写死 type。
		// 同一地址声明两种安装尺寸，让 Chromium 直接采用个性化 Logo。
		icons = []mobileManifestIcon{
			{Src: logo, Sizes: "192x192", Purpose: "any"},
			{Src: logo, Sizes: "512x512", Purpose: "any"},
		}
	}

	return common.Marshal(mobileManifest{
		ID:              "/m/",
		Name:            name,
		ShortName:       name,
		StartURL:        "/m/",
		Scope:           "/m/",
		Display:         "standalone",
		BackgroundColor: "#ffffff",
		ThemeColor:      "#ffffff",
		Lang:            "zh-CN",
		Icons:           icons,
	})
}
