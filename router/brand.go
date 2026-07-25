package router

import (
	"bytes"
	"html"

	"github.com/QuantumNous/new-api/common"
)

var (
	brandTitlePlaceholder = []byte("<title>New API</title>")
	// 各前端构建产物里的默认 favicon 引用（default/classic 用 /logo.png，移动端用 /m/favicon.ico）
	brandFaviconPlaceholders = [][]byte{
		[]byte(`href="/logo.png"`),
		[]byte(`href="/m/favicon.ico"`),
	}
)

// BrandIndexHTML 在服务端渲染 index.html 时把构建期写死的默认标题/图标
// 替换为运营配置的站点名称与 logo，消除首屏闪现默认品牌的问题
// （前端 JS 要等 /api/status 返回才能改 document.title，首访必闪）。
// 未配置时保持构建产物原样。每次请求替换一次，index 仅数 KB，开销可忽略，
// 且天然跟随运行时的配置变更。
func BrandIndexHTML(page []byte) []byte {
	if name := common.SystemName; name != "" && name != "New API" {
		page = bytes.ReplaceAll(page, brandTitlePlaceholder,
			[]byte("<title>"+html.EscapeString(name)+"</title>"))
	}
	if logo := common.Logo; logo != "" {
		replacement := []byte(`href="` + html.EscapeString(logo) + `"`)
		for _, placeholder := range brandFaviconPlaceholders {
			page = bytes.ReplaceAll(page, placeholder, replacement)
		}
	}
	return page
}
